type RandomEmptyDeps = {
  ROWS: number;
  COLS: number;
  grid: any[][];
  /** Cells to exclude (e.g. drag-origin while drag is active — grid is temporarily null there). */
  excludeCells?: { r: number; c: number }[];
};

/**
 * Returns a random cell that is safe for spawning (wild or normal tile).
 * Returns cells that are either:
 * 1. GHOST PLACEHOLDERS (locked, value <= 0) — normal/early game
 * 2. NULL (no tile) — end game when there are no locked tiles; wild spawn must still work.
 * We must NEVER return cells with active tile (value > 0) or wild.
 * excludeCells: when drag is active, pass drag-origin so we never spawn there.
 */
export function getRandomEmptyCell({ ROWS, COLS, grid, excludeCells = [] }: RandomEmptyDeps){
  const excludeSet = new Set(excludeCells.map(({ r, c }) => `${r},${c}`));
  const empties: { c: number; r: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (excludeSet.has(`${r},${c}`)) continue;
      const t = grid[r]?.[c];
      if (!t) {
        // End game: no placeholder, cell is null — still valid for wild spawn (openAtCell will create tile)
        empties.push({ c, r });
        continue;
      }
      const isWildTile = !!(t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer' || t.special === 'wild-tnt' || (t as any).isWild === true || (t as any).isWildFace === true);
      const hasValue = (t.value | 0) > 0;
      const isLockedPlaceholder = t.locked === true && (t.value | 0) <= 0;
      if (isWildTile || hasValue) continue;
      if (isLockedPlaceholder) empties.push({ c, r });
    }
  }
  if (!empties.length) return null;
  return empties[(Math.random() * empties.length) | 0];
}
