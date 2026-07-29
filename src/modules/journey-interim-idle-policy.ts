export const JOURNEY_INTERIM_IDLE_MOTION = Object.freeze({
  anticipationScaleX: 1.035,
  anticipationScaleY: 0.965,
  peakScaleX: 0.96,
  peakScaleY: 1.105,
  landScaleX: 1.075,
  landScaleY: 0.94,
  reboundScaleX: 0.985,
  reboundScaleY: 1.025,
  tiltDegrees: 1.35,
  liftPx: 11,
  anticipationDurationSeconds: 0.1,
  riseDurationSeconds: 0.2,
  landDurationSeconds: 0.13,
  reboundDurationSeconds: 0.14,
  settleDurationSeconds: 0.22,
  repeatDelaySeconds: 0.58,
});

export type JourneyInterimBounceVariant = Readonly<{
  kind: 'stretch' | 'squash';
  peakScaleX: number;
  peakScaleY: number;
  landScaleX: number;
  landScaleY: number;
  tiltMultiplier: number;
}>;

const STRETCH_VARIANT: JourneyInterimBounceVariant = Object.freeze({
  kind: 'stretch',
  peakScaleX: JOURNEY_INTERIM_IDLE_MOTION.peakScaleX,
  peakScaleY: JOURNEY_INTERIM_IDLE_MOTION.peakScaleY,
  landScaleX: JOURNEY_INTERIM_IDLE_MOTION.landScaleX,
  landScaleY: JOURNEY_INTERIM_IDLE_MOTION.landScaleY,
  tiltMultiplier: 1,
});

const SQUASH_VARIANT: JourneyInterimBounceVariant = Object.freeze({
  kind: 'squash',
  peakScaleX: 1.1,
  peakScaleY: 0.955,
  landScaleX: 0.97,
  landScaleY: 1.07,
  tiltMultiplier: 0.72,
});

/** Pick one bounded cartoon pose; callers reuse it for the complete bounce cycle. */
export function createJourneyInterimBounceVariant(randomValue = Math.random()): JourneyInterimBounceVariant {
  return Number.isFinite(randomValue) && randomValue >= 0.5 ? SQUASH_VARIANT : STRETCH_VARIANT;
}
