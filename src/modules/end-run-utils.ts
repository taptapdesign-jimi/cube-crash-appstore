// end-run-utils.ts
// Utility functions for end run modal

import { showCleanBoardModal } from './clean-board-modal.js';
import { safePauseGame, safeResumeGame, safeUnlockSlider } from '../utils/animations.js';
import { logger } from '../core/logger.js';

// Type definitions
interface TouchEventWithTouches extends TouchEvent {
  touches: TouchList;
  changedTouches: TouchList;
}

interface MouseEventWithTarget extends MouseEvent {
  target: EventTarget | null;
}

interface WindowWithCC extends Window {
  CC?: {
    restart?: () => void;
    app?: any;
    stage?: any;
    getScore?: () => number;
    setScore?: (score: number) => void;
    animateScore?: (score: number) => void;
    updateHUD?: () => void;
  };
  exitToMenu?: () => void;
  showEndRunModalFromGame?: () => void;
}

declare let window: WindowWithCC;

// Global state
let activeModal: HTMLElement | null = null;
let isModalVisible: boolean = false;

/**
 * Get active modal
 */
export function getActiveModal(): HTMLElement | null {
  return activeModal;
}

/**
 * Set active modal
 */
export function setActiveModal(modal: HTMLElement | null): void {
  activeModal = modal;
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
 * Get current score
 */
export function getCurrentScore(): number {
  if (window.CC?.getScore) {
    return window.CC.getScore();
  }
  return 0;
}

/**
 * Set score
 */
export function setScore(score: number): void {
  if (window.CC?.setScore) {
    window.CC.setScore(score);
  }
}

/**
 * Animate score
 */
export function animateScore(score: number): void {
  if (window.CC?.animateScore) {
    window.CC.animateScore(score);
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
 * Restart game
 */
export function restartGame(): void {
  if (window.CC?.restart) {
    window.CC.restart();
  }
}

/**
 * Exit to menu
 */
export function exitToMenu(): void {
  if (window.exitToMenu) {
    window.exitToMenu();
  }
}

/**
 * Show clean board modal
 */
export function showCleanBoard(): void {
  showCleanBoardModal({
    onClean: () => {
      logger.info('✅ Board cleaned');
      hideModal();
    },
    onCancel: () => {
      logger.info('❌ Clean board cancelled');
    }
  });
}

/**
 * Pause game safely
 */
export function pauseGame(): void {
  safePauseGame();
}

/**
 * Resume game safely
 */
export function resumeGame(): void {
  safeResumeGame();
}

/**
 * Unlock slider safely
 */
export function unlockSlider(): void {
  safeUnlockSlider();
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `end-run-modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
 * Animate element to position
 */
export function animateToPosition(
  element: HTMLElement,
  targetX: number,
  targetY: number,
  duration: number = 300
): Promise<void> {
  return new Promise((resolve) => {
    const startX = element.offsetLeft;
    const startY = element.offsetTop;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;
    
    const startTime = performance.now();
    
    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      
      element.style.left = `${startX + deltaX * easeProgress}px`;
      element.style.top = `${startY + deltaY * easeProgress}px`;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }
    
    requestAnimationFrame(animate);
  });
}

/**
 * Get touch position
 */
export function getTouchPosition(event: TouchEventWithTouches | MouseEventWithTarget): { x: number; y: number } {
  if ('touches' in event && event.touches.length > 0) {
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  } else if ('clientX' in event) {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }
  return { x: 0, y: 0 };
}

/**
 * Check if touch is valid
 */
export function isValidTouch(event: TouchEventWithTouches | MouseEventWithTarget): boolean {
  if ('touches' in event) {
    return event.touches.length === 1;
  }
  return true;
}

/**
 * Get modal options
 */
export function getModalOptions(): { 
  restart: () => void;
  exit: () => void;
  clean: () => void;
} {
  return {
    restart: restartGame,
    exit: exitToMenu,
    clean: showCleanBoard
  };
}

// All functions are already exported individually above
