export type PostMagnetResolutionAction = 'continue' | 'check-level-end';

export type PostMagnetResolutionInput = {
  tiles: any[];
  anyMergePossible?: (tiles: any[]) => boolean;
  isLastMergeFlagSet?: boolean;
  spawnCount?: number;
};

export type PostMagnetResolution = {
  action: PostMagnetResolutionAction;
  reason: 'merge-or-stack-potential' | 'clean-merge6-only' | 'stuck-unlocked-tiles' | 'stuck-active-tiles' | 'no-active-tiles';
  activeTiles: any[];
  unlockedActiveTiles: any[];
  hasMergeOrStackPotential: boolean;
  hasSpawnedNewTiles: boolean;
  isActuallyLastMerge: boolean;
  isBoardClean: boolean;
  shouldClearLastMergeFlag: boolean;
};

export type MagnetRespawnPlan = {
  replacementSpawnCount: number;
  obligatorySpawnCount: number;
  spawnCount: number;
};

export type PreMagnetRespawnDecision = {
  isLastMergeFlagSet: boolean;
  onlyDstRemains: boolean;
  hasTilesToRespawn: boolean;
  shouldClearLastMergeFlag: boolean;
  shouldDelegateToCentralEndgame: boolean;
};

export function createMagnetRespawnPlan(pulledCellCount: number, hasTilesToRespawn: boolean): MagnetRespawnPlan {
  const replacementSpawnCount = hasTilesToRespawn ? Math.max(0, pulledCellCount | 0) : 0;
  // v915 Magnet density: replace every pulled tile and add one nearby
  // obligatory continuation cube. The merge-6 survivor is converted separately.
  const obligatorySpawnCount = hasTilesToRespawn ? 1 : 0;
  return {
    replacementSpawnCount,
    obligatorySpawnCount,
    spawnCount: replacementSpawnCount + obligatorySpawnCount,
  };
}

export function resolvePreMagnetRespawnDecision({
  isLastMergeFlagSetRaw = false,
  activeTilesAfterRemoval = [],
  dst,
  pulledCellCount = 0,
}: {
  isLastMergeFlagSetRaw?: boolean;
  activeTilesAfterRemoval?: any[];
  dst?: any;
  pulledCellCount?: number;
}): PreMagnetRespawnDecision {
  const active = Array.isArray(activeTilesAfterRemoval)
    ? activeTilesAfterRemoval.filter(Boolean)
    : [];
  const dstIsPlayableMerge6 =
    !!dst &&
    dst.destroyed !== true &&
    dst.visible !== false &&
    (typeof dst.alpha !== 'number' || dst.alpha > 0.01) &&
    (dst.value | 0) === 6;
  const onlyDstRemains =
    dstIsPlayableMerge6 &&
    (
      active.length === 0 ||
      (active.length === 1 && active[0] === dst)
    );
  const hasTilesToRespawn = Math.max(0, pulledCellCount | 0) > 0 && !onlyDstRemains;
  const isLastMergeFlagSet = !!isLastMergeFlagSetRaw && !hasTilesToRespawn;

  return {
    isLastMergeFlagSet,
    onlyDstRemains,
    hasTilesToRespawn,
    shouldClearLastMergeFlag: !!isLastMergeFlagSetRaw && hasTilesToRespawn,
    shouldDelegateToCentralEndgame: isLastMergeFlagSet || onlyDstRemains,
  };
}

export function isPlayablePostMagnetTile(tile: any): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  if (typeof tile.alpha === 'number' && tile.alpha <= 0.01) return false;
  const value = (tile.value | 0);
  const isWild = !!tile.special || tile.isWild === true || tile.isWildFace === true;
  if (!isWild && tile.locked) return false;
  return value > 0 || isWild;
}

export function resolvePostMagnetEndgameAction({
  tiles,
  anyMergePossible,
  isLastMergeFlagSet = false,
  spawnCount = 0,
}: PostMagnetResolutionInput): PostMagnetResolution {
  const activeTiles = (Array.isArray(tiles) ? tiles : []).filter(isPlayablePostMagnetTile);
  const unlockedActiveTiles = activeTiles.filter((tile: any) => !tile.locked);
  const hasMergeOrStackPotential = activeTiles.length > 0 && typeof anyMergePossible === 'function'
    ? anyMergePossible(activeTiles)
    : false;

  const hasSpawnedNewTiles = spawnCount > 0 && activeTiles.length > 1;
  const isActuallyLastMerge = isLastMergeFlagSet && !hasSpawnedNewTiles;
  const isBoardClean = activeTiles.length === 1 && (activeTiles[0]?.value | 0) === 6;
  const shouldClearLastMergeFlag = !!isLastMergeFlagSet && hasSpawnedNewTiles;

  if (hasMergeOrStackPotential) {
    return {
      action: 'continue',
      reason: 'merge-or-stack-potential',
      activeTiles,
      unlockedActiveTiles,
      hasMergeOrStackPotential,
      hasSpawnedNewTiles,
      isActuallyLastMerge,
      isBoardClean,
      shouldClearLastMergeFlag,
    };
  }

  if (isBoardClean && unlockedActiveTiles.length <= 1) {
    return {
      action: 'check-level-end',
      reason: 'clean-merge6-only',
      activeTiles,
      unlockedActiveTiles,
      hasMergeOrStackPotential,
      hasSpawnedNewTiles,
      isActuallyLastMerge,
      isBoardClean,
      shouldClearLastMergeFlag,
    };
  }

  if (unlockedActiveTiles.length > 0) {
    return {
      action: 'check-level-end',
      reason: 'stuck-unlocked-tiles',
      activeTiles,
      unlockedActiveTiles,
      hasMergeOrStackPotential,
      hasSpawnedNewTiles,
      isActuallyLastMerge,
      isBoardClean,
      shouldClearLastMergeFlag,
    };
  }

  if (activeTiles.length >= 1) {
    return {
      action: 'check-level-end',
      reason: 'stuck-active-tiles',
      activeTiles,
      unlockedActiveTiles,
      hasMergeOrStackPotential,
      hasSpawnedNewTiles,
      isActuallyLastMerge,
      isBoardClean,
      shouldClearLastMergeFlag,
    };
  }

  return {
    action: 'continue',
    reason: 'no-active-tiles',
    activeTiles,
    unlockedActiveTiles,
    hasMergeOrStackPotential,
    hasSpawnedNewTiles,
    isActuallyLastMerge,
    isBoardClean,
    shouldClearLastMergeFlag,
  };
}
