import { randomRegularTileValue, randVal, trackAppTimeout } from '../app-core-utils';
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

  test('journey boards 1-5 force small values 70 percent of the time', () => {
    (window as any).STATE.boardNumber = 5;
    mockRandomSequence([0.69, 0.99]);

    expect(randomRegularTileValue()).toBe(3);
  });

  test('journey boards 6-10 force small values 50 percent of the time', () => {
    (window as any).STATE.boardNumber = 10;
    mockRandomSequence([0.49, 0.99]);

    expect(randomRegularTileValue()).toBe(3);
  });

  test('journey boards 11-15 force small values 25 percent of the time', () => {
    (window as any).STATE.boardNumber = 15;
    mockRandomSequence([0.24, 0.99]);

    expect(randomRegularTileValue()).toBe(3);
  });

  test('journey boards 16+ use normal regular pool', () => {
    (window as any).STATE.boardNumber = 16;
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
    jest.runOnlyPendingTimers();
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
  });
});
