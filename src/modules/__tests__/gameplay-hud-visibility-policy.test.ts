import { isGameplayHudRevealAllowed } from '../gameplay-hud-visibility-policy';

describe('gameplay HUD visibility policy', () => {
  it.each(['board-arcade', 'board-journey'])('allows HUD reveal while %s owns the app', (zone) => {
    expect(isGameplayHudRevealAllowed({ __ccAppZone: zone, exitingToMenu: false })).toBe(true);
  });

  it('rejects every late HUD reveal as soon as menu exit owns the route', () => {
    expect(isGameplayHudRevealAllowed({ __ccAppZone: 'board-arcade', exitingToMenu: true })).toBe(false);
  });

  it.each(['home', 'journey', 'settings', 'clean-board', 'fail-screen'])(
    'rejects HUD reveal while %s owns the app',
    (zone) => {
      expect(isGameplayHudRevealAllowed({ __ccAppZone: zone, exitingToMenu: false })).toBe(false);
    },
  );

  it('keeps legacy tests/runtimes without an app-zone marker compatible', () => {
    expect(isGameplayHudRevealAllowed({ exitingToMenu: false })).toBe(true);
  });
});
