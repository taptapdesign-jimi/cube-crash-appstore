import { SpecialDiceIdleBudget, hasContinuousSpecialDiceIdle } from '../special-dice-idle-budget';

function owner() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  };
}

describe('SpecialDiceIdleBudget', () => {
  test.each(['kanta', 'honey', 'bee', 'fish'])('%s copies keep idle without taking the ordinary Special slot', variant => {
    const budget = new SpecialDiceIdleBudget<object>(1);
    const first = owner(); const second = owner(); const old = owner(); const newest = owner();
    const firstKey = {}; const secondKey = {}; const newestKey = {};
    budget.request({}, old);
    budget.request(firstKey, first, hasContinuousSpecialDiceIdle(variant));
    budget.request(secondKey, second, hasContinuousSpecialDiceIdle(variant));
    budget.request(newestKey, newest);
    expect(budget.snapshot()).toMatchObject({ registered: 4, active: 3 });
    expect(old.stop).toHaveBeenCalledTimes(1);
    expect(first.stop).not.toHaveBeenCalled(); expect(second.stop).not.toHaveBeenCalled();
    budget.request(firstKey, first, true);
    expect(first.start).toHaveBeenCalledTimes(1);
    const releaseDrag = budget.suspend('drag'); const releaseMerge = budget.suspend('merge');
    [first, second, newest].forEach(callbacks => expect(callbacks.pause).toHaveBeenCalledTimes(1));
    budget.retire(firstKey); budget.retire(firstKey);
    releaseDrag(); expect(second.resume).not.toHaveBeenCalled();
    releaseMerge(); expect(second.resume).toHaveBeenCalledTimes(1);
    expect(first.resume).not.toHaveBeenCalled(); expect(first.stop).toHaveBeenCalledTimes(1);
    budget.reset(); budget.reset();
    expect(second.stop).toHaveBeenCalledTimes(1);
    expect(newest.stop).toHaveBeenCalledTimes(1);
    expect(budget.snapshot()).toMatchObject({ registered: 0, active: 0 });
  });

  test.each([undefined, 'robo', 'lasergun', 'spaceship', 'bottle', 'mushroom', 'flower', 'barrel', 'beachball'])('does not exempt unrelated variant %s', variant => {
    expect(hasContinuousSpecialDiceIdle(variant)).toBe(false);
  });

  test('mobile keeps only the newest Special active and promotes the prior candidate on removal', () => {
    const budget = new SpecialDiceIdleBudget<object>(1);
    const firstKey = {}; const secondKey = {};
    const first = owner(); const second = owner();

    budget.request(firstKey, first);
    budget.request(secondKey, second);
    expect(first.start).toHaveBeenCalledTimes(1);
    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(second.start).toHaveBeenCalledTimes(1);
    expect(budget.snapshot()).toMatchObject({ registered: 2, active: 1, paused: 0 });

    budget.retire(secondKey);
    expect(second.stop).toHaveBeenCalledTimes(1);
    expect(first.start).toHaveBeenCalledTimes(2);
  });

  test('nested foreground suspensions pause once and resume only after the last release', () => {
    const budget = new SpecialDiceIdleBudget<object>(1);
    const key = {}; const callbacks = owner();
    budget.request(key, callbacks);
    const releaseDrag = budget.suspend('drag');
    const releaseMerge = budget.suspend('merge');
    expect(callbacks.pause).toHaveBeenCalledTimes(1);
    expect(budget.snapshot()).toMatchObject({ active: 1, paused: 1, suspended: true });
    releaseDrag();
    expect(callbacks.resume).not.toHaveBeenCalled();
    releaseMerge();
    expect(callbacks.resume).toHaveBeenCalledTimes(1);
    releaseMerge();
    expect(callbacks.resume).toHaveBeenCalledTimes(1);
  });

  test('candidate registered while suspended starts paused and never receives a live frame first', () => {
    const budget = new SpecialDiceIdleBudget<object>(1);
    const release = budget.suspend('merge');
    const callbacks = owner();
    budget.request({}, callbacks);
    expect(callbacks.start.mock.invocationCallOrder[0])
      .toBeLessThan(callbacks.pause.mock.invocationCallOrder[0]);
    expect(callbacks.pause).toHaveBeenCalledTimes(1);
    release();
    expect(callbacks.resume).toHaveBeenCalledTimes(1);
  });

  test('desktop unlimited mode preserves every authored idle owner', () => {
    const budget = new SpecialDiceIdleBudget<object>(Number.POSITIVE_INFINITY);
    const owners = [owner(), owner(), owner()];
    owners.forEach((callbacks) => budget.request({}, callbacks));
    expect(budget.snapshot()).toMatchObject({ registered: 3, active: 3 });
    owners.forEach((callbacks) => {
      expect(callbacks.start).toHaveBeenCalledTimes(1);
      expect(callbacks.stop).not.toHaveBeenCalled();
    });
  });
});
