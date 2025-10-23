import { ANIMATION_DURATIONS, ANIMATION_EASING, ELEMENT_IDS } from '../constants/animations.js';

// Safe element getter
export const getElement = (id) => {
  try {
    return document.getElementById(id);
  } catch (error) {
    console.error(`Failed to get element with id: ${id}`, error);
    return null;
  }
};

// Fade out home element
export const fadeOutHome = () => {
  const home = getElement(ELEMENT_IDS.HOME);
  if (home) {
    home.style.transition = `opacity ${ANIMATION_DURATIONS.NORMAL} ${ANIMATION_EASING.EASE}`;
    home.style.opacity = '0';
    console.log('🎮 Animating #home element fade out');
  }
};

// Fade in home element
export const fadeInHome = () => {
  const home = getElement(ELEMENT_IDS.HOME);
  if (home) {
    home.style.transition = `opacity ${ANIMATION_DURATIONS.NORMAL} ${ANIMATION_EASING.EASE}`;
    home.style.opacity = '1';
    console.log('🎮 Animating #home element fade in');
  }
};

// Safe pause game
export const safePauseGame = () => {
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
export const safeResumeGame = () => {
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
export const safeUnlockSlider = () => {
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
export const debounce = (func, wait) => {
  let timeout = null;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function
export const throttle = (func, limit) => {
  let inThrottle = false;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
