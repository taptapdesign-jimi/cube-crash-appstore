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
    // A merge-6 is a cube break, not rising ambient smoke. An organic radial
    // field avoids both upward bias and the four-sided "flower" silhouette.
    smokeSpawnShape: 'organic-radial',
    smokeEllipseChance: 0.62,
    smokeEllipseAspectMin: 0.58,
    smokeEllipseAspectMax: 1.42,
  };
}

export type OrganicRadialSmokeLayout = {
  sx: number;
  sy: number;
  dx: number;
  dy: number;
};

export function getOrganicRadialSmokeLayout(
  size: number,
  distanceScale: number,
  randomValue = Math.random,
): OrganicRadialSmokeLayout {
  const safeSize = Math.max(1, Number.isFinite(size) ? size : 96);
  const safeDistanceScale = Math.max(0.1, Number.isFinite(distanceScale) ? distanceScale : 1);
  const nextRandom = (): number => {
    const value = randomValue();
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
  };

  const startAngle = nextRandom() * Math.PI * 2;
  // Bias some particles toward the core while still allowing starts beyond a
  // cube face (0.5 * size). This breaks the appearance of one perfect ring.
  const startRadius = Math.pow(nextRandom(), 1.35) * safeSize * 0.62;
  const travelAngle = startAngle + (nextRandom() - 0.5) * 1.35;
  const travelDistance = safeSize * (0.06 + nextRandom() * 0.4) * safeDistanceScale;
  const lateralOffset = (nextRandom() - 0.5) * safeSize * 0.16 * safeDistanceScale;

  const sx = Math.cos(startAngle) * startRadius;
  const sy = Math.sin(startAngle) * startRadius;
  const tangentAngle = travelAngle + Math.PI * 0.5;

  return {
    sx,
    sy,
    dx: sx + Math.cos(travelAngle) * travelDistance + Math.cos(tangentAngle) * lateralOffset,
    dy: sy + Math.sin(travelAngle) * travelDistance + Math.sin(tangentAngle) * lateralOffset,
  };
}

export function getSmokeCloudParticleAlpha(centerStrength: number, randomValue = Math.random()): number {
  const center = Math.max(0, Math.min(1, Number.isFinite(centerStrength) ? centerStrength : 0));
  const random = Math.max(0, Math.min(1, Number.isFinite(randomValue) ? randomValue : 0.5));
  return Math.max(0.3, Math.min(1, 0.34 + center * 0.64 + (random - 0.5) * 0.16));
}
