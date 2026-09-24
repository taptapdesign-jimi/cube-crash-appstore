import { getRunComboBonus, recordRunCombo, resetRunComboBonus, restoreRunComboBonus, snapshotRunComboBonus } from '../run-combo-bonus';
import { buildSaveState } from '../app-core-save-state';
import { restoreBasicState } from '../app-core-load-basics';
import { validateAndNormalizeGameSave } from '../app-core-save-schema';

beforeEach(() => resetRunComboBonus(1));

function streak(length: number) {
  recordRunCombo(1, 0);
  for (let n = 1; n <= length; n++) recordRunCombo(1, n);
}

test('counts all qualifying streaks, including the unfinished final streak', () => {
  streak(1);
  streak(2);
  expect(getRunComboBonus(1)).toBe(0);
  streak(3);
  expect(getRunComboBonus(1)).toBe(150);
  streak(5);
  expect(getRunComboBonus(1)).toBe(475);
  streak(8);
  expect(getRunComboBonus(1)).toBe(1250);
  expect(getRunComboBonus(1)).toBe(1250); // projection is read-only
});

test('three x8 streaks pay three times; longer streaks earn progressively more', () => {
  streak(8); streak(8); streak(8);
  expect(getRunComboBonus(1)).toBe(2325);
  resetRunComboBonus(1);
  streak(10);
  expect(getRunComboBonus(1)).toBe(1200);
});

test('Magnet jumps and repeated setter verification credit exactly once', () => {
  recordRunCombo(1, 2);
  recordRunCombo(1, 8);
  recordRunCombo(1, 8);
  expect(getRunComboBonus(1)).toBe(775);
  recordRunCombo(1, 9);
  expect(getRunComboBonus(1)).toBe(975);
});

test('a fresh attempt and switching boards never inherit another attempt', () => {
  streak(8);
  expect(getRunComboBonus(2)).toBe(0);
  recordRunCombo(2, 20);
  expect(getRunComboBonus(1)).toBe(775);
  resetRunComboBonus(1);
  expect(getRunComboBonus(1)).toBe(0);
  resetRunComboBonus(2);
  expect(getRunComboBonus(2)).toBe(0);
});

test('save/schema/load preserves earned reward and resumes with a new live streak', () => {
  streak(8);
  const saved = buildSaveState({ gridSnapshot: [[{ value: 1 }]], score: 100, level: 1,
    boardNumber: 1, moves: 40, wildMeter: 0, wildSpawnCount: 0, bestScore: 100,
    starsCount: 0, MOVES_MAX: 50, devLog: jest.fn() });
  const validated = validateAndNormalizeGameSave(JSON.parse(JSON.stringify(saved)), { rows: 1, cols: 1, allowLegacy: true });
  expect(validated.ok).toBe(true);
  if (!validated.ok) throw new Error('Save rejected');
  resetRunComboBonus(2);
  restoreBasicState({ gameState: validated.gameState, MOVES_MAX: 50, STATE: {},
    setScore: jest.fn(), setLevel: jest.fn(), setBoardNumber: jest.fn(), setMoves: jest.fn(),
    setWildMeter: jest.fn(), devLog: jest.fn() });
  expect(getRunComboBonus(1)).toBe(775);
  streak(3);
  expect(getRunComboBonus(1)).toBe(925);
  restoreRunComboBonus(1, snapshotRunComboBonus(1));
  expect(getRunComboBonus(1)).toBe(925);
});

test.each([undefined, null, {}, { version: 2, earnedBonus: 1000 }, { version: 1, earnedBonus: NaN }, { version: 1, earnedBonus: -1 }])('legacy or malformed attempt data does not borrow historical records: %p', saved => {
  streak(8);
  restoreRunComboBonus(1, saved);
  expect(getRunComboBonus(1)).toBe(0);
});

test('bounds malformed input and cumulative bonus', () => {
  recordRunCombo(1, NaN);
  expect(getRunComboBonus(1)).toBe(0);
  recordRunCombo(1, 9999);
  expect(getRunComboBonus(1)).toBe(121350);
  for (let i = 0; i < 10; i++) streak(99);
  expect(getRunComboBonus(1)).toBe(999999);
  restoreRunComboBonus(1, { version: 1, earnedBonus: Infinity });
  expect(getRunComboBonus(1)).toBe(0);
});
