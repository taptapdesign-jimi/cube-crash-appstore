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
