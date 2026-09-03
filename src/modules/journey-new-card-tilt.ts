export interface JourneyNewCardTiltProfile {
  interimRestRotationDeg: number;
  interimRestRotateXDeg: number;
  interimRestRotateYDeg: number;
  interimExitRotationDeg: number;
  interimExitRotateXDeg: number;
  interimExitRotateYDeg: number;
  unlockedEntryRotationDeg: number;
  unlockedEntryRotateXDeg: number;
  unlockedEntryRotateYDeg: number;
  unlockedRestRotationDeg: number;
  unlockedRestRotateXDeg: number;
  unlockedRestRotateYDeg: number;
  unlockedExitRotationDeg: number;
  unlockedExitRotateXDeg: number;
  unlockedExitRotateYDeg: number;
}

export const JOURNEY_NEW_CARD_DRAG_MAX_TILT_DEG = 28.8;
export const JOURNEY_NEW_CARD_DRAG_FULL_RANGE_VIEWPORT_RATIO = 0.4;
export const JOURNEY_NEW_CARD_DRAG_TAP_SLOP_PX = 7;

export function getJourneyNewCardDragTiltAngle(
  startAngle: number,
  deltaX: number,
  viewportWidth: number,
): number {
  const fullRangeDistance = Math.max(
    1,
    Math.abs(viewportWidth) * JOURNEY_NEW_CARD_DRAG_FULL_RANGE_VIEWPORT_RATIO,
  );
  const angle = startAngle
    + (deltaX / fullRangeDistance) * JOURNEY_NEW_CARD_DRAG_MAX_TILT_DEG;
  return Math.max(
    -JOURNEY_NEW_CARD_DRAG_MAX_TILT_DEG,
    Math.min(JOURNEY_NEW_CARD_DRAG_MAX_TILT_DEG, angle),
  );
}

export function isJourneyNewCardCollectDrag(
  deltaX: number,
  deltaY: number,
  cardHeight: number,
): boolean {
  const verticalDistance = Math.abs(deltaY);
  const collectDistance = Math.min(96, Math.max(48, Math.abs(cardHeight) * 0.12));
  return verticalDistance >= collectDistance
    && verticalDistance > Math.abs(deltaX) * 1.15;
}

function sampleUnit(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

/**
 * Gives the two New Reward card faces one coordinated Journey-modal-style
 * handoff. New Reward intentionally uses half of the Journey detail-card
 * angles: transitions never exceed 7.5deg and rest stays at 2.375–3.125deg.
 */
export function createJourneyNewCardTiltProfile(
  random: () => number = Math.random,
): JourneyNewCardTiltProfile {
  const interimDirection = sampleUnit(random) < 0.5 ? -1 : 1;
  const interimRestMagnitude = 2.375 + sampleUnit(random) * 0.75;
  const interimRestDepthMagnitude = 2 + sampleUnit(random) * 1.5;
  const interimMagnitude = 4.5 + sampleUnit(random) * 3;
  const unlockedDirection = interimDirection * -1;
  const unlockedEntryMagnitude = 4.5 + sampleUnit(random) * 3;
  const unlockedRestMagnitude = 2.375 + sampleUnit(random) * 0.75;
  const unlockedRestDepthMagnitude = 1.5 + sampleUnit(random) * 1.5;
  const exitMagnitude = 4.5 + sampleUnit(random) * 3;

  return {
    interimRestRotationDeg: Number((interimDirection * interimRestMagnitude).toFixed(2)),
    interimRestRotateXDeg: Number((-1.5 - sampleUnit(random) * 1.5).toFixed(2)),
    interimRestRotateYDeg: Number((interimDirection * interimRestDepthMagnitude).toFixed(2)),
    interimExitRotationDeg: Number((interimDirection * interimMagnitude).toFixed(2)),
    interimExitRotateXDeg: Number((-4.5 - sampleUnit(random) * 3).toFixed(2)),
    interimExitRotateYDeg: Number((interimDirection * interimMagnitude).toFixed(2)),
    unlockedEntryRotationDeg: Number((unlockedDirection * unlockedEntryMagnitude).toFixed(2)),
    unlockedEntryRotateXDeg: Number((4.5 + sampleUnit(random) * 3).toFixed(2)),
    unlockedEntryRotateYDeg: Number((unlockedDirection * unlockedEntryMagnitude).toFixed(2)),
    unlockedRestRotationDeg: Number((unlockedDirection * unlockedRestMagnitude).toFixed(2)),
    unlockedRestRotateXDeg: Number((1 + sampleUnit(random)).toFixed(2)),
    unlockedRestRotateYDeg: Number((unlockedDirection * unlockedRestDepthMagnitude).toFixed(2)),
    unlockedExitRotationDeg: Number((unlockedDirection * exitMagnitude).toFixed(2)),
    unlockedExitRotateXDeg: Number((-4.5 - sampleUnit(random) * 3).toFixed(2)),
    unlockedExitRotateYDeg: Number((unlockedDirection * exitMagnitude).toFixed(2)),
  };
}
