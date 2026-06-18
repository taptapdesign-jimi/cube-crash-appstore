import {
  FINAL_MERGE_REASONS,
  getFinalMergeCleanBoardReason,
  reasonAlreadyPassedTntCompletion,
  reasonExpectsJuiceFinale,
  reasonExpectsMagnetFinale,
  reasonExpectsSparkleFinale,
} from '../final-merge-reasons';

test('maps finale fx to clean-board handoff reasons', () => {
  expect(getFinalMergeCleanBoardReason('tnt')).toBe(FINAL_MERGE_REASONS.tnt);
  expect(getFinalMergeCleanBoardReason('juice')).toBe(FINAL_MERGE_REASONS.juice);
  expect(getFinalMergeCleanBoardReason('magnet')).toBe(FINAL_MERGE_REASONS.magnet);
  expect(getFinalMergeCleanBoardReason('star')).toBe(FINAL_MERGE_REASONS.star);
  expect(getFinalMergeCleanBoardReason(null)).toBe(FINAL_MERGE_REASONS.default);
});

test('classifies final merge handoff reasons by required animation', () => {
  expect(reasonAlreadyPassedTntCompletion(FINAL_MERGE_REASONS.tnt)).toBe(true);
  expect(reasonAlreadyPassedTntCompletion(FINAL_MERGE_REASONS.tntAfterAnimation)).toBe(true);
  expect(reasonAlreadyPassedTntCompletion(FINAL_MERGE_REASONS.tntFallbackTimeout)).toBe(true);

  expect(reasonExpectsJuiceFinale(FINAL_MERGE_REASONS.juice)).toBe(true);
  expect(reasonExpectsSparkleFinale(FINAL_MERGE_REASONS.star)).toBe(true);
  expect(reasonExpectsMagnetFinale(FINAL_MERGE_REASONS.magnet)).toBe(true);

  expect(reasonExpectsJuiceFinale(FINAL_MERGE_REASONS.star)).toBe(false);
  expect(reasonExpectsSparkleFinale(FINAL_MERGE_REASONS.juice)).toBe(false);
  expect(reasonExpectsMagnetFinale(FINAL_MERGE_REASONS.default)).toBe(false);
});
