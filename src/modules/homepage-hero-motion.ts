import {
  JOURNEY_WORLD_CARTOON_BOUNCE_ENTER,
  getJourneyV700HubWorldExitDuration,
} from './journey-v700-motion';

/** Compositor representation of the selected Journey World's exact two legs. */
export function getHomepageHeroExitMotion(reducedMotion = false): {
  keyframes: Keyframe[];
  duration: number;
  transformOrigin: string;
} {
  const motion = JOURNEY_WORLD_CARTOON_BOUNCE_ENTER;
  const inflate = getJourneyV700HubWorldExitDuration(motion.bounceDurationSeconds, reducedMotion);
  const collapse = getJourneyV700HubWorldExitDuration(motion.exitDurationSeconds, reducedMotion);
  return {
    duration: (inflate + collapse) * 1000,
    transformOrigin: motion.transformOrigin,
    keyframes: [
      // Linear Bezier x makes these exact cubic polynomials, not approximations:
      // power2.in = t^3; back.in(1.7) = 2.7*t^3 - 1.7*t^2.
      { scale: '1 1', offset: 0, easing: 'cubic-bezier(0.333333333333, 0, 0.666666666667, 0)' },
      {
        scale: `${motion.scaleX} ${motion.scaleY}`,
        offset: inflate / (inflate + collapse),
        easing: 'cubic-bezier(0.333333333333, 0, 0.666666666667, -0.566666666667)',
      },
      { scale: '0 0', offset: 1 },
    ],
  };
}
