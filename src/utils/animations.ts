import { ANIMATION_DURATIONS, ANIMATION_EASING, ELEMENT_IDS } from '../constants/animations.js';
import { logger } from '../core/logger.js';

// Global window extensions
declare global {
  interface Window {
    CC?: {
      pauseGame?: () => void;
      resumeGame?: () => void;
    };
    unlockSlider?: () => void;
  }
}

// Safe element getter
export const getElement = (id: string): HTMLElement | null => {
  try {
    return document.getElementById(id);
  } catch (error) {
    logger.error(`Failed to get element with id: ${id}`, error);
    return null;
  }
};

// Fade out home element
export const fadeOutHome = (): void => {
  const home = getElement(ELEMENT_IDS.HOME);
  if (home) {
    home.style.transition = `opacity ${ANIMATION_DURATIONS.NORMAL} ${ANIMATION_EASING.EASE}`;
    home.style.opacity = '0';
    logger.info('🎮 Animating #home element fade out');
  }
};

// Fade in home element
export const fadeInHome = (): void => {
  const home = getElement(ELEMENT_IDS.HOME);
  if (home) {
    home.style.transition = `opacity ${ANIMATION_DURATIONS.NORMAL} ${ANIMATION_EASING.EASE}`;
    home.style.opacity = '1';
    logger.info('🎮 Animating #home element fade in');
  }
};

// Safe pause game - NO-OP for now (game not active yet)
export const safePauseGame = (): void => {
  try {
    // No-op: game is not active when resume sheet shows
    logger.info('🎯 safePauseGame called (no-op)');
  } catch (error) {
    logger.error('❌ Failed to pause game:', error);
  }
};

// Safe resume game - NO-OP for now (game not active yet)
export const safeResumeGame = (): void => {
  try {
    // No-op: game is not active yet
    logger.info('🎯 safeResumeGame called (no-op)');
  } catch (error) {
    logger.error('❌ Failed to resume game:', error);
  }
};

// Safe lock slider
export const safeLockSlider = (): void => {
  try {
    if (typeof window.lockSlider === 'function') {
      window.lockSlider();
      logger.info('🔒 Slider locked successfully');
    } else {
      logger.warn('⚠️ lockSlider function not available');
    }
  } catch (error) {
    logger.warn('⚠️ Failed to lock slider:', error);
  }
};

// Safe unlock slider
export const safeUnlockSlider = (): void => {
  try {
    if (typeof window.unlockSlider === 'function') {
      window.unlockSlider();
      logger.info('🔓 Slider unlocked successfully');
    } else {
      logger.warn('⚠️ unlockSlider function not available');
    }
  } catch (error) {
    logger.warn('⚠️ Failed to unlock slider:', error);
  }
};

// Animate slider exit when clicking CTA - CARTOONISH BOUNCE-INTO-SCALE-0
export const animateSliderExit = (): void => {
  try {
    logger.info('🎬 Starting cartoonish bounce-in-to-scale-0 exit animation...');
    
    // CRITICAL: Clean up any leftover animations first
    const allSliderElements = [
      '.hero-container',
      '.slide-text',
      '.slide-button',
      '#slider-dots',
      '#home-logo',
      '#independent-nav',
      '#slider-container'
    ];
    
    allSliderElements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const el = element as HTMLElement;
        // Kill any ongoing transitions
        el.style.transition = 'none';
        el.style.transform = '';
        el.style.opacity = '';
        el.style.willChange = '';
        // Force reflow to cancel animations
        void el.offsetHeight;
      }
    });
    
    // Helper function for cartoonish bounce scale animation
    const cartoonishBounce = (element: HTMLElement, delay: number) => {
      setTimeout(() => {
        element.style.willChange = 'transform, opacity';
        element.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Bouncy easing
        element.style.transform = 'scale(0)';
        element.style.opacity = '0';
      }, delay);
    };
    
    // STEP 1: Hero image - bounce into nothing
    const heroContainer = document.querySelector('.hero-container');
    if (heroContainer) {
      cartoonishBounce(heroContainer as HTMLElement, 0);
      logger.info('🖼️ Step 1: Hero image cartoonish bounce to scale(0)');
    }
    
    // STEP 2: Slide text
    const slideText = document.querySelector('.slide-text');
    if (slideText) {
      cartoonishBounce(slideText as HTMLElement, 100);
      logger.info('📝 Step 2: Slide text cartoonish bounce to scale(0)');
    }
    
    // STEP 3: Play button
    const slideButton = document.querySelector('.slide-button');
    if (slideButton) {
      cartoonishBounce(slideButton as HTMLElement, 200);
      logger.info('🔘 Step 3: Play button cartoonish bounce to scale(0)');
    }
    
    // STEP 4: Navigation dots
    const sliderNav = document.querySelector('#slider-dots');
    if (sliderNav) {
      cartoonishBounce(sliderNav as HTMLElement, 300);
      logger.info('🎯 Step 4: Navigation dots cartoonish bounce to scale(0)');
    }
    
    // STEP 5: Home logo
    const homeLogo = document.querySelector('#home-logo');
    if (homeLogo) {
      cartoonishBounce(homeLogo as HTMLElement, 400);
      logger.info('🎨 Step 5: Home logo cartoonish bounce to scale(0)');
    }
    
    // STEP 6: Independent navigation (bottom nav bar) - FASTER
    const independentNav = document.getElementById('independent-nav');
    if (independentNav) {
      cartoonishBounce(independentNav as HTMLElement, 150);
      logger.info('🎯 Step 6: Independent navigation cartoonish bounce to scale(0) - FASTER');
    }
    
    // STEP 7: Slider container (last)
    const sliderContainer = document.getElementById('slider-container');
    if (sliderContainer) {
      setTimeout(() => {
        sliderContainer.style.willChange = 'transform, opacity';
        sliderContainer.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        sliderContainer.style.transform = 'scale(0)';
        sliderContainer.style.opacity = '0';
      }, 600);
      logger.info('📦 Step 7: Slider container cartoonish bounce to scale(0)');
    }
    
    logger.info('✅ Cartoonish bounce-in-to-scale-0 exit animation started');
  } catch (error) {
    logger.error('❌ Failed to animate slider exit:', error);
  }
};

// Animate slider enter when returning to home - REVERSE OF EXIT ANIMATION
export const animateSliderEnter = (): void => {
  try {
    logger.info('🎬 Starting reverse cartoonish bounce enter animation...');
    
    // CRITICAL: Clean up any leftover animations first
    const allSliderElements = [
      '.hero-container',
      '.slide-text',
      '.slide-button',
      '#slider-dots',
      '#home-logo',
      '#slider-container'
    ];
    
    allSliderElements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const el = element as HTMLElement;
        // Kill any ongoing transitions
        el.style.transition = 'none';
        el.style.transform = '';
        el.style.opacity = '';
        el.style.willChange = '';
        // Force reflow to cancel animations
        void el.offsetHeight;
      }
    });
    
    // Helper function for reverse bounce animation (scale 0 to 1)
    const reverseBounce = (element: HTMLElement, delay: number) => {
      // Set initial state (from scale 0) - NO TRANSITION YET
      element.style.transition = 'none'; // Crucial: no transition when setting initial state
      element.style.transform = 'scale(0)';
      element.style.opacity = '0';
      
      // Force reflow to apply initial state
      void element.offsetHeight;
      
      setTimeout(() => {
        element.style.willChange = 'transform, opacity';
        element.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Same bouncy easing
        element.style.transform = 'scale(1)';
        element.style.opacity = '1';
      }, delay);
    };
    
    // Get slider container and reset it first
    const sliderContainer = document.getElementById('slider-container');
    if (sliderContainer) {
      sliderContainer.style.transform = 'scale(0)';
      sliderContainer.style.opacity = '0';
      setTimeout(() => {
        sliderContainer.style.willChange = 'transform, opacity';
        sliderContainer.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        sliderContainer.style.transform = 'scale(1)';
        sliderContainer.style.opacity = '1';
      }, 0);
      logger.info('📦 Step 1: Slider container reverse bounce from scale(0)');
    }
    
    // STEP 1: Hero image - bounce from 0 to 1
    const heroContainer = document.querySelector('.hero-container');
    if (heroContainer) {
      reverseBounce(heroContainer as HTMLElement, 100);
      logger.info('🖼️ Step 2: Hero image reverse bounce from scale(0)');
    }
    
    // STEP 2: Slide text
    const slideText = document.querySelector('.slide-text');
    if (slideText) {
      reverseBounce(slideText as HTMLElement, 200);
      logger.info('📝 Step 3: Slide text reverse bounce from scale(0)');
    }
    
    // STEP 3: Play button
    const slideButton = document.querySelector('.slide-button');
    if (slideButton) {
      reverseBounce(slideButton as HTMLElement, 300);
      logger.info('🔘 Step 4: Play button reverse bounce from scale(0)');
    }
    
    // STEP 4: Navigation dots
    const sliderNav = document.querySelector('#slider-dots');
    if (sliderNav) {
      reverseBounce(sliderNav as HTMLElement, 400);
      logger.info('🎯 Step 5: Navigation dots reverse bounce from scale(0)');
    }
    
    // STEP 5: Home logo (faster appearance)
    const homeLogo = document.querySelector('#home-logo');
    if (homeLogo) {
      reverseBounce(homeLogo as HTMLElement, 100);
      logger.info('🎨 Step 6: Home logo reverse bounce from scale(0) - FASTER');
    }
    
    // STEP 6: Independent navigation (bottom nav bar) - FASTER
    const independentNav = document.getElementById('independent-nav');
    if (independentNav) {
      reverseBounce(independentNav as HTMLElement, 150);
      logger.info('🎯 Step 7: Independent navigation reverse bounce from scale(0) - FASTER');
    }
    
    // CRITICAL: After all animations complete, ensure all elements are at final state
    setTimeout(() => {
      const allElements = [
        '.hero-container',
        '.slide-text',
        '.slide-button',
        '#slider-dots',
        '#home-logo',
        '#independent-nav',
        '#slider-container'
      ];
      
      allElements.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          const el = element as HTMLElement;
          // Ensure final state - remove transitions, set to final values
          el.style.transition = 'none';
          el.style.transform = 'scale(1)';
          el.style.opacity = '1';
          el.style.willChange = 'auto';
        }
      });
      
      logger.info('✅ All slider elements set to final state (scale(1), opacity(1))');
    }, 1100); // 500ms delay + 500ms animation + 100ms buffer
    
    logger.info('✅ Reverse cartoonish bounce enter animation started');
  } catch (error) {
    logger.error('❌ Failed to animate slider enter:', error);
  }
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>): void {
    const later = () => {
      clearTimeout(timeout!);
      func(...args);
    };
    clearTimeout(timeout!);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return function(this: any, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};