import {
  amplifyJourneyCardReturnLandingScale,
  createJourneyInterimBounceVariant,
  JOURNEY_CARD_RETURN_LANDING_SQUASH_STRENGTH,
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

  test('gives only return-card landings a clearly readable 2.2x cartoon scale amplitude', () => {
    expect(JOURNEY_CARD_RETURN_LANDING_SQUASH_STRENGTH).toBe(2.2);
    expect(amplifyJourneyCardReturnLandingScale(1.075)).toBeCloseTo(1.165, 8);
    expect(amplifyJourneyCardReturnLandingScale(0.94)).toBeCloseTo(0.868, 8);
    expect(amplifyJourneyCardReturnLandingScale(1)).toBe(1);
  });

});
