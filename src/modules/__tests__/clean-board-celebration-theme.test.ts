import { resolveCleanBoardCelebrationTheme } from '../clean-board-celebration-theme';
import { RUN_MODE_ARCADE_HOME, RUN_MODE_JOURNEY } from '../run-mode';

describe('Clean Board celebration World ownership', () => {
  test.each([
    [1, 'forest'],
    [10, 'forest'],
    [11, 'beach'],
    [20, 'beach'],
    [21, 'area55'],
    [30, 'area55'],
  ] as const)('maps Journey board %i through the World registry to %s', (boardNumber, theme) => {
    expect(resolveCleanBoardCelebrationTheme({
      boardNumber,
      runMode: RUN_MODE_JOURNEY,
    })).toBe(theme);
  });

  test.each([1, 15, 29])('never treats Arcade Round %i as a Journey World', (boardNumber) => {
    expect(resolveCleanBoardCelebrationTheme({
      boardNumber,
      runMode: RUN_MODE_ARCADE_HOME,
    })).toBe('area55');
  });

  test.each([0, 31, Number.NaN])('fails safely to the existing confetti for invalid board %p', (boardNumber) => {
    expect(resolveCleanBoardCelebrationTheme({
      boardNumber,
      runMode: RUN_MODE_JOURNEY,
    })).toBe('area55');
  });
});
