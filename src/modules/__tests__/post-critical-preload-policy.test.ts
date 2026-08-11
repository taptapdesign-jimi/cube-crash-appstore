import { shouldPausePostCriticalPreload } from '../post-critical-preload-policy';

describe('post-critical preload lifecycle policy', () => {
  test('allows iOS preload while the home menu owns the screen', () => {
    expect(shouldPausePostCriticalPreload({ isIOS: true, appZone: 'home' })).toBe(false);
  });

  test.each([undefined, 'loader', 'settings', 'journey', 'board-journey', 'board-arcade'])(
    'pauses iOS preload in %s',
    appZone => expect(shouldPausePostCriticalPreload({ isIOS: true, appZone })).toBe(true)
  );

  test('pauses during transition even if the zone flag is stale', () => {
    expect(shouldPausePostCriticalPreload({
      isIOS: true,
      appZone: 'home',
      boardTransitionVisible: true,
    })).toBe(true);
  });

  test('does not change web preload behavior', () => {
    expect(shouldPausePostCriticalPreload({
      isIOS: false,
      appZone: 'board-journey',
      boardTransitionVisible: true,
    })).toBe(false);
  });
});
