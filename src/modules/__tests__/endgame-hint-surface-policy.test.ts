import { isEndgameHintSurfaceAllowed } from '../endgame-hint-surface-policy';

describe('endgame hint surface policy', () => {
  it.each(['home', 'journey', 'settings', 'loader', undefined])(
    'rejects delayed gameplay hints in %s zone',
    (zone) => {
      expect(isEndgameHintSurfaceAllowed(zone, true)).toBe(false);
    },
  );

  it.each(['board-arcade', 'board-journey'])(
    'allows hints only on a visible %s surface',
    (zone) => {
      expect(isEndgameHintSurfaceAllowed(zone, true)).toBe(true);
      expect(isEndgameHintSurfaceAllowed(zone, false)).toBe(false);
    },
  );
});
