import { loadSavedBoardState } from '../app-core-load-save.ts';
import {
  getArcadeSaveKey,
  getBoardSaveKey,
  getJourneyCompletedBoardKey,
  markJourneyBoardSaveCompleted,
} from '../../utils/board-save-utils.ts';

const starAndDieSave = {
  schemaVersion: 2,
  boardNumber: 3,
  level: 3,
  moves: 4,
  score: 120,
  grid: [[
    { value: 6, special: 'wild', open: true, gridX: 0, gridY: 0 },
    { value: 2, open: true, gridX: 1, gridY: 0 },
  ]],
};

const readBoard = (isArcade = false) => loadSavedBoardState({
  boardNumber: 3,
  getBoardSaveKey: isArcade ? getArcadeSaveKey : getBoardSaveKey,
  isArcade,
  devLog: () => {},
  devWarn: () => {},
  rows: 1,
  cols: 2,
});

describe('completed Journey board direct restore', () => {
  afterEach(() => localStorage.clear());

  test('foreground direct load rejects a tombstoned star and die', () => {
    markJourneyBoardSaveCompleted(3);
    localStorage.setItem(getBoardSaveKey(3), JSON.stringify(starAndDieSave));

    expect(readBoard()).toBeNull();
    expect(localStorage.getItem(getBoardSaveKey(3))).toBeNull();
  });

  test('pre-upgrade matching Clean Board receipt migrates before direct load', () => {
    localStorage.setItem('cc_board_completed', JSON.stringify({ completedLevel: 3, nextLevel: 4 }));
    localStorage.setItem(getBoardSaveKey(3), JSON.stringify(starAndDieSave));

    expect(readBoard()).toBeNull();
    expect(localStorage.getItem(getJourneyCompletedBoardKey(3))).toBe('1');
    expect(localStorage.getItem(getBoardSaveKey(3))).toBeNull();
    expect(localStorage.getItem('cc_board_completed')).not.toBeNull();
  });

  test('a different board receipt does not discard an in-progress Journey save', () => {
    localStorage.setItem('cc_board_completed', JSON.stringify({ completedLevel: 4, nextLevel: 5 }));
    localStorage.setItem(getBoardSaveKey(3), JSON.stringify(starAndDieSave));

    expect(readBoard()?.gameState.boardNumber).toBe(3);
    expect(localStorage.getItem(getJourneyCompletedBoardKey(3))).toBeNull();
  });

  test('Arcade direct load ignores Journey completion for the same number', () => {
    markJourneyBoardSaveCompleted(3);
    localStorage.setItem(getArcadeSaveKey(), JSON.stringify(starAndDieSave));

    expect(readBoard(true)?.gameState.boardNumber).toBe(3);
    expect(localStorage.getItem(getArcadeSaveKey())).not.toBeNull();
  });
});
