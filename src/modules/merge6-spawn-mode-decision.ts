export type Merge6SpawnModeInput = {
  isLastMerge: boolean;
  isFinalMergeByResolver: boolean;
  spawnMult: number;
  isEndgameMode: boolean;
  isArcadeSimpleWildMergeSpawn: boolean;
};

export type Merge6SpawnModeDecision = {
  shouldSpawnAtDst: boolean;
};

export function resolveMerge6SpawnMode({
  isLastMerge,
  isFinalMergeByResolver,
  spawnMult,
  isEndgameMode,
  isArcadeSimpleWildMergeSpawn,
}: Merge6SpawnModeInput): Merge6SpawnModeDecision {
  return {
    shouldSpawnAtDst:
      !isLastMerge &&
      !isFinalMergeByResolver &&
      spawnMult > 0 &&
      (isEndgameMode || isArcadeSimpleWildMergeSpawn),
  };
}
