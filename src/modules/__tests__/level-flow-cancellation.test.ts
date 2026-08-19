import {
  cleanupLevelFlowTimeouts,
  LevelFlowCancelledError,
  openLockedBounceParallel,
} from '../level-flow';

describe('level-flow cancellation ownership', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    cleanupLevelFlowTimeouts();
    jest.useRealTimers();
  });

  test('cleanup cancels an in-flight spawn so its parent cannot run fallback mutations', async () => {
    const tile = {
      locked: true,
      destroyed: false,
      scale: { x: 1, y: 1 },
      value: 0,
      gridX: 1,
      gridY: 1,
    } as any;

    const spawn = openLockedBounceParallel({
      tiles: [tile],
      k: 1,
      spawnBounce: jest.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();

    cleanupLevelFlowTimeouts();

    await expect(spawn).rejects.toBeInstanceOf(LevelFlowCancelledError);
    expect(tile._isBeingSpawned).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a bounce completion delivered after cleanup cannot mutate the retired tile', async () => {
    const tile = {
      locked: true,
      destroyed: false,
      scale: { x: 1, y: 1, set: jest.fn() },
      value: 0,
      gridX: 1,
      gridY: 1,
      alpha: 1,
      base: { alpha: 1 },
      rotG: { alpha: 1 },
      overlay: { alpha: 1, visible: false },
      pips: { alpha: 1, visible: true },
    } as any;
    let completeBounce: (() => void) | null = null;
    const spawnBounce = jest.fn((_tile, onComplete) => {
      completeBounce = onComplete;
    });

    const spawn = openLockedBounceParallel({
      tiles: [tile],
      k: 1,
      makeBoard: {
        setValue: (target: any, value: number) => { target.value = value; },
      },
      spawnBounce,
    });
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(50);
    await Promise.resolve();

    expect(spawnBounce).toHaveBeenCalledTimes(1);
    const cancelledSpawn = expect(spawn).rejects.toBeInstanceOf(LevelFlowCancelledError);
    cleanupLevelFlowTimeouts();
    await cancelledSpawn;

    const scaleCallsAfterCleanup = tile.scale.set.mock.calls.length;
    const timersAfterCleanup = jest.getTimerCount();
    completeBounce?.();

    expect(tile.scale.set).toHaveBeenCalledTimes(scaleCallsAfterCleanup);
    expect(jest.getTimerCount()).toBe(timersAfterCleanup);
  });
});
