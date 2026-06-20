export type WildMergeSpawnBonusInput = {
  isWildMerge: boolean;
  isLastMerge: boolean;
  isArcadeSimpleWildMergeSpawn: boolean;
  isFinalWildSnapshotBeforeSpawn: boolean;
  isJuice: boolean;
  isStar: boolean;
  isMagnet: boolean;
  isTnt: boolean;
  starOrbitCount: number;
};

export type WildMergeSpawnBonusDecision = {
  lockedBonusCount: number;
  extraActiveCount: number;
};

function resolveStarBonus(starOrbitCount: number): WildMergeSpawnBonusDecision {
  const count = Math.max(1, Math.min(3, starOrbitCount | 0 || 3));
  if (count >= 3) return { lockedBonusCount: 9, extraActiveCount: 3 };
  if (count === 2) return { lockedBonusCount: 7, extraActiveCount: 2 };
  return { lockedBonusCount: 5, extraActiveCount: 1 };
}

export function resolveWildMergeSpawnBonus({
  isWildMerge,
  isLastMerge,
  isArcadeSimpleWildMergeSpawn,
  isFinalWildSnapshotBeforeSpawn,
  isJuice,
  isStar,
  isMagnet,
  isTnt,
  starOrbitCount,
}: WildMergeSpawnBonusInput): WildMergeSpawnBonusDecision {
  if (!isWildMerge || isLastMerge || isArcadeSimpleWildMergeSpawn || isFinalWildSnapshotBeforeSpawn) {
    return { lockedBonusCount: 0, extraActiveCount: 0 };
  }

  if (isJuice) return { lockedBonusCount: 3, extraActiveCount: 0 };
  if (isStar) return resolveStarBonus(starOrbitCount);
  if (isMagnet || isTnt) return { lockedBonusCount: 9, extraActiveCount: 0 };

  return { lockedBonusCount: 9, extraActiveCount: 3 };
}
