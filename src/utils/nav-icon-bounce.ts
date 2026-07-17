import { gsap } from 'gsap';
import { logger } from '../core/logger.js';

export function getNavIconVisualTarget(target: Element | null): HTMLElement | null {
  if (!target) return null;
  return (target.querySelector('img') as HTMLElement | null) || (target as HTMLElement | null);
}

export function playNavIconCartoonBounce(target: Element | null): void {
  const visualTarget = getNavIconVisualTarget(target);
  if (!visualTarget) return;

  try {
    gsap.killTweensOf(visualTarget);
    gsap.set(visualTarget, {
      scale: 1,
      transformOrigin: '50% 50%',
      willChange: 'transform',
      force3D: true,
    });

    gsap.timeline({
      defaults: { force3D: true },
      onComplete: () => {
        gsap.set(visualTarget, {
          scale: 1,
          clearProps: 'scale,willChange,force3D',
        });
      },
    })
      .to(visualTarget, {
        scale: 1.18,
        duration: 0.12,
        ease: 'back.out(2.2)',
      })
      .to(visualTarget, {
        scale: 0.93,
        duration: 0.09,
        ease: 'power2.out',
      })
      .to(visualTarget, {
        scale: 1,
        duration: 0.17,
        ease: 'back.out(1.9)',
      });
  } catch (error) {
    logger.warn('⚠️ Failed to animate nav icon cartoon bounce:', String(error));
  }
}
