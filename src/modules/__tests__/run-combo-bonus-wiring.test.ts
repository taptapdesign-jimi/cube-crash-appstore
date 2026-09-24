import fs from 'node:fs';
import path from 'node:path';
import { getRunComboBonus, recordRunCombo, resetRunComboBonus } from '../run-combo-bonus';

const source = (name: string) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('the actual shared HUD setters credit regular/Magnet combos and settle timed-out streaks', () => {
  const core = source('app-core.ts');
  const setters = core.slice(core.indexOf('function hudSetCombo(v)'), core.indexOf('// Export combo text for animations'));
  const hud = { setCombo: jest.fn(), resetCombo: jest.fn() };
  const makeSetters = new Function('recordRunCombo', 'HUD', 'hudSetComboHelper', 'hudResetComboHelper', `
    let combo = 0; const boardNumber = 1; const COMBO_CAP = 99;
    ${setters}
    return { set: hudSetCombo, reset: hudResetCombo };
  `);
  const owner = makeSetters(recordRunCombo, hud,
    (n: number, cap: number, set: (n: number) => void) => { const value = Math.min(n, cap); set(value); return value; },
    (reset: () => void) => reset());
  resetRunComboBonus(1);
  for (let n = 1; n <= 5; n++) owner.set(n);
  owner.reset();
  owner.set(8); // shared Magnet setter supports multi-tile jumps
  owner.set(8); // verification retry must not duplicate reward
  expect(getRunComboBonus(1)).toBe(1100);
  expect(hud.setCombo).toHaveBeenLastCalledWith(8);
  expect(hud.resetCombo).toHaveBeenCalledTimes(1);
});

test('reward projection and Clean Board receive the same attempt total instead of a board record', () => {
  const flow = source('endgame-flow.ts');
  const reward = flow.slice(flow.indexOf('const rewardCurrentScore'), flow.indexOf('const rewardCurrentScore') + 500);
  expect(reward).toContain('const comboBonus = getRunComboBonus(boardNumber)');
  expect(reward).toContain('comboBonus,');
  const modal = flow.slice(flow.indexOf('modalResult = await showCleanBoardModal'), flow.indexOf('modalResult = await showCleanBoardModal') + 700);
  expect(modal).toContain('comboBonus,');
  expect(source('clean-board-modal.ts')).not.toContain('longestCombo * 50');
});
