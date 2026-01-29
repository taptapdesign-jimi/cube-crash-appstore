/**
 * app-core-utils.ts
 * 
 * Utility functions extracted from app-core.ts
 * These are pure functions that don't modify global state
 */

import { COLS, ROWS, TILE, GAP } from './constants.js';
import { logger } from '../core/logger.js';

// 🔥 MEMORY LEAK FIX: Track all timeouts for cleanup
const _appTimeouts: Set<NodeJS.Timeout> = new Set();

export function trackAppTimeout(callback: () => void, delay: number): NodeJS.Timeout {
  const timeout = setTimeout(() => {
    callback();
    _appTimeouts.delete(timeout);
  }, delay);
  _appTimeouts.add(timeout);
  return timeout;
}

export function waitTracked(ms: number): Promise<void> {
  return new Promise<void>(resolve => trackAppTimeout(() => resolve(), ms));
}

export function clearAllAppTimeouts() {
  logger.debug(`🧹 Clearing ${_appTimeouts.size} pending timeouts from app-core`, 'app-core');
  _appTimeouts.forEach(timeout => clearTimeout(timeout));
  _appTimeouts.clear();
}

// 🔥 MEMORY LEAK FIX: Track all requestAnimationFrame callbacks for cleanup
const _appAnimationFrames: Set<number> = new Set();

export function trackAppAnimationFrame(callback: FrameRequestCallback): number {
  const rafId = requestAnimationFrame((now: number) => {
    callback(now);
    _appAnimationFrames.delete(rafId);
  });
  _appAnimationFrames.add(rafId);
  return rafId;
}

export function clearAllAppAnimationFrames() {
  logger.debug(`🧹 Clearing ${_appAnimationFrames.size} pending requestAnimationFrame callbacks from app-core`, 'app-core');
  _appAnimationFrames.forEach(rafId => cancelAnimationFrame(rafId));
  _appAnimationFrames.clear();
}

// 🔥 MEMORY LEAK FIX: Track all intervals for cleanup
const _appIntervals: Set<NodeJS.Timeout> = new Set();

export function trackAppInterval(callback: () => void, delay: number): NodeJS.Timeout {
  const interval = setInterval(() => {
    callback();
  }, delay);
  _appIntervals.add(interval);
  return interval;
}

export function clearAllAppIntervals() {
  logger.debug(`🧹 Clearing ${_appIntervals.size} pending intervals from app-core`, 'app-core');
  _appIntervals.forEach(interval => clearInterval(interval));
  _appIntervals.clear();
}

// 🔥 MEMORY LEAK FIX: Track all event listeners for cleanup
type AppListener = {
  target: EventTarget;
  event: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};

const _appListeners: AppListener[] = [];

export function trackAppListener(
  target: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): void {
  target.addEventListener(event, handler, options);
  _appListeners.push({ target, event, handler, options });
}

export function clearAllAppListeners(): void {
  if (_appListeners.length > 0) {
    logger.debug(`🧹 Clearing ${_appListeners.length} event listeners from app-core`, 'app-core');
  }
  for (const { target, event, handler, options } of _appListeners) {
    try {
      target.removeEventListener(event, handler, options);
    } catch {}
  }
  _appListeners.length = 0;
}

// Debug: get current counts for tracked resources
export function getAppCleanupStats() {
  return {
    timeouts: _appTimeouts.size,
    animationFrames: _appAnimationFrames.size,
    intervals: _appIntervals.size,
    listeners: _appListeners.length
  };
}

/**
 * Calculate board size based on grid dimensions
 */
export function boardSize(): { w: number; h: number } {
  return { 
    w: COLS * TILE + (COLS - 1) * GAP, 
    h: ROWS * TILE + (ROWS - 1) * GAP 
  };
}

/**
 * Calculate cell position (x, y) from column and row
 */
export function cellXY(c: number, r: number): { x: number; y: number } {
  return { 
    x: c * (TILE + GAP), 
    y: r * (TILE + GAP) 
  };
}

/**
 * Get random tile value (weighted distribution)
 * Returns: 1, 1, 1, 2, 2, 3, 3, 4, 5 (weighted towards lower values)
 */
export function randVal(): number {
  return [1, 1, 1, 2, 2, 3, 3, 4, 5][(Math.random() * 9) | 0];
}

/**
 * Sleep utility - returns a promise that resolves after specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Pick wild value for spawning
 * Excludes target value and uses smart logic to prefer complementary values
 */
export function pickWildValue(dstValue: number): number {
  // Always exclude the target value to avoid spawning same number
  let candidates = [1, 2, 3, 4, 5].filter(v => v !== dstValue);
  
  console.log('🎯 pickWildValue: target was', dstValue, 'candidates:', candidates);

  // Smart logic: if target is high (4-5), prefer lower numbers (1-3)
  // if target is low (1-2), prefer higher numbers (3-5)
  if (dstValue >= 4) {
    // Target is high, prefer lower numbers
    const lowCandidates = candidates.filter(v => v <= 3);
    if (lowCandidates.length > 0) {
      candidates = lowCandidates;
      console.log('🎯 Preferring lower numbers:', candidates);
    }
  } else if (dstValue <= 2) {
    // Target is low, prefer higher numbers
    const highCandidates = candidates.filter(v => v >= 3);
    if (highCandidates.length > 0) {
      candidates = highCandidates;
      console.log('🎯 Preferring higher numbers:', candidates);
    }
  }

  // Fallback: if no candidates, use all except target
  if (candidates.length === 0) {
    candidates = [1, 2, 3, 4, 5].filter(v => v !== dstValue);
    console.log('🎯 Fallback to all except target:', candidates);
  }

  const result = candidates[(Math.random() * candidates.length) | 0];
  console.log('🎯 Final wild spawn value:', result);
  return result;
}
