import { JourneyPostEnterOwner } from '../journey-post-enter-owner';

describe('JourneyPostEnterOwner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('replacement cancels delayed work from the previous epoch', () => {
    const owner = new JourneyPostEnterOwner();
    const first = owner.acquire(1);
    const oldWork = jest.fn();
    first.schedule(oldWork, 100);

    const second = owner.acquire(2);
    const currentWork = jest.fn();
    second.schedule(currentWork, 100);
    jest.advanceTimersByTime(100);

    expect(first.isCurrent()).toBe(false);
    expect(oldWork).not.toHaveBeenCalled();
    expect(currentWork).toHaveBeenCalledTimes(1);
  });

  test('retirement clears all pending callbacks', () => {
    const owner = new JourneyPostEnterOwner();
    const lease = owner.acquire(7);
    const work = jest.fn();
    lease.schedule(work, 50);
    lease.schedule(work, 100);

    owner.retire();
    jest.runAllTimers();

    expect(lease.isCurrent()).toBe(false);
    expect(work).not.toHaveBeenCalled();
  });
});
