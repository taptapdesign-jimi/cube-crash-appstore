import { computeEfficiencyBonus, computeEfficiencyBonusFromState, computeCleanBoardFinalScore } from '../clean-board-score-utils';

const reward = (movesRemaining: number, maxStackDepth = 1) => computeEfficiencyBonus({
  bonus: 500, boardNumber: 1, maxMoves: 50, movesRemaining, maxStackDepth,
});

describe('Clean Board move efficiency', () => {
  afterEach(() => { delete (window as any).STATE; });

  test('strongly rewards short clears even without stacking or combo', () => {
    expect(reward(40)).toBe(1598); // ten spent moves; previously 318
    expect(reward(30)).toBe(996); // twenty spent moves; previously 276
    expect(reward(10)).toBe(272);
    expect(reward(40)).toBeGreaterThan(reward(10, 4));
  });

  test('every saved move increases the reward, with larger gains for short clears', () => {
    for (let remaining = 1; remaining <= 50; remaining++) {
      expect(reward(remaining)).toBeGreaterThan(reward(remaining - 1));
    }
    expect(reward(40) - reward(30)).toBeGreaterThan(reward(20) - reward(10));
  });

  test('preserves completion and stack rewards and caps efficiency at five times base', () => {
    expect(reward(0)).toBe(150);
    expect(reward(0, 4)).toBe(290);
    expect(reward(50, 4)).toBe(2500);
    expect(reward(500, 100)).toBe(2500);
    expect(reward(-10, -1)).toBe(150);
    expect(reward(30, 4) - reward(30)).toBe(140);
  });

  test('scales by the board bonus and move budget, not accumulated score', () => {
    expect(computeEfficiencyBonus({ bonus: 1000, boardNumber: 2, maxMoves: 100, movesRemaining: 80 })).toBe(3196);
    expect(computeEfficiencyBonus({ bonus: 0, boardNumber: 1, movesRemaining: 50 })).toBe(0);
    expect(computeCleanBoardFinalScore({ currentScore: 100, comboBonus: 0, efficiencyBonus: reward(40) })).toBe(1698);
  });

  test('uses the persisted remaining moves and safely handles missing state', () => {
    (window as any).STATE = { moves: 40, maxStackDepth: 1 };
    expect(computeEfficiencyBonusFromState({ bonus: 500, boardNumber: 1 })).toBe(1598);
    (window as any).STATE = { moves: 40 }; // older/resumed save without stack history
    expect(computeEfficiencyBonusFromState({ bonus: 500, boardNumber: 1 })).toBe(1598);
    delete (window as any).STATE;
    expect(computeEfficiencyBonusFromState({ bonus: 500, boardNumber: 1 })).toBe(150);
  });
});
