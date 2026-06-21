export type FinalMergeSpawnGuardInput = {
  activeTilesBeforeMerge: any[];
  finalMergeBlockersBefore: any[];
  src: any;
  dst: any;
  effSum: number;
  srcIsWild: boolean;
  dstIsWild: boolean;
  magnetWillPull: boolean;
};

export type FinalMergeSpawnGuardDecision = {
  shouldBlockSpawn: boolean;
  reason: 'regular-final-pair' | 'wild-final-pair' | 'magnet-will-pull' | 'blockers-present' | 'not-final-pair';
};

export type PreSpawnFinalMergeCompletionInput = {
  spawnGuardDecision: FinalMergeSpawnGuardDecision;
  srcWasWild: boolean;
  dstWasWild: boolean;
  effSum: number;
  isFinalWildLastTwo?: boolean;
  otherPlayableCount: number;
};

export type PreSpawnFinalMergeCompletionDecision = {
  shouldComplete: boolean;
  reason: 'final-wild-pair' | 'final-regular-pair' | 'other-playable-present' | 'not-final-pair';
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

export function resolveFinalMergeSpawnGuard({
  activeTilesBeforeMerge,
  finalMergeBlockersBefore,
  src,
  dst,
  effSum,
  srcIsWild,
  dstIsWild,
  magnetWillPull,
}: FinalMergeSpawnGuardInput): FinalMergeSpawnGuardDecision {
  if (magnetWillPull) {
    return { shouldBlockSpawn: false, reason: 'magnet-will-pull' };
  }

  if ((finalMergeBlockersBefore?.length || 0) > 0) {
    return { shouldBlockSpawn: false, reason: 'blockers-present' };
  }

  const active = uniqueTileRefs(activeTilesBeforeMerge);
  const onlyMergePair =
    active.length === 2 &&
    active.includes(src) &&
    active.includes(dst);

  if (!onlyMergePair) {
    return { shouldBlockSpawn: false, reason: 'not-final-pair' };
  }

  const oneWild = srcIsWild !== dstIsWild;
  if (oneWild) {
    return { shouldBlockSpawn: true, reason: 'wild-final-pair' };
  }

  const activePhysicalTileCount = active.reduce((sum, tile) => sum + stackDepthOf(tile), 0);
  const mergePhysicalTileCount = stackDepthOf(src) + stackDepthOf(dst);
  const regularMergeIsExactlyTwoSingleDice =
    activePhysicalTileCount === 2 &&
    mergePhysicalTileCount === 2;

  if (!srcIsWild && !dstIsWild && regularMergeIsExactlyTwoSingleDice && (effSum | 0) === 6) {
    return { shouldBlockSpawn: true, reason: 'regular-final-pair' };
  }

  return { shouldBlockSpawn: false, reason: 'not-final-pair' };
}

export function resolvePreSpawnFinalMergeCompletion({
  spawnGuardDecision,
  srcWasWild,
  dstWasWild,
  effSum,
  isFinalWildLastTwo = false,
  otherPlayableCount,
}: PreSpawnFinalMergeCompletionInput): PreSpawnFinalMergeCompletionDecision {
  if (otherPlayableCount > 0) {
    return { shouldComplete: false, reason: 'other-playable-present' };
  }

  const oneWasWild = srcWasWild !== dstWasWild;
  const isWildFinal =
    oneWasWild &&
    (
      (spawnGuardDecision.shouldBlockSpawn && spawnGuardDecision.reason === 'wild-final-pair') ||
      isFinalWildLastTwo
    );
  if (isWildFinal) {
    return { shouldComplete: true, reason: 'final-wild-pair' };
  }

  const isRegularFinal =
    !srcWasWild &&
    !dstWasWild &&
    (effSum | 0) === 6 &&
    spawnGuardDecision.shouldBlockSpawn &&
    spawnGuardDecision.reason === 'regular-final-pair';
  if (isRegularFinal) {
    return { shouldComplete: true, reason: 'final-regular-pair' };
  }

  return { shouldComplete: false, reason: 'not-final-pair' };
}
