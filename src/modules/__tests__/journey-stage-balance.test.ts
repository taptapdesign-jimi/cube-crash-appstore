import {
  getJourneyEarnedStars,
  getJourneyStageBalance,
} from '../journey-stage-balance';

describe('Journey per-world stage balance', () => {
  test.each([
    [1, 1, 'very-easy', 0.75],
    [3, 3, 'very-easy', 0.75],
    [4, 4, 'medium', 0.4],
    [6, 6, 'medium', 0.4],
    [7, 7, 'normal', 0],
    [10, 10, 'normal', 0],
    [11, 1, 'very-easy', 0.75],
    [21, 1, 'very-easy', 0.75],
    [30, 10, 'normal', 0],
  ])('board %i maps to local stage %i and %s difficulty', (board, localStage, difficulty, bias) => {
    expect(getJourneyStageBalance(board)).toMatchObject({
      stageInWorld: localStage,
      difficulty,
      smallValueBias: bias,
    });
  });

  test.each([
    [1, 2499, 1],
    [1, 2500, 2],
    [11, 6500, 3],
    [4, 2999, 1],
    [14, 3000, 2],
    [24, 8000, 3],
    [7, 3499, 1],
    [17, 3500, 2],
    [30, 9499, 2],
    [30, 9500, 3],
  ])('board %i maps score %i to %i stars', (board, score, stars) => {
    expect(getJourneyEarnedStars(score, board)).toBe(stars);
  });

  test('an unplayed board has no earned stars', () => {
    expect(getJourneyEarnedStars(0, 1)).toBe(0);
  });
});
