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
    expect(shouldSampleBoardFrameBudget(30, true)).toBe(true);
    expect(evaluateBoardFrameBudget(Array(90).fill(1000 / 30), false, false, 1000 / 30).reducedFx).toBe(false);
    expect(evaluateBoardFrameBudget(Array(90).fill(100), false, false, 1000 / 30).reducedFx).toBe(true);
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


describe('real mobile frame-budget ticker', () => {
  afterEach(() => { stopBoardFrameBudgetMonitor(); jest.restoreAllMocks(); });
  test('reports actual idle stalls and never mistakes an intentional cadence change for overload', () => {
    jest.resetModules();
    jest.doMock('../mobile-runtime-profile', () => ({ MOBILE_RUNTIME_PROFILE: { isMobileDevice: true } }));
    const owner = require('../board-frame-budget');
    let time = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => time);
    let callback!: () => void;
    const ticker = { maxFPS: 30, add(fn: () => void) { callback = fn; }, remove() {} };
    const frames = (count: number, gap: number) => { for (let i = 0; i < count; i++) { time += gap; callback(); } };
    try {
      owner.startBoardFrameBudgetMonitor(ticker);
      frames(90, 1000 / 30);
      expect((window as any).__ccLastBoardPerf.reducedFx).toBe(false);
      expect((window as any).__ccLastBoardPerf.expectedFrameMs).toBeCloseTo(1000 / 30);
      frames(150, 100);
      expect((window as any).__ccLastBoardPerf.averageFrameMs).toBeCloseTo(100, 6);
      expect((window as any).__ccLastBoardPerf.reducedFx).toBe(true);
      expect((window as any).__ccLastBoardPerf.framesOverBudget).toBe(120);
      expect((window as any).__ccLastBoardPerf.sustainedLoadReduction).toBe(false);
      ticker.maxFPS = 60;
      frames(121, 1000 / 60);
      expect((window as any).__ccLastBoardPerf.expectedFrameMs).toBeCloseTo(1000 / 60);
      expect((window as any).__ccLastBoardPerf.reducedFx).toBe(false);
    } finally { owner.stopBoardFrameBudgetMonitor(); jest.dontMock('../mobile-runtime-profile'); }
  });
});
