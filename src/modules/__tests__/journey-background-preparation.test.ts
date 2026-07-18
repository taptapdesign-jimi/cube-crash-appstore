import {
  isJourneyBackgroundPreparationAllowed,
  shouldBlockHiddenJourneyRender,
} from '../journey-background-preparation';

describe('Journey background preparation ownership', () => {
  test.each(['loader', 'home', 'journey', 'settings'])(
    'allows menu preparation in %s zone',
    appZone => {
      expect(isJourneyBackgroundPreparationAllowed({ appZone })).toBe(true);
    }
  );

  test.each(['board-arcade', 'board-journey', 'clean-board', 'new-card', 'stage-complete', 'fail-screen'])(
    'blocks late preparation in %s zone',
    appZone => {
      expect(isJourneyBackgroundPreparationAllowed({ appZone })).toBe(false);
    }
  );

  test('blocks a post-critical preload that resolves during game startup', () => {
    expect(isJourneyBackgroundPreparationAllowed({
      appZone: 'journey',
      gameStartInProgress: true,
    })).toBe(false);
  });

  test('blocks a late direct world render behind the board transition', () => {
    expect(shouldBlockHiddenJourneyRender(true, true)).toBe(true);
    expect(shouldBlockHiddenJourneyRender(false, true)).toBe(false);
    expect(shouldBlockHiddenJourneyRender(true, false)).toBe(false);
  });
});
