// end-run-animations.ts
// Animations for end run modal


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
  const { duration = 300, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    modal.style.opacity = '0';
    modal.style.display = 'flex';
    
    // Force reflow
    modal.offsetHeight;
    
    modal.style.transition = `opacity ${duration}ms ${easing}`;
    modal.style.opacity = '1';
    
    // Animate content
    const content = modal.querySelector('.end-run-modal-content') as HTMLElement;
    if (content) {
      content.style.transform = 'scale(0.8)';
      content.style.transition = `transform ${duration}ms ${easing}`;
      
      // Force reflow
      content.offsetHeight;
      
      content.style.transform = 'scale(1)';
    }
    
    setTimeout(() => {
      modal.classList.add('show');
      resolve();
    }, duration);
  });
}

/**
 * Hide modal animation
 */
export function hideModalAnimation(modal: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    modal.style.transition = `opacity ${duration}ms ${easing}`;
    modal.style.opacity = '0';
    
    // Animate content
    const content = modal.querySelector('.end-run-modal-content') as HTMLElement;
    if (content) {
      content.style.transition = `transform ${duration}ms ${easing}`;
      content.style.transform = 'scale(0.8)';
    }
    
    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('show');
      resolve();
    }, duration);
  });
}

/**
 * Bounce animation for buttons
 */
export function bounceButtonAnimation(button: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 200, easing = 'ease-out' } = options;
  
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
      duration,
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
 * Shake animation for modal
 */
export function shakeModalAnimation(modal: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 500, easing = 'ease-in-out' } = options;
  
  return new Promise((resolve) => {
    const content = modal.querySelector('.end-run-modal-content') as HTMLElement;
    if (!content) {
      resolve();
      return;
    }
    
    const originalTransform = content.style.transform;
    
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
    
    const animation = content.animate(keyframes, {
      duration,
      easing,
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      content.style.transform = originalTransform;
      resolve();
    };
  });
}

/**
 * Pulse animation for score
 */
export function pulseScoreAnimation(scoreElement: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 1000, easing = 'ease-in-out' } = options;
  
  return new Promise((resolve) => {
    const originalTransform = scoreElement.style.transform;
    
    // Pulse sequence
    const keyframes = [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.1)', offset: 0.5 },
      { transform: 'scale(1)', offset: 1 }
    ];
    
    const animation = scoreElement.animate(keyframes, {
      duration,
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
 * Animate modal entrance
 */
export function animateModalEntrance(modal: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const sequence = async () => {
      // 1. Show modal
      await showModalAnimation(modal);
      
      // 2. Animate score
      const scoreElement = modal.querySelector('.end-run-modal-score') as HTMLElement;
      if (scoreElement) {
        await pulseScoreAnimation(scoreElement);
      }
      
      // 3. Animate buttons
      const buttons = Array.from(modal.querySelectorAll('button')) as HTMLElement[];
      await staggerAnimation(buttons, (btn) => slideUpAnimation(btn, { delay: 100 }), 150);
      
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
      await staggerAnimation(buttons, (btn) => slideDownAnimation(btn), 50);
      
      // 2. Hide modal
      await hideModalAnimation(modal);
      
      resolve();
    };
    
    sequence();
  });
}

// All functions are already exported individually above
