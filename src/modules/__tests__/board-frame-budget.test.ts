import {
  evaluateBoardFrameBudget,
  IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS,
  startBoardFrameBudgetMonitor,
  stopBoardFrameBudgetMonitor,
  shouldSampleBoardFrameBudget,
  shouldUseSustainedLoadReduction,
} from '../board-frame-budget';

describe('board frame budget', () => {
  test('keeps full effects during stable 60fps gameplay', () => {
    expect(evaluateBoardFrameBudget(Array(90).fill(16.7)).reducedFx).toBe(false);
  });

  test('reduces secondary effects when hot-device frames accumulate', () => {
    const result = evaluateBoardFrameBudget([...Array(70).fill(18), ...Array(20).fill(35)]);
    expect(result.reducedFx).toBe(true);
    expect(result.framesOver28Ms).toBe(20);
  });

  test('allows recovery when an already reduced board becomes stable', () => {
    expect(evaluateBoardFrameBudget(Array(90).fill(16.7), true).reducedFx).toBe(false);
  });

  test('reduces effects after sustained iPhone gameplay even while frame pacing is stable', () => {
    const result = evaluateBoardFrameBudget(Array(90).fill(16.7), false, true);
    expect(result.reducedFx).toBe(true);
    expect(result.sustainedLoadReduction).toBe(true);
  });

  test('activates sustained reduction only for opted-in mobile runtimes after the thermal threshold', () => {
    expect(shouldUseSustainedLoadReduction(IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS - 1, true)).toBe(false);
    expect(shouldUseSustainedLoadReduction(IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS, true)).toBe(true);
    expect(shouldUseSustainedLoadReduction(IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS * 2, false)).toBe(false);
  });

  test('does not misclassify the intentional mobile 30fps idle cadence as frame pressure', () => {
    expect(shouldSampleBoardFrameBudget(30, true)).toBe(false);
    expect(shouldSampleBoardFrameBudget(60, true)).toBe(true);
    expect(shouldSampleBoardFrameBudget(undefined, true)).toBe(true);
    expect(shouldSampleBoardFrameBudget(30, false)).toBe(true);
  });

  test('uses the gameplay ticker instead of owning a parallel animation-frame loop', () => {
    const callbacks = new Set<(ticker?: unknown) => void>();
    const ticker = {
      maxFPS: 60,
      add: jest.fn((callback: (ticker?: unknown) => void) => callbacks.add(callback)),
      remove: jest.fn((callback: (ticker?: unknown) => void) => callbacks.delete(callback)),
    };
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame');

    startBoardFrameBudgetMonitor(ticker);

    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(rafSpy).not.toHaveBeenCalled();

    stopBoardFrameBudgetMonitor();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
    rafSpy.mockRestore();
  });
});
