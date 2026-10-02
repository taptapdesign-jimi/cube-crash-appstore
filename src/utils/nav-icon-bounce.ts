import { gsap } from 'gsap';
import { logger } from '../core/logger.js';

export const NAV_ICON_TAP_BOUNCE = Object.freeze({
  totalDurationSeconds: 0.22,
  squeezeScale: 0.92,
  popScale: 1.06,
  squeezeDurationSeconds: 0.077,
  popDurationSeconds: 0.077,
  settleDurationSeconds: 0.066,
  cssEase: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
});

const activeNavIconTimelines = new WeakMap<HTMLElement, gsap.core.Timeline>();

function cubicBezierCoordinate(progress: number, controlPoint1: number, controlPoint2: number): number {
  const inverse = 1 - progress;
  return (3 * inverse * inverse * progress * controlPoint1)
    + (3 * inverse * progress * progress * controlPoint2)
    + (progress * progress * progress);
}

/** GSAP-compatible equivalent of cubic-bezier(0.34, 1.56, 0.64, 1). */
export function navIconTapBounceEase(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const candidate = (lower + upper) / 2;
    if (cubicBezierCoordinate(candidate, 0.34, 0.64) < progress) lower = candidate;
    else upper = candidate;
  }
  return cubicBezierCoordinate((lower + upper) / 2, 1.56, 1);
}

export function getNavIconVisualTarget(target: Element | null): HTMLElement | null {
  if (!target) return null;
  return (target.querySelector('.nav-icon-visual') as HTMLElement | null)
    || (target.querySelector('img') as HTMLElement | null)
    || (target as HTMLElement | null);
}

export function playNavIconCartoonBounce(target: Element | null): gsap.core.Timeline | null {
  const visualTarget = getNavIconVisualTarget(target);
  if (!visualTarget) return null;

  try {
    activeNavIconTimelines.get(visualTarget)?.kill();
    gsap.killTweensOf(visualTarget);
    gsap.set(visualTarget, {
      scale: 1,
      transformOrigin: '50% 50%',
      willChange: 'transform',
      force3D: true,
    });

    let timeline: gsap.core.Timeline;
    timeline = gsap.timeline({
      defaults: { force3D: true },
      onComplete: () => {
        if (activeNavIconTimelines.get(visualTarget) === timeline) {
          activeNavIconTimelines.delete(visualTarget);
        }
        gsap.set(visualTarget, {
          scale: 1,
          clearProps: 'scale,willChange,force3D',
        });
      },
    });
    activeNavIconTimelines.set(visualTarget, timeline);

    return timeline
      .to(visualTarget, {
        scale: NAV_ICON_TAP_BOUNCE.squeezeScale,
        duration: NAV_ICON_TAP_BOUNCE.squeezeDurationSeconds,
        ease: navIconTapBounceEase,
      })
      .to(visualTarget, {
        scale: NAV_ICON_TAP_BOUNCE.popScale,
        duration: NAV_ICON_TAP_BOUNCE.popDurationSeconds,
        ease: navIconTapBounceEase,
      })
      .to(visualTarget, {
        scale: 1,
        duration: NAV_ICON_TAP_BOUNCE.settleDurationSeconds,
        ease: navIconTapBounceEase,
      });
  } catch (error) {
    logger.warn('⚠️ Failed to animate nav icon cartoon bounce:', String(error));
    return null;
  }
}
