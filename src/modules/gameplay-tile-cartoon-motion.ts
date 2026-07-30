export type GameplayTileCartoonVariantKind = 'stretch' | 'squash';

export type GameplayTileCartoonPose = Readonly<{
  scaleX: number;
  scaleY: number;
}>;

type GameplayTileCartoonMotionStage = GameplayTileCartoonPose & Readonly<{
  durationSeconds: number;
  ease: string;
}>;

export type GameplayTileCartoonMotionVariant = Readonly<{
  kind: GameplayTileCartoonVariantKind;
  anticipation: GameplayTileCartoonMotionStage;
  peak: GameplayTileCartoonMotionStage;
  rebound: GameplayTileCartoonMotionStage;
  settleDurationSeconds: number;
  settleEase: string;
  tiltDegrees: number;
}>;

/**
 * One tuning surface for regular gameplay cube motion in Journey and Arcade.
 * Increase/decrease `strength` values to retune the complete effect family.
 */
export const GAMEPLAY_TILE_CARTOON_MOTION = Object.freeze({
  stack: Object.freeze({
    strength: 1,
    anticipationDurationSeconds: 0.065,
    peakDurationSeconds: 0.09,
    reboundDurationSeconds: 0.1,
    settleDurationSeconds: 0.14,
    tiltDegrees: 0,
  }),
  idle: Object.freeze({
    strength: 1,
    anticipationDurationSeconds: 0.09,
    peakDurationSeconds: 0.14,
    reboundDurationSeconds: 0.12,
    settleDurationSeconds: 0.17,
    tiltDegrees: 1.35,
  }),
});

type GameplayTileCartoonMotionMode = keyof typeof GAMEPLAY_TILE_CARTOON_MOTION;

function applyStrength(value: number, strength: number): number {
  return 1 + (value - 1) * strength;
}

const BASE_POSES = Object.freeze({
  stack: Object.freeze({
    stretch: Object.freeze({
      anticipation: Object.freeze({ scaleX: 1.06, scaleY: 0.95 }),
      peak: Object.freeze({ scaleX: 0.965, scaleY: 1.1 }),
      rebound: Object.freeze({ scaleX: 1.025, scaleY: 0.985 }),
    }),
    squash: Object.freeze({
      anticipation: Object.freeze({ scaleX: 0.95, scaleY: 1.055 }),
      peak: Object.freeze({ scaleX: 1.1, scaleY: 0.96 }),
      rebound: Object.freeze({ scaleX: 0.985, scaleY: 1.025 }),
    }),
  }),
  idle: Object.freeze({
    stretch: Object.freeze({
      anticipation: Object.freeze({ scaleX: 1.035, scaleY: 0.97 }),
      peak: Object.freeze({ scaleX: 0.975, scaleY: 1.085 }),
      rebound: Object.freeze({ scaleX: 1.02, scaleY: 0.99 }),
    }),
    squash: Object.freeze({
      anticipation: Object.freeze({ scaleX: 0.97, scaleY: 1.035 }),
      peak: Object.freeze({ scaleX: 1.085, scaleY: 0.975 }),
      rebound: Object.freeze({ scaleX: 0.99, scaleY: 1.02 }),
    }),
  }),
});

/** Pick one bounded stretch/squash cycle and apply the mode's central strength. */
export function createGameplayTileCartoonVariant(
  mode: GameplayTileCartoonMotionMode,
  randomValue = Math.random(),
): GameplayTileCartoonMotionVariant {
  const profile = GAMEPLAY_TILE_CARTOON_MOTION[mode];
  const kind: GameplayTileCartoonVariantKind =
    Number.isFinite(randomValue) && randomValue >= 0.5 ? 'squash' : 'stretch';
  const poses = BASE_POSES[mode][kind];
  const stage = (
    pose: GameplayTileCartoonPose,
    durationSeconds: number,
    ease: string,
  ): GameplayTileCartoonMotionStage => Object.freeze({
    scaleX: applyStrength(pose.scaleX, profile.strength),
    scaleY: applyStrength(pose.scaleY, profile.strength),
    durationSeconds,
    ease,
  });

  return Object.freeze({
    kind,
    anticipation: stage(
      poses.anticipation,
      profile.anticipationDurationSeconds,
      'power2.out',
    ),
    peak: stage(poses.peak, profile.peakDurationSeconds, 'back.out(1.65)'),
    rebound: stage(poses.rebound, profile.reboundDurationSeconds, 'power2.out'),
    settleDurationSeconds: profile.settleDurationSeconds,
    settleEase: 'back.out(1.9)',
    tiltDegrees: profile.tiltDegrees,
  });
}
