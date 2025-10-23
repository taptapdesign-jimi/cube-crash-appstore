import { ANIMATION_DURATIONS, ANIMATION_EASING, ELEMENT_IDS, type ElementId } from '../constants/animations.js';

// Type definitions
interface GameControls {
  pauseGame?: () => void;
  resumeGame?: () => void;
}

declare global {
  interface Window {
    CC?: GameControls;
    pauseGame?: () => void;
    resumeGame?: () => void;
    unlockSlider?: () => void;
  }
}

// Safe element getter
export const getElement = (id: ElementId): HTMLElement | null => {
  try {
    return document.getElementById(id);
  } catch (error) {
    console.error(`Failed to get element with id: ${id}`, error);
    return null;
  }
};

// Fade out home element
export const fadeOutHome = (): void => {
  const home = getElement(ELEMENT_IDS.HOME);
  if (home) {
    home.style.transition = `opacity ${ANIMATION_DURATIONS.NORMAL} ${ANIMATION_EASING.EASE}`;
    home.style.opacity = '0';
    console.log('🎮 Animating #home element fade out');
  }
};

// Fade in home element
export const fadeInHome = (): void => {
  const home = getElement(ELEMENT_IDS.HOME);
  if (home) {
    home.style.transition = `opacity ${ANIMATION_DURATIONS.NORMAL} ${ANIMATION_EASING.EASE}`;
    home.style.opacity = '1';
    console.log('🎮 Animating #home element fade in');
  }
};

// Safe pause game
export const safePauseGame = (): void => {
  try {
    if (window.CC?.pauseGame) {
      window.CC.pauseGame();
      console.log('🎯 Game paused successfully');
    } else {
      console.warn('⚠️ pauseGame function not available');
    }
  } catch (error) {
    console.error('❌ Failed to pause game:', error);
  }
};

// Safe resume game
export const safeResumeGame = (): void => {
  try {
    if (window.CC?.resumeGame) {
      window.CC.resumeGame();
      console.log('🎯 Game resumed successfully');
    } else {
      console.warn('⚠️ resumeGame function not available');
    }
  } catch (error) {
    console.error('❌ Failed to resume game:', error);
  }
};

// Safe unlock slider
export const safeUnlockSlider = (): void => {
  try {
    if (typeof window.unlockSlider === 'function') {
      window.unlockSlider();
      console.log('🔓 Slider unlocked successfully');
    } else {
      console.warn('⚠️ unlockSlider function not available');
    }
  } catch (error) {
    console.warn('⚠️ Failed to unlock slider:', error);
  }
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
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
  let inThrottle: boolean = false;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
