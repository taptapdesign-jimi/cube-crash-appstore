export type MagnetPullProgressDecisionInput = {
  activeTilesBeforePull: any[];
  mergeTile: any;
  pulledTileCount: number;
};

export type MagnetPullProgressDecision = {
  shouldAddWildProgress: boolean;
  isLastMergeBeforePull: boolean;
};

export function resolveMagnetPullProgressDecision({
  activeTilesBeforePull,
  mergeTile,
  pulledTileCount,
}: MagnetPullProgressDecisionInput): MagnetPullProgressDecision {
  const validPullCount = pulledTileCount >= 1 && pulledTileCount <= 4;
  const active = Array.isArray(activeTilesBeforePull) ? activeTilesBeforePull : [];
  const isLastMergeBeforePull =
    validPullCount &&
    active.length === 2 &&
    active.includes(mergeTile);

  return {
    shouldAddWildProgress: validPullCount && !isLastMergeBeforePull,
    isLastMergeBeforePull,
  };
}
