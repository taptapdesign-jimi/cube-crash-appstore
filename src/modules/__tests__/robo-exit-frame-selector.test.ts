import { selectRoboExitFrameIndex } from '../robo-exit-frame-selector';

describe('Robo exit frame selector', () => {
  test('never keeps the currently visible frame or repeats the previous exit PNG', () => {
    for (const randomValue of [0, 0.1, 0.49, 0.75, 0.999999]) {
      const selected = selectRoboExitFrameIndex(12, 10, 4, randomValue);
      expect(selected).not.toBe(10);
      expect(selected).not.toBe(4);
      expect(selected).toBeGreaterThanOrEqual(0);
      expect(selected).toBeLessThan(12);
    }
  });

  test('maps the random roll across the complete eligible PNG pool', () => {
    expect(selectRoboExitFrameIndex(4, 3, 2, 0)).toBe(0);
    expect(selectRoboExitFrameIndex(4, 3, 2, 0.999999)).toBe(1);
  });

  test('prioritizes a visible change when only two frames are available', () => {
    expect(selectRoboExitFrameIndex(2, 0, 1, 0.5)).toBe(1);
    expect(selectRoboExitFrameIndex(1, 0, 0, 0.5)).toBe(0);
    expect(selectRoboExitFrameIndex(0, 0, null, 0.5)).toBeNull();
  });
});
