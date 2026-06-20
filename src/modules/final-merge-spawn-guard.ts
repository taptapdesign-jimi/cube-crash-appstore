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

  const active = Array.isArray(activeTilesBeforeMerge) ? activeTilesBeforeMerge : [];
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

  if (!srcIsWild && !dstIsWild && (effSum | 0) === 6) {
    return { shouldBlockSpawn: true, reason: 'regular-final-pair' };
  }

  return { shouldBlockSpawn: false, reason: 'not-final-pair' };
}
