// resume-sheet-animations.ts
// Animations for resume game bottom sheet


// Animation options
interface AnimationOptions {
  duration?: number;
  easing?: string;
  delay?: number;
  onComplete?: () => void;
  onUpdate?: () => void;
}

/**
 * Show bottom sheet animation
 */
export function showBottomSheetAnimation(modal: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-out' } = options;
  
  return new Promise((resolve) => {
    modal.style.transform = 'translateY(100%)';
    modal.style.display = 'block';
    
    // Force reflow
    modal.offsetHeight;
    
    modal.style.transition = `transform ${duration}ms ${easing}`;
    modal.style.transform = 'translateY(0)';
    
    setTimeout(() => {
      modal.classList.add('show');
      resolve();
    }, duration);
  });
}

/**
 * Hide bottom sheet animation
 */
export function hideBottomSheetAnimation(modal: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 300, easing = 'ease-in' } = options;
  
  return new Promise((resolve) => {
    modal.style.transition = `transform ${duration}ms ${easing}`;
    modal.style.transform = 'translateY(100%)';
    
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
    const originalTransform = modal.style.transform;
    
    // Shake sequence
    const keyframes = [
      { transform: 'translateY(0) translateX(0)', offset: 0 },
      { transform: 'translateY(0) translateX(-10px)', offset: 0.1 },
      { transform: 'translateY(0) translateX(10px)', offset: 0.2 },
      { transform: 'translateY(0) translateX(-10px)', offset: 0.3 },
      { transform: 'translateY(0) translateX(10px)', offset: 0.4 },
      { transform: 'translateY(0) translateX(-10px)', offset: 0.5 },
      { transform: 'translateY(0) translateX(10px)', offset: 0.6 },
      { transform: 'translateY(0) translateX(-10px)', offset: 0.7 },
      { transform: 'translateY(0) translateX(10px)', offset: 0.8 },
      { transform: 'translateY(0) translateX(-5px)', offset: 0.9 },
      { transform: 'translateY(0) translateX(0)', offset: 1 }
    ];
    
    const animation = modal.animate(keyframes, {
      duration,
      easing,
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      modal.style.transform = originalTransform;
      resolve();
    };
  });
}

/**
 * Pulse animation for title
 */
export function pulseTitleAnimation(titleElement: HTMLElement, options: AnimationOptions = {}): Promise<void> {
  const { duration = 1000, easing = 'ease-in-out' } = options;
  
  return new Promise((resolve) => {
    const originalTransform = titleElement.style.transform;
    
    // Pulse sequence
    const keyframes = [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.05)', offset: 0.5 },
      { transform: 'scale(1)', offset: 1 }
    ];
    
    const animation = titleElement.animate(keyframes, {
      duration,
      easing,
      iterations: 2,
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      titleElement.style.transform = originalTransform;
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
 * Animate bottom sheet entrance
 */
export function animateBottomSheetEntrance(modal: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const sequence = async () => {
      // 1. Show bottom sheet
      await showBottomSheetAnimation(modal);
      
      // 2. Animate title
      const titleElement = modal.querySelector('.resume-bottom-sheet-title') as HTMLElement;
      if (titleElement) {
        await pulseTitleAnimation(titleElement);
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
 * Animate bottom sheet exit
 */
export function animateBottomSheetExit(modal: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const sequence = async () => {
      // 1. Animate buttons out
      const buttons = Array.from(modal.querySelectorAll('button')) as HTMLElement[];
      await staggerAnimation(buttons, (btn) => slideDownAnimation(btn), 50);
      
      // 2. Hide bottom sheet
      await hideBottomSheetAnimation(modal);
      
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
 * Animate handle indicator
 */
export function animateHandleIndicator(handle: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const originalBackground = handle.style.background;
    
    // Pulse sequence
    const keyframes = [
      { background: '#ddd', offset: 0 },
      { background: '#E97A55', offset: 0.5 },
      { background: '#ddd', offset: 1 }
    ];
    
    const animation = handle.animate(keyframes, {
      duration: 1000,
      easing: 'ease-in-out',
      iterations: 2,
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      handle.style.background = originalBackground;
      resolve();
    };
  });
}

// All functions are already exported individually above
