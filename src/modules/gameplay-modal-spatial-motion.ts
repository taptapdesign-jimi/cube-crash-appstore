import { appSpatialMotion } from './journey-spatial-motion.js';

export type GameplayModalSpatialProfile = 'standard' | 'journey-pair';

// Every paper modal shown over the shared backdrop uses the accepted Journey
// card response. Keeping one profile prevents score/reward/exit surfaces from
// feeling flatter than the Journey modal while retaining one sensor/RAF owner.
const OVERLAY_MODAL_PROFILE = Object.freeze({
  xDepth: 9,
  yDepth: 10,
  rotateXDegrees: 4.6,
  rotateYDegrees: 5.2,
  zDepth: 12,
});

const JOURNEY_FLIP_RIBBON_PROFILE = Object.freeze({
  xDepth: 1.2,
  yDepth: 1.2,
});

const JOURNEY_FLIP_RIBBON_LABEL_PROFILE = Object.freeze({
  xDepth: 2.4,
  yDepth: 2.4,
});

/** Mounts a subtle gyro profile on a transform-isolated modal paper surface. */
export function mountGameplayModalSpatialMotion(
  stage: HTMLElement,
  target: HTMLElement | null,
): () => void {
  if (!target) return () => undefined;
  return appSpatialMotion.registerModalTargets(stage, [{ element: target, ...OVERLAY_MODAL_PROFILE }]);
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
  const ribbon = stage.querySelector<HTMLElement>(
    '.journey-card-overlay-portaled-card > .journey-card-ribbon',
  );
  const ribbonLabel = ribbon?.querySelector<HTMLElement>('.journey-card-ribbon-label') ?? null;
  return appSpatialMotion.registerModalTargets(stage, [
    { element: target, ...OVERLAY_MODAL_PROFILE },
    ...(ribbon ? [{ element: ribbon, ...JOURNEY_FLIP_RIBBON_PROFILE }] : []),
    ...(ribbonLabel ? [{ element: ribbonLabel, ...JOURNEY_FLIP_RIBBON_LABEL_PROFILE }] : []),
  ]);
}
