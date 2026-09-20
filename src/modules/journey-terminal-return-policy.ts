export const JOURNEY_TERMINAL_RETURN_VISIBLE_BUDGET_MS = 1000;

export const CLEAN_BOARD_JOURNEY_EXIT_MOTION = Object.freeze({
  contentStepMs: 45,
  contentDurationMs: 420,
  cardLeadMs: 0,
  cardDurationMs: 220,
  paperFadeMs: 140,
});

export const FAIL_JOURNEY_EXIT_MOTION = Object.freeze({
  cardSettleDelayMs: 160,
  collapseDelayMs: 360,
  completionTailMs: 260,
});

export function resolveCleanBoardJourneyExitTiming(
  earnedStarCount: number,
  ctaExitDurationMs: number,
): { collapseDelayMs: number; completionMs: number } {
  const starCount = Math.max(0, Math.floor(earnedStarCount));
  const starExitDurationMs = starCount === 0
    ? 0
    : 500 + Math.max(0, starCount - 1) * 70;
  const contentExitDurationMs = 5 * CLEAN_BOARD_JOURNEY_EXIT_MOTION.contentStepMs
    + CLEAN_BOARD_JOURNEY_EXIT_MOTION.contentDurationMs;
  const cardExitDurationMs = starExitDurationMs
    + CLEAN_BOARD_JOURNEY_EXIT_MOTION.cardLeadMs
    + CLEAN_BOARD_JOURNEY_EXIT_MOTION.cardDurationMs;
  const collapseDelayMs = Math.max(
    contentExitDurationMs,
    starExitDurationMs,
    cardExitDurationMs,
    Math.max(0, ctaExitDurationMs),
  );
  return {
    collapseDelayMs,
    completionMs: collapseDelayMs + CLEAN_BOARD_JOURNEY_EXIT_MOTION.paperFadeMs,
  };
}
