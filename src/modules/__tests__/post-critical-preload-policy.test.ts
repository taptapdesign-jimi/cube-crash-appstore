import { shouldPausePostCriticalPreload } from '../post-critical-preload-policy';

describe('post-critical preload lifecycle policy', () => {
  test('allows mobile preload while the home menu owns the screen', () => {
    expect(shouldPausePostCriticalPreload({ isMobileRuntime: true, appZone: 'home' })).toBe(false);
  });

  test.each([undefined, 'loader', 'settings', 'journey', 'board-journey', 'board-arcade'])(
    'pauses mobile preload in %s',
    appZone => expect(shouldPausePostCriticalPreload({ isMobileRuntime: true, appZone })).toBe(true)
  );

  test('pauses during transition even if the zone flag is stale', () => {
    expect(shouldPausePostCriticalPreload({
      isMobileRuntime: true,
      appZone: 'home',
      boardTransitionVisible: true,
    })).toBe(true);
  });

  test('does not change web preload behavior', () => {
    expect(shouldPausePostCriticalPreload({
      isMobileRuntime: false,
      appZone: 'board-journey',
      boardTransitionVisible: true,
    })).toBe(false);
  });
});
