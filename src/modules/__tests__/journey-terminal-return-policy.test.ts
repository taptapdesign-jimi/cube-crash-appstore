import {
  CLEAN_BOARD_JOURNEY_EXIT_MOTION,
  FAIL_JOURNEY_EXIT_MOTION,
  JOURNEY_TERMINAL_RETURN_VISIBLE_BUDGET_MS,
  resolveCleanBoardJourneyExitTiming,
} from '../journey-terminal-return-policy';

describe('Journey terminal return timing policy', () => {
  test.each([0, 1, 2, 3])('keeps Clean Board %i-star exit inside the shared visible budget', (stars) => {
    const timing = resolveCleanBoardJourneyExitTiming(stars, 380);
    expect(timing.completionMs).toBeLessThanOrEqual(JOURNEY_TERMINAL_RETURN_VISIBLE_BUDGET_MS);
    expect(timing.collapseDelayMs).toBeGreaterThanOrEqual(380);
  });

  test('keeps the card, content and paper as explicit independent motion owners', () => {
    expect(CLEAN_BOARD_JOURNEY_EXIT_MOTION).toEqual({
      contentStepMs: 45,
      contentDurationMs: 420,
      cardLeadMs: 0,
      cardDurationMs: 220,
      paperFadeMs: 140,
    });
    expect(FAIL_JOURNEY_EXIT_MOTION.collapseDelayMs + FAIL_JOURNEY_EXIT_MOTION.completionTailMs)
      .toBeLessThanOrEqual(JOURNEY_TERMINAL_RETURN_VISIBLE_BUDGET_MS);
  });
});
