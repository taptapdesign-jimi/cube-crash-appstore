export const BEACH_FLOAT_HORIZONTAL_CROSSING_SECONDS = 1.5;
export const BEACH_FLOAT_LEFT_EDGE_RATIO = 0.06;
export const BEACH_FLOAT_RIGHT_EDGE_RATIO = 0.94;
export const BEACH_FLOAT_HORIZONTAL_TRAVEL_SCALE = 0.75;

export function sampleBeachFloatHorizontalProgress(elapsedSeconds: number): number {
  const normalizedProgress = Math.max(
    0,
    Math.min(1, elapsedSeconds / BEACH_FLOAT_HORIZONTAL_CROSSING_SECONDS),
  );
  return 0.5 - 0.5 * Math.cos(normalizedProgress * Math.PI);
}

export type BeachTransitionVariation = Readonly<{
  floatsSwapped: boolean;
  castleStartsLeft: boolean;
}>;

function createUnitSampler(random: () => number): () => number {
  return () => {
    const sampled = Number(random());
    if (!Number.isFinite(sampled)) return 0;
    return Math.max(0, Math.min(0.999999, sampled));
  };
}

export function createBeachTransitionVariation(
  random: () => number = Math.random,
  floatsSwappedOverride?: boolean,
): BeachTransitionVariation {
  const sampleUnit = createUnitSampler(random);
  const floatsSwapped = floatsSwappedOverride ?? sampleUnit() < 0.5;

  return Object.freeze({
    floatsSwapped,
    castleStartsLeft: floatsSwapped,
  });
}

export function createBeachTransitionVariationSequence(
  random: () => number = Math.random,
): () => BeachTransitionVariation {
  let previousFloatsSwapped: boolean | null = null;

  return () => {
    const floatsSwapped = previousFloatsSwapped === null
      ? createUnitSampler(random)() < 0.5
      : !previousFloatsSwapped;
    previousFloatsSwapped = floatsSwapped;
    return createBeachTransitionVariation(random, floatsSwapped);
  };
}
