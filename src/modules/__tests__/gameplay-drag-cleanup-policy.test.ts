import { shouldDisposeGameplayDragOwner } from '../gameplay-drag-cleanup-policy';

describe('gameplay drag cleanup policy', () => {
  test.each([
    ['restartGame', false],
    ['endgame-arcade-play-again', false],
    ['endgame-play-again', false],
  ])('retains the installed drag overlay for soft board reset %s', (reason, isNavigationCleanup) => {
    expect(shouldDisposeGameplayDragOwner(reason, isNavigationCleanup)).toBe(false);
  });

  test.each([
    ['cleanupGame', false],
    ['nav:homepage', true],
    ['cc-navigation-home', true],
  ])('disposes the drag overlay for full teardown %s', (reason, isNavigationCleanup) => {
    expect(shouldDisposeGameplayDragOwner(reason, isNavigationCleanup)).toBe(true);
  });
});
