// @ts-nocheck

import { container } from '../core/dependency-injection.js';
import { gsap } from 'gsap';
import { Container } from 'pixi.js';
// pause-utils.ts
// Utility functions for pause modal

// Note: pauseGame, resumeGame, restart functions should be imported from appropriate modules
// For now, we'll define them locally or import from the correct module

type WindowWithCC = {
  CC?: {
    app?: any;
    stage?: any;
    getScore?: () => number;
    animateScoreTo?: (value: number, duration: number) => void;
    updateHUD?: () => void;
    hideGameUI?: () => void;
    nextLevel?: () => void;
  };
};

declare global {
  interface Window extends WindowWithCC {}
}

/**
 * Pause game
 */
export function pauseGame(): void {
  try {
    // Implement pause game logic
    if (container && typeof container.get === 'function') {
      try { container.set('gamePaused', true); } catch {}
    }
    
    // Pause all animations
    if (gsap && gsap.globalTimeline) {
      gsap.globalTimeline.pause();
    }
    
    // Pause PIXI app - try DI first, then fallback to window.STATE.app
    let app = null;
    try {
      app = container && typeof container.get === 'function' ? container.get('app') : null;
    } catch {
      // DI container doesn't have 'app' - use fallback
      app = (window as any).STATE?.app || null;
    }
    if (app && app.ticker) {
      app.ticker.stop();
    }
  } catch (e) {
    // Silently ignore - this is truly non-fatal
  }
}

/**
 * Resume game
 */
export function resumeGame(): void {
  try {
    // Implement resume game logic
    if (container && typeof container.set === 'function') {
      try { container.set('gamePaused', false); } catch {}
    }
    
    // Resume all animations
    if (gsap && gsap.globalTimeline) {
      gsap.globalTimeline.resume();
    }
    
    // Resume PIXI app - try DI first, then fallback to window.STATE.app
    let app = null;
    try {
      app = container && typeof container.get === 'function' ? container.get('app') : null;
    } catch {
      // DI container doesn't have 'app' - use fallback
      app = (window as any).STATE?.app || null;
    }
    if (app && app.ticker) {
      app.ticker.start();
    }
  } catch (e) {
    // Silently ignore - this is truly non-fatal
  }
}

/**
 * Restart game
 */
export function restartGame(): void {
  try {
    // Implement restart game logic
    // Reset game state
    if (container && typeof container.set === 'function') {
      try { container.set('score', 0); } catch {}
      try { container.set('level', 1); } catch {}
      try { container.set('moves', 50); } catch {}
      try { container.set('combo', 0); } catch {}
      try { container.set('gamePaused', false); } catch {}
    }
  } catch (e) {
    console.warn('⚠️ restartGame state reset failed (non-fatal):', e);
  }
  
  // Reset board
  const grid = (container && typeof container.get === 'function') ? container.get('grid') as (Container | null)[][] : null;
  if (grid) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        grid[r][c] = null;
      }
    }
  }
  
  // Restart PIXI app
  const app = container.get('app');
  if (app) {
    app.ticker.start();
  }
}

/**
 * Get current score
 */
export function getCurrentScore(): number {
  if (window.CC?.getScore) {
    return window.CC.getScore();
  }
  return 0;
}

/**
 * Animate score to value
 */
export function animateScoreTo(value: number, duration: number = 1000): void {
  if (window.CC?.animateScoreTo) {
    window.CC.animateScoreTo(value, duration);
  }
}

/**
 * Update HUD
 */
export function updateHUD(): void {
  if (window.CC?.updateHUD) {
    window.CC.updateHUD();
  }
}

/**
 * Hide game UI
 */
export function hideGameUI(): void {
  if (window.CC?.hideGameUI) {
    window.CC.hideGameUI();
  }
}

/**
 * Go to next level
 */
export function nextLevel(): void {
  if (window.CC?.nextLevel) {
    window.CC.nextLevel();
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Check if element is in viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Get element position
 */
export function getElementPosition(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY
  };
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smooth step interpolation
 */
export function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// All functions are already exported individually above
