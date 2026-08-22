import {
  ARCADE_SAVE_KEY,
  getArcadeSavedRound,
  getBoardSaveKey,
  hasArcadeSavedState,
  hasResumableSavedStateForBoard,
  isArcadeSaveStateResumable,
  isBoardSaveStateResumable,
} from '../utils/board-save-utils.ts';

describe('Arcade saved-round continuation', () => {
  afterEach(() => localStorage.clear());

  test('reads the persisted Arcade board number as the continuation round', () => {
    localStorage.setItem(ARCADE_SAVE_KEY, JSON.stringify({ boardNumber: 12, level: 3 }));
    expect(getArcadeSavedRound()).toBe(12);
  });

  test('falls back to level and rejects missing or malformed saves', () => {
    localStorage.setItem(ARCADE_SAVE_KEY, JSON.stringify({ level: 2 }));
    expect(getArcadeSavedRound()).toBe(2);

    localStorage.setItem(ARCADE_SAVE_KEY, '{bad json');
    expect(getArcadeSavedRound()).toBeNull();

    localStorage.removeItem(ARCADE_SAVE_KEY);
    expect(getArcadeSavedRound()).toBeNull();
  });

  test('accepts only a playable Arcade continuation and clears terminal residue', () => {
    expect(isArcadeSaveStateResumable({
      boardNumber: 2,
      grid: [[{ value: 3, open: true }, { value: 2, open: true }]],
    })).toBe(true);
    expect(isArcadeSaveStateResumable({
      boardNumber: 2,
      grid: [[{ value: 6, open: true }, { value: 5, open: true }]],
    })).toBe(true);
    expect(isArcadeSaveStateResumable({
      boardNumber: 2,
      grid: [[{ value: 0, special: 'wild', open: true }]],
    })).toBe(false);

    localStorage.setItem(ARCADE_SAVE_KEY, JSON.stringify({
      boardNumber: 2,
      grid: [[{ value: 0, special: 'wild', open: true }]],
    }));
    expect(hasArcadeSavedState({ clearInvalid: true })).toBe(false);
    expect(localStorage.getItem(ARCADE_SAVE_KEY)).toBeNull();
  });
});

describe('Journey resumable board saves', () => {
  test('accepts a matching board with at least two playable tiles', () => {
    expect(isBoardSaveStateResumable({
      boardNumber: 3,
      grid: [[
        { value: 4, open: true },
        { value: 2, open: true },
      ]],
    }, 3)).toBe(true);
  });

  test('rejects terminal star-only residue', () => {
    expect(isBoardSaveStateResumable({
      boardNumber: 3,
      grid: [[{ value: 0, special: 'wild', open: true }]],
    }, 3)).toBe(false);
  });

  test('clears an invalid save when requested', () => {
    const store = new Map<string, string>();
    const key = getBoardSaveKey(3);
    store.set(key, JSON.stringify({ boardNumber: 3, tiles: [{ value: 0, special: 'wild' }] }));
    const storage = {
      getItem: (name: string) => store.get(name) ?? null,
      removeItem: (name: string) => { store.delete(name); },
    };

    expect(hasResumableSavedStateForBoard(3, { storage, clearInvalid: true })).toBe(false);
    expect(store.has(key)).toBe(false);
  });
});
