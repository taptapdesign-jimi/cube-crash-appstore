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
    // Keep density bounded; sell the break through larger, wider solid-white puffs.
    smokeSizeScale: reducedFx ? 1.25 : 1.36,
    smokeDistanceScale: reducedFx ? 1.08 : 1.2,
    smokeCountScale: reducedFx ? 0.72 : 0.9,
    smokeUpwardBias: reducedFx ? 0.2 : 0.28,
  };
}

export function getSmokeCloudParticleAlpha(centerStrength: number, randomValue = Math.random()): number {
  const center = Math.max(0, Math.min(1, Number.isFinite(centerStrength) ? centerStrength : 0));
  const random = Math.max(0, Math.min(1, Number.isFinite(randomValue) ? randomValue : 0.5));
  return Math.max(0.3, Math.min(1, 0.34 + center * 0.64 + (random - 0.5) * 0.16));
}
