export const BEACH_CURTAIN_LAYER_KEYS = Object.freeze([
  'beach-palm-1',
  'beach-palm-2',
  'beach-palm-3',
  'beach-palm-4',
  'beach-palm-center',
] as const);

// The transition positions palms from the bottom edge, so a negative shared
// offset moves the complete five-palm curtain down without changing its layout.
export const BEACH_PALM_GLOBAL_VERTICAL_OFFSET_PX = -32;

export type BeachCurtainLayerKey = typeof BEACH_CURTAIN_LAYER_KEYS[number];

export type BeachPalmPlacement = Readonly<{
  leftPercent: number;
  horizontalOffsetPx: number;
  bottomPx: number;
  verticalOffsetPx: number;
  upwardLiftVh: number;
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

const BEACH_PALM_ART_OFFSETS: Readonly<Record<BeachCurtainLayerKey, Readonly<{
  horizontalPx: number;
  verticalPx: number;
}>>> = Object.freeze({
  'beach-palm-1': Object.freeze({ horizontalPx: 0, verticalPx: 0 }),
  'beach-palm-2': Object.freeze({ horizontalPx: 0, verticalPx: -16 }),
  'beach-palm-3': Object.freeze({ horizontalPx: 16, verticalPx: 20 }),
  'beach-palm-4': Object.freeze({ horizontalPx: 0, verticalPx: 10 }),
  'beach-palm-center': Object.freeze({ horizontalPx: 16, verticalPx: 0 }),
});

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
    const artOffset = BEACH_PALM_ART_OFFSETS[key];
    const leftPercent = Number((lane.leftPercent + randomBetween(sampleUnit, -5, 5)).toFixed(2));
    const bottomPx = -Math.round(randomBetween(sampleUnit, 95, 150)) + lane.bottomLiftPx;
    const upwardLiftVh = Number(randomBetween(sampleUnit, 8, 18).toFixed(2));
    return [key, Object.freeze({
      leftPercent,
      horizontalOffsetPx: artOffset.horizontalPx,
      bottomPx,
      verticalOffsetPx: artOffset.verticalPx,
      upwardLiftVh,
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
