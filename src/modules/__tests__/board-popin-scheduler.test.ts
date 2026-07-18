import { createBoardPopInPlan } from '../board-popin-scheduler';

describe('board pop-in scheduler', () => {
  test('keeps every active and inactive tile in the animation plan exactly once', () => {
    const plan = createBoardPopInPlan(24, () => 0.42);
    const indices = plan.map((step) => step.tileIndex).sort((a, b) => a - b);

    expect(indices).toEqual(Array.from({ length: 24 }, (_, index) => index));
  });

  test('produces deterministic bounce timing when supplied a seeded random source', () => {
    const values = [0.1, 0.7, 0.3, 0.9, 0.2, 0.8, 0.4, 0.6];
    const makeRandom = () => {
      let index = 0;
      return () => values[index++ % values.length];
    };

    expect(createBoardPopInPlan(6, makeRandom())).toEqual(createBoardPopInPlan(6, makeRandom()));
  });

  test('keeps the original cartoony amplitude and positive duration ranges', () => {
    const plan = createBoardPopInPlan(32, () => 0.5);

    for (const step of plan) {
      expect(step.amplitude).toBeGreaterThanOrEqual(1.08);
      expect(step.amplitude).toBeLessThanOrEqual(1.15);
      expect(step.growDuration).toBeGreaterThanOrEqual(0.1);
      expect(step.compressDuration).toBeGreaterThanOrEqual(0.08);
      expect(step.settleDuration).toBeGreaterThanOrEqual(0.08);
      expect(step.endTime).toBeGreaterThan(step.enterDelay);
    }
  });

  test('preserves the legacy fast overlapping random entry rhythm', () => {
    const values = [0.12, 0.83, 0.34, 0.68, 0.27, 0.91, 0.46];
    let index = 0;
    const plan = createBoardPopInPlan(36, () => values[index++ % values.length]);
    const delays = plan.map((step) => step.enterDelay);

    expect(Math.min(...delays)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...delays)).toBeLessThan(0.8);
    expect(delays.some((delay, delayIndex) => delayIndex > 0 && delay < delays[delayIndex - 1])).toBe(true);

    const sortedDelays = [...delays].sort((a, b) => a - b);
    const nearSimultaneousStarts = sortedDelays.filter((delay, delayIndex) =>
      delayIndex > 0 && delay - sortedDelays[delayIndex - 1] < 0.012
    ).length;
    expect(nearSimultaneousStarts).toBeGreaterThan(10);
  });
});
