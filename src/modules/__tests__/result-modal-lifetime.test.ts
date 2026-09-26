import { createResultModalLifetime } from '../result-modal-lifetime';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('hidden time preserves pending entrance and its relative delay on resume', () => {
  const owner = createResultModalLifetime();
  const work = jest.fn();
  owner.timeout(work, 1000);
  jest.advanceTimersByTime(300);
  owner.setSuspended(true);
  expect(jest.getTimerCount()).toBe(0);
  jest.advanceTimersByTime(5000);
  expect(work).not.toHaveBeenCalled();
  owner.setSuspended(false);
  jest.advanceTimersByTime(699);
  expect(work).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(work).toHaveBeenCalledTimes(1);
  owner.dispose();
});

test('dispose is idempotent, cancels frames and timers, and settles waits', () => {
  const owner = createResultModalLifetime();
  const work = jest.fn();
  const settle = jest.fn();
  owner.timeout(work, 100);
  owner.frame(work);
  owner.onDispose(settle);
  owner.dispose(); owner.dispose();
  owner.timeout(work, 0); owner.frame(work);
  jest.runAllTimers();
  expect(work).not.toHaveBeenCalled();
  expect(settle).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('an already delivered cancelled frame cannot run after resume or replacement', () => {
  const callbacks: FrameRequestCallback[] = [];
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { callbacks.push(cb); return callbacks.length; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const owner = createResultModalLifetime();
  const work = jest.fn();
  owner.frame(work);
  owner.setSuspended(true);
  owner.setSuspended(false);
  callbacks[0](0);
  expect(work).not.toHaveBeenCalled();
  callbacks[1](16);
  expect(work).toHaveBeenCalledTimes(1);
  owner.dispose();
  callbacks[1](32);
  expect(work).toHaveBeenCalledTimes(1);
});
