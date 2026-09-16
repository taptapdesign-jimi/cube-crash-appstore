import {
  ARCADE_SAVE_KEY,
  ARCADE_PENDING_ROUND_KEY,
  clearArcadeSaveState,
  clearPendingArcadeRound,
  clearJourneyBoardSaveCompleted,
  getArcadeSavedRound,
  getPendingArcadeRound,
  getBoardSaveKey,
  getJourneyCompletedBoardKey,
  hasArcadeSavedState,
  hasArcadePersistedBoardState,
  hasResumableSavedStateForBoard,
  isArcadeSaveStateResumable,
  isBoardSaveStateResumable,
  isJourneyBoardSaveCompleted,
  markJourneyBoardSaveCompleted,
  migrateJourneyCompletionReceiptBeforeClear,
  setPendingArcadeRound,
} from '../utils/board-save-utils.ts';
import { validateAndNormalizeGameSave } from '../modules/app-core-save-schema.ts';

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

  test('accepted Continue receipt takes priority over an old playable Round snapshot', () => {
    localStorage.setItem(ARCADE_SAVE_KEY, JSON.stringify({
      boardNumber: 1,
      grid: [[{ value: 3, open: true }, { value: 2, open: true }]],
    }));
    setPendingArcadeRound(2, 420);
    expect(getPendingArcadeRound()).toEqual({ round: 2, score: 420 });
    expect(getArcadeSavedRound()).toBe(1);
    expect(hasArcadeSavedState()).toBe(true);
    expect(hasArcadePersistedBoardState()).toBe(true);
    clearPendingArcadeRound();
    expect(localStorage.getItem(ARCADE_PENDING_ROUND_KEY)).toBeNull();
    clearArcadeSaveState();
    expect(getArcadeSavedRound()).toBeNull();
  });

  test('receipt alone offers Arcade Continue until the promised board is saved', () => {
    setPendingArcadeRound(2, 0);
    expect(hasArcadeSavedState()).toBe(true);
    expect(hasArcadePersistedBoardState()).toBe(false);
    clearArcadeSaveState();
    expect(hasArcadeSavedState()).toBe(false);
  });

  test("a canceled old cue cannot clear a newer owner's receipt", () => {
    setPendingArcadeRound(2, 100, 'new-owner');
    clearPendingArcadeRound('old-owner');
    expect(getPendingArcadeRound()).toEqual({ round: 2, score: 100, ownerId: 'new-owner' });
    clearPendingArcadeRound('new-owner');
    expect(getPendingArcadeRound()).toBeNull();
  });

  test('a malformed new-Round board cannot supersede its valid receipt', () => {
    setPendingArcadeRound(2, 420, 'accepted-cue');
    const malformed = {
      boardNumber: 2, level: 1,
      grid: [[{ value: 3, open: true, gridX: 0, gridY: 0 },
        { value: 2, open: true, gridX: 1, gridY: 0 }]],
    };
    localStorage.setItem(ARCADE_SAVE_KEY, JSON.stringify(malformed));
    expect(hasArcadePersistedBoardState()).toBe(true);
    expect(validateAndNormalizeGameSave(malformed, { rows: 1, cols: 2 }).ok).toBe(false);
    expect(getPendingArcadeRound()).toEqual({ round: 2, score: 420, ownerId: 'accepted-cue' });
  });
});

describe('Journey resumable board saves', () => {
  afterEach(() => localStorage.clear());

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

  test('a completed board cannot Continue from its saved star and die after hard exit', () => {
    const completedSaveKey = getBoardSaveKey(3);
    const otherSaveKey = getBoardSaveKey(4);
    const twoDiceSnapshot = JSON.stringify({
      boardNumber: 3,
      grid: [[
        { value: 6, special: 'wild', open: true },
        { value: 2, open: true },
      ]],
    });
    localStorage.setItem(completedSaveKey, twoDiceSnapshot);
    localStorage.setItem(otherSaveKey, JSON.stringify({ boardNumber: 4 }));
    expect(hasResumableSavedStateForBoard(3)).toBe(true);

    markJourneyBoardSaveCompleted(3);
    expect(localStorage.getItem(getJourneyCompletedBoardKey(3))).toBe('1');
    expect(isJourneyBoardSaveCompleted(3)).toBe(true);
    expect(localStorage.getItem(completedSaveKey)).toBeNull();
    expect(localStorage.getItem(otherSaveKey)).not.toBeNull();

    // A late pagehide writer or an older stored snapshot is still rejected.
    localStorage.setItem(completedSaveKey, twoDiceSnapshot);
    expect(hasResumableSavedStateForBoard(3, { clearInvalid: true })).toBe(false);
    expect(localStorage.getItem(completedSaveKey)).toBeNull();

    // A deliberate fresh Play Again removes only this board's guard.
    clearJourneyBoardSaveCompleted(3);
    localStorage.setItem(completedSaveKey, twoDiceSnapshot);
    expect(hasResumableSavedStateForBoard(3)).toBe(true);
  });

  test('an older exact Clean Board receipt upgrades a stale Continue snapshot', () => {
    const saveKey = getBoardSaveKey(3);
    localStorage.setItem(saveKey, JSON.stringify({
      boardNumber: 3,
      grid: [[{ value: 6, special: 'wild', open: true }, { value: 2, open: true }]],
    }));
    localStorage.setItem('cc_board_completed', JSON.stringify({ completedLevel: 3, nextLevel: 4 }));

    expect(hasResumableSavedStateForBoard(3, { clearInvalid: true })).toBe(false);
    expect(isJourneyBoardSaveCompleted(3)).toBe(true);
    expect(localStorage.getItem(saveKey)).toBeNull();
    expect(localStorage.getItem('cc_board_completed')).not.toBeNull();
  });

  test('Home entry can consume an old completion receipt without reviving its board', () => {
    const saveKey = getBoardSaveKey(3);
    localStorage.setItem(saveKey, JSON.stringify({
      boardNumber: 3,
      grid: [[{ value: 6, special: 'wild', open: true }, { value: 2, open: true }]],
    }));
    localStorage.setItem('cc_board_completed', JSON.stringify({ completedLevel: 3, nextLevel: 4 }));

    expect(migrateJourneyCompletionReceiptBeforeClear()).toBe(3);
    localStorage.removeItem('cc_board_completed');
    expect(isJourneyBoardSaveCompleted(3)).toBe(true);
    expect(localStorage.getItem(saveKey)).toBeNull();
    expect(hasResumableSavedStateForBoard(3)).toBe(false);

    localStorage.setItem('cc_board_completed', JSON.stringify({ completedLevel: 4, nextLevel: 7 }));
    expect(migrateJourneyCompletionReceiptBeforeClear()).toBeNull();
    expect(isJourneyBoardSaveCompleted(4)).toBe(false);
    expect(isJourneyBoardSaveCompleted(3)).toBe(true);
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
