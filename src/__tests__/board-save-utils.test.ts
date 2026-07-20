import {
  getBoardSaveKey,
  hasResumableSavedStateForBoard,
  isBoardSaveStateResumable,
} from '../utils/board-save-utils.ts';

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
