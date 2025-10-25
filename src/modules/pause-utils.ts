import { logger } from '../core/logger.js';
// pause-utils.ts
// Utility functions for pause modal

// Note: pauseGame, resumeGame, restart functions should be imported from appropriate modules
// For now, we'll define them locally or import from the correct module

// Type definitions
interface PauseModalOptions {
  onUnpause?: () => void | Promise<void>;
  onRestart?: () => void | Promise<void>;
  onExit?: () => void | Promise<void>;
}

interface WindowWithCC extends Window {
  CC?: {
    app?: any;
    stage?: any;
    getScore?: () => number;
    animateScoreTo?: (value: number, duration: number) => void;
    updateHUD?: () => void;
    hideGameUI?: () => void;
    nextLevel?: () => void;
  };
}

declare global {
  interface Window extends WindowWithCC {}
}

// Global state
let overlay: HTMLElement | null = null;
let isModalVisible: boolean = false;
let modalOptions: PauseModalOptions = {};

/**
 * Get active overlay
 */
export function getActiveOverlay(): HTMLElement | null {
  return overlay;
}

/**
 * Set active overlay
 */
export function setActiveOverlay(overlayEl: HTMLElement | null): void {
  overlay = overlayEl;
}

/**
 * Check if modal is visible
 */
export function isModalVisible(): boolean {
  return isModalVisible;
}

/**
 * Set modal visibility
 */
export function setModalVisible(visible: boolean): void {
  isModalVisible = visible;
}

/**
 * Get modal options
 */
export function getModalOptions(): PauseModalOptions {
  return modalOptions;
}

/**
 * Set modal options
 */
export function setModalOptions(options: PauseModalOptions): void {
  modalOptions = options;
}

/**
 * Pause game
 */
export function pauseGame(): void {
  // Implement pause game logic
  const gameState = container.get('gamePaused') as boolean;
  container.set('gamePaused', true);
  
  // Pause all animations
  gsap.globalTimeline.pause();
  
  // Pause PIXI app
  const app = container.get('app');
  if (app) {
    app.ticker.stop();
  }
}

/**
 * Resume game
 */
export function resumeGame(): void {
  // Implement resume game logic
  container.set('gamePaused', false);
  
  // Resume all animations
  gsap.globalTimeline.resume();
  
  // Resume PIXI app
  const app = container.get('app');
  if (app) {
    app.ticker.start();
  }
}

/**
 * Restart game
 */
export function restartGame(): void {
  // Implement restart game logic
  // Reset game state
  container.set('score', 0);
  container.set('level', 1);
  container.set('moves', 50);
  container.set('combo', 0);
  container.set('gamePaused', false);
  
  // Reset board
  const grid = container.get('grid') as (Container | null)[][];
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
 * Generate unique ID
 */
export function generateId(): string {
  return `pause-modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

/**
 * Get modal button options
 */
export function getModalButtonOptions(): { 
  resume: () => void;
  restart: () => void;
  exit: () => void;
} {
  return {
    resume: resumeGame,
    restart: restartGame,
    exit: () => {
      // Handle exit logic
      logger.info('🚪 Exiting game');
    }
  };
}

/**
 * Execute modal option callback
 */
export function executeModalCallback(callback: (() => void | Promise<void>) | undefined): void {
  if (callback) {
    try {
      const result = callback();
      if (result instanceof Promise) {
        result.catch(error => {
          logger.error('❌ Modal callback error:', error);
        });
      }
    } catch (error) {
      logger.error('❌ Modal callback error:', error);
    }
  }
}

/**
 * Cleanup overlay
 */
export function cleanupOverlay(): void {
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
  overlay = null;
  setModalVisible(false);
}

// All functions are already exported individually above
