import { isWildLikeSpecial } from './final-merge-rules.ts';
import { getCompatibleSpecialDiceVariant } from './special-dice-registry.ts';

export const GAME_SAVE_SCHEMA_VERSION = 2;
export const LEGACY_GAME_SAVE_SCHEMA_VERSION = 1;
const MAX_SAVED_BOARD_NUMBER = 10_000;
const MAX_SAVED_MOVES = 1_000;
const MAX_SAVED_WILD_METER = 10;

export type SaveValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type ValidatedTileSnapshot = {
  value: number;
  special: string | null;
  specialDiceVariant: string | null;
  locked: boolean;
  open: boolean;
  isWild: boolean;
  isWildFace: boolean;
  gridX: number;
  gridY: number;
};

export type ValidatedGameSave = Record<string, any> & {
  schemaVersion: number;
  grid: Array<Array<ValidatedTileSnapshot | null>>;
};

export class GameSaveValidationError extends Error {
  readonly issues: SaveValidationIssue[];

  constructor(issues: SaveValidationIssue[]) {
    super(`Invalid game save (${issues.length} issue${issues.length === 1 ? '' : 's'})`);
    this.name = 'GameSaveValidationError';
    this.issues = issues;
  }
}

type ValidateGameSaveOptions = {
  rows: number;
  cols: number;
  allowLegacy?: boolean;
};

function issue(code: string, path: string, message: string): SaveValidationIssue {
  return { code, path, message };
}

function validateFiniteNumber(
  value: unknown,
  path: string,
  issues: SaveValidationIssue[],
  { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false, fallback = 0 } = {},
): number {
  if (value == null) return fallback;
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || Number(value) < min || Number(value) > max) {
    issues.push(issue('invalid-scalar', path, `${path} is outside its supported numeric range.`));
    return fallback;
  }
  return Number(value);
}

function normalizeLegacySpecial(special: unknown): string | null {
  if (special === 'wild-' + 'b' + 'e' + 'e' + 'r') return 'wild-juice';
  return typeof special === 'string' && special.length > 0 ? special : null;
}

function validateTileSnapshot(
  raw: any,
  c: number,
  r: number,
  path: string,
  issues: SaveValidationIssue[],
): ValidatedTileSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push(issue('invalid-tile', path, 'Tile snapshot must be an object or null.'));
    return null;
  }

  const rawGridX = raw.gridX == null ? c : raw.gridX;
  const rawGridY = raw.gridY == null ? r : raw.gridY;
  if (!Number.isInteger(rawGridX) || !Number.isInteger(rawGridY) || rawGridX !== c || rawGridY !== r) {
    issues.push(issue('coordinate-mismatch', path, `Tile coordinates must match owning grid cell (${c}, ${r}).`));
  }

  const value = raw.value;
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    issues.push(issue('invalid-value', `${path}.value`, 'Tile value must be an integer from 0 through 6.'));
  }

  const special = normalizeLegacySpecial(raw.special);
  if (raw.special != null && !special) {
    issues.push(issue('invalid-special', `${path}.special`, 'Special identity must be a non-empty string or null.'));
  }
  if (special && !isWildLikeSpecial(special)) {
    issues.push(issue('invalid-special', `${path}.special`, `Unsupported special identity: ${String(special)}.`));
  }

  const locked = raw.locked === true;
  const open = typeof raw.open === 'boolean' ? raw.open : !locked;
  if (typeof raw.open === 'boolean' && raw.open === locked) {
    issues.push(issue('lock-open-conflict', path, '`open` must be the inverse of `locked`.'));
  }

  if (Number.isInteger(value)) {
    if (!special && value === 6) {
      issues.push(issue('transient-merge6', path, 'A plain value-6 tile is a transient merge result and cannot be restored.'));
    }
    if (special && value !== 6) {
      issues.push(issue('special-value-mismatch', path, 'A special tile must have value 6.'));
    }
    if (value === 0 && (!locked || special)) {
      issues.push(issue('invalid-placeholder', path, 'Value 0 is only valid for a locked regular placeholder.'));
    }
  }

  const rawVariant = raw.specialDiceVariant ?? raw._ccSpecialDiceVariant ?? null;
  if (rawVariant != null && typeof rawVariant !== 'string') {
    issues.push(issue('invalid-variant', `${path}.specialDiceVariant`, 'Variant identity must be a string or null.'));
  }
  const compatibleVariant = getCompatibleSpecialDiceVariant(rawVariant, special);
  if (rawVariant && !compatibleVariant) {
    issues.push(issue('variant-archetype-mismatch', path, `Variant ${String(rawVariant)} is not compatible with ${special || 'a regular tile'}.`));
  }

  const rawWild = raw.isWild === true || raw.isWildFace === true;
  if (rawWild && !special) {
    issues.push(issue('wild-identity-mismatch', path, 'Wild flags require a visible special identity.'));
  }

  return {
    value: Number.isInteger(value) ? value : 0,
    special,
    specialDiceVariant: compatibleVariant?.id || null,
    locked,
    open,
    isWild: !!special,
    isWildFace: !!special,
    gridX: c,
    gridY: r,
  };
}

function buildLegacyGrid(
  tiles: any[],
  rows: number,
  cols: number,
  issues: SaveValidationIssue[],
): any[][] {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  const occupied = new Set<string>();

  tiles.forEach((tile, index) => {
    const path = `tiles[${index}]`;
    if (!tile || typeof tile !== 'object' || tile.destroyed === true) return;
    const c = tile.gridX;
    const r = tile.gridY;
    if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || c >= cols || r < 0 || r >= rows) {
      issues.push(issue('out-of-bounds', path, 'Tile coordinates are outside the board.'));
      return;
    }
    const key = `${c},${r}`;
    if (occupied.has(key)) {
      issues.push(issue('duplicate-cell', path, `More than one tile claims grid cell (${c}, ${r}).`));
      return;
    }
    occupied.add(key);
    grid[r][c] = tile;
  });

  return grid;
}

export function validateAndNormalizeGameSave(
  raw: unknown,
  { rows, cols, allowLegacy = true }: ValidateGameSaveOptions,
): { ok: true; gameState: ValidatedGameSave; migratedLegacy: boolean } | { ok: false; issues: SaveValidationIssue[] } {
  const issues: SaveValidationIssue[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, issues: [issue('invalid-root', '$', 'Saved game must be an object.')] };
  }
  if (!Number.isInteger(rows) || rows <= 0 || !Number.isInteger(cols) || cols <= 0) {
    return { ok: false, issues: [issue('invalid-dimensions', '$', 'Expected board dimensions are invalid.')] };
  }

  const source = raw as Record<string, any>;
  const hasVersion = source.schemaVersion != null;
  const schemaVersion = hasVersion ? source.schemaVersion : LEGACY_GAME_SAVE_SCHEMA_VERSION;
  if (!Number.isInteger(schemaVersion) || schemaVersion < LEGACY_GAME_SAVE_SCHEMA_VERSION || schemaVersion > GAME_SAVE_SCHEMA_VERSION) {
    issues.push(issue('unsupported-schema-version', 'schemaVersion', `Supported schema versions are 1 through ${GAME_SAVE_SCHEMA_VERSION}.`));
  }
  if (!hasVersion && !allowLegacy) {
    issues.push(issue('missing-schema-version', 'schemaVersion', 'A schema version is required.'));
  }


  const normalizedBoardNumber = validateFiniteNumber(source.boardNumber ?? source.level, 'boardNumber', issues, {
    min: 1,
    max: MAX_SAVED_BOARD_NUMBER,
    integer: true,
    fallback: 1,
  });
  const normalizedLevel = validateFiniteNumber(source.level ?? normalizedBoardNumber, 'level', issues, {
    min: 1,
    max: MAX_SAVED_BOARD_NUMBER,
    integer: true,
    fallback: normalizedBoardNumber,
  });
  if (normalizedLevel !== normalizedBoardNumber) {
    issues.push(issue('board-level-mismatch', 'level', 'Saved level must match the board identity.'));
  }
  const normalizedMoves = validateFiniteNumber(source.moves, 'moves', issues, {
    min: 0,
    max: MAX_SAVED_MOVES,
    integer: true,
    fallback: 50,
  });
  const normalizedWildMeter = validateFiniteNumber(source.wildMeter, 'wildMeter', issues, {
    min: 0,
    max: MAX_SAVED_WILD_METER,
    fallback: 0,
  });
  const normalizedScore = validateFiniteNumber(source.score, 'score', issues);
  const normalizedBestScore = validateFiniteNumber(source.bestScore, 'bestScore', issues);
  const normalizedStarsCount = validateFiniteNumber(source.starsCount, 'starsCount', issues, { integer: true });

  let sourceGrid = source.grid;
  if ((!Array.isArray(sourceGrid) || sourceGrid.length === 0) && Array.isArray(source.tiles)) {
    sourceGrid = buildLegacyGrid(source.tiles, rows, cols, issues);
  }

  if (!Array.isArray(sourceGrid) || sourceGrid.length !== rows) {
    issues.push(issue('invalid-grid-shape', 'grid', `Grid must contain exactly ${rows} rows.`));
  }

  const normalizedGrid: Array<Array<ValidatedTileSnapshot | null>> = Array.from(
    { length: rows },
    () => Array(cols).fill(null),
  );
  if (Array.isArray(sourceGrid)) {
    for (let r = 0; r < rows; r++) {
      const row = sourceGrid[r];
      if (!Array.isArray(row) || row.length !== cols) {
        issues.push(issue('invalid-grid-shape', `grid[${r}]`, `Grid row must contain exactly ${cols} columns.`));
        continue;
      }
      for (let c = 0; c < cols; c++) {
        const rawTile = row[c];
        if (rawTile == null) continue;
        normalizedGrid[r][c] = validateTileSnapshot(rawTile, c, r, `grid[${r}][${c}]`, issues);
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    gameState: {
      ...source,
      schemaVersion: GAME_SAVE_SCHEMA_VERSION,
      boardNumber: normalizedBoardNumber,
      level: normalizedLevel,
      moves: normalizedMoves,
      wildMeter: normalizedWildMeter,
      score: normalizedScore,
      bestScore: normalizedBestScore,
      starsCount: normalizedStarsCount,
      grid: normalizedGrid,
    },
    migratedLegacy: !hasVersion || schemaVersion < GAME_SAVE_SCHEMA_VERSION,
  };
}

export function assertValidGameSave(raw: unknown, options: ValidateGameSaveOptions): ValidatedGameSave {
  const result = validateAndNormalizeGameSave(raw, options);
  if ('issues' in result) throw new GameSaveValidationError(result.issues);
  return result.gameState;
}

export function stampCurrentGameSaveSchema<T extends Record<string, any>>(
  gameState: T,
): T & { schemaVersion: number } {
  return {
    ...gameState,
    schemaVersion: GAME_SAVE_SCHEMA_VERSION,
  };
}
