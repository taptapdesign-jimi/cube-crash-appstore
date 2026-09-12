import {
  applyJourneyReturnScrollIfOwned,
  beginJourneyReturnScrollOwnership,
  hasUserClaimedJourneyReturnScroll,
} from '../journey-return-scroll-ownership';

describe('Journey return scroll ownership', () => {
  test('allows layout stabilization before the player touches the returned World', () => {
    const scrollable = document.createElement('div');
    const apply = jest.fn();

    beginJourneyReturnScrollOwnership(scrollable);

    expect(applyJourneyReturnScrollIfOwned(scrollable, apply)).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(hasUserClaimedJourneyReturnScroll(scrollable)).toBe(false);
  });

  test('the first touch permanently cancels every late recenter in that return session', () => {
    const scrollable = document.createElement('div');
    const onUserClaim = jest.fn();
    const apply = jest.fn();

    beginJourneyReturnScrollOwnership(scrollable, onUserClaim);
    scrollable.dispatchEvent(new Event('touchstart', { bubbles: true }));

    expect(hasUserClaimedJourneyReturnScroll(scrollable)).toBe(true);
    expect(applyJourneyReturnScrollIfOwned(scrollable, apply)).toBe(false);
    expect(applyJourneyReturnScrollIfOwned(scrollable, apply)).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(onUserClaim).toHaveBeenCalledWith('touchstart');
  });

  test('a new Journey return session replaces the prior user claim', () => {
    const scrollable = document.createElement('div');
    const apply = jest.fn();

    beginJourneyReturnScrollOwnership(scrollable);
    scrollable.dispatchEvent(new Event('wheel', { bubbles: true }));
    expect(applyJourneyReturnScrollIfOwned(scrollable, apply)).toBe(false);

    beginJourneyReturnScrollOwnership(scrollable);
    expect(applyJourneyReturnScrollIfOwned(scrollable, apply)).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
