import { HomepageEnterTransitionOwner } from '../homepage-enter-transition-owner';

describe('Homepage enter transition owner', () => {
  it('cancels the previous owner before a replacement can start', async () => {
    const owner = new HomepageEnterTransitionOwner();
    const cancelled: string[] = [];
    const first = owner.begin('journey-return', 1);
    first.onCancel((reason) => cancelled.push(reason));

    const second = owner.begin('settings-return', 0);

    await expect(first.settled).resolves.toBe('cancelled');
    expect(cancelled).toEqual(['superseded-by-new-homepage-enter']);
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it('settles exactly once when the current owner completes', async () => {
    const owner = new HomepageEnterTransitionOwner();
    const lease = owner.begin('journey-return', 1);

    lease.complete();
    lease.complete();

    await expect(lease.settled).resolves.toBe('completed');
    expect(owner.isActive()).toBe(false);
  });
});
