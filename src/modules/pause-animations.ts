// pause-animations.ts
// Animations for pause modal

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));

// 🔥 FIX: Track GSAP tweens and timeouts for cleanup
const activePauseTweens: Set<gsap.core.Tween> = new Set();
const activePauseTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

function trackPauseTween(tween: gsap.core.Tween): gsap.core.Tween {
  activePauseTweens.add(tween);
  tween.eventCallback('onComplete', () => {
    activePauseTweens.delete(tween);
  });
  return tween;
}

function trackPauseTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timeout = setTimeout(() => {
    activePauseTimeouts.delete(timeout);
    callback();
  }, delay);
  activePauseTimeouts.add(timeout);
  return timeout;
}

/**
 * Cleanup all pause animation tweens and timeouts
 */
export function cleanupPauseAnimations(): void {
  // Kill all tracked GSAP tweens
  activePauseTweens.forEach(tween => {
    try { tween.kill(); } catch {}
  });
  activePauseTweens.clear();
  
  // Clear all tracked timeouts
  activePauseTimeouts.forEach(timeout => {
    try { clearTimeout(timeout); } catch {}
  });
  activePauseTimeouts.clear();
  
  console.log('✅ Pause animations cleaned up');
}

// Animation options
interface AnimationOptions {
  duration?: number;
  easing?: string;
  delay?: number;
  onComplete?: () => void;
  onUpdate?: () => void;
}

/**
 * Show modal animation
 */
export function showModalAnimation(modal: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'power2.out' } = options;
  
  return new Promise((resolve) => {
    const tween = gsap.fromTo(modal, 
      { 
        scale: 0.8, 
        opacity: 0 
      },
      { 
        scale: 1, 
        opacity: 1, 
        duration, 
        ease: easing,
        onComplete: () => {
          activePauseTweens.delete(tween);
          resolve();
        }
      }
    );
    activePauseTweens.add(tween);
  });
}

/**
 * Hide modal animation
 */
export function hideModalAnimation(modal: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'power2.in' } = options;
  
  return new Promise((resolve) => {
    const tween = trackTween(modal, {
      scale: 0.8,
      opacity: 0,
      duration,
      ease: easing,
      onComplete: () => {
        activePauseTweens.delete(tween);
        resolve();
      }
    });
    activePauseTweens.add(tween);
  });
}

/**
 * Pulse animation for score (used by animateModalEntrance)
 */
export function pulseScoreAnimation(scoreElement: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 1, easing = 'power2.inOut' } = options;
  
  return new Promise((resolve) => {
    const tween = gsap.fromTo(scoreElement,
      { scale: 1 },
      {
        scale: 1.05,
        duration: duration * 0.5,
        ease: easing,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          activePauseTweens.delete(tween);
          resolve();
        }
      }
    );
    activePauseTweens.add(tween);
  });
}

/**
 * Slide up animation (used by animateModalEntrance)
 */
export function slideUpAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'power2.out' } = options;
  
  return new Promise((resolve) => {
    const tween = gsap.fromTo(element,
      { y: 20, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration,
        ease: easing,
        onComplete: () => {
          activePauseTweens.delete(tween);
          resolve();
        }
      }
    );
    activePauseTweens.add(tween);
  });
}

/**
 * Slide down animation
 */
export function slideDownAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'power2.in' } = options;
  
  return new Promise((resolve) => {
    const tween = trackTween(element, {
      y: 20,
      opacity: 0,
      duration,
      ease: easing,
      onComplete: () => {
        activePauseTweens.delete(tween);
        resolve();
      }
    });
    activePauseTweens.add(tween);
  });
}

/**
 * Stagger animation for multiple elements (used by animateModalEntrance/Exit)
 */
export function staggerAnimation(
  elements: HTMLElement[],
  animationFn: (element: HTMLElement) => Promise<void>,
  staggerDelay: number = 0.1
): Promise<void> {
  return new Promise((resolve) => {
    let completed = 0;
    const total = elements.length;
    
    if (total === 0) {
      resolve();
      return;
    }
    
    elements.forEach((element, index) => {
      trackPauseTimeout(() => {
        animationFn(element).then(() => {
          completed++;
          if (completed === total) {
            resolve();
          }
        });
      }, index * staggerDelay * 1000);
    });
  });
}

/**
 * Animate modal entrance
 */
export function animateModalEntrance(modal: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const sequence = async () => {
      // 1. Show modal
      await showModalAnimation(modal);
      
      // 2. Animate score
      const scoreElement = modal.querySelector('div[style*="color: #E97A55"]') as HTMLElement;
      if (scoreElement) {
        await pulseScoreAnimation(scoreElement);
      }
      
      // 3. Animate buttons
      const buttons = Array.from(modal.querySelectorAll('button')) as HTMLElement[];
      await staggerAnimation(buttons, (btn) => slideUpAnimation(btn, { delay: 0.1 }), 0.15);
      
      resolve();
    };
    
    sequence();
  });
}

/**
 * Animate modal exit
 */
export function animateModalExit(modal: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const sequence = async () => {
      // 1. Animate buttons out
      const buttons = Array.from(modal.querySelectorAll('button')) as HTMLElement[];
      await staggerAnimation(buttons, (btn) => slideDownAnimation(btn), 0.05);
      
      // 2. Hide modal
      await hideModalAnimation(modal);
      
      resolve();
    };
    
    sequence();
  });
}
