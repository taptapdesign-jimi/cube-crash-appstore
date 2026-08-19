import { getCompatibleSpecialDiceVariant } from './special-dice-registry.ts';

export type BoardSnapshotIssue = {
  code: string;
  message: string;
  gridX?: number;
  gridY?: number;
};

export class BoardSnapshotIntegrityError extends Error {
  readonly issues: BoardSnapshotIssue[];

  constructor(issues: BoardSnapshotIssue[]) {
    super(`Board is not safe to save (${issues.length} issue${issues.length === 1 ? '' : 's'})`);
    this.name = 'BoardSnapshotIntegrityError';
    this.issues = issues;
  }
}

type SaveTilesDeps = {
  ROWS: number;
  COLS: number;
  tiles: any[];
  grid: any[][];
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function buildGridSnapshot({
  ROWS,
  COLS,
  tiles,
  grid,
  devLog,
  devWarn,
}: SaveTilesDeps){
  const getSerializableVariantId = (tile: any): string | null => {
    const id = tile?._ccSpecialDiceVariant || tile?.specialDiceVariant || null;
    return getCompatibleSpecialDiceVariant(id, tile?.special)?.id || null;
  };
  const gridSnapshot = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const issues: BoardSnapshotIssue[] = [];
  const liveTileSet = new Set((Array.isArray(tiles) ? tiles : []).filter((tile) => tile && !tile.destroyed));
  const gridOwnerSet = new Set<any>();
  const claimedCells = new Map<string, any>();

  const addIssue = (code: string, message: string, gridX?: number, gridY?: number) => {
    const entry = { code, message, gridX, gridY };
    issues.push(entry);
    devWarn('⚠️ Board snapshot rejected:', entry);
  };
  const hasActiveTween = (tween: any): boolean => {
    if (!tween) return false;
    try {
      return typeof tween.isActive === 'function' ? tween.isActive() : tween.isActive === true;
    } catch {
      return true;
    }
  };
  const isTransient = (tile: any): boolean =>
    tile._pendingRemoval === true ||
    tile._beingRemoved === true ||
    tile._cleanupQueued === true ||
    tile._isBeingSpawned === true ||
    tile._ccWildSpawnDropping === true ||
    tile._ccWildSpawnHandoffLock === true ||
    tile._wildMagnetAffected === true ||
    tile._ccSpecialDiceResolving === true ||
    typeof tile._ccMerge6CleanupToken === 'number' ||
    hasActiveTween(tile._spawnTween);

  if (!Array.isArray(grid) || grid.length !== ROWS) {
    addIssue('invalid-grid-shape', `Grid must contain exactly ${ROWS} rows.`);
  }

  for (let r = 0; r < ROWS; r++) {
    if (!Array.isArray(grid?.[r]) || grid[r].length !== COLS) {
      addIssue('invalid-grid-shape', `Grid row ${r} must contain exactly ${COLS} columns.`, undefined, r);
      continue;
    }
    for (let c = 0; c < COLS; c++) {
      const gridTile = grid[r]?.[c];
      if (!gridTile) continue;
      if (gridTile.destroyed) {
        addIssue('destroyed-grid-owner', 'Grid points to a destroyed tile.', c, r);
        continue;
      }
      gridOwnerSet.add(gridTile);
      if (!liveTileSet.has(gridTile)) {
        addIssue('grid-owner-missing-from-tiles', 'Authoritative grid owner is missing from the live tile registry.', c, r);
      }
      if ((gridTile.gridX | 0) !== c || (gridTile.gridY | 0) !== r) {
        addIssue('coordinate-mismatch', 'Tile coordinates do not match its authoritative grid cell.', c, r);
      }
      if (isTransient(gridTile)) {
        addIssue('transient-grid-owner', 'Tile is in a transient gameplay lifecycle and cannot be saved.', c, r);
      }

      const tileValue = gridTile.value;
      if (!Number.isInteger(tileValue) || tileValue < 0 || tileValue > 6) {
        addIssue('invalid-value', 'Tile value must be an integer from 0 through 6.', c, r);
        continue;
      }
      const special = gridTile.special || null;
      if (!special && tileValue === 6) {
        addIssue('transient-merge6', 'A plain value-6 result must settle before saving.', c, r);
      }
      if (special && tileValue !== 6) {
        addIssue('special-value-mismatch', 'A special tile must have value 6.', c, r);
      }
      if (tileValue === 0 && (!gridTile.locked || special)) {
        addIssue('invalid-placeholder', 'Value 0 is only valid for a locked regular placeholder.', c, r);
      }
      const isPlayable = !gridTile.locked && (tileValue > 0 || !!special);
      if (isPlayable && (
        gridTile.visible === false ||
        (typeof gridTile.alpha === 'number' && gridTile.alpha <= 0.01) ||
        gridTile.eventMode === 'none' ||
        gridTile.eventMode === 'passive'
      )) {
        addIssue('passive-playable-tile', 'A playable tile is hidden or non-interactive.', c, r);
      }

      const tileSnapshot = {
        value: tileValue,
        special,
        specialDiceVariant: getSerializableVariantId(gridTile),
        locked: !!gridTile.locked,
        open: !gridTile.locked,
        isWild: !!gridTile.isWild,
        isWildFace: !!gridTile.isWildFace,
        gridX: c,
        gridY: r,
      };
      
      gridSnapshot[r][c] = tileSnapshot;
    }
  }

  liveTileSet.forEach((tile: any) => {
    const c = Number.isInteger(tile.gridX) ? tile.gridX : -1;
    const r = Number.isInteger(tile.gridY) ? tile.gridY : -1;
    const key = `${c},${r}`;
    const prior = claimedCells.get(key);
    if (prior && prior !== tile) {
      addIssue('duplicate-cell-claim', 'More than one live tile claims the same grid cell.', c, r);
    } else {
      claimedCells.set(key, tile);
    }
    if (!gridOwnerSet.has(tile)) {
      addIssue('orphan-live-tile', 'A live tile is not the authoritative owner of any grid cell.', c, r);
    }
  });

  if (issues.length > 0) throw new BoardSnapshotIntegrityError(issues);

  const savedTilesCount = gridOwnerSet.size;
  devLog('💾 Saved', savedTilesCount, 'tiles from authoritative grid identity');
  return { gridSnapshot, savedTilesCount };
}
