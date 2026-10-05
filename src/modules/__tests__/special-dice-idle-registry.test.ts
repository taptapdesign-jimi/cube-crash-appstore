import { SpecialDiceIdleRegistry } from '../special-dice-idle-registry';

function owner() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  };
}

describe('SpecialDiceIdleRegistry', () => {
  test('starts every live Special once and never stops a sibling when another registers', () => {
    const registry = new SpecialDiceIdleRegistry<object>();
    const keys = [{}, {}, {}, {}];
    const owners = keys.map(() => owner());

    keys.forEach((key, index) => registry.register(key, owners[index]));

    expect(registry.snapshot()).toMatchObject({
      registered: 4,
      running: 4,
      paused: 0,
      pending: 0,
    });
    owners.forEach((callbacks) => {
      expect(callbacks.start).toHaveBeenCalledTimes(1);
      expect(callbacks.stop).not.toHaveBeenCalled();
    });

    registry.register(keys[0], owner());
    expect(owners[0].start).toHaveBeenCalledTimes(1);
    expect(owners[0].stop).not.toHaveBeenCalled();
  });

  test('retires only the exact tile and reset stops each remaining live owner once', () => {
    const registry = new SpecialDiceIdleRegistry<object>();
    const firstKey = {};
    const secondKey = {};
    const first = owner();
    const second = owner();
    registry.register(firstKey, first);
    registry.register(secondKey, second);

    registry.retire(firstKey);
    registry.retire(firstKey);
    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(second.stop).not.toHaveBeenCalled();
    expect(registry.snapshot()).toMatchObject({ registered: 1, running: 1 });

    registry.reset();
    registry.reset();
    expect(second.stop).toHaveBeenCalledTimes(1);
    expect(registry.snapshot()).toMatchObject({ registered: 0, running: 0 });
  });

  test('nested suspension pauses once, defers new starts, and resumes after the final release', () => {
    const registry = new SpecialDiceIdleRegistry<object>();
    const running = owner();
    const pending = owner();
    const runningKey = {};
    const pendingKey = {};
    registry.register(runningKey, running);

    const releaseDrag = registry.suspend('drag');
    const releaseMerge = registry.suspend('merge');
    registry.register(pendingKey, pending);

    expect(running.pause).toHaveBeenCalledTimes(1);
    expect(pending.start).not.toHaveBeenCalled();
    expect(registry.snapshot()).toMatchObject({
      registered: 2,
      running: 0,
      paused: 1,
      pending: 1,
      suspended: true,
    });

    releaseDrag();
    expect(running.resume).not.toHaveBeenCalled();
    expect(pending.start).not.toHaveBeenCalled();
    releaseMerge();
    releaseMerge();
    expect(running.resume).toHaveBeenCalledTimes(1);
    expect(pending.start).toHaveBeenCalledTimes(1);
    expect(registry.snapshot()).toMatchObject({ running: 2, paused: 0, pending: 0 });
  });

  test('retiring during suspension never resumes or starts the retired owner', () => {
    const registry = new SpecialDiceIdleRegistry<object>();
    const runningKey = {};
    const pendingKey = {};
    const running = owner();
    const pending = owner();
    registry.register(runningKey, running);
    const release = registry.suspend('merge');
    registry.register(pendingKey, pending);

    registry.retire(runningKey);
    registry.retire(pendingKey);
    release();

    expect(running.stop).toHaveBeenCalledTimes(1);
    expect(running.resume).not.toHaveBeenCalled();
    expect(pending.start).not.toHaveBeenCalled();
    expect(pending.stop).not.toHaveBeenCalled();
    expect(registry.snapshot()).toMatchObject({ registered: 0, running: 0 });
  });

  test('owns one settled cadence lease for the whole live population', () => {
    const releases: jest.Mock[] = [];
    const acquireSettledCadence = jest.fn(() => {
      const release = jest.fn();
      releases.push(release);
      return release;
    });
    const registry = new SpecialDiceIdleRegistry<object>({ acquireSettledCadence });
    const firstKey = {};
    const secondKey = {};
    registry.register(firstKey, owner());
    registry.register(secondKey, owner());
    expect(acquireSettledCadence).toHaveBeenCalledTimes(1);
    expect(registry.snapshot().settledCadenceOwned).toBe(true);

    const releaseDrag = registry.suspend('drag');
    const releaseMerge = registry.suspend('merge');
    expect(releases[0]).toHaveBeenCalledTimes(1);
    releaseDrag();
    expect(acquireSettledCadence).toHaveBeenCalledTimes(1);
    releaseMerge();
    expect(acquireSettledCadence).toHaveBeenCalledTimes(2);

    registry.retire(firstKey);
    expect(releases[1]).not.toHaveBeenCalled();
    registry.retire(secondKey);
    expect(releases[1]).toHaveBeenCalledTimes(1);
    expect(registry.snapshot().settledCadenceOwned).toBe(false);
  });
});
