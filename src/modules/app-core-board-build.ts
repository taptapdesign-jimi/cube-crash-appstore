type LockedHolderDeps = {
  ROWS: number;
  COLS: number;
  board: any;
  grid: any;
  tiles: any[];
  makeBoard: any;
  fixHoverAnchor: (t: any) => void;
};

export function createLockedHolders(deps: LockedHolderDeps) {
  const { ROWS, COLS, board, grid, tiles, makeBoard, fixHoverAnchor } = deps;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      makeBoard.createTile({ board, grid, tiles, c, r, val: 0, locked: true });
      fixHoverAnchor(grid[r][c]);
    }
  }
}

/** Reduced alpha for locked ghost placeholders (matches app-board.ts locked tile style) */
const LOCKED_PLACEHOLDER_ALPHA = 0.25;

/**
 * Fill only null/empty cells with locked placeholders (ghost tiles).
 * Used after magnet spawn to ensure board has locked tiles like regular merge-6 flow.
 * Regular merge-6 uses openLockedBounceParallel which opens existing locked tiles;
 * magnet spawn uses openAtCell on null cells, so we need to create placeholders for holes.
 * Locked placeholders use reduced alpha (0.25) for ghost appearance.
 */
export function fillNullCellsWithLockedPlaceholders(
  deps: LockedHolderDeps,
  options?: { cells?: Array<{ c: number; r: number }> }
) {
  const { ROWS, COLS, board, grid, tiles, makeBoard, fixHoverAnchor } = deps;
  if (!grid || !board) return;
  const createTileFn = makeBoard?.createTile ?? (makeBoard as any)?.default?.createTile;
  if (typeof createTileFn !== 'function') return;
  let filled = 0;
  const targetCells = Array.isArray(options?.cells) ? options?.cells : null;
  const tryFillCell = (c: number, r: number) => {
    const cell = grid[r]?.[c];
    if (cell == null || (cell && (cell as any).destroyed)) {
      try {
        const t = createTileFn({ board, grid, tiles, c, r, val: 0, locked: true });
        if (t) {
          t.alpha = LOCKED_PLACEHOLDER_ALPHA;
          if (t.rotG) t.rotG.alpha = LOCKED_PLACEHOLDER_ALPHA;
          if (t.base) t.base.alpha = LOCKED_PLACEHOLDER_ALPHA;
          try { fixHoverAnchor(t); } catch {}
          filled++;
        }
      } catch (err) {
        try {
          const logger = (window as any).logger;
          if (logger?.warn) logger.warn('🧲 fillNullCellsWithLockedPlaceholders: Failed at', c, r, err);
        } catch {}
      }
    }
  };
  if (targetCells && targetCells.length > 0) {
    for (const cell of targetCells) {
      if (!cell) continue;
      tryFillCell(cell.c, cell.r);
    }
  } else {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        tryFillCell(c, r);
      }
    }
  }
  if (filled > 0) {
    try {
      const logger = (window as any).logger;
      if (logger?.info) logger.info('🧲 fillNullCellsWithLockedPlaceholders: Created', filled, 'locked placeholders after magnet spawn');
    } catch {}
  }
}
