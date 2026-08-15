export const BEACH_CURTAIN_LAYER_KEYS = Object.freeze([
  'beach-palm-1',
  'beach-palm-2',
  'beach-palm-3',
  'beach-palm-4',
  'beach-palm-center',
] as const);

export type BeachCurtainLayerKey = typeof BEACH_CURTAIN_LAYER_KEYS[number];

export type BeachPalmPlacement = Readonly<{
  leftPercent: number;
  bottomPx: number;
  exitDirection: -1 | 0 | 1;
  restRotationDeg: number | null;
}>;

export type BeachTransitionVariation = Readonly<{
  palms: Readonly<Record<BeachCurtainLayerKey, BeachPalmPlacement>>;
  floatsSwapped: boolean;
  castleStartsLeft: boolean;
}>;

type PalmLane = Readonly<{
  leftPercent: number;
  exitDirection: -1 | 0 | 1;
  bottomLiftPx: number;
  restRotationDeg: number | null;
}>;

const BEACH_PALM_LANES: readonly PalmLane[] = Object.freeze([
  Object.freeze({ leftPercent: -2, exitDirection: -1, bottomLiftPx: 20, restRotationDeg: 15 }),
  Object.freeze({ leftPercent: 18, exitDirection: -1, bottomLiftPx: 12, restRotationDeg: 10 }),
  Object.freeze({ leftPercent: 50, exitDirection: 0, bottomLiftPx: 0, restRotationDeg: null }),
  Object.freeze({ leftPercent: 74, exitDirection: 1, bottomLiftPx: 0, restRotationDeg: null }),
  Object.freeze({ leftPercent: 98, exitDirection: 1, bottomLiftPx: 0, restRotationDeg: null }),
]);

function createUnitSampler(random: () => number): () => number {
  return () => {
    const sampled = Number(random());
    if (!Number.isFinite(sampled)) return 0;
    return Math.max(0, Math.min(0.999999, sampled));
  };
}

function randomBetween(sampleUnit: () => number, min: number, max: number): number {
  return min + sampleUnit() * (max - min);
}

export function createBeachTransitionVariation(
  random: () => number = Math.random,
  floatsSwappedOverride?: boolean,
): BeachTransitionVariation {
  const sampleUnit = createUnitSampler(random);
  const shuffledLanes = [...BEACH_PALM_LANES];
  for (let index = shuffledLanes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(sampleUnit() * (index + 1));
    [shuffledLanes[index], shuffledLanes[swapIndex]] = [shuffledLanes[swapIndex], shuffledLanes[index]];
  }

  const palmEntries = BEACH_CURTAIN_LAYER_KEYS.map((key, index) => {
    const lane = shuffledLanes[index];
    const leftPercent = Number((lane.leftPercent + randomBetween(sampleUnit, -5, 5)).toFixed(2));
    const bottomPx = -Math.round(randomBetween(sampleUnit, 95, 150)) + lane.bottomLiftPx;
    return [key, Object.freeze({
      leftPercent,
      bottomPx,
      exitDirection: lane.exitDirection,
      restRotationDeg: lane.restRotationDeg,
    })] as const;
  });

  const floatsSwapped = floatsSwappedOverride ?? sampleUnit() < 0.5;

  return Object.freeze({
    palms: Object.freeze(Object.fromEntries(palmEntries)) as Readonly<Record<BeachCurtainLayerKey, BeachPalmPlacement>>,
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
