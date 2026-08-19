import {
  clearAllAppAnimationFrames,
  clearAllAppIntervals,
  clearAllAppListeners,
  clearAllAppTimeouts,
  getAppCleanupStats,
  randomRegularTileValue,
  randVal,
  trackAppAnimationFrame,
  trackAppInterval,
  trackAppListener,
  trackAppTimeout,
  waitTracked,
  waitTrackedResult,
} from '../app-core-utils';
import { RUN_MODE_ARCADE_HOME, RUN_MODE_JOURNEY, setRunMode } from '../run-mode';

describe('app-core-utils regular value bias', () => {
  const originalRandom = Math.random;

  beforeEach(() => {
    (window as any).STATE = { boardNumber: 1 };
    setRunMode(RUN_MODE_JOURNEY);
  });

  afterEach(() => {
    Math.random = originalRandom;
    delete (window as any).STATE;
    delete (window as any).__ccStartAtLevel;
    delete (window as any).__ccRunMode;
  });

  function mockRandomSequence(values: number[]): void {
    let index = 0;
    Math.random = jest.fn(() => values[Math.min(index++, values.length - 1)]);
  }

  test('the first three stages of every Journey world strongly prefer small values', () => {
    (window as any).STATE.boardNumber = 21;
    mockRandomSequence([0.74, 0.99]);

    expect(randomRegularTileValue()).toBe(3);
  });

  test('stages four through six of every Journey world use medium assistance', () => {
    (window as any).STATE.boardNumber = 15;
    mockRandomSequence([0.39, 0.99]);

    expect(randomRegularTileValue()).toBe(3);
  });

  test('stages seven through ten of every Journey world use the normal pool', () => {
    (window as any).STATE.boardNumber = 27;
    mockRandomSequence([0.99]);

    expect(randomRegularTileValue()).toBe(5);
  });

  test('journey bias also applies to initial randVal spawn', () => {
    (window as any).STATE.boardNumber = 1;
    mockRandomSequence([0.2, 0.99]);

    expect(randVal()).toBe(3);
  });

  test('arcade mode keeps existing arcade bias path separate', () => {
    setRunMode(RUN_MODE_ARCADE_HOME);
    (window as any).STATE.boardNumber = 1;
    mockRandomSequence([0.49, 0.99]);

    expect(randomRegularTileValue()).toBe(3);
  });
});

describe('app-core-utils tracked timeouts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    clearAllAppTimeouts();
    clearAllAppIntervals();
    clearAllAppAnimationFrames();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('timeout callback errors are contained so later callbacks still run', () => {
    const afterError = jest.fn();

    trackAppTimeout(() => {
      throw new Error('timeout boom');
    }, 10);
    trackAppTimeout(afterError, 20);

    expect(() => {
      jest.advanceTimersByTime(30);
    }).not.toThrow();
    expect(afterError).toHaveBeenCalledTimes(1);
    expect(getAppCleanupStats().timeouts).toBe(0);
  });

  test('cleanup settles cancellation-aware waits instead of leaving a pending promise', async () => {
    const wait = waitTrackedResult(5_000);

    expect(getAppCleanupStats().timeouts).toBe(1);
    clearAllAppTimeouts();

    await expect(wait).resolves.toBe('cancelled');
    expect(getAppCleanupStats().timeouts).toBe(0);
  });

  test('elapsed cancellation-aware waits report elapsed and retire their timeout', async () => {
    const wait = waitTrackedResult(25);

    jest.advanceTimersByTime(25);

    await expect(wait).resolves.toBe('elapsed');
    expect(getAppCleanupStats().timeouts).toBe(0);
  });

  test('legacy waitTracked also settles during cleanup', async () => {
    const wait = waitTracked(5_000);

    clearAllAppTimeouts();

    await expect(wait).resolves.toBeUndefined();
  });

  test('async timeout rejection is contained and its registry entry is retired', async () => {
    trackAppTimeout(async () => {
      throw new Error('async timeout boom');
    }, 10);

    jest.advanceTimersByTime(10);
    await Promise.resolve();

    expect(getAppCleanupStats().timeouts).toBe(0);
  });
});

describe('app-core-utils tracked frame and interval callbacks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    clearAllAppTimeouts();
    clearAllAppIntervals();
    clearAllAppAnimationFrames();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('RAF registry entry is removed even when its callback throws', () => {
    let scheduled: FrameRequestCallback | null = null;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduled = callback;
      return 73;
    });

    trackAppAnimationFrame(() => {
      throw new Error('raf boom');
    });
    expect(getAppCleanupStats().animationFrames).toBe(1);

    expect(() => scheduled?.(16)).toThrow('raf boom');
    expect(getAppCleanupStats().animationFrames).toBe(0);
  });

  test('interval callback errors are contained and the interval remains owned', () => {
    const callback = jest.fn(() => {
      throw new Error('interval boom');
    });
    trackAppInterval(callback, 20);

    expect(() => jest.advanceTimersByTime(60)).not.toThrow();
    expect(callback).toHaveBeenCalledTimes(3);
    expect(getAppCleanupStats().intervals).toBe(1);

    clearAllAppIntervals();
    expect(getAppCleanupStats().intervals).toBe(0);
  });
});

describe('app-core-utils tracked listeners', () => {
  afterEach(() => {
    clearAllAppListeners();
  });

  test('deduplicates a repeated boot listener and permits reinstall after cleanup', () => {
    const handler = jest.fn();

    trackAppListener(window, 'resize', handler);
    trackAppListener(window, 'resize', handler);
    window.dispatchEvent(new Event('resize'));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(getAppCleanupStats().listeners).toBe(1);

    clearAllAppListeners();
    window.dispatchEvent(new Event('resize'));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(getAppCleanupStats().listeners).toBe(0);

    trackAppListener(window, 'resize', handler);
    window.dispatchEvent(new Event('resize'));
    expect(handler).toHaveBeenCalledTimes(2);
    expect(getAppCleanupStats().listeners).toBe(1);
  });

  test('keeps capture variants as distinct browser listeners', () => {
    const handler = jest.fn();

    trackAppListener(window, 'resize', handler, false);
    trackAppListener(window, 'resize', handler, true);

    expect(getAppCleanupStats().listeners).toBe(2);
  });
});
