import { appSpatialMotion } from './journey-spatial-motion.js';

export type GameplayModalSpatialProfile = 'standard' | 'reduced-exit-score';

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

// Exit Game and the HUD Trophy/Combo sheets should react much more calmly
// than collectible/Journey presentation surfaces. This is exactly 20% of the
// shared overlay profile (an 80% reduction), while retaining the same axes.
const REDUCED_EXIT_SCORE_MODAL_PROFILE = Object.freeze({
  xDepth: 1.8,
  yDepth: 2,
  rotateXDegrees: 0.92,
  rotateYDegrees: 1.04,
  zDepth: 2.4,
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
  profile: GameplayModalSpatialProfile = 'standard',
): () => void {
  if (!target) return () => undefined;
  const motionProfile = profile === 'reduced-exit-score'
    ? REDUCED_EXIT_SCORE_MODAL_PROFILE
    : OVERLAY_MODAL_PROFILE;
  return appSpatialMotion.registerModalTargets(stage, [{ element: target, ...motionProfile }]);
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
