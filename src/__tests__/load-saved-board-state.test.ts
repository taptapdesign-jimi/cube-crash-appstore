import { loadSavedBoardState } from '../modules/app-core-load-save.ts';

type StorageMap = Record<string, string>;

const createLocalStorageMock = (store: StorageMap = {}) => {
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
    get length() {
      return Object.keys(store).length;
    },
    _dump: () => ({ ...store }),
  };
};

describe('loadSavedBoardState', () => {
  beforeEach(() => {
    (global as any).localStorage = createLocalStorageMock();
  });

  it('returns null when no saved game exists', () => {
    const storage = createLocalStorageMock();
    const result = loadSavedBoardState({
      boardNumber: 1,
      getBoardSaveKey: (n) => `cc_saved_game_board_${String(n).padStart(2, '0')}`,
      devLog: () => {},
      devWarn: () => {},
      storage
    });

    expect(result).toBeNull();
  });

  it('removes corrupted save and returns null', () => {
    const storage = createLocalStorageMock({
      cc_saved_game_board_01: '{bad json',
    });
    (global as any).localStorage = storage;

    const result = loadSavedBoardState({
      boardNumber: 1,
      getBoardSaveKey: (n) => `cc_saved_game_board_${String(n).padStart(2, '0')}`,
      devLog: () => {},
      devWarn: () => {},
      storage
    });

    expect(result).toBeNull();
    expect(storage.getItem('cc_saved_game_board_01')).toBeNull();
  });

  it('returns parsed state when valid and fresh', () => {
    const now = Date.now();
    const saved = {
      score: 10,
      level: 2,
      boardNumber: 2,
      moves: 5,
      timestamp: now,
      grid: [],
    };
    const storage = createLocalStorageMock({
      cc_saved_game_board_02: JSON.stringify(saved),
    });
    (global as any).localStorage = storage;

    const result = loadSavedBoardState({
      boardNumber: 2,
      getBoardSaveKey: (n) => `cc_saved_game_board_${String(n).padStart(2, '0')}`,
      devLog: () => {},
      devWarn: () => {},
      storage
    });

    expect(result).not.toBeNull();
    expect(result?.gameState?.score).toBe(10);
  });
});
