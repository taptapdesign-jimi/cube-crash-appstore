const TNT_BONUS_TILE_OWNED_FLAG = '_ccTntBonusOwned';

/**
 * TNT may continue replacing a small, preselected set of tiles after the rest
 * of the board is safe to use. Keep that ownership local to those exact tile
 * objects so ordinary stacks elsewhere do not need a global input lock.
 */
export function isTntBonusTileOwned(tile: any): boolean {
  return !!tile && !tile.destroyed && tile[TNT_BONUS_TILE_OWNED_FLAG] === true;
}

export function claimTntBonusTiles(tiles: readonly any[]): void {
  tiles.forEach((tile) => {
    if (!tile || tile.destroyed) return;
    tile[TNT_BONUS_TILE_OWNED_FLAG] = true;
  });
}

export function releaseTntBonusTile(tile: any): void {
  if (!tile) return;
  try { delete tile[TNT_BONUS_TILE_OWNED_FLAG]; } catch {
    try { tile[TNT_BONUS_TILE_OWNED_FLAG] = false; } catch {}
  }
}

export function releaseTntBonusTiles(tiles: readonly any[]): void {
  tiles.forEach(releaseTntBonusTile);
}
