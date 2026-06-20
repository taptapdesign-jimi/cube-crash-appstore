export type WildEndgameSpawnMultDecisionInput = {
  spawnMult: number;
  isWildMerge: boolean;
  lockedEmptyPlaceholderCount: number;
  isLastMerge: boolean;
};

export type WildEndgameSpawnMultDecision = {
  spawnMult: number;
  reducedToSingleSpawn: boolean;
};

export function resolveWildEndgameSpawnMult({
  spawnMult,
  isWildMerge,
  lockedEmptyPlaceholderCount,
  isLastMerge,
}: WildEndgameSpawnMultDecisionInput): WildEndgameSpawnMultDecision {
  const nextSpawnMult = spawnMult | 0;
  const isEndgameMode = lockedEmptyPlaceholderCount <= 0;
  const shouldReduce =
    isWildMerge &&
    isEndgameMode &&
    nextSpawnMult > 1 &&
    !isLastMerge;

  return {
    spawnMult: shouldReduce ? 1 : nextSpawnMult,
    reducedToSingleSpawn: shouldReduce,
  };
}
