import { JOURNEY_BOTTOM_DECOR_MOTION } from '../journey-bottom-decor-motion';

describe('journey bottom decor motion profile', () => {
  test('keeps all vertical travel below or exactly on the viewport edge', () => {
    expect(JOURNEY_BOTTOM_DECOR_MOTION.start.y).toBeGreaterThan(0);
    expect(JOURNEY_BOTTOM_DECOR_MOTION.exit.y).toBeGreaterThan(0);
  });

  test('never applies an overshooting ease to vertical travel', () => {
    expect(JOURNEY_BOTTOM_DECOR_MOTION.enter.travelEase).toBe('power3.out');
    expect(JOURNEY_BOTTOM_DECOR_MOTION.exit.ease).toBe('power2.in');
    expect(JOURNEY_BOTTOM_DECOR_MOTION.enter.travelEase).not.toMatch(/back|bounce|elastic/);
    expect(JOURNEY_BOTTOM_DECOR_MOTION.exit.ease).not.toMatch(/back|bounce|elastic/);
  });

  test('keeps the bottom-anchored settle subtle', () => {
    expect(JOURNEY_BOTTOM_DECOR_MOTION.enter.arrivalScaleX).toBeLessThanOrEqual(1.02);
    expect(JOURNEY_BOTTOM_DECOR_MOTION.enter.arrivalScaleY).toBeGreaterThanOrEqual(0.98);
    expect(JOURNEY_BOTTOM_DECOR_MOTION.enter.settleDurationSeconds).toBeLessThan(0.2);
  });
});
