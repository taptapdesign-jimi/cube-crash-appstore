export interface MushroomSporeFlightProfile {
  startBandProgress: number;
  birthDelay: number;
  travelRatio: number;
  riseDuration: number;
  arrivalDuration: number;
  swayAmplitudeRatio: number;
  swaySpeed: number;
  driftSpeedRatio: number;
  driftDirection: -1 | 1;
}

// Preserve every authored route while fitting the complete independent birth,
// rise and arrival lifecycle inside the shortened five-second flock owner.
export const MUSHROOM_SPORE_TIME_SCALE = 5 / 7.2;

function boundedRandom(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function shuffledRanks(count: number, random: () => number): number[] {
  const values = Array.from({ length: Math.max(0, count) }, (_, index) => index);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(boundedRandom(random) * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

/**
 * Creates visibly independent, stratified spore routes while retaining one
 * pooled renderer owner. The shuffled travel ranks guarantee short, medium and
 * >60%-screen flights even when a seeded/random source clusters badly.
 */
export function createMushroomSporeFlightProfiles(
  count: number,
  random: () => number = Math.random,
): MushroomSporeFlightProfile[] {
  const safeCount = Math.max(0, count | 0);
  const startRanks = shuffledRanks(safeCount, random);
  const travelRanks = shuffledRanks(safeCount, random);

  return Array.from({ length: safeCount }, (_, index) => {
    const startBandProgress = (startRanks[index] + boundedRandom(random)) / Math.max(1, safeCount);
    const travelProgress = (travelRanks[index] + boundedRandom(random)) / Math.max(1, safeCount);
    const travelRatio = 0.16 + (travelProgress * 0.60);
    return {
      startBandProgress,
      birthDelay: boundedRandom(random) * 0.78 * MUSHROOM_SPORE_TIME_SCALE,
      travelRatio,
      riseDuration: (1.25 + (travelRatio * 4.2) + (boundedRandom(random) * 0.85))
        * MUSHROOM_SPORE_TIME_SCALE,
      arrivalDuration: (0.20 + (boundedRandom(random) * 0.82)) * MUSHROOM_SPORE_TIME_SCALE,
      swayAmplitudeRatio: 0.012 + (boundedRandom(random) * 0.098),
      swaySpeed: 1.05 + (boundedRandom(random) * 3.15),
      driftSpeedRatio: 0.008 + (boundedRandom(random) * 0.048),
      driftDirection: boundedRandom(random) < 0.5 ? -1 : 1,
    };
  });
}
