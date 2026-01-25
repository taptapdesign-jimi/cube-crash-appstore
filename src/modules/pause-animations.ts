// pause-animations.ts
// Animations for pause modal

import { gsap } from 'gsap';

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
    gsap.fromTo(modal, 
      { 
        scale: 0.8, 
        opacity: 0 
      },
      { 
        scale: 1, 
        opacity: 1, 
        duration, 
        ease: easing,
        onComplete: resolve
      }
    );
  });
}

/**
 * Hide modal animation
 */
export function hideModalAnimation(modal: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'power2.in' } = options;
  
  return new Promise((resolve) => {
    gsap.to(modal, {
      scale: 0.8,
      opacity: 0,
      duration,
      ease: easing,
      onComplete: resolve
    });
  });
}

/**
 * Pulse animation for score (used by animateModalEntrance)
 */
export function pulseScoreAnimation(scoreElement: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 1, easing = 'power2.inOut' } = options;
  
  return new Promise((resolve) => {
    gsap.fromTo(scoreElement,
      { scale: 1 },
      {
        scale: 1.05,
        duration: duration * 0.5,
        ease: easing,
        yoyo: true,
        repeat: 1,
        onComplete: resolve
      }
    );
  });
}

/**
 * Slide up animation (used by animateModalEntrance)
 */
export function slideUpAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'power2.out' } = options;
  
  return new Promise((resolve) => {
    gsap.fromTo(element,
      { y: 20, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration,
        ease: easing,
        onComplete: resolve
      }
    );
  });
}

/**
 * Slide down animation
 */
export function slideDownAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'power2.in' } = options;
  
  return new Promise((resolve) => {
    gsap.to(element, {
      y: 20,
      opacity: 0,
      duration,
      ease: easing,
      onComplete: resolve
    });
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
      setTimeout(() => {
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

// 🔥 DEAD CODE REMOVED: bounceButtonAnimation, shakeModalAnimation, fadeInAnimation,
// fadeOutAnimation, scaleInAnimation, scaleOutAnimation, animateButtonPress,
// animateOverlayBlur, animateOverlayFade - none of these were used
