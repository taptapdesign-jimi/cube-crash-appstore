import { appSpatialMotion } from './journey-spatial-motion.js';

export type GameplayModalSpatialProfile = 'standard' | 'journey-pair';

const STANDARD_MODAL_PROFILE = Object.freeze({
  xDepth: 5.5,
  yDepth: 4.5,
  rotateXDegrees: 1.8,
  rotateYDegrees: 2.4,
  zDepth: 5,
});

const JOURNEY_FLIP_CARD_PROFILE = Object.freeze({
  xDepth: 9,
  yDepth: 10,
  rotateXDegrees: 4.6,
  rotateYDegrees: 5.2,
  zDepth: 12,
});

/** Mounts a subtle gyro profile on a transform-isolated modal paper surface. */
export function mountGameplayModalSpatialMotion(
  stage: HTMLElement,
  target: HTMLElement | null,
): () => void {
  if (!target) return () => undefined;
  return appSpatialMotion.registerModalTargets(stage, [{ element: target, ...STANDARD_MODAL_PROFILE }]);
}

/**
 * A true two-sided Journey card has one physical gyro owner. Both faces live
 * below this shell, so turning the card never registers a second sensor target
 * or makes the two sides drift apart.
 */
export function mountJourneyCardFlipSpatialMotion(
  stage: HTMLElement,
  target: HTMLElement,
): () => void {
  return appSpatialMotion.registerModalTargets(stage, [
    { element: target, ...JOURNEY_FLIP_CARD_PROFILE },
  ]);
}
