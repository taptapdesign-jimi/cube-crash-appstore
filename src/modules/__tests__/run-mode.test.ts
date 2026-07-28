import {
  getRunMode,
  markArcadeHomeRunOrigin,
  RUN_MODE_ARCADE_HOME,
  RUN_MODE_JOURNEY,
  setRunMode,
  shouldRenderWildStarOrbit,
} from '../run-mode';

describe('run-mode arcade origin', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (global as any).__ccRunMode;
    delete (global as any).__ccCameFromHomepage;
    delete (global as any).__ccCameFromJourney;
    delete (global as any).__ccFromInterimBoard;
    delete (global as any).__ccIsInterimBoard;
    delete (global as any).__ccReturningFromInterimBoard;
    delete (global as any).__ccCameFromDetailModal;
    delete (global as any).__ccDetailModalBoardId;
  });

  it('marks arcade as homepage origin and clears stale journey flags', () => {
    (global as any).__ccCameFromJourney = true;
    (global as any).__ccFromInterimBoard = true;
    (global as any).__ccIsInterimBoard = true;
    (global as any).__ccReturningFromInterimBoard = true;
    (global as any).__ccCameFromDetailModal = true;
    (global as any).__ccDetailModalBoardId = 7;
    localStorage.setItem('__ccCameFromJourney', 'true');
    localStorage.setItem('__ccFromInterimBoard', 'true');
    localStorage.setItem('__ccReturningFromInterimBoard', 'true');

    markArcadeHomeRunOrigin();

    expect(getRunMode()).toBe(RUN_MODE_ARCADE_HOME);
    expect((global as any).__ccCameFromHomepage).toBe(true);
    expect((global as any).__ccCameFromJourney).toBe(false);
    expect((global as any).__ccFromInterimBoard).toBe(false);
    expect((global as any).__ccIsInterimBoard).toBe(false);
    expect((global as any).__ccReturningFromInterimBoard).toBeUndefined();
    expect((global as any).__ccCameFromDetailModal).toBeUndefined();
    expect((global as any).__ccDetailModalBoardId).toBeUndefined();
    expect(localStorage.getItem('__ccCameFromHomepage')).toBe('true');
    expect(localStorage.getItem('__ccCameFromJourney')).toBeNull();
    expect(localStorage.getItem('__ccFromInterimBoard')).toBeNull();
    expect(localStorage.getItem('__ccReturningFromInterimBoard')).toBeNull();
  });

  it('allows the wild-star idle orbit in Journey but never in Arcade', () => {
    setRunMode(RUN_MODE_JOURNEY);
    expect(shouldRenderWildStarOrbit()).toBe(true);

    setRunMode(RUN_MODE_ARCADE_HOME);
    expect(shouldRenderWildStarOrbit()).toBe(false);
  });
});
