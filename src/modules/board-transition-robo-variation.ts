export type RoboTravelDirection = -1 | 1;

export type RoboTransitionVariation = Readonly<{
  frontTravelDirection: RoboTravelDirection;
  walkerTravelDirection: RoboTravelDirection;
}>;

export type RoboAirCombatVariation = Readonly<{
  routeProfile: 'high-wide' | 'low-tight' | 'reverse-sweep';
  routeHorizontalScale: number;
  routeVerticalBias: number;
  routeVerticalScale: number;
  crossingPolarity: RoboTravelDirection;
  postBeamDirection: RoboTravelDirection;
  fighterEntryX: number;
  fighterJitterX: number;
  fighterJitterY: number;
  beamOne: Readonly<{ launchXRatio: number; rotationOffset: number; travelMultiplier: number; scaleMultiplier: number; destinationXOffset: number }>;
  beamFour: Readonly<{ launchXRatio: number; rotationOffset: number; travelMultiplier: number; scaleMultiplier: number; destinationXOffset: number }>;
  exitPattern: 0 | 1 | 2;
  exitVerticalScale: number;
  exitDurationSeconds: number;
}>;

function boundedSample(random: () => number): number {
  const value = Number(random());
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function between(random: () => number, min: number, max: number): number {
  return min + boundedSample(random) * (max - min);
}

export function createRoboAirCombatVariation(random: () => number = Math.random): RoboAirCombatVariation {
  const routeProfileIndex = Math.min(2, Math.floor(boundedSample(random) * 3));
  const routeProfiles = ['high-wide', 'low-tight', 'reverse-sweep'] as const;
  const exitPattern = Math.min(2, Math.floor(boundedSample(random) * 3)) as 0 | 1 | 2;
  return Object.freeze({
    routeProfile: routeProfiles[routeProfileIndex],
    routeHorizontalScale: routeProfileIndex === 0
      ? between(random, 1.15, 1.38)
      : routeProfileIndex === 1
        ? between(random, 0.82, 1.00)
        : between(random, 1.02, 1.28),
    routeVerticalBias: routeProfileIndex === 0
      ? between(random, -58, -28)
      : routeProfileIndex === 1
        ? between(random, 28, 58)
        : between(random, -20, 20),
    routeVerticalScale: routeProfileIndex === 0
      ? between(random, 1.05, 1.28)
      : routeProfileIndex === 1
        ? between(random, 0.72, 0.90)
        : between(random, 0.92, 1.12),
    crossingPolarity: routeProfileIndex === 2 ? -1 : 1,
    postBeamDirection: boundedSample(random) < 0.5 ? -1 : 1,
    fighterEntryX: between(random, 96, 132),
    fighterJitterX: between(random, 16, 30),
    fighterJitterY: between(random, 12, 24),
    beamOne: Object.freeze({
      launchXRatio: between(random, 0.80, 0.94),
      rotationOffset: between(random, -14, 14),
      travelMultiplier: between(random, 1.18, 1.42),
      scaleMultiplier: between(random, 1.35, 1.68),
      destinationXOffset: between(random, -44, 44),
    }),
    beamFour: Object.freeze({
      launchXRatio: between(random, 0.06, 0.20),
      rotationOffset: between(random, -16, 16),
      travelMultiplier: between(random, 1.36, 1.66),
      scaleMultiplier: between(random, 1.44, 1.78),
      destinationXOffset: between(random, -52, 52),
    }),
    exitPattern,
    exitVerticalScale: between(random, 0.62, 1.12),
    exitDurationSeconds: between(random, 0.82, 1.08),
  });
}

export function createRoboTransitionVariation(
  random: () => number = Math.random,
): RoboTransitionVariation {
  const sample = Number(random());
  const frontTravelDirection: RoboTravelDirection = Number.isFinite(sample) && sample >= 0.5 ? -1 : 1;

  return Object.freeze({
    frontTravelDirection,
    walkerTravelDirection: (frontTravelDirection * -1) as RoboTravelDirection,
  });
}
