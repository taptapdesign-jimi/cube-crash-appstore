import { computeCleanBoardFinalScore } from '../clean-board-score-utils';

describe('Clean Board final-score projection', () => {
  test('matches the reward score formula used by the modal', () => {
    expect(computeCleanBoardFinalScore({
      currentScore: 5900,
      comboBonus: 200,
      efficiencyBonus: 400,
    })).toBe(6500);
  });

  test('clamps invalid inputs and the score cap', () => {
    expect(computeCleanBoardFinalScore({
      currentScore: 999900,
      comboBonus: 500,
      efficiencyBonus: 500,
      scoreCap: 999999,
    })).toBe(999999);
    expect(computeCleanBoardFinalScore({
      currentScore: Number.NaN,
      comboBonus: -100,
      efficiencyBonus: -5,
    })).toBe(0);
  });
});
