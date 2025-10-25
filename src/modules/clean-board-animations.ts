// clean-board-animations.ts
// Animations for clean board modal


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
  const { duration = 0.2, easing = 'ease' } = options;
  
  return new Promise((resolve) => {
    overlay.style.opacity = '0';
    overlay.style.display = 'flex';
    
    // Force reflow
    overlay.offsetHeight;
    
    overlay.style.transition = `opacity ${duration}s ${easing}`;
    overlay.style.opacity = '1';
    
    setTimeout(() => {
      resolve();
    }, duration * 1000);
  });
}

/**
 * Hide overlay animation
 */
export function hideOverlayAnimation(overlay: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.2, easing = 'ease' } = options;
  
  return new Promise((resolve) => {
    overlay.style.transition = `opacity ${duration}s ${easing}`;
    overlay.style.opacity = '0';
    
    setTimeout(() => {
      overlay.style.display = 'none';
      resolve();
    }, duration * 1000);
  });
}

/**
 * Show card animation
 */
export function showCardAnimation(card: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.34, easing = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' } = options;
  
  return new Promise((resolve) => {
    card.style.transform = 'scale(0.9)';
    card.style.opacity = '0';
    
    // Force reflow
    card.offsetHeight;
    
    card.style.transition = `transform ${duration}s ${easing}, opacity ${duration}s ${easing}`;
    card.style.transform = 'scale(1)';
    card.style.opacity = '1';
    
    setTimeout(() => {
      resolve();
    }, duration * 1000);
  });
}

/**
 * Hide card animation
 */
export function hideCardAnimation(card: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.2, easing = 'ease' } = options;
  
  return new Promise((resolve) => {
    card.style.transition = `transform ${duration}s ${easing}, opacity ${duration}s ${easing}`;
    card.style.transform = 'scale(0.9)';
    card.style.opacity = '0';
    
    setTimeout(() => {
      resolve();
    }, duration * 1000);
  });
}

/**
 * Bounce animation for buttons
 */
export function bounceButtonAnimation(button: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.2, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    const originalTransform = button.style.transform;
    
    // Bounce sequence
    const keyframes = [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.1)', offset: 0.3 },
      { transform: 'scale(0.95)', offset: 0.6 },
      { transform: 'scale(1)', offset: 1 }
    ];
    
    const animation = button.animate(keyframes, {
      duration: duration * 1000,
      easing,
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      button.style.transform = originalTransform;
      resolve();
    };
  });
}

/**
 * Shake animation for card
 */
export function shakeCardAnimation(card: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.5, easing = 'ease-in-out' } = options;
  
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
      duration: duration * 1000,
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
 * Pulse animation for score
 */
export function pulseScoreAnimation(scoreElement: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 1, easing = 'ease-in-out' } = options;
  
  return new Promise((resolve) => {
    const originalTransform = scoreElement.style.transform;
    
    // Pulse sequence
    const keyframes = [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.05)', offset: 0.5 },
      { transform: 'scale(1)', offset: 1 }
    ];
    
    const animation = scoreElement.animate(keyframes, {
      duration: duration * 1000,
      easing,
      iterations: 2,
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      scoreElement.style.transform = originalTransform;
      resolve();
    };
  });
}

/**
 * Fade in animation
 */
export function fadeInAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'ease-out', delay = 0 } = options;
  
  return new Promise((resolve) => {
    element.style.opacity = '0';
    element.style.transition = `opacity ${duration}s ${easing}`;
    
    setTimeout(() => {
      element.style.opacity = '1';
      
      setTimeout(() => {
        resolve();
      }, duration * 1000);
    }, delay * 1000);
  });
}

/**
 * Fade out animation
 */
export function fadeOutAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    element.style.transition = `opacity ${duration}s ${easing}`;
    element.style.opacity = '0';
    
    setTimeout(() => {
      resolve();
    }, duration * 1000);
  });
}

/**
 * Slide up animation
 */
export function slideUpAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    element.style.transform = 'translateY(20px)';
    element.style.opacity = '0';
    element.style.transition = `transform ${duration}s ${easing}, opacity ${duration}s ${easing}`;
    
    // Force reflow
    element.offsetHeight;
    
    element.style.transform = 'translateY(0)';
    element.style.opacity = '1';
    
    setTimeout(() => {
      resolve();
    }, duration * 1000);
  });
}

/**
 * Slide down animation
 */
export function slideDownAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    element.style.transition = `transform ${duration}s ${easing}, opacity ${duration}s ${easing}`;
    element.style.transform = 'translateY(20px)';
    element.style.opacity = '0';
    
    setTimeout(() => {
      resolve();
    }, duration * 1000);
  });
}

/**
 * Scale in animation
 */
export function scaleInAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    element.style.transform = 'scale(0.8)';
    element.style.opacity = '0';
    element.style.transition = `transform ${duration}s ${easing}, opacity ${duration}s ${easing}`;
    
    // Force reflow
    element.offsetHeight;
    
    element.style.transform = 'scale(1)';
    element.style.opacity = '1';
    
    setTimeout(() => {
      resolve();
    }, duration * 1000);
  });
}

/**
 * Scale out animation
 */
export function scaleOutAnimation(element: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 0.3, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    element.style.transition = `transform ${duration}s ${easing}, opacity ${duration}s ${easing}`;
    element.style.transform = 'scale(0.8)';
    element.style.opacity = '0';
    
    setTimeout(() => {
      resolve();
    }, duration * 1000);
  });
}

/**
 * Stagger animation for multiple elements
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
export function animateModalEntrance(overlay: HTMLElement, card: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const sequence = async () => {
      // 1. Show overlay
      await showOverlayAnimation(overlay);
      
      // 2. Show card
      await showCardAnimation(card);
      
      // 3. Animate score
      const scoreElement = card.querySelector('div[style*="color:#B07F69"]') as HTMLElement;
      if (scoreElement) {
        await pulseScoreAnimation(scoreElement);
      }
      
      // 4. Animate buttons
      const buttons = Array.from(card.querySelectorAll('button')) as HTMLElement[];
      await staggerAnimation(buttons, (btn) => slideUpAnimation(btn, { delay: 0.1 }), 0.15);
      
      resolve();
    };
    
    sequence();
  });
}

/**
 * Animate modal exit
 */
export function animateModalExit(overlay: HTMLElement, card: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const sequence = async () => {
      // 1. Animate buttons out
      const buttons = Array.from(card.querySelectorAll('button')) as HTMLElement[];
      await staggerAnimation(buttons, (btn) => slideDownAnimation(btn), 0.05);
      
      // 2. Hide card
      await hideCardAnimation(card);
      
      // 3. Hide overlay
      await hideOverlayAnimation(overlay);
      
      resolve();
    };
    
    sequence();
  });
}

/**
 * Animate button press
 */
export function animateButtonPress(button: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const originalTransform = button.style.transform;
    
    // Press sequence
    const keyframes = [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(0.95)', offset: 0.5 },
      { transform: 'scale(1)', offset: 1 }
    ];
    
    const animation = button.animate(keyframes, {
      duration: 150,
      easing: 'ease-out',
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      button.style.transform = originalTransform;
      resolve();
    };
  });
}

/**
 * Animate score change
 */
export function animateScoreChange(
  currentScoreEl: HTMLElement, 
  newScoreEl: HTMLElement, 
  options: AnimationOptions = {}
): Promise<void> {
  const { duration = 1, easing = 'ease-in-out' } = options;
  
  return new Promise((resolve) => {
    // Hide new score initially
    newScoreEl.style.opacity = '0';
    newScoreEl.style.transform = 'scale(0.8)';
    
    // Animate current score out
    const currentAnimation = currentScoreEl.animate([
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.8)' }
    ], {
      duration: duration * 500,
      easing,
      fill: 'forwards'
    });
    
    currentAnimation.onfinish = () => {
      // Show new score
      newScoreEl.style.transition = `opacity ${duration * 500}ms ${easing}, transform ${duration * 500}ms ${easing}`;
      newScoreEl.style.opacity = '1';
      newScoreEl.style.transform = 'scale(1)';
      
      setTimeout(() => {
        resolve();
      }, duration * 500);
    };
  });
}

// All functions are already exported individually above
