import {
  clearJourneyDetailReturn,
  clearJourneyInterimOrigin,
  isJourneyOriginActive,
  markJourneyDetailReturn,
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
