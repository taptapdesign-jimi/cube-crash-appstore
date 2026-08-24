export type RoboTravelDirection = -1 | 1;

export type RoboTransitionVariation = Readonly<{
  frontTravelDirection: RoboTravelDirection;
  walkerTravelDirection: RoboTravelDirection;
}>;

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
