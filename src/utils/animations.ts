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
// Helper function for EXTRA CARTOONISH bounce scale animation (SCALE ONLY, NO OPACITY)
const cartoonishBounce = (element: HTMLElement, delay: number) => {
  setTimeout(() => {
    // CRITICAL: Reset element state first
    element.style.willChange = 'transform';
    element.style.transition = 'none';
    element.style.transform = 'scale(1)';
    
    // Force reflow
    void element.offsetHeight;
    
    // NOW animate with extra bouncy easing
    element.style.transition = 'transform 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)'; // EXTRA bouncy, longer duration
    element.style.transform = 'scale(0)';
    // NO OPACITY - only scale down
  }, delay);
};

// Helper function for reverse bounce animation (scale 0 to 1) - NO OPACITY, SCALE ONLY
const reverseBounce = (element: HTMLElement, delay: number) => {
  // Set initial state (from scale 0) - NO TRANSITION YET
  element.style.transition = 'none'; // Crucial: no transition when setting initial state
  element.style.transform = 'scale(0)';
  // NO OPACITY - scale only
  
  // Force reflow to apply initial state
  void element.offsetHeight;
  
  setTimeout(() => {
    element.style.willChange = 'transform';
    element.style.transition = 'transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Same bouncy easing, scale only
    element.style.transform = 'scale(1)';
    // NO OPACITY
  }, delay);
};

export const animateSliderExit = (): void => {
  try {
    logger.info('🎬 Starting CARTOONISH PROCEDURAL exit animation...');
    
    // CRITICAL: Clean up any leftover animations and RESET to initial state first
    const allSliderElements = [
      '.hero-container',
      '.slide-text',
      '.slide-button',
      '#slider-dots',
      '#home-logo',
      '#independent-nav',
      '#slider-container'
    ];
    
    // CRITICAL: Reset ALL elements to initial state (scale 1, visible) IMMEDIATELY
    allSliderElements.forEach(selector => {
      const element = document.querySelector(selector) || document.getElementById(selector.replace('#', ''));
      if (element) {
        const el = element as HTMLElement;
        
        // Kill any ongoing transitions
        el.style.transition = '';
        // RESET to initial state
        el.style.transform = '';
        el.style.opacity = '';
        el.style.willChange = '';
        el.style.display = '';
        el.style.visibility = '';
      }
    });
    
    // CRITICAL: Force layout recalculation
    void document.body.offsetHeight;
    
    // NO ANIMATION - just return (animations removed)
    logger.info('✅ Slider exit animation skipped - using fade out instead');
    
  } catch (error) {
    logger.error('❌ Failed to animate slider exit:', error);
  }
};

// Separate function for the actual animation sequence
function startExitAnimationSequence(): void {
  try {
    // CARTOONISH PROCEDURAL SEQUENCE: 1. Navigation → 2. Hero image → 3. Logo → 4. Text → 5. CTA
    
    // STEP 1: Navigation FIRST (0ms delay)
    const independentNav = document.getElementById('independent-nav');
    if (independentNav) {
      cartoonishBounce(independentNav as HTMLElement, 0);
      logger.info('🎯 Step 1: Navigation cartoonish bounce - FIRST');
    }
    
    // STEP 2: Hero image SECOND (150ms delay)
    const heroContainer = document.querySelector('.hero-container');
    if (heroContainer) {
      cartoonishBounce(heroContainer as HTMLElement, 150);
      logger.info('🖼️ Step 2: Hero image cartoonish bounce - SECOND');
    }
    
    // STEP 3: Home logo THIRD (300ms delay)
    const homeLogo = document.querySelector('#home-logo');
    if (homeLogo) {
      cartoonishBounce(homeLogo as HTMLElement, 300);
      logger.info('🎨 Step 3: Home logo cartoonish bounce - THIRD');
    }
    
    // STEP 4: Slide text FOURTH (450ms delay)
    const slideText = document.querySelector('.slide-text');
    if (slideText) {
      cartoonishBounce(slideText as HTMLElement, 450);
      logger.info('📝 Step 4: Slide text cartoonish bounce - FOURTH');
    }
    
    // STEP 5: Stats button/CTA LAST (600ms delay)
    const slideButton = document.querySelector('.slide-button');
    if (slideButton) {
      cartoonishBounce(slideButton as HTMLElement, 600);
      logger.info('🔘 Step 5: Stats button cartoonish bounce - LAST');
    }
    
    // STEP 6: Slider container (after all elements, 800ms delay)
    const sliderContainer = document.getElementById('slider-container');
    if (sliderContainer) {
      setTimeout(() => {
        sliderContainer.style.willChange = 'transform';
        sliderContainer.style.transition = 'none';
        sliderContainer.style.transform = 'scale(1)';
        void sliderContainer.offsetHeight;
        sliderContainer.style.transition = 'transform 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
        sliderContainer.style.transform = 'scale(0)';
        // NO OPACITY - only scale
      }, 800);
      logger.info('📦 Step 6: Slider container cartoonish bounce');
    }
    
    logger.info('✅ Cartoonish bounce-in-to-scale-0 exit animation started');
  } catch (error) {
    logger.error('❌ Failed to start exit animation sequence:', error);
  }
};

// Stats screen enter animation - SAME STYLE AS SLIDE 1 (NO OPACITY, SCALE ONLY)
export const animateStatsScreenEnter = (): void => {
  try {
    logger.info('🎬 Starting stats screen enter animation (same as slide 1, scale only)...');
    
    // All stats screen elements
    const statsSelectors = [
      '.stats-back-button',
      '.stats-title',
      '.stats-title-underline',
      '.stats-grid',
      '.stats-scrollable'
    ];
    
    // Reset all elements to initial state (scale 0 only, NO opacity)
    statsSelectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const el = element as HTMLElement;
        el.style.transition = 'none';
        el.style.transform = 'scale(0)';
        // NO OPACITY - scale only
        el.style.willChange = '';
        void el.offsetHeight;
      }
    });
    
    // Helper function for reverse bounce animation (scale 0 to 1, NO OPACITY)
    const reverseBounceStats = (element: HTMLElement, delay: number) => {
      // Set initial state (from scale 0) - NO TRANSITION YET
      element.style.transition = 'none';
      element.style.transform = 'scale(0)';
      // NO OPACITY - scale only
      
      // Force reflow to apply initial state
      void element.offsetHeight;
      
      setTimeout(() => {
        element.style.willChange = 'transform';
        element.style.transition = 'transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Bouncy easing, scale only
        element.style.transform = 'scale(1)';
        // NO OPACITY
      }, delay);
    };
    
    // Animate each element with reverse bounce (same as slide 1 enter, scale only)
    const backButton = document.querySelector('.stats-back-button');
    if (backButton) reverseBounceStats(backButton as HTMLElement, 0);
    
    const title = document.querySelector('.stats-title');
    if (title) reverseBounceStats(title as HTMLElement, 100);
    
    const underline = document.querySelector('.stats-title-underline');
    if (underline) reverseBounceStats(underline as HTMLElement, 200);
    
    const grid = document.querySelector('.stats-grid');
    if (grid) reverseBounceStats(grid as HTMLElement, 300);
    
    const scrollable = document.querySelector('.stats-scrollable');
    if (scrollable) reverseBounceStats(scrollable as HTMLElement, 400);
    
    logger.info('✅ Stats screen enter animation started (scale only, no opacity)');
  } catch (error) {
    logger.error('❌ Failed to animate stats screen enter:', error);
  }
};

// Stats screen exit animation - SAME STYLE AS SLIDE 1 (NO OPACITY, SCALE ONLY)
export const animateStatsScreenExit = (): void => {
  try {
    logger.info('🎬 Starting stats screen exit animation (same as slide 1, scale only)...');
    
    const statsElements = [
      '.stats-back-button',
      '.stats-title',
      '.stats-title-underline',
      '.stats-grid',
      '.stats-scrollable'
    ];
    
    // Reset all elements (scale 1 only, NO opacity)
    statsElements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const el = element as HTMLElement;
        el.style.transition = 'none';
        el.style.transform = 'scale(1)';
        // NO OPACITY - scale only
        el.style.willChange = '';
        void el.offsetHeight;
      }
    });
    
    // Animate each element with stagger (same as slide 1 exit, scale only)
    const backButton = document.querySelector('.stats-back-button');
    if (backButton) cartoonishBounce(backButton as HTMLElement, 0);
    
    const title = document.querySelector('.stats-title');
    if (title) cartoonishBounce(title as HTMLElement, 100);
    
    const underline = document.querySelector('.stats-title-underline');
    if (underline) cartoonishBounce(underline as HTMLElement, 200);
    
    const grid = document.querySelector('.stats-grid');
    if (grid) cartoonishBounce(grid as HTMLElement, 300);
    
    const scrollable = document.querySelector('.stats-scrollable');
    if (scrollable) cartoonishBounce(scrollable as HTMLElement, 400);
    
    logger.info('✅ Stats screen exit animation started (scale only, no opacity)');
  } catch (error) {
    logger.error('❌ Failed to animate stats screen exit:', error);
  }
};

// Animate slider enter when returning to home - CARTOONISH PROCEDURAL ENTER (SCALE ONLY, NO OPACITY)
export const animateSliderEnter = (): void => {
  try {
    logger.info('🎬 Starting CARTOONISH PROCEDURAL enter animation...');
    
    // CRITICAL: Clean up any leftover animations first
    const allSliderElements = [
      '#independent-nav', // Add navigation
      '.hero-container',
      '.slide-text',
      '.slide-button',
      '#home-logo',
      '#slider-container'
    ];
    
    // CRITICAL: Reset ALL elements to initial state (scale 0, visible) IMMEDIATELY
    allSliderElements.forEach(selector => {
      const element = document.querySelector(selector) || document.getElementById(selector.replace('#', ''));
      if (element) {
        const el = element as HTMLElement;
        // Kill any ongoing transitions
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
        el.style.willChange = '';
        el.style.display = '';
        el.style.visibility = '';
      }
    });
    
    // CRITICAL: Force layout recalculation
    void document.body.offsetHeight;
    
    // NO ANIMATION - just return (animations removed)
    logger.info('✅ Slider enter animation skipped - using fade in instead');
    
  } catch (error) {
    logger.error('❌ Failed to animate slider enter:', error);
  }
};

// Separate function for the actual enter animation sequence
function startEnterAnimationSequence(): void {
  try {
    
    // Helper function for EXTRA CARTOONISH reverse bounce animation (scale 0 to 1, NO OPACITY)
    const reverseBounce = (element: HTMLElement, delay: number) => {
      setTimeout(() => {
        // CRITICAL: Reset element state first
        element.style.willChange = 'transform';
        element.style.transition = 'none';
        element.style.transform = 'scale(0)';
        
        // Force reflow
        void element.offsetHeight;
        
        // NOW animate with extra bouncy easing
        element.style.transition = 'transform 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)'; // EXTRA bouncy, longer duration
        element.style.transform = 'scale(1)';
        // NO OPACITY
      }, delay);
    };
    
    // CARTOONISH PROCEDURAL SEQUENCE: 1. Navigation → 2. Hero image → 3. Logo → 4. Text → 5. CTA
    
    // STEP 1: Navigation FIRST (0ms delay)
    const independentNav = document.getElementById('independent-nav');
    if (independentNav) {
      reverseBounce(independentNav as HTMLElement, 0);
      logger.info('🎯 Step 1: Navigation cartoonish bounce - FIRST');
    }
    
    // STEP 2: Hero image SECOND (150ms delay)
    const heroContainer = document.querySelector('.hero-container');
    if (heroContainer) {
      reverseBounce(heroContainer as HTMLElement, 150);
      logger.info('🖼️ Step 2: Hero image cartoonish bounce - SECOND');
    }
    
    // STEP 3: Home logo THIRD (300ms delay)
    const homeLogo = document.querySelector('#home-logo');
    if (homeLogo) {
      reverseBounce(homeLogo as HTMLElement, 300);
      logger.info('🎨 Step 3: Home logo cartoonish bounce - THIRD');
    }
    
    // STEP 4: Slide text FOURTH (450ms delay)
    const slideText = document.querySelector('.slide-text');
    if (slideText) {
      reverseBounce(slideText as HTMLElement, 450);
      logger.info('📝 Step 4: Slide text cartoonish bounce - FOURTH');
    }
    
    // STEP 5: CTA button LAST (600ms delay)
    const slideButton = document.querySelector('.slide-button');
    if (slideButton) {
      reverseBounce(slideButton as HTMLElement, 600);
      logger.info('🔘 Step 5: CTA button cartoonish bounce - LAST');
    }
    
    // STEP 6: Slider container (after all elements, 800ms delay)
    const sliderContainer = document.getElementById('slider-container');
    if (sliderContainer) {
      setTimeout(() => {
        sliderContainer.style.willChange = 'transform';
        sliderContainer.style.transition = 'none';
        sliderContainer.style.transform = 'scale(0)';
        void sliderContainer.offsetHeight;
        sliderContainer.style.transition = 'transform 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
        sliderContainer.style.transform = 'scale(1)';
        // NO OPACITY - only scale
      }, 800);
      logger.info('📦 Step 6: Slider container cartoonish bounce');
    }
    
    // CRITICAL: After all animations complete, ensure all elements are at final state
    setTimeout(() => {
      const allElements = [
        '#independent-nav',
        '.hero-container',
        '.slide-text',
        '.slide-button',
        '#home-logo',
        '#slider-container'
      ];
      
      allElements.forEach(selector => {
        const element = document.querySelector(selector) || document.getElementById(selector.replace('#', ''));
        if (element) {
          const el = element as HTMLElement;
          // Ensure final state - remove transitions, set to final values (SCALE ONLY)
          el.style.transition = 'none';
          el.style.transform = 'scale(1)';
          // NO OPACITY - scale only
          el.style.willChange = 'auto';
        }
      });
      
      logger.info('✅ All slider elements set to final state (scale(1) only)');
    }, 1400); // 800ms delay + 500ms animation + 100ms buffer
    
    logger.info('✅ Reverse cartoonish bounce enter animation started');
  } catch (error) {
    logger.error('❌ Failed to start enter animation sequence:', error);
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