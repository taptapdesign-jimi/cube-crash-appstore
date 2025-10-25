// collectible-reward-animations.ts
// Animations for collectible reward bottom sheet

import { executeCleanup, setClosing } from './collectible-reward-utils.js';

// Animation options
interface AnimationOptions {
  duration?: number;
  easing?: string;
  delay?: number;
  onComplete?: () => void;
  onUpdate?: () => void;
}

/**
 * Show overlay animation
 */
export function showOverlayAnimation(overlay: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    overlay.style.opacity = '0';
    overlay.style.display = 'flex';
    
    // Force reflow
    overlay.offsetHeight;
    
    overlay.style.transition = `opacity ${duration}ms ${easing}`;
    overlay.style.opacity = '1';
    
    setTimeout(() => {
      overlay.classList.add('show');
      resolve();
    }, duration);
  });
}

/**
 * Hide overlay animation
 */
export function hideOverlayAnimation(overlay: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    overlay.style.transition = `opacity ${duration}ms ${easing}`;
    overlay.style.opacity = '0';
    
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('show');
      resolve();
    }, duration);
  });
}

/**
 * Show sheet animation
 */
export function showSheetAnimation(sheet: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    sheet.style.transform = 'translateY(100%)';
    sheet.style.transition = `transform ${duration}ms ${easing}`;
    
    // Force reflow
    sheet.offsetHeight;
    
    sheet.style.transform = 'translateY(0)';
    sheet.classList.add('show');
    
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

/**
 * Hide sheet animation
 */
export function hideSheetAnimation(sheet: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    sheet.style.transition = `transform ${duration}ms ${easing}`;
    sheet.style.transform = 'translateY(100%)';
    sheet.classList.remove('show');
    
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

/**
 * Bounce animation for card
 */
export function bounceCardAnimation(card: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 600, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    const originalTransform = card.style.transform;
    
    // Bounce sequence
    const keyframes = [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.1)', offset: 0.2 },
      { transform: 'scale(0.95)', offset: 0.4 },
      { transform: 'scale(1.05)', offset: 0.6 },
      { transform: 'scale(1)', offset: 1 }
    ];
    
    const animation = card.animate(keyframes, {
      duration,
      easing,
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      card.style.transform = originalTransform;
      resolve();
    };
  });
}

/**
 * Shake animation for card
 */
export function shakeCardAnimation(card: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 500, easing = 'ease-in-out' } = options;
  
  return new Promise((resolve) => {
    const originalTransform = card.style.transform;
    
    // Shake sequence
    const keyframes = [
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(-10px)', offset: 0.1 },
      { transform: 'translateX(10px)', offset: 0.2 },
      { transform: 'translateX(-10px)', offset: 0.3 },
      { transform: 'translateX(10px)', offset: 0.4 },
      { transform: 'translateX(-10px)', offset: 0.5 },
      { transform: 'translateX(10px)', offset: 0.6 },
      { transform: 'translateX(-10px)', offset: 0.7 },
      { transform: 'translateX(10px)', offset: 0.8 },
      { transform: 'translateX(-5px)', offset: 0.9 },
      { transform: 'translateX(0)', offset: 1 }
    ];
    
    const animation = card.animate(keyframes, {
      duration,
      easing,
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      card.style.transform = originalTransform;
      resolve();
    };
  });
}

/**
 * Pulse animation for card
 */
export function pulseCardAnimation(card: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 1000, easing = 'ease-in-out' } = options;
  
  return new Promise((resolve) => {
    const originalTransform = card.style.transform;
    
    // Pulse sequence
    const keyframes = [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.05)', offset: 0.5 },
      { transform: 'scale(1)', offset: 1 }
    ];
    
    const animation = card.animate(keyframes, {
      duration,
      easing,
      iterations: 3,
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      card.style.transform = originalTransform;
      resolve();
    };
  });
}

/**
 * Fade in animation
 */
export function fadeInAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-out', delay = 0 } = options;
  
  return new Promise((resolve) => {
    element.style.opacity = '0';
    element.style.transition = `opacity ${duration}ms ${easing}`;
    
    setTimeout(() => {
      element.style.opacity = '1';
      
      setTimeout(() => {
        resolve();
      }, duration);
    }, delay);
  });
}

/**
 * Fade out animation
 */
export function fadeOutAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    element.style.transition = `opacity ${duration}ms ${easing}`;
    element.style.opacity = '0';
    
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

/**
 * Slide up animation
 */
export function slideUpAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    element.style.transform = 'translateY(20px)';
    element.style.opacity = '0';
    element.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
    
    // Force reflow
    element.offsetHeight;
    
    element.style.transform = 'translateY(0)';
    element.style.opacity = '1';
    
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

/**
 * Slide down animation
 */
export function slideDownAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    element.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
    element.style.transform = 'translateY(20px)';
    element.style.opacity = '0';
    
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

/**
 * Scale in animation
 */
export function scaleInAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    element.style.transform = 'scale(0.8)';
    element.style.opacity = '0';
    element.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
    
    // Force reflow
    element.offsetHeight;
    
    element.style.transform = 'scale(1)';
    element.style.opacity = '1';
    
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

/**
 * Scale out animation
 */
export function scaleOutAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    element.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
    element.style.transform = 'scale(0.8)';
    element.style.opacity = '0';
    
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

/**
 * Stagger animation for multiple elements
 */
export function staggerAnimation(
  elements: HTMLElement[],
  animationFn: (element: HTMLElement) => Promise<void>,
  staggerDelay: number = 100
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
      }, index * staggerDelay);
    });
  });
}

/**
 * Reveal collectible card animation
 */
export function revealCollectibleCardAnimation(sheet: HTMLElement, detail: any): Promise<void> {
  return new Promise((resolve) => {
    const card = sheet.querySelector('.collectible-reward-card');
    const image = sheet.querySelector('.collectible-card-image');
    const name = sheet.querySelector('.collectible-card-name');
    const description = sheet.querySelector('.collectible-card-description');
    const actions = sheet.querySelector('.collectible-reward-actions');
    
    if (!card) {
      resolve();
      return;
    }
    
    // Animate card reveal
    const sequence = async () => {
      // 1. Show card with bounce
      await bounceCardAnimation(card as HTMLElement);
      
      // 2. Animate image
      if (image) {
        await scaleInAnimation(image as HTMLElement, { delay: 200 });
      }
      
      // 3. Animate text elements
      const textElements = [name, description].filter(Boolean) as HTMLElement[];
      await staggerAnimation(textElements, (el) => slideUpAnimation(el, { delay: 100 }), 150);
      
      // 4. Animate actions
      if (actions) {
        await slideUpAnimation(actions as HTMLElement, { delay: 300 });
      }
      
      resolve();
    };
    
    sequence();
  });
}

// All functions are already exported individually above
