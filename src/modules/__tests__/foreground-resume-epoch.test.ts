import { ForegroundResumeEpoch } from '../foreground-resume-epoch';

describe('ForegroundResumeEpoch', () => {
  test('coalesces repeated hidden and sequential visibility/pageshow foreground events', () => {
    const owner = new ForegroundResumeEpoch();
    expect(owner.beginSuspension(true)).toBe(true);
    expect(owner.beginSuspension(false)).toBe(false);

    const visibilityLease = owner.consume();
    expect(visibilityLease).toMatchObject({ resumeTicker: true });
    expect(owner.consume()).toBeNull();
  });

  test('does not restart a ticker that was stopped before suspension', () => {
    const owner = new ForegroundResumeEpoch();
    owner.beginSuspension(false);
    expect(owner.consume()).toMatchObject({ resumeTicker: false });
  });

  test('invalidates stale async recovery ownership', () => {
    const owner = new ForegroundResumeEpoch();
    owner.beginSuspension(true);
    const staleLease = owner.consume()!;
    owner.invalidate();
    expect(owner.isCurrent(staleLease)).toBe(false);
  });
});
