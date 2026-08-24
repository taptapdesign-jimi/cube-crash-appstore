import { createBoardTransitionSettlement } from '../board-transition-lifecycle';

describe('Board Transition settlement lifecycle', () => {
  test('normal completion resolves once and invokes the handoff once', () => {
    const resolve = jest.fn();
    const onComplete = jest.fn();
    const onSettled = jest.fn();
    const settle = createBoardTransitionSettlement({ resolve, onComplete, onSettled });

    expect(settle()).toBe(true);
    expect(settle()).toBe(false);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  test('forced cleanup resolves the pending promise without launching the next screen', () => {
    const resolve = jest.fn();
    const onComplete = jest.fn();
    const onSettled = jest.fn();
    const settle = createBoardTransitionSettlement({ resolve, onComplete, onSettled });

    expect(settle(false)).toBe(true);
    expect(settle()).toBe(false);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  test('does not resolve until an asynchronous gameplay handoff completes', async () => {
    const resolve = jest.fn();
    let finish = () => {};
    const settle = createBoardTransitionSettlement({
      resolve,
      onComplete: () => new Promise<void>((done) => { finish = done; }),
    });

    settle();
    expect(resolve).not.toHaveBeenCalled();
    finish();
    await Promise.resolve();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  test('routes asynchronous handoff rejection to the transition owner', async () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const error = new Error('board boot failed');
    const settle = createBoardTransitionSettlement({
      resolve,
      reject,
      onComplete: async () => { throw error; },
    });

    settle();
    await Promise.resolve();
    await Promise.resolve();
    expect(reject).toHaveBeenCalledWith(error);
    expect(resolve).not.toHaveBeenCalled();
  });

  test('still resolves when cleanup bookkeeping throws', () => {
    const resolve = jest.fn();
    const settle = createBoardTransitionSettlement({
      resolve,
      onComplete: jest.fn(),
      onSettled: () => { throw new Error('cleanup bookkeeping failed'); },
    });

    expect(() => settle(false)).toThrow('cleanup bookkeeping failed');
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(settle(false)).toBe(false);
  });
});
