// resume-sheet-utils.ts
// Utility functions for resume game bottom sheet

import { safePauseGame, safeResumeGame, safeUnlockSlider } from '../utils/animations.js';

// Type definitions
interface HTMLElementWithCleanup extends HTMLElement {
  _cleanupFns?: (() => void)[];
  _closing?: boolean;
}

interface TouchEventWithTouches extends TouchEvent {
  touches: TouchList;
  changedTouches: TouchList;
}

interface MouseEventWithTarget extends MouseEvent {
  target: EventTarget | null;
}

// Global state
let activeModal: HTMLElementWithCleanup | null = null;
let modalVisible: boolean = false;
let modalOptions: { 
  resume: () => void;
  pause: () => void;
} | null = null;

/**
 * Get active modal
 */
export function getActiveModal(): HTMLElementWithCleanup | null {
  return activeModal;
}

/**
 * Set active modal
 */
export function setActiveModal(modal: HTMLElementWithCleanup | null): void {
  activeModal = modal;
}

/**
 * Check if modal is visible
 */
export function isModalVisible(): boolean {
  return modalVisible;
}

/**
 * Set modal visibility
 */
export function setModalVisible(visible: boolean): void {
  modalVisible = visible;
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
 * Create cleanup registry
 */
export function createCleanupRegistry(modalEl: HTMLElementWithCleanup): (fn: () => void) => void {
  if (!modalEl._cleanupFns) {
    modalEl._cleanupFns = [];
  }
  
  return (fn: () => void) => {
    if (typeof fn === 'function') {
      modalEl._cleanupFns!.push(fn);
    }
  };
}

/**
 * Execute cleanup functions
 */
export function executeCleanup(modalEl: HTMLElementWithCleanup): void {
  if (modalEl._cleanupFns) {
    modalEl._cleanupFns.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.warn('⚠️ Resume sheet cleanup failed:', error);
      }
    });
    modalEl._cleanupFns = [];
  }
}

/**
 * Set modal closing state
 */
export function setModalClosing(modalEl: HTMLElementWithCleanup, closing: boolean): void {
  modalEl._closing = closing;
}

/**
 * Check if modal is closing
 */
export function isModalClosing(modalEl: HTMLElementWithCleanup): boolean {
  return modalEl._closing || false;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `resume-sheet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
 * Get modal options
 */
export function getModalOptions(): { 
  resume: () => void;
  pause: () => void;
} {
  return modalOptions || {
    resume: resumeGame,
    pause: pauseGame
  };
}

/**
 * Set modal options
 */
export function setModalOptions(options: { 
  resume: () => void;
  pause: () => void;
}): void {
  modalOptions = options;
}

/**
 * Check if modal should close
 */
export function shouldCloseModal(deltaY: number, velocity: number, threshold: number = 100): boolean {
  return deltaY > threshold || velocity > 0.5;
}

/**
 * Calculate velocity
 */
export function calculateVelocity(deltaY: number, deltaTime: number): number {
  return deltaTime > 0 ? deltaY / deltaTime : 0;
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
