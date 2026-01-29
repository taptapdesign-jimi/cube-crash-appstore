import { COLS, ROWS } from './constants.js';
import type { Tile } from '../types/game-types.js';

type ReplayTileSnapshot = {
  value: number;
  special: string | null;
  locked: boolean;
  open: boolean;
  isWild: boolean;
  isWildFace: boolean;
  gridX: number;
  gridY: number;
};

type ReplaySnapshot = {
  grid: (ReplayTileSnapshot | null)[][];
  score: number;
  level: number;
  boardNumber: number;
  moves: number;
  wildMeter: number;
  starsCount: number;
};

type ReplayStep = {
  type: string;
  meta?: Record<string, unknown>;
  before?: ReplaySnapshot;
  after?: ReplaySnapshot;
};

type ReplayDeps = {
  tiles: Tile[];
  getGrid: () => (Tile | null)[][];
  getScore: () => number;
  getLevel: () => number;
  getBoardNumber: () => number;
  getMoves: () => number;
  getWildMeter: () => number;
  getStarsCount: () => number;
};

export function createReplayRecorder(deps: ReplayDeps) {
  let mode: 'off' | 'record' | 'verify' = 'off';
  let steps: ReplayStep[] = [];
  let stepIndex = 0;
  let lastError: string | null = null;

  const snapshotTile = (tile: Tile, gridX: number, gridY: number): ReplayTileSnapshot => ({
    value: Number.isFinite(tile?.value) ? (tile.value as number) : 0,
    special: (tile as any)?.special || null,
    locked: !!tile?.locked,
    open: !tile?.locked,
    isWild: !!(tile as any)?.isWild,
    isWildFace: !!(tile as any)?.isWildFace,
    gridX,
    gridY,
  });

  const buildSnapshot = (): ReplaySnapshot => {
    const gridSnapshot = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

    deps.tiles.forEach((tile: Tile) => {
      if (!tile || tile.destroyed) return;
      const tileValue = tile.value;
      if (tileValue === null || tileValue === undefined || !Number.isFinite(tileValue) || tileValue < 0) return;
      const gridX = Number.isFinite(tile.gridX) ? (tile.gridX as number | 0) : -1;
      const gridY = Number.isFinite(tile.gridY) ? (tile.gridY as number | 0) : -1;
      if (gridX < 0 || gridX >= COLS || gridY < 0 || gridY >= ROWS) return;
      const tileSnapshot = snapshotTile(tile, gridX, gridY);
      if (gridSnapshot[gridY] && gridSnapshot[gridY][gridX] === null) {
        gridSnapshot[gridY][gridX] = tileSnapshot;
      } else if (gridSnapshot[gridY]) {
        gridSnapshot[gridY][gridX] = tileSnapshot;
      }
    });

    const grid = deps.getGrid();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (gridSnapshot[r]?.[c]) continue;
        const gridTile = grid?.[r]?.[c] as Tile | null | undefined;
        if (!gridTile || gridTile.destroyed) continue;
        const tileValue = gridTile.value;
        if (tileValue === null || tileValue === undefined || !Number.isFinite(tileValue) || tileValue < 0) continue;
        gridSnapshot[r][c] = snapshotTile(gridTile, c, r);
      }
    }

    return {
      grid: gridSnapshot,
      score: deps.getScore(),
      level: deps.getLevel(),
      boardNumber: deps.getBoardNumber(),
      moves: deps.getMoves(),
      wildMeter: deps.getWildMeter(),
      starsCount: deps.getStarsCount(),
    };
  };

  const compareSnapshots = (a: ReplaySnapshot | undefined, b: ReplaySnapshot | undefined) => {
    if (!a || !b) return 'Missing snapshot';
    const keys: Array<keyof ReplaySnapshot> = ['score', 'level', 'boardNumber', 'moves', 'wildMeter', 'starsCount', 'grid'];
    for (const k of keys) {
      if (k === 'grid') continue;
      if (a[k] !== b[k]) return `Mismatch ${String(k)}: ${a[k]} != ${b[k]}`;
    }
    if (!Array.isArray(a.grid) || !Array.isArray(b.grid)) return 'Grid missing';
    if (a.grid.length !== b.grid.length) return 'Grid rows mismatch';
    for (let r = 0; r < a.grid.length; r++) {
      const rowA = a.grid[r];
      const rowB = b.grid[r];
      if (!Array.isArray(rowA) || !Array.isArray(rowB) || rowA.length !== rowB.length) {
        return `Grid cols mismatch at row ${r}`;
      }
      for (let c = 0; c < rowA.length; c++) {
        const ta = rowA[c];
        const tb = rowB[c];
        if (!ta && !tb) continue;
        if (!ta || !tb) return `Tile presence mismatch at ${r},${c}`;
        if ((ta.value | 0) !== (tb.value | 0)) return `Value mismatch at ${r},${c}`;
        if ((ta.special || null) !== (tb.special || null)) return `Special mismatch at ${r},${c}`;
        if (!!ta.locked !== !!tb.locked) return `Locked mismatch at ${r},${c}`;
      }
    }
    return null;
  };

  const beginStep = (type: string, meta?: Record<string, unknown>) => {
    if (mode === 'off') return null;
    const before = buildSnapshot();
    if (mode === 'record') {
      const step: ReplayStep = { type, meta, before };
      steps.push(step);
      return step;
    }
    if (mode === 'verify') {
      const expected = steps[stepIndex];
      if (!expected) {
        lastError = `Replay verify: missing expected step ${stepIndex}`;
        return null;
      }
      const beforeMismatch = compareSnapshots(before, expected.before);
      if (beforeMismatch) {
        lastError = `Replay verify before mismatch at step ${stepIndex}: ${beforeMismatch}`;
      }
      return expected;
    }
    return null;
  };

  const endStep = (token: ReplayStep | null, meta?: Record<string, unknown>) => {
    if (mode === 'off' || !token) return;
    const after = buildSnapshot();
    if (mode === 'record') {
      token.after = after;
      if (meta) token.meta = { ...(token.meta || {}), ...meta };
    } else if (mode === 'verify') {
      const expected = steps[stepIndex];
      const afterMismatch = compareSnapshots(after, expected?.after);
      if (afterMismatch) {
        lastError = `Replay verify after mismatch at step ${stepIndex}: ${afterMismatch}`;
      }
      stepIndex++;
    }
  };

  return {
    startRecord: () => { mode = 'record'; steps = []; stepIndex = 0; lastError = null; },
    startVerify: (importedSteps: ReplayStep[]) => { mode = 'verify'; steps = importedSteps || []; stepIndex = 0; lastError = null; },
    stop: () => { mode = 'off'; stepIndex = 0; },
    export: () => JSON.stringify({ steps }, null, 2),
    import: (json: string) => {
      try {
        const parsed = JSON.parse(json);
        steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
        return true;
      } catch {
        return false;
      }
    },
    status: () => ({ mode, steps: steps.length, stepIndex, lastError }),
    snapshot: () => buildSnapshot(),
    beginStep,
    endStep,
  };
}
