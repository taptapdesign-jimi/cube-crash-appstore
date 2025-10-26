import { logger } from '../core/logger.js';
// clean-board-utils.ts
// Utility functions for clean board modal


// Type definitions
interface ShowCleanBoardModalParams {
  app?: any;
  stage?: any;
  getScore?: () => number;
  setScore?: (score: number) => void;
  animateScore?: (score: number, duration: number) => void;
  updateHUD?: () => void;
  bonus?: number;
  scoreCap?: number;
  boardNumber?: number;
}

interface CleanBoardModalResult {
  action: string;
}

interface TouchEventWithTouches extends TouchEvent {
  touches: TouchList;
  changedTouches: TouchList;
}

interface MouseEventWithTarget extends MouseEvent {
  target: EventTarget | null;
}

interface WindowWithUpdateHighScore extends Window {
  updateHighScore?: (score: number) => void;
}

// Constants
const HEADLINES: string[] = [
  'Outstanding!', 'Amazing!', 'Excellent!', 'Fantastic!', 'Incredible!',
  'Perfect!', 'Brilliant!', 'Superb!', 'Awesome!', 'Spectacular!',
  'Magnificent!', 'Phenomenal!', 'Marvelous!', 'Exceptional!', 'Stellar!',
  'Remarkable!', 'Impressive!', 'Unbelievable!', 'Wonderful!', 'Fabulous!',
  'Sensational!', 'Terrific!', 'Splendid!', 'Exquisite!', 'Divine!',
  'Glorious!', 'Masterful!', 'Flawless!', 'Supreme!', 'Epic!'
];

// Global state
let activeOverlay: HTMLElement | null = null;
let isModalVisibleState: boolean = false;
let modalParams: ShowCleanBoardModalParams = {};

/**
 * Get active overlay
 */
export function getActiveOverlay(): HTMLElement | null {
  return activeOverlay;
}

/**
 * Set active overlay
 */
export function setActiveOverlay(overlay: HTMLElement | null): void {
  activeOverlay = overlay;
}

/**
 * Check if modal is visible
 */
export function isModalVisible(): boolean {
  return isModalVisibleState;
}

/**
 * Set modal visibility
 */
export function setModalVisible(visible: boolean): void {
  isModalVisibleState = visible;
}

/**
 * Get modal parameters
 */
export function getModalParams(): ShowCleanBoardModalParams {
  return modalParams;
}

/**
 * Set modal parameters
 */
export function setModalParams(params: ShowCleanBoardModalParams): void {
  modalParams = params;
}

/**
 * Pick random headline
 */
export function pickRandomHeadline(): string {
  return HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
}

/**
 * Pick random from array
 */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get current score
 */
export function getCurrentScore(): number {
  if (modalParams.getScore) {
    return modalParams.getScore();
  }
  return 0;
}

/**
 * Set score
 */
export function setScore(score: number): void {
  if (modalParams.setScore) {
    modalParams.setScore(score);
  }
}

/**
 * Animate score
 */
export function animateScore(score: number, duration: number = 1000): void {
  if (modalParams.animateScore) {
    modalParams.animateScore(score, duration);
  }
}

/**
 * Update HUD
 */
export function updateHUD(): void {
  if (modalParams.updateHUD) {
    modalParams.updateHUD();
  }
}

/**
 * Update high score
 */
export function updateHighScore(score: number): void {
  if ((window as WindowWithUpdateHighScore).updateHighScore) {
    (window as WindowWithUpdateHighScore).updateHighScore!(score);
  }
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `clean-board-modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Calculate bonus score
 */
export function calculateBonusScore(currentScore: number, bonus: number, scoreCap: number): number {
  const newScore = currentScore + bonus;
  return Math.min(newScore, scoreCap);
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
 * Cleanup overlay
 */
export function cleanupOverlay(): void {
  if (activeOverlay && activeOverlay.parentNode) {
    activeOverlay.parentNode.removeChild(activeOverlay);
  }
  activeOverlay = null;
  setModalVisible(false);
}

/**
 * Get modal button options
 */
export function getModalButtonOptions(): { 
  continue: () => void;
  cancel: () => void;
} {
  return {
    continue: () => {
      logger.info('✅ Continuing game');
    },
    cancel: () => {
      logger.info('❌ Cancelling clean board');
    }
  };
}

/**
 * Execute modal callback
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

// All functions are already exported individually above
