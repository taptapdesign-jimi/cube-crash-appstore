import {
  createJourneyInterimBounceVariant,
  JOURNEY_INTERIM_IDLE_MOTION,
} from '../journey-interim-idle-policy.js';

describe('Journey interim idle policy', () => {
  test('uses a short cartoon squash, stretch, land and rebound cadence', () => {
    expect(JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleX).toBeGreaterThan(1);
    expect(JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleY).toBeLessThan(1);
    expect(JOURNEY_INTERIM_IDLE_MOTION.peakScaleY).toBeGreaterThan(1.08);
    expect(JOURNEY_INTERIM_IDLE_MOTION.landScaleX).toBeGreaterThan(1.05);
    expect(JOURNEY_INTERIM_IDLE_MOTION.landScaleY).toBeLessThan(0.96);
    const activeDuration =
      JOURNEY_INTERIM_IDLE_MOTION.anticipationDurationSeconds +
      JOURNEY_INTERIM_IDLE_MOTION.riseDurationSeconds +
      JOURNEY_INTERIM_IDLE_MOTION.landDurationSeconds +
      JOURNEY_INTERIM_IDLE_MOTION.reboundDurationSeconds +
      JOURNEY_INTERIM_IDLE_MOTION.settleDurationSeconds;
    expect(activeDuration).toBeLessThan(0.9);
  });

  test('alternates between bounded stretch and squash cartoon poses', () => {
    expect(createJourneyInterimBounceVariant(0).kind).toBe('stretch');
    expect(createJourneyInterimBounceVariant(0.99).kind).toBe('squash');
    expect(createJourneyInterimBounceVariant(0).peakScaleY).toBeGreaterThan(1);
    expect(createJourneyInterimBounceVariant(0.99).peakScaleX).toBeGreaterThan(1);
  });

});
