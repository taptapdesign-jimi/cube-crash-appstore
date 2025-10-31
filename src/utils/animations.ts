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
  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
    // CRITICAL: Reset element state first
    element.style.willChange = 'transform';
    element.style.transition = 'none';
    element.style.transform = 'scale(1)';
    
    // Force reflow
    void element.offsetHeight;
    
    // NOW animate with extra bouncy easing
    element.style.transition = 'transform 0.3s cubic-bezier(0.68, -0.6, 0.32, 1.6)';
    element.style.transform = 'scale(0)';
    // NO OPACITY - only scale down
  }, delay);
  activeTimeouts.add(timeout);
};

// Helper function for reverse bounce animation (scale 0 to 1) - NO OPACITY, SCALE ONLY
const reverseBounce = (element: HTMLElement, delay: number) => {
  // Set initial state (from scale 0) - NO TRANSITION YET
  element.style.transition = 'none'; // Crucial: no transition when setting initial state
  element.style.transform = 'scale(0)';
  // NO OPACITY - scale only
  
  // Force reflow to apply initial state
  void element.offsetHeight;
  
  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
    element.style.willChange = 'transform';
    element.style.transition = 'transform 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    element.style.transform = 'scale(1)';
    // NO OPACITY
  }, delay);
  activeTimeouts.add(timeout);
};

// Guard to prevent multiple simultaneous animations
let isAnimatingExit = false;
let isAnimatingEnter = false;

// Track active animation timeouts for cleanup
let activeTimeouts: Set<NodeJS.Timeout> = new Set();

// Cleanup function to cancel all pending animations
export const cleanupAnimations = (): void => {
  logger.info('🧹 Cleaning up all animation timeouts...');
  activeTimeouts.forEach(timeout => {
    clearTimeout(timeout);
  });
  activeTimeouts.clear();
  isAnimatingExit = false;
  isAnimatingEnter = false;
  logger.info('✅ Animation cleanup complete');
};

export const animateSliderExit = (): void => {
  try {
    if (isAnimatingExit) {
      logger.warn('⚠️ Exit animation already in progress, ignoring duplicate call');
      return;
    }
    
    isAnimatingExit = true;
    logger.info('🎬 Starting CARTOONISH PROCEDURAL exit animation...');
    
    // Start the actual exit animation sequence
    startExitAnimationSequence();
    
    // Reset flag after animation completes
    const timeout = setTimeout(() => {
      activeTimeouts.delete(timeout);
      isAnimatingExit = false;
      logger.info('✅ Exit animation guard reset');
    }, 420); // 120ms delay + 300ms animation = 420ms total
    activeTimeouts.add(timeout);
    
  } catch (error) {
    isAnimatingExit = false;
    logger.error('❌ Failed to animate slider exit:', error);
  }
};

// Separate function for the actual animation sequence
function startExitAnimationSequence(): void {
  try {
    // CARTOONISH PROCEDURAL SEQUENCE: 1. Hero → 2. CTA → 3. Text → 4. Logo → 5. Navigation LAST
    
    // STEP 1: Hero image FIRST (0ms delay)
    const heroContainer = document.querySelector('.hero-container');
    if (heroContainer) {
      cartoonishBounce(heroContainer as HTMLElement, 0);
      logger.info('🖼️ Step 1: Hero image cartoonish bounce - FIRST');
    } else {
      logger.warn('⚠️ Hero container not found');
    }
    
    // STEP 2: CTA button SECOND (30ms delay - right after Hero)
    const slideButton = document.querySelector('.slide-button') || document.getElementById('btn-home');
    if (slideButton) {
      cartoonishBounce(slideButton as HTMLElement, 30);
      logger.info('🔘 Step 2: CTA button cartoonish bounce - SECOND');
    } else {
      logger.warn('⚠️ CTA button not found');
    }
    
    // STEP 3: Slide text THIRD (60ms delay - right after CTA)
    const slideText = document.querySelector('.slide-text');
    if (slideText) {
      cartoonishBounce(slideText as HTMLElement, 60);
      logger.info('📝 Step 3: Slide text cartoonish bounce - THIRD');
    } else {
      logger.warn('⚠️ Slide text not found');
    }
    
    // STEP 4: Home logo FOURTH (90ms delay)
    const homeLogo = document.querySelector('#home-logo');
    if (homeLogo) {
      cartoonishBounce(homeLogo as HTMLElement, 90);
      logger.info('🎨 Step 4: Home logo cartoonish bounce - FOURTH');
    } else {
      logger.warn('⚠️ Home logo not found');
    }
    
    // STEP 5: Navigation LAST (120ms delay - finishes at 420ms, close to 400ms)
    const independentNav = document.getElementById('independent-nav');
    if (independentNav) {
      cartoonishBounce(independentNav as HTMLElement, 120);
      logger.info('🎯 Step 5: Navigation cartoonish bounce - LAST');
    } else {
      logger.warn('⚠️ Navigation not found');
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
    if (isAnimatingEnter) {
      logger.warn('⚠️ Enter animation already in progress, ignoring duplicate call');
      return;
    }
    
    isAnimatingEnter = true;
    logger.info('🎬 Starting CARTOONISH PROCEDURAL enter animation...');
    
    // Start the actual enter animation sequence
    startEnterAnimationSequence();
    
    // Reset flag after animation completes
    const timeout = setTimeout(() => {
      activeTimeouts.delete(timeout);
      isAnimatingEnter = false;
      logger.info('✅ Enter animation guard reset');
    }, 420); // 120ms delay + 300ms animation = 420ms total
    activeTimeouts.add(timeout);
    
  } catch (error) {
    isAnimatingEnter = false;
    logger.error('❌ Failed to animate slider enter:', error);
  }
};

// Separate function for the actual enter animation sequence
function startEnterAnimationSequence(): void {
  try {
    // CARTOONISH PROCEDURAL SEQUENCE: 1. Hero → 2. CTA → 3. Text → 4. Logo → 5. Navigation LAST
    
    // STEP 1: Hero image FIRST (0ms delay)
    const heroContainer = document.querySelector('.hero-container');
    if (heroContainer) {
      reverseBounce(heroContainer as HTMLElement, 0);
      logger.info('🖼️ Step 1: Hero image cartoonish bounce - FIRST');
    } else {
      logger.warn('⚠️ Hero container not found');
    }
    
    // STEP 2: CTA button SECOND (30ms delay - right after Hero)
    const slideButton = document.querySelector('.slide-button') || document.getElementById('btn-home');
    if (slideButton) {
      reverseBounce(slideButton as HTMLElement, 30);
      logger.info('🔘 Step 2: CTA button cartoonish bounce - SECOND');
    } else {
      logger.warn('⚠️ CTA button not found');
    }
    
    // STEP 3: Slide text THIRD (60ms delay - right after CTA)
    const slideText = document.querySelector('.slide-text');
    if (slideText) {
      reverseBounce(slideText as HTMLElement, 60);
      logger.info('📝 Step 3: Slide text cartoonish bounce - THIRD');
    } else {
      logger.warn('⚠️ Slide text not found');
    }
    
    // STEP 4: Home logo FOURTH (90ms delay)
    const homeLogo = document.querySelector('#home-logo');
    if (homeLogo) {
      reverseBounce(homeLogo as HTMLElement, 90);
      logger.info('🎨 Step 4: Home logo cartoonish bounce - FOURTH');
    } else {
      logger.warn('⚠️ Home logo not found');
    }
    
    // STEP 5: Navigation LAST (120ms delay - finishes at 420ms)
    const independentNav = document.getElementById('independent-nav');
    if (independentNav) {
      reverseBounce(independentNav as HTMLElement, 120);
      logger.info('🎯 Step 5: Navigation cartoonish bounce - LAST');
    } else {
      logger.warn('⚠️ Navigation not found');
    }
    
    // CRITICAL: After all animations complete, ensure all elements are at final state
    const finalTimeout = setTimeout(() => {
      activeTimeouts.delete(finalTimeout);
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
    }, 420); // 120ms delay + 300ms animation = 420ms total
    activeTimeouts.add(finalTimeout);
    
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