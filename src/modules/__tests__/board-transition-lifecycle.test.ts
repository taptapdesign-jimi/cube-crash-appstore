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
