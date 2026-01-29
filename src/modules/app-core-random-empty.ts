type RandomEmptyDeps = {
  ROWS: number;
  COLS: number;
  grid: any[][];
  /** Cells to exclude (e.g. drag-origin while drag is active — grid is temporarily null there). */
  excludeCells?: { r: number; c: number }[];
};

/**
 * Returns a random cell that is safe for spawning (wild or normal tile).
 * CRITICAL: Only returns cells that are GHOST PLACEHOLDERS (locked, value <= 0).
 * We must NEVER return:
 * - Cells with no tile (null) — could be drag-origin or race; wild must go on visible ghost only.
 * - Cells with active tile (value > 0) or wild — would spawn "on top" of content.
 * So: wild spawn ONLY on ghost placeholders (empty spots with a locked placeholder), never on active/closed tiles.
 * excludeCells: when drag is active, pass drag-origin so we never spawn there.
 */
export function getRandomEmptyCell({ ROWS, COLS, grid, excludeCells = [] }: RandomEmptyDeps){
  const excludeSet = new Set(excludeCells.map(({ r, c }) => `${r},${c}`));
  const empties: { c: number; r: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (excludeSet.has(`${r},${c}`)) continue;
      const t = grid[r]?.[c];
      if (!t) continue; // 🔥 Only ghost placeholders: skip null (no tile)
      const isWildTile = !!(t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer' || (t as any).isWild === true || (t as any).isWildFace === true);
      const hasValue = (t.value | 0) > 0;
      const isLockedPlaceholder = t.locked === true && (t.value | 0) <= 0;
      if (isWildTile || hasValue) continue;
      if (isLockedPlaceholder) empties.push({ c, r });
    }
  }
  if (!empties.length) return null;
  return empties[(Math.random() * empties.length) | 0];
}
