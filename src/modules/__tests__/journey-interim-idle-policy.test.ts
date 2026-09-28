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
    const cycleDurationMs = (
      activeDuration + JOURNEY_INTERIM_IDLE_MOTION.repeatDelaySeconds
    ) * 1000;
    expect(cycleDurationMs).toBeCloseTo(JOURNEY_INTERIM_IDLE_MOTION.burnGlowCadenceMs, 8);
    expect(JOURNEY_INTERIM_IDLE_MOTION.smokeStartSeconds).toBeGreaterThan(
      JOURNEY_INTERIM_IDLE_MOTION.anticipationDurationSeconds,
    );
    expect(JOURNEY_INTERIM_IDLE_MOTION.smokeStartSeconds).toBeLessThan(
      JOURNEY_INTERIM_IDLE_MOTION.anticipationDurationSeconds
        + JOURNEY_INTERIM_IDLE_MOTION.riseDurationSeconds,
    );
    expect(JOURNEY_INTERIM_IDLE_MOTION.burnGlowInitialDelayMs).toBe(1150);
    expect(JOURNEY_INTERIM_IDLE_MOTION.burnGlowDurationMs).toBe(1100);
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

describe('visible interim scroll admission', () => {
  const { JourneyWorldRuntimeScheduler } = require('../journey-world-runtime-scheduler');
  const { canPaintJourneyInterimDuringRuntime } = require('../journey-interim-idle-policy');
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  test.each([1, 2, 3])('World %i keeps card motion through scroll and settles but rejects modal, background and teardown', (worldId) => {
    const root = document.createElement('div');
    const runtime = new JourneyWorldRuntimeScheduler(180, 180);
    const allowed = () => canPaintJourneyInterimDuringRuntime(runtime.getSnapshot());
    runtime.activate(worldId, root, 'transition');
    expect(allowed()).toBe(false);
    runtime.endTransition();
    expect(allowed()).toBe(true);
    root.dispatchEvent(new Event('scroll'));
    expect(allowed()).toBe(true);
    jest.advanceTimersByTime(180);
    expect(allowed()).toBe(true);
    runtime.openModal();
    expect(allowed()).toBe(false);
    runtime.closeModal();
    jest.advanceTimersByTime(180);
    runtime.beginInteractionSettle();
    expect(allowed()).toBe(false);
    runtime.releaseAmbientDuringInteractionSettle();
    expect(allowed()).toBe(false);
    runtime.endInteractionSettle();
    expect(allowed()).toBe(true);
    window.dispatchEvent(new Event('pagehide'));
    expect(allowed()).toBe(false);
    runtime.dispose();
    expect(allowed()).toBe(false);
  });
});
