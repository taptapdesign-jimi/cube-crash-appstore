/**
 * Shared motion profile for every randomized Journey gameplay bottom land.
 *
 * Vertical travel deliberately uses non-overshooting eases. The image is
 * bottom-anchored, so the small scale settle can retain a cartoon feel without
 * ever lifting its lower edge and exposing the paper background underneath.
 */
export const JOURNEY_BOTTOM_DECOR_MOTION = Object.freeze({
  start: Object.freeze({
    y: 84,
    scaleX: 0.94,
    scaleY: 0.82,
  }),
  enter: Object.freeze({
    travelDurationSeconds: 0.48,
    travelEase: 'power3.out',
    arrivalScaleX: 1.018,
    arrivalScaleY: 0.985,
    settleDurationSeconds: 0.14,
    settleEase: 'power2.out',
  }),
  exit: Object.freeze({
    y: 70,
    scaleX: 0.96,
    scaleY: 0.88,
    durationSeconds: 0.44,
    ease: 'power2.in',
  }),
});
