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
  activePhysicalTileCount: number;
  mergePhysicalTileCount: number;
  isFinalRegularMerge6: boolean;
  isFinalWildLastTwo: boolean;
  isFinalMerge: boolean;
};

export type FinalMergeTileSets = {
  activeTilesBeforeMerge: any[];
  finalMergeBlockersBefore: any[];
};

function uniqueTileRefs(tileList: any[]): any[] {
  const out: any[] = [];
  (Array.isArray(tileList) ? tileList : []).forEach((tile: any) => {
    if (!tile || out.includes(tile)) return;
    out.push(tile);
  });
  return out;
}

function stackDepthOf(tile: any): number {
  const depth = Number(tile?.stackDepth ?? 1);
  return Number.isFinite(depth) && depth > 0 ? depth : 1;
}

export function isWildLikeSpecial(special: unknown): boolean {
  return typeof special === 'string' && special.startsWith('wild');
}

export function isWildLikeTile(tile: any): boolean {
  return isWildLikeSpecial(tile?.special) ||
    isWildLikeSpecial(tile?._ccWildSpecial) ||
    isWildLikeSpecial(tile?._ccSpecialDiceArchetype) ||
    isWildLikeSpecial(tile?.specialDiceArchetype) ||
    tile?.isWild === true ||
    tile?.isWildFace === true;
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

function isVisibleWildGameplayPresence(tile: any): boolean {
  if (isTilePendingGameplayRemoval(tile)) return false;
  if (!isWildLikeTile(tile)) return false;
  if (tile._wildMagnetAffected === true) return false;
  if (!isVisibleEnoughForGameplay(tile)) return false;
  // Locked empty placeholders are faint. A full-opacity locked special is still
  // a real special die temporarily gated by animation/input and must block endgame.
  if (tile.locked === true && typeof tile.alpha === 'number' && tile.alpha <= 0.35) return false;
  return true;
}

export function tileCountsAsFinalMergeActive(tile: any): boolean {
  if (isTilePendingGameplayRemoval(tile)) return false;
  if (!isVisibleEnoughForGameplay(tile)) return false;
  if (isWildLikeTile(tile)) return isVisibleWildGameplayPresence(tile);
  if (tile.locked) return false;
  return (tile.value | 0) > 0;
}

export function tileBlocksFinalMerge(tile: any, srcTile: any, dstTile: any): boolean {
  if (!tile || tile === srcTile || tile === dstTile) return false;
  if (isTilePendingGameplayRemoval(tile)) return false;
  if (tile._wildMagnetAffected === true) return false;

  if (isWildLikeTile(tile)) return isVisibleWildGameplayPresence(tile);
  if (tile.locked) return false;
  if (!isVisibleEnoughForGameplay(tile)) return false;
  return (tile.value | 0) > 0;
}

export function isPlayableMagnetPullCandidate(tile: any, options: { allowMagnetOwned?: boolean } = {}): boolean {
  if (!tile || tile.destroyed === true || tile._ccWildSpawnDropping === true) return false;
  // Once Magnet owns a candidate it is intentionally locked and detached from
  // the grid. Commit validation must accept that owned state, while retaining
  // the same hard rejection for a tile that became a dropping spawn.
  if (options.allowMagnetOwned && tile._wildMagnetAffected === true) {
    return isWildLikeTile(tile) || (tile.value | 0) > 0;
  }
  if (!tileCountsAsFinalMergeActive(tile)) return false;
  if (tile._wildMagnetAffected === true) return false;
  if (tile._noTilesPulled === true || tile._wildMagnetPulledTilesMerge === true) return false;
  return isWildLikeTile(tile) || (tile.value | 0) > 0;
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
    // A visible regular merge-6 destination can briefly remain on stage while
    // its spawn choreography finishes. It is cleanup-owned, not magnet food.
    if (typeof tile._ccMerge6CleanupToken === 'number') return false;
    // Dropping wilds still block false clean-board detection, but Magnet cannot
    // own them until their spawn transaction has settled.
    return isPlayableMagnetPullCandidate(tile);
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
  const safeTiles = uniqueTileRefs(Array.isArray(tiles) ? tiles.filter(Boolean) : []);
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
  const activeUnique = uniqueTileRefs(activeTilesBeforeMerge);
  const activePhysicalTileCount = activeUnique.reduce((sum, tile) => sum + stackDepthOf(tile), 0);
  const mergePhysicalTileCount = stackDepthOf(src) + stackDepthOf(dst);
  const activeSnapshotWasOnlyMergePair =
    (() => {
      return activeUnique.length === 2 &&
        activeUnique.includes(src) &&
        activeUnique.includes(dst);
    })();

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
    activePhysicalTileCount,
    mergePhysicalTileCount,
    isFinalRegularMerge6,
    isFinalWildLastTwo,
    isFinalMerge: isFinalRegularMerge6 || isFinalWildLastTwo,
  };
}
