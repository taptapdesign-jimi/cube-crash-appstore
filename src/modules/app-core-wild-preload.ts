type WildPreloadDeps = {
  tiles: any[];
  devLog: (...args: any[]) => void;
};

/**
 * Active = visible, not destroyed, has value > 0 or is wild.
 */
function getActiveTiles(tiles: any[]): any[] {
  return tiles.filter((t: any) => {
    if (!t || t.destroyed) return false;
    const isWild = t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-juice' || t.special === 'wild-tnt';
    const hasValue = (t.value | 0) > 0;
    return isWild || hasValue;
  });
}

/**
 * Block wild preloader ONLY when board is in "last merge" state:
 * exactly 1 tile on board and that tile is merge-6 (value === 6).
 * In that case we do NOT spawn a new wild (clean board is next).
 * In all other cases (0 tiles, 2+ tiles, or 1 tile that isn't merge-6) we allow wild spawn.
 * We do NOT rely on _isLastMerge flag — only on actual tile count and the single tile's value.
 */
export function hasLastMergeTile({ tiles, devLog }: WildPreloadDeps): boolean {
  const active = getActiveTiles(tiles);
  const activeCount = active.length;

  // Clear stale _isLastMerge whenever we have 2+ tiles so merge logic stays consistent
  if (activeCount > 1) {
    tiles.forEach((t: any) => {
      if (t && !t.destroyed && t.value === 6 && (t as any)?._isLastMerge === true) {
        (t as any)._isLastMerge = false;
      }
    });
    return false;
  }

  // Block only when exactly 1 tile and it's merge-6 (last merge → clean board)
  if (activeCount === 1 && active[0] && (active[0].value | 0) === 6) {
    devLog('🚨 Preload bar blocked: exactly 1 tile (merge-6) — last merge, clean board next');
    return true;
  }

  return false;
}
