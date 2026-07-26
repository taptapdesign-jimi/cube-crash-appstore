export function getRegularStackSmokeProfile(reducedFx: boolean) {
  return {
    baseAlpha: reducedFx ? 0.62 : 0.72,
    trailAlpha: reducedFx ? 0.7 : 0.82,
    sizeScale: reducedFx ? 1 : 1.1,
    sizeBoostChance: reducedFx ? 0.18 : 0.26,
    sizeBoostScale: reducedFx ? 1.2 : 1.3,
    distanceScale: reducedFx ? 0.92 : 1.04,
    countScale: reducedFx ? 0.42 : 0.56,
    durationScale: reducedFx ? 0.72 : 0.84,
  };
}

export function getRegularMerge6FxProfile(reducedFx: boolean) {
  return {
    shardDensity: reducedFx ? 0.55 : 1,
    shardVisualScale: reducedFx ? 1.12 : 1.18,
    shardDistanceScale: reducedFx ? 1.12 : 1.2,
    smokeSizeScale: reducedFx ? 1.12 : 1.22,
    smokeDistanceScale: reducedFx ? 0.76 : 0.86,
  };
}
