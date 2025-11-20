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
    // Remove any existing animation classes
    element.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
    
    // Force reflow
    void element.offsetHeight;
    
    // NOW animate with CSS class
    element.classList.add('animate-exit');
    // NO OPACITY - only scale down
  }, delay);
  activeTimeouts.add(timeout);
};

// Helper function for reverse bounce animation (scale 0 to 1) - NO OPACITY, SCALE ONLY
const reverseBounce = (element: HTMLElement, delay: number) => {
  // Set initial state (from scale 0) - NO TRANSITION YET
  element.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
  element.classList.add('animate-enter-initial');
  // NO OPACITY - scale only
  
  // Force reflow to apply initial state
  void element.offsetHeight;
  
  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
    element.classList.remove('animate-enter-initial');
    element.classList.add('animate-enter');
    // NO OPACITY
  }, delay);
  activeTimeouts.add(timeout);
};

// Guard to prevent multiple simultaneous animations
let isAnimatingExit = false;
let isAnimatingEnter = false;

// Track active animation timeouts for cleanup
let activeTimeouts: Set<NodeJS.Timeout> = new Set();

// Cache DOM elements for performance (prevent repeated querySelector calls on first click)
let cachedElements: {
  homeLogo?: HTMLElement | null;
  independentNav?: HTMLElement | null;
} = {};

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
    
    // Start the actual exit animation sequence immediately
    // REMOVED: requestAnimationFrame delay - no longer needed
    startExitAnimationSequence();
    
    // Reset flag after animation completes
    const timeout = setTimeout(() => {
      activeTimeouts.delete(timeout);
      isAnimatingExit = false;
      logger.info('✅ Exit animation guard reset');
    }, 770); // 120ms delay + 650ms animation = 770ms total (was 420ms, increased by 350ms)
    activeTimeouts.add(timeout);
    
  } catch (error) {
    isAnimatingExit = false;
    logger.error('❌ Failed to animate slider exit:', error);
  }
};

// Separate function for the actual animation sequence
function startExitAnimationSequence(): void {
  try {
    // Find the currently active slide (slide with .active class)
    const activeSlide = document.querySelector('.slider-slide.active');
    if (!activeSlide) {
      logger.warn('⚠️ No active slide found, animating from first slide');
      startExitAnimationSequenceLegacy();
      return;
    }
    
    // Find elements within the active slide ONLY
    const heroContainer = activeSlide.querySelector('.hero-container');
    const slideButton = activeSlide.querySelector('.slide-button');
    const slideText = activeSlide.querySelector('.slide-text');
    
    // Use cached elements or query them once and cache
    if (!cachedElements.homeLogo) {
      cachedElements.homeLogo = document.querySelector('#home-logo');
    }
    const homeLogo = cachedElements.homeLogo;
    
    if (!cachedElements.independentNav) {
      cachedElements.independentNav = document.getElementById('independent-nav');
    }
    const independentNav = cachedElements.independentNav;
    
    // CARTOONISH PROCEDURAL SEQUENCE: 1. Hero → 2. CTA → 3. Text → 4. Logo → 5. Navigation LAST
    
    // STEP 1: Hero image FIRST (0ms delay)
    if (heroContainer) {
      cartoonishBounce(heroContainer as HTMLElement, 0);
      logger.info('🖼️ Step 1: Hero image cartoonish bounce - FIRST');
    } else {
      logger.warn('⚠️ Hero container not found in active slide');
    }
    
    // STEP 2: CTA button, Slide text, and Tagline TOGETHER (30ms delay - right after Hero)
    // Animate all at exactly the same time using the same timeout
    const slideTagline = activeSlide.querySelector('.slide-tagline');
    const timeout = setTimeout(() => {
      activeTimeouts.delete(timeout);
    if (slideButton) {
        slideButton.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
        void slideButton.offsetHeight;
        slideButton.classList.add('animate-exit');
      logger.info('🔘 Step 2: CTA button cartoonish bounce - SECOND');
    } else {
      logger.warn('⚠️ CTA button not found in active slide');
    }
    
    if (slideText) {
        slideText.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
        void slideText.offsetHeight;
        slideText.classList.add('animate-exit');
        logger.info('📝 Step 2: Slide text cartoonish bounce - TOGETHER with CTA');
    } else {
      logger.warn('⚠️ Slide text not found in active slide');
    }
      
      // Animate tagline together with text and CTA
      if (slideTagline) {
        (slideTagline as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
        void (slideTagline as HTMLElement).offsetHeight;
        (slideTagline as HTMLElement).classList.add('animate-exit');
        logger.info('📝 Step 2: Slide tagline cartoonish bounce - TOGETHER with text and CTA');
      }
    }, 30);
    activeTimeouts.add(timeout);
    
    // STEP 4: Home logo and shards FOURTH (90ms delay)
    if (homeLogo) {
      cartoonishBounce(homeLogo as HTMLElement, 90);
      logger.info('🎨 Step 4: Home logo cartoonish bounce - FOURTH');
    } else {
      logger.warn('⚠️ Home logo not found');
    }
    
    // Animate shards together with logo - ALL at the same time as logo (90ms delay)
    const logoAddons = [
      document.getElementById('logo-shards-gore-ljevo'),
      document.getElementById('logo-shards-gore-desno')
    ];
    logoAddons.forEach((addon, index) => {
      if (addon) {
        cartoonishBounce(addon as HTMLElement, 90); // Same delay as logo - no stagger
        logger.info(`✨ Step 4: Logo addon ${index + 1} cartoonish bounce - with logo (same time)`);
      }
    });
    
    
    // STEP 5: Navigation and Shadow LAST (120ms delay - finishes at 420ms, close to 400ms)
    if (independentNav) {
      cartoonishBounce(independentNav as HTMLElement, 120);
      logger.info('🎯 Step 5: Navigation cartoonish bounce - LAST');
    } else {
      logger.warn('⚠️ Navigation not found');
    }
    
    // Shadow animates together with navigation
    const fixedShadowBottom = document.getElementById('home-fixed-shadow-bottom');
    if (fixedShadowBottom) {
      cartoonishBounce(fixedShadowBottom as HTMLElement, 120);
      logger.info('🌑 Step 5: Shadow cartoonish bounce - LAST (with navigation)');
    }
    
    logger.info('✅ Cartoonish bounce-in-to-scale-0 exit animation started');
  } catch (error) {
    logger.error('❌ Failed to start exit animation sequence:', error);
  }
};

// Legacy fallback for when no active slide is found
function startExitAnimationSequenceLegacy(): void {
  // STEP 1: Hero image FIRST (0ms delay)
  const heroContainer = document.querySelector('.hero-container');
  if (heroContainer) {
    cartoonishBounce(heroContainer as HTMLElement, 0);
    logger.info('🖼️ Step 1: Hero image cartoonish bounce - FIRST (legacy)');
  }
  
  // STEP 2: CTA button, Slide text, and Tagline TOGETHER (30ms delay - right after Hero)
  // Animate all at exactly the same time using the same timeout
  const slideButton = document.querySelector('.slide-button') || document.getElementById('btn-home');
  const slideText = document.querySelector('.slide-text');
  const slideTagline = document.querySelector('.slide-tagline');
  
  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
  if (slideButton) {
      slideButton.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
      void slideButton.offsetHeight;
      slideButton.classList.add('animate-exit');
    logger.info('🔘 Step 2: CTA button cartoonish bounce - SECOND (legacy)');
  }
  
  if (slideText) {
      slideText.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
      void slideText.offsetHeight;
      slideText.classList.add('animate-exit');
      logger.info('📝 Step 2: Slide text cartoonish bounce - TOGETHER with CTA (legacy)');
    }
    
    // Animate tagline together with text and CTA
    if (slideTagline) {
      (slideTagline as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
      void (slideTagline as HTMLElement).offsetHeight;
      (slideTagline as HTMLElement).classList.add('animate-exit');
      logger.info('📝 Step 2: Slide tagline cartoonish bounce - TOGETHER with text and CTA (legacy)');
  }
  }, 30);
  activeTimeouts.add(timeout);
  
  // STEP 4: Home logo FOURTH (90ms delay)
  const homeLogo = document.querySelector('#home-logo');
  if (homeLogo) {
    cartoonishBounce(homeLogo as HTMLElement, 90);
    logger.info('🎨 Step 4: Home logo cartoonish bounce - FOURTH (legacy)');
  }
  
  // STEP 5: Navigation and Shadow LAST (120ms delay)
  const independentNav = document.getElementById('independent-nav');
  if (independentNav) {
    cartoonishBounce(independentNav as HTMLElement, 120);
    logger.info('🎯 Step 5: Navigation cartoonish bounce - LAST (legacy)');
  }
  
  // Shadow animates together with navigation
  const fixedShadowBottom = document.getElementById('home-fixed-shadow-bottom');
  if (fixedShadowBottom) {
    cartoonishBounce(fixedShadowBottom as HTMLElement, 120);
    logger.info('🌑 Step 5: Shadow cartoonish bounce - LAST (legacy, with navigation)');
  }
};

// Stats screen enter animation - REMOVED - no animations on stats screen
export const animateStatsScreenEnter = (): void => {
  logger.info('📊 Stats screen enter - animations disabled');
};

// Stats screen exit animation - REMOVED - no animations on stats screen
export const animateStatsScreenExit = (): void => {
  logger.info('📊 Stats screen exit - animations disabled');
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
    }, 770); // 120ms delay + 650ms animation = 770ms total (matches exit animation)
    activeTimeouts.add(timeout);
    
  } catch (error) {
    isAnimatingEnter = false;
    logger.error('❌ Failed to animate slider enter:', error);
  }
};

// Separate function for the actual enter animation sequence
function startEnterAnimationSequence(): void {
  try {
    // Find the currently active slide (slide with .active class)
    const activeSlide = document.querySelector('.slider-slide.active');
    if (!activeSlide) {
      logger.warn('⚠️ No active slide found, animating from first slide');
      startEnterAnimationSequenceLegacy();
      return;
    }
    
    // Find elements within the active slide ONLY
    const heroContainer = activeSlide.querySelector('.hero-container');
    const slideButton = activeSlide.querySelector('.slide-button');
    const slideText = activeSlide.querySelector('.slide-text');
    
    // Use cached elements or query them once and cache
    if (!cachedElements.homeLogo) {
      cachedElements.homeLogo = document.querySelector('#home-logo');
    }
    const homeLogo = cachedElements.homeLogo;
    
    if (!cachedElements.independentNav) {
      cachedElements.independentNav = document.getElementById('independent-nav');
    }
    const independentNav = cachedElements.independentNav;
    
    // COMIC POP-IN PROCEDURAL SEQUENCE (REVERSE of exit): Nav → Logo → Text → CTA → Hero
    // Last element that exits is first to enter!
    
    // STEP 1: Navigation and Shadow FIRST (0ms delay) - was last to exit
    if (independentNav) {
      reverseBounce(independentNav as HTMLElement, 0);
      logger.info('🎯 Step 1: Navigation cartoonish bounce - FIRST (reverse of exit)');
    } else {
      logger.warn('⚠️ Navigation not found');
    }
    
    // Shadow animates together with navigation
    const fixedShadowBottom = document.getElementById('home-fixed-shadow-bottom');
    if (fixedShadowBottom) {
      reverseBounce(fixedShadowBottom as HTMLElement, 0);
      logger.info('🌑 Step 1: Shadow cartoonish bounce - FIRST (with navigation)');
    }
    
    // STEP 2: Home logo and shards SECOND (30ms delay)
    if (homeLogo) {
      reverseBounce(homeLogo as HTMLElement, 30);
      logger.info('🎨 Step 2: Home logo cartoonish bounce - SECOND');
    } else {
      logger.warn('⚠️ Home logo not found');
    }
    
    // Animate shards together with logo - ALL at the same time as logo (30ms delay)
    const logoAddons = [
      document.getElementById('logo-shards-gore-ljevo'),
      document.getElementById('logo-shards-gore-desno')
    ];
    logoAddons.forEach((addon, index) => {
      if (addon) {
        reverseBounce(addon as HTMLElement, 30); // Same delay as logo - no stagger
        logger.info(`✨ Step 2: Logo addon ${index + 1} cartoonish bounce - with logo (same time)`);
      }
    });
    
    
    // STEP 3: Slide text, CTA button, and Tagline TOGETHER (60ms delay)
    // Animate all at exactly the same time using the same timeout
    const slideTagline = activeSlide.querySelector('.slide-tagline');
    if (slideText) {
      slideText.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
      slideText.classList.add('animate-enter-initial');
      void slideText.offsetHeight;
    }
    if (slideButton) {
      slideButton.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
      slideButton.classList.add('animate-enter-initial');
      void slideButton.offsetHeight;
    }
    if (slideTagline) {
      (slideTagline as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
      (slideTagline as HTMLElement).classList.add('animate-enter-initial');
      void (slideTagline as HTMLElement).offsetHeight;
    }
    
    const enterTimeout = setTimeout(() => {
      activeTimeouts.delete(enterTimeout);
      if (slideText) {
        slideText.classList.remove('animate-enter-initial');
        slideText.classList.add('animate-enter');
        logger.info('📝 Step 3: Slide text cartoonish bounce - TOGETHER with CTA');
    } else {
      logger.warn('⚠️ Slide text not found in active slide');
    }
    
    if (slideButton) {
        slideButton.classList.remove('animate-enter-initial');
        slideButton.classList.add('animate-enter');
        logger.info('🔘 Step 3: CTA button cartoonish bounce - TOGETHER with text');
    } else {
      logger.warn('⚠️ CTA button not found in active slide');
    }
      
      // Animate tagline together with text and CTA
      if (slideTagline) {
        (slideTagline as HTMLElement).classList.remove('animate-enter-initial');
        (slideTagline as HTMLElement).classList.add('animate-enter');
        logger.info('📝 Step 3: Slide tagline cartoonish bounce - TOGETHER with text and CTA');
      }
    }, 60);
    activeTimeouts.add(enterTimeout);
    
    // STEP 5: Hero image LAST (120ms delay) - was first to exit
    if (heroContainer) {
      reverseBounce(heroContainer as HTMLElement, 120);
      logger.info('🖼️ Step 5: Hero image cartoonish bounce - LAST (reverse of exit)');
    } else {
      logger.warn('⚠️ Hero container not found in active slide');
    }
    
    // CRITICAL: After all animations complete, ensure all elements are at final state
    const finalTimeout = setTimeout(() => {
      activeTimeouts.delete(finalTimeout);
      
      // Clean up elements from active slide + shared elements
      if (activeSlide) {
        const slideElements = [
          activeSlide.querySelector('.hero-container'),
          activeSlide.querySelector('.slide-text'),
          activeSlide.querySelector('.slide-button'),
          activeSlide.querySelector('.slide-tagline')
        ];
        
        slideElements.forEach(element => {
          if (element) {
            const el = element as HTMLElement;
            el.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
          }
        });
      }
      
      // Clean up shared elements
      const sharedElements = [
        document.querySelector('#independent-nav'),
        document.querySelector('#home-logo'),
        document.getElementById('logo-shards-gore-ljevo'),
        document.getElementById('logo-shards-gore-desno'),
        document.getElementById('home-fixed-shadow-bottom')
      ];
      
      sharedElements.forEach(element => {
        if (element) {
          const el = element as HTMLElement;
          el.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
        }
      });
      
      logger.info('✅ All slider elements set to final state (scale(1) only)');
    }, 770); // 120ms delay + 650ms animation = 770ms total (matches exit)
    activeTimeouts.add(finalTimeout);
    
    logger.info('✅ Reverse cartoonish bounce enter animation started');
  } catch (error) {
    logger.error('❌ Failed to start enter animation sequence:', error);
  }
};

// Legacy fallback for enter animation when no active slide is found
function startEnterAnimationSequenceLegacy(): void {
  // COMIC POP-IN PROCEDURAL SEQUENCE (REVERSE of exit): Nav → Logo → Text → CTA → Hero
  
  // STEP 1: Navigation and Shadow FIRST (0ms delay) - was last to exit
  const independentNav = document.getElementById('independent-nav');
  if (independentNav) {
    reverseBounce(independentNav as HTMLElement, 0);
    logger.info('🎯 Step 1: Navigation cartoonish bounce - FIRST (legacy, reverse of exit)');
  }
  
  // Shadow animates together with navigation
  const fixedShadowBottom = document.getElementById('home-fixed-shadow-bottom');
  if (fixedShadowBottom) {
    reverseBounce(fixedShadowBottom as HTMLElement, 0);
    logger.info('🌑 Step 1: Shadow cartoonish bounce - FIRST (legacy, with navigation)');
  }
  
  // STEP 2: Home logo and shards SECOND (30ms delay)
  const homeLogo = document.querySelector('#home-logo');
  if (homeLogo) {
    reverseBounce(homeLogo as HTMLElement, 30);
    logger.info('🎨 Step 2: Home logo cartoonish bounce - SECOND (legacy)');
  }
  
  // Animate shards together with logo
  const logoAddons = [
    document.getElementById('logo-shards-gore-ljevo'),
    document.getElementById('logo-shards-gore-desno')
  ];
  logoAddons.forEach((addon, index) => {
    if (addon) {
      reverseBounce(addon as HTMLElement, 30 + (index * 5)); // Slight stagger for visual effect
      logger.info(`✨ Step 2: Logo addon ${index + 1} cartoonish bounce - with logo (legacy)`);
    }
  });
  
  // STEP 3: Slide text, CTA button, and Tagline TOGETHER (60ms delay)
  // Animate all at exactly the same time using the same timeout
  const slideText = document.querySelector('.slide-text');
  const slideButton = document.querySelector('.slide-button') || document.getElementById('btn-home');
  const slideTagline = document.querySelector('.slide-tagline');
  
  if (slideText) {
    slideText.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
    slideText.classList.add('animate-enter-initial');
    void slideText.offsetHeight;
  }
  if (slideButton) {
    slideButton.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
    slideButton.classList.add('animate-enter-initial');
    void slideButton.offsetHeight;
  }
  if (slideTagline) {
    (slideTagline as HTMLElement).classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
    (slideTagline as HTMLElement).classList.add('animate-enter-initial');
    void (slideTagline as HTMLElement).offsetHeight;
  }
  
  const enterTimeout = setTimeout(() => {
    activeTimeouts.delete(enterTimeout);
    if (slideText) {
      slideText.classList.remove('animate-enter-initial');
      slideText.classList.add('animate-enter');
      logger.info('📝 Step 3: Slide text cartoonish bounce - TOGETHER with CTA (legacy)');
    }
    
    if (slideButton) {
      slideButton.classList.remove('animate-enter-initial');
      slideButton.classList.add('animate-enter');
      logger.info('🔘 Step 3: CTA button cartoonish bounce - TOGETHER with text (legacy)');
    }
    
    // Animate tagline together with text and CTA
    if (slideTagline) {
      (slideTagline as HTMLElement).classList.remove('animate-enter-initial');
      (slideTagline as HTMLElement).classList.add('animate-enter');
      logger.info('📝 Step 3: Slide tagline cartoonish bounce - TOGETHER with text and CTA (legacy)');
  }
  }, 60);
  activeTimeouts.add(enterTimeout);
  
  // STEP 5: Hero image LAST (120ms delay) - was first to exit
  const heroContainer = document.querySelector('.hero-container');
  if (heroContainer) {
    reverseBounce(heroContainer as HTMLElement, 120);
    logger.info('🖼️ Step 5: Hero image cartoonish bounce - LAST (legacy, reverse of exit)');
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