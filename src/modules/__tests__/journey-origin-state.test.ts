import {
  cancelJourneyCardOverlayReturn,
  clearJourneyDetailReturn,
  clearJourneyInterimOrigin,
  completeJourneyCardOverlayReturn,
  getJourneyCardOverlayReturnBoardId,
  isJourneyOriginActive,
  markJourneyDetailReturn,
  markJourneyCardOverlayReturn,
  markJourneyGameOrigin,
  prepareJourneyFailReturnTarget,
  resolveJourneyReturnTarget,
} from '../journey-origin-state';

const storage = new Map<string, string>();

jest.mock('../run-mode.js', () => ({
  RUN_MODE_JOURNEY: 'journey',
  setRunMode: jest.fn(),
}));

jest.mock('../journey-boards-manager.js', () => ({
  journeyBoardsManager: {
    getBoardById: jest.fn((id: number) => ({ id, unlocked: id === 4 })),
  },
}));

describe('journey-origin-state', () => {
  beforeEach(() => {
    storage.clear();
    (global as any).window = global;
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
    Object.defineProperty((global as any).window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
    delete (global as any).__ccCameFromJourney;
    delete (global as any).__ccCameFromHomepage;
    delete (global as any).__ccFromInterimBoard;
    delete (global as any).__ccIsInterimBoard;
    delete (global as any).__ccReturningFromInterimBoard;
    delete (global as any).__ccCameFromDetailModal;
    delete (global as any).__ccDetailModalBoardId;
    delete (global as any).__ccReturningFromDetailModal;
    delete (global as any).__ccJourneyReturnBoardId;
    delete (global as any).__ccLastActiveJourneyBoardAreaId;
    delete (global as any).__ccJourneyCardOverlayReturnBoardId;
    document.body.innerHTML = '';
  });

  it('marks journey origin without leaving homepage flag active', () => {
    markJourneyGameOrigin({ fromInterim: true });

    expect(isJourneyOriginActive()).toBe(true);
    expect((global as any).__ccCameFromJourney).toBe(true);
    expect((global as any).__ccCameFromHomepage).toBe(false);
    expect(storage.get('__ccFromInterimBoard')).toBe('true');
  });

  it('returns to journey screen for interim boards', async () => {
    markJourneyGameOrigin({ fromInterim: true });

    await expect(resolveJourneyReturnTarget(2)).resolves.toEqual({
      target: 'journey',
      boardId: 2,
      isUnlockedBoard: false,
      isInterim: true,
    });
  });

  it('returns directly to detail modal for unlocked regular journey boards', async () => {
    markJourneyDetailReturn(4);

    await expect(resolveJourneyReturnTarget(4)).resolves.toEqual({
      target: 'detail-modal',
      boardId: 4,
      isUnlockedBoard: true,
      isInterim: false,
    });
  });

  it('keeps an overlay return pending until the exact card landing is acknowledged', async () => {
    document.body.innerHTML = '<div class="journey-board-card" data-board-id="4"></div>';
    markJourneyGameOrigin({ fromInterim: false });
    markJourneyCardOverlayReturn(4);

    expect(getJourneyCardOverlayReturnBoardId()).toBe(4);
    expect(document.querySelector('.journey-board-card')?.classList)
      .toContain('journey-board-card-return-placeholder');

    await expect(resolveJourneyReturnTarget(4)).resolves.toEqual({
      target: 'journey',
      boardId: 4,
      isUnlockedBoard: true,
      isInterim: false,
    });
    expect(getJourneyCardOverlayReturnBoardId()).toBe(4);
    expect(completeJourneyCardOverlayReturn(5)).toBe(false);
    expect(getJourneyCardOverlayReturnBoardId()).toBe(4);
    document.querySelector('.journey-board-card')?.classList
      .add('journey-board-card-return-landing');
    expect(completeJourneyCardOverlayReturn(4)).toBe(true);
    expect(getJourneyCardOverlayReturnBoardId()).toBeNull();
    expect(document.querySelector('.journey-board-card')?.classList)
      .not.toContain('journey-board-card-return-placeholder');
    expect(document.querySelector('.journey-board-card')?.classList)
      .toContain('journey-board-card-return-landing');

    markJourneyCardOverlayReturn(4);
    expect(cancelJourneyCardOverlayReturn(4)).toBe(true);
    expect(document.querySelector('.journey-board-card')?.classList)
      .not.toContain('journey-board-card-return-placeholder');
    expect(document.querySelector('.journey-board-card')?.classList)
      .not.toContain('journey-board-card-return-landing');
  });

  it('supports every current Journey stage, including Area 55 stages 26 through 30', () => {
    expect(markJourneyCardOverlayReturn(30)).toBe(30);
    expect(getJourneyCardOverlayReturnBoardId()).toBe(30);
    expect(completeJourneyCardOverlayReturn(30)).toBe(true);
    expect(markJourneyCardOverlayReturn(31)).toBeNull();
  });

  it('falls back to journey screen for locked regular journey boards', async () => {
    markJourneyGameOrigin({ fromInterim: false });

    await expect(resolveJourneyReturnTarget(5)).resolves.toEqual({
      target: 'journey',
      boardId: 5,
      isUnlockedBoard: false,
      isInterim: false,
    });
  });

  it('returns failed unlocked boards to their Journey world instead of the detail modal', () => {
    markJourneyDetailReturn(4);

    expect(prepareJourneyFailReturnTarget(4)).toEqual({
      target: 'journey',
      boardId: 4,
      isUnlockedBoard: false,
      isInterim: false,
    });
    expect((global as any).__ccCameFromJourney).toBe(true);
    expect((global as any).__ccCameFromDetailModal).toBeUndefined();
    expect((global as any).__ccDetailModalBoardId).toBeUndefined();
    expect((global as any).__ccReturningFromDetailModal).toBe(true);
    expect((global as any).__ccJourneyReturnBoardId).toBe(4);
    expect(storage.get('__ccJourneyReturnBoardId')).toBe('4');
    expect((global as any).__ccLastActiveJourneyBoardAreaId).toBe(4);
    expect(storage.get('__ccLastActiveJourneyBoardAreaId')).toBe('4');
  });

  it('clears detail and interim return flags independently', () => {
    markJourneyDetailReturn(4);
    markJourneyGameOrigin({ fromInterim: true });

    clearJourneyDetailReturn();
    clearJourneyInterimOrigin();

    expect((global as any).__ccCameFromDetailModal).toBeUndefined();
    expect((global as any).__ccDetailModalBoardId).toBeUndefined();
    expect((global as any).__ccFromInterimBoard).toBe(false);
    expect(storage.get('__ccFromInterimBoard')).toBeUndefined();
  });
});
