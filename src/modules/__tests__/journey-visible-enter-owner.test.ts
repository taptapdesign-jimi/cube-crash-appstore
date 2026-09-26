import { JourneyVisibleEnterOwner } from '../journey-visible-enter-owner';

describe('Journey visible enter ownership', () => {
  test('a re-entrant show in the same presentation epoch joins the active visible commit', async () => {
    const owner = new JourneyVisibleEnterOwner();
    const first = owner.acquire(7);
    const retry = owner.acquire(7);
    const retrySettled = jest.fn();

    expect(first.joined).toBe(false);
    expect(retry.joined).toBe(true);
    expect(retry.generation).toBe(first.generation);
    retry.promise.then(retrySettled);

    retry.settle();
    await Promise.resolve();
    expect(retrySettled).not.toHaveBeenCalled();
    expect(first.isCurrent()).toBe(true);

    first.settle();
    await Promise.resolve();
    expect(retrySettled).toHaveBeenCalledTimes(1);
    expect(first.isCurrent()).toBe(false);
  });

  test('a successor epoch retires the old owner and stale callbacks cannot settle it', async () => {
    const owner = new JourneyVisibleEnterOwner();
    const old = owner.acquire(10);
    const oldSettled = jest.fn();
    old.promise.then(oldSettled);

    const current = owner.acquire(11);
    await Promise.resolve();
    expect(oldSettled).toHaveBeenCalledTimes(1);
    expect(old.isCurrent()).toBe(false);
    expect(current.isCurrent()).toBe(true);

    old.settle();
    expect(current.isCurrent()).toBe(true);
    current.settle();
    await current.promise;
    expect(current.isCurrent()).toBe(false);
  });

  test('explicit retirement releases waiters without granting stale mutation ownership', async () => {
    const owner = new JourneyVisibleEnterOwner();
    const lease = owner.acquire(3);
    owner.retire();
    await lease.promise;
    expect(lease.isCurrent()).toBe(false);
  });
});
