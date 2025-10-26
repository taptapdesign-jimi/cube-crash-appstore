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

// Animate slider exit when clicking CTA
export const animateSliderExit = (): void => {
  try {
    logger.info('🎬 Starting slider exit animation...');
    
    const slideContent = document.querySelector('.slide-content');
    const slideText = document.querySelector('.slide-text');
    const slideButton = document.querySelector('.slide-button');
    const heroContainer = document.querySelector('.hero-container');
    const homeLogo = document.querySelector('#home-logo');
    
    // Apply exit animation to all slider elements
    const elements = [slideContent, slideText, slideButton, heroContainer, homeLogo].filter(el => el !== null);
    
    elements.forEach((element, index) => {
      if (element) {
        const el = element as HTMLElement;
        // Add GPU acceleration for smoother animations on iOS
        el.style.willChange = 'transform, opacity';
        el.style.backfaceVisibility = 'hidden';
        el.style.webkitBackfaceVisibility = 'hidden';
        el.style.perspective = '1000px';
        
        // Smoother cubic-bezier for iOS-like feel
        el.style.transition = 'all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)';
        el.style.transform = 'scale(0.8) translateY(-20px)';
        el.style.opacity = '0';
      }
    });
    
    logger.info('✅ Slider exit animation applied');
  } catch (error) {
    logger.error('❌ Failed to animate slider exit:', error);
  }
};

// Animate slider enter when returning to home
export const animateSliderEnter = (): void => {
  try {
    logger.info('🎬 Starting slider enter animation...');
    
    const slideContent = document.querySelector('.slide-content');
    const slideText = document.querySelector('.slide-text');
    const slideButton = document.querySelector('.slide-button');
    const heroContainer = document.querySelector('.hero-container');
    const homeLogo = document.querySelector('#home-logo');
    
    // Apply enter animation to all slider elements
    const elements = [slideContent, slideText, slideButton, heroContainer, homeLogo].filter(el => el !== null);
    
    elements.forEach((element) => {
      if (element) {
        // Set initial state
        (element as HTMLElement).style.transform = 'scale(0.8) translateY(-20px)';
        (element as HTMLElement).style.opacity = '0';
        
        // Animate to final state
        setTimeout(() => {
          (element as HTMLElement).style.transition = 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          (element as HTMLElement).style.transform = 'scale(1) translateY(0)';
          (element as HTMLElement).style.opacity = '1';
        }, 50);
      }
    });
    
    logger.info('✅ Slider enter animation applied');
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