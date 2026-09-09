import {
  isNoMovesNavigationLocked,
  setNoMovesNavigationLocked,
} from '../terminal-navigation-lock';

describe('NO MOVES navigation lock', () => {
  afterEach(() => setNoMovesNavigationLocked(false));

  it('locks and releases navigation without owning gameplay input', () => {
    expect(isNoMovesNavigationLocked()).toBe(false);
    setNoMovesNavigationLocked(true);
    expect(isNoMovesNavigationLocked()).toBe(true);
    setNoMovesNavigationLocked(false);
    expect(isNoMovesNavigationLocked()).toBe(false);
  });
});
