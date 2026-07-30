export const DETAIL_MODAL_STATS_ENTER_MOTION = Object.freeze({
  baseDelaySeconds: 0,
  staggerSeconds: 0.05,
  durationSeconds: 0.4,
});

/**
 * The accepted detail-stat exit uses five equal beats in DOM order. Enter is
 * that same CSS animation played backwards, so every stat and divider keeps
 * the identical duration and relative spacing.
 */
export function createDetailModalStatsEnterDelays(
  elementCount: number,
): number[] {
  return Array.from({ length: Math.max(0, elementCount) }, (_, elementIndex) => (
    Number((
      DETAIL_MODAL_STATS_ENTER_MOTION.baseDelaySeconds +
      elementIndex * DETAIL_MODAL_STATS_ENTER_MOTION.staggerSeconds
    ).toFixed(3))
  ));
}

export function getDetailModalStatsEnterTotalDuration(elementCount: number): number {
  if (elementCount <= 0) return 0;
  return createDetailModalStatsEnterDelays(elementCount)[elementCount - 1] +
    DETAIL_MODAL_STATS_ENTER_MOTION.durationSeconds;
}
