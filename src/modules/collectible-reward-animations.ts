// collectible-reward-animations.ts
// Animations for collectible reward bottom sheet

import { GAMEPLAY_MODAL_BENCHMARK } from './gameplay-modal-benchmark.ts';

// 🔥 FIX: Track animation timeouts for cleanup
const activeAnimTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

function trackAnimTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timeout = setTimeout(() => {  // 🔥 FIX: Was calling itself recursively, now correctly calls setTimeout
    activeAnimTimeouts.delete(timeout);
    callback();
  }, delay);
  activeAnimTimeouts.add(timeout);
  return timeout;
}

export function scheduleCollectibleRewardAnimation(callback: () => void, delay: number): void {
  trackAnimTimeout(callback, delay);
}

/**
 * Cleanup all animation timeouts
 */
export function cleanupCollectibleRewardAnimationTimeouts(): void {
  activeAnimTimeouts.forEach(timeout => {
    try { clearTimeout(timeout); } catch {}
  });
  activeAnimTimeouts.clear();
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
 * Show overlay animation
 */
export function showOverlayAnimation(overlay: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 500, easing = 'ease-in-out' } = options;
  
  return new Promise((resolve) => {
    overlay.style.opacity = '0';
    overlay.style.display = 'flex';
    
    // Force reflow
    overlay.offsetHeight;
    
    overlay.style.transition = `opacity ${duration}ms ${easing}`;
    overlay.style.opacity = '1';
    
    // 🔥 FIX: Track timeout for cleanup
    trackAnimTimeout(() => {
      // 🔥 FIX: Check if element still exists before modifying
      if (overlay && overlay.isConnected) {
        overlay.classList.add('show');
      }
      resolve();
    }, duration);
  });
}

/**
 * Hide overlay animation
 */
export function hideOverlayAnimation(overlay: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 200, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    overlay.style.transition = `opacity ${duration}ms ${easing}`;
    overlay.style.opacity = '0';
    
    // 🔥 FIX: Track timeout for cleanup
    trackAnimTimeout(() => {
      if (overlay && overlay.isConnected) {
        overlay.classList.remove('show');
      }
      resolve();
    }, duration);
  });
}

/**
 * Show sheet animation
 */
export function showSheetAnimation(sheet: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = GAMEPLAY_MODAL_BENCHMARK.enterDurationMs } = options;
  
  return new Promise((resolve) => {
    const stage = sheet.closest<HTMLElement>('.cc-gameplay-modal-stage');
    stage?.classList.remove('cc-gameplay-modal-exiting');
    stage?.classList.remove('cc-gameplay-modal-idle');
    stage?.classList.add('cc-gameplay-modal-entering');
    
    trackAnimTimeout(() => {
      stage?.classList.remove('cc-gameplay-modal-entering');
      stage?.classList.add('cc-gameplay-modal-idle');
      resolve();
    }, duration + GAMEPLAY_MODAL_BENCHMARK.enterCleanupBufferMs);
  });
}

/**
 * Hide sheet animation
 */
export function hideSheetAnimation(sheet: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = GAMEPLAY_MODAL_BENCHMARK.exitDurationMs } = options;
  
  return new Promise((resolve) => {
    const stage = sheet.closest<HTMLElement>('.cc-gameplay-modal-stage');
    stage?.classList.remove('cc-gameplay-modal-entering');
    stage?.classList.add('cc-gameplay-modal-exiting');
    
    trackAnimTimeout(() => {
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
    
    trackAnimTimeout(() => {
      element.style.opacity = '1';
      
      trackAnimTimeout(() => {
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
    
    trackAnimTimeout(() => {
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
    
    trackAnimTimeout(() => {
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
    
    trackAnimTimeout(() => {
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
    
    trackAnimTimeout(() => {
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
    
    trackAnimTimeout(() => {
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
      trackAnimTimeout(() => {
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
export function revealCollectibleCardAnimation(sheet: HTMLElement, _detail: any): Promise<void> {
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
