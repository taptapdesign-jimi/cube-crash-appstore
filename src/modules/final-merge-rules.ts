export type FinalMergeSnapshotInput = {
  activeTilesBeforeMerge: any[];
  src: any;
  dst: any;
  effSum: number;
  finalMergeBlockersBefore?: any[];
  isWildMagnetMerge?: boolean;
  hasTilesToPull?: boolean;
};

export type FinalMergeSnapshot = {
  activeSnapshotWasOnlyMergePair: boolean;
  isFinalRegularMerge6: boolean;
  isFinalWildLastTwo: boolean;
  isFinalMerge: boolean;
};

export type FinalMergeTileSets = {
  activeTilesBeforeMerge: any[];
  finalMergeBlockersBefore: any[];
};

export function isWildLikeSpecial(special: unknown): boolean {
  return typeof special === 'string' && special.startsWith('wild');
}

export function isWildLikeTile(tile: any): boolean {
  return isWildLikeSpecial(tile?.special) || tile?.isWild === true || tile?.isWildFace === true;
}

function isStalePlayableWildSpawnDrop(tile: any): boolean {
  if (!tile || tile._ccWildSpawnDropping !== true) return false;
  if (!isWildLikeTile(tile)) return false;
  if (tile.destroyed === true || tile.visible === false) return false;
  if (typeof tile.alpha === 'number' && tile.alpha <= 0.01) return false;
  // A visible wild/special die still blocks final-merge completion even while input
  // is temporarily disabled by an animation gate. Otherwise "regular + one juice"
  // can falsely complete the board while another visible juice remains.
  return true;
}

export function isTilePendingGameplayRemoval(tile: any): boolean {
  if (!tile) return true;
  return tile.destroyed === true ||
    (tile._ccWildSpawnDropping === true && !isStalePlayableWildSpawnDrop(tile)) ||
    tile._pendingRemoval === true ||
    tile._beingRemoved === true ||
    tile._cleanupQueued === true;
}

function isVisibleEnoughForGameplay(tile: any): boolean {
  if (!tile) return false;
  if (tile.visible === false) return false;
  if (typeof tile.alpha === 'number' && tile.alpha <= 0.01) return false;
  return true;
}

export function tileCountsAsFinalMergeActive(tile: any): boolean {
  if (isTilePendingGameplayRemoval(tile)) return false;
  if (!isVisibleEnoughForGameplay(tile)) return false;
  if (tile.locked) return false;
  if (isWildLikeTile(tile)) return true;
  return (tile.value | 0) > 0;
}

export function tileBlocksFinalMerge(tile: any, srcTile: any, dstTile: any): boolean {
  if (!tile || tile === srcTile || tile === dstTile) return false;
  if (isTilePendingGameplayRemoval(tile)) return false;
  if (tile._wildMagnetAffected === true) return false;

  if (tile.locked) return false;
  if (isWildLikeTile(tile)) return true;
  if (!isVisibleEnoughForGameplay(tile)) return false;
  return (tile.value | 0) > 0;
}

export function getPlayableMagnetPullCandidates({
  tiles,
  src,
  dst,
  magnetTile,
}: {
  tiles: any[];
  src: any;
  dst: any;
  magnetTile?: any;
}): any[] {
  const safeTiles = Array.isArray(tiles) ? tiles.filter(Boolean) : [];
  return safeTiles.filter((tile: any) => {
    if (!tile || tile === src || tile === dst || tile === magnetTile) return false;
    if (!tileCountsAsFinalMergeActive(tile)) return false;
    if (tile._wildMagnetAffected === true) return false;
    if (tile._noTilesPulled === true || tile._wildMagnetPulledTilesMerge === true) return false;
    return isWildLikeTile(tile) || (tile.value | 0) > 0;
  });
}

export function getFinalMergeTileSets({
  tiles,
  src,
  dst,
}: {
  tiles: any[];
  src: any;
  dst: any;
}): FinalMergeTileSets {
  const safeTiles = Array.isArray(tiles) ? tiles.filter(Boolean) : [];
  return {
    activeTilesBeforeMerge: safeTiles.filter(tileCountsAsFinalMergeActive),
    finalMergeBlockersBefore: safeTiles.filter((tile: any) => tileBlocksFinalMerge(tile, src, dst)),
  };
}

export function getFinalMergeSnapshot({
  activeTilesBeforeMerge,
  src,
  dst,
  effSum,
  finalMergeBlockersBefore = [],
  isWildMagnetMerge = false,
  hasTilesToPull = false,
}: FinalMergeSnapshotInput): FinalMergeSnapshot {
  const activeSnapshotWasOnlyMergePair =
    Array.isArray(activeTilesBeforeMerge) &&
    activeTilesBeforeMerge.length === 2 &&
    activeTilesBeforeMerge.includes(src) &&
    activeTilesBeforeMerge.includes(dst);

  const hasOtherGameplayBlockers = finalMergeBlockersBefore.length > 0;
  const magnetWillPull = isWildMagnetMerge && hasTilesToPull;
  const srcIsWild = isWildLikeTile(src);
  const dstIsWild = isWildLikeTile(dst);
  const srcValue = src ? (src.value | 0) : 0;
  const dstValue = dst ? (dst.value | 0) : 0;

  const isFinalWildLastTwo =
    activeSnapshotWasOnlyMergePair &&
    !hasOtherGameplayBlockers &&
    !magnetWillPull &&
    (srcIsWild !== dstIsWild);

  const isFinalRegularMerge6 =
    activeSnapshotWasOnlyMergePair &&
    !hasOtherGameplayBlockers &&
    !srcIsWild &&
    !dstIsWild &&
    srcValue > 0 &&
    dstValue > 0 &&
    (srcValue + dstValue === 6 || (effSum | 0) === 6);

  return {
    activeSnapshotWasOnlyMergePair,
    isFinalRegularMerge6,
    isFinalWildLastTwo,
    isFinalMerge: isFinalRegularMerge6 || isFinalWildLastTwo,
  };
}
