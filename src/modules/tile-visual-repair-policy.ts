export function hasOwnedOuterTileTransform(tile: any, activeDragTile: any = null): boolean {
  return !!tile && (
    tile === activeDragTile ||
    tile._idleBounceTl != null ||
    tile._mergeImpactTl != null ||
    tile._ccPickupScaleTimeline != null ||
    tile._ccSnapBackTimeline != null ||
    tile._ccLaserGunImpactTl != null ||
    tile._ccTntBonusOwned === true ||
    tile._isBeingSpawned === true ||
    tile._pendingRemoval === true ||
    tile._beingRemoved === true ||
    tile._cleanupQueued === true ||
    tile._skipIdleScaleReset === true
  );
}

export function repairUnownedCollapsedTileScale({
  tile,
  activeDragTile = null,
  threshold = 0.86,
  killScaleTweens,
}: {
  tile: any;
  activeDragTile?: any;
  threshold?: number;
  killScaleTweens?: (scale: any) => void;
}): boolean {
  if (!tile || tile.destroyed || tile.visible === false) return false;
  if (hasOwnedOuterTileTransform(tile, activeDragTile)) return false;
  const sx = Number.isFinite(tile.scale?.x) ? tile.scale.x : 1;
  const sy = Number.isFinite(tile.scale?.y) ? tile.scale.y : 1;
  if (Math.min(sx, sy) >= threshold) return false;
  try { killScaleTweens?.(tile.scale); } catch {}
  try {
    if (tile.scale?.set) tile.scale.set(1, 1);
    else if (tile.scale) {
      tile.scale.x = 1;
      tile.scale.y = 1;
    }
  } catch {}
  try { tile._isBeingSpawned = false; } catch {}
  return true;
}
