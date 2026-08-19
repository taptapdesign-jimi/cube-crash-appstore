/**
 * app-core-utils.ts
 * 
 * Utility functions extracted from app-core.ts
 * These are pure functions that don't modify global state
 */

import { COLS, ROWS, TILE, GAP } from './constants.js';
import { logger } from '../core/logger.js';
import { getRunMode, isArcadeHomeRunMode, RUN_MODE_JOURNEY } from './run-mode.js';
import { getJourneySmallValueBias } from './journey-stage-balance.js';

// 🔥 MEMORY LEAK FIX: Track all timeouts for cleanup. A timeout may also
// own a cancellation settlement (used by waitTrackedResult) so clearing the
// registry never leaves an awaiting lifecycle suspended forever.
type AppTimeoutRecord = {
  onCancel?: () => void;
};

const _appTimeouts = new Map<NodeJS.Timeout, AppTimeoutRecord>();

function reportTrackedCallbackError(kind: 'timeout' | 'interval', error: unknown): void {
  logger.error(`❌ Tracked app ${kind} callback failed`, 'app-core', error);
}

function scheduleAppTimeout(
  callback: () => void | Promise<void>,
  delay: number,
  onCancel?: () => void,
): NodeJS.Timeout {
  const timeout = setTimeout(() => {
    // The timer has fired and is no longer cancellable. Remove it before
    // invoking user code so a callback-triggered global cleanup cannot settle
    // the same owner twice.
    _appTimeouts.delete(timeout);
    try {
      const result = callback();
      if (result && typeof result.then === 'function') {
        void result.catch((error) => reportTrackedCallbackError('timeout', error));
      }
    } catch (error) {
      reportTrackedCallbackError('timeout', error);
    }
  }, delay);
  _appTimeouts.set(timeout, { onCancel });
  return timeout;
}

export function trackAppTimeout(callback: () => void | Promise<void>, delay: number): NodeJS.Timeout {
  return scheduleAppTimeout(callback, delay);
}

export type TrackedWaitResult = 'elapsed' | 'cancelled';

/**
 * Cancellation-aware wait for lifecycle-sensitive code.
 *
 * Unlike a bare Promise(setTimeout), this always settles when app timeout
 * ownership is cleared. New transaction code should branch on the result and
 * stop mutating retired state when it is `cancelled`.
 */
export function waitTrackedResult(ms: number): Promise<TrackedWaitResult> {
  return new Promise<TrackedWaitResult>((resolve) => {
    let settled = false;
    const settle = (result: TrackedWaitResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    scheduleAppTimeout(() => settle('elapsed'), ms, () => settle('cancelled'));
  });
}

/**
 * Compatibility wrapper for existing callers that only await elapsed time.
 * It now also settles during cleanup; migrate transaction-sensitive callers
 * to waitTrackedResult() when they need to distinguish cancellation.
 */
export function waitTracked(ms: number): Promise<void> {
  return waitTrackedResult(ms).then(() => undefined);
}

export function clearAllAppTimeouts() {
  logger.debug(`🧹 Clearing ${_appTimeouts.size} pending timeouts from app-core`, 'app-core');
  const pending = Array.from(_appTimeouts.entries());
  _appTimeouts.clear();
  pending.forEach(([timeout, record]) => {
    try { clearTimeout(timeout); } catch {}
    try { record.onCancel?.(); } catch (error) {
      reportTrackedCallbackError('timeout', error);
    }
  });
}

// 🔥 MEMORY LEAK FIX: Track all requestAnimationFrame callbacks for cleanup
const _appAnimationFrames: Set<number> = new Set();

export function trackAppAnimationFrame(callback: FrameRequestCallback): number {
  const rafId = requestAnimationFrame((now: number) => {
    try {
      callback(now);
    } finally {
      _appAnimationFrames.delete(rafId);
    }
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
    try {
      callback();
    } catch (error) {
      reportTrackedCallbackError('interval', error);
    }
  }, delay);
  _appIntervals.add(interval);
  return interval;
}

/** Clear a tracked interval and remove from internal set (prevents memory leak). */
export function clearAppInterval(interval: NodeJS.Timeout | null | undefined): void {
  if (!interval) return;
  clearInterval(interval);
  _appIntervals.delete(interval);
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

function listenerCapture(options?: boolean | AddEventListenerOptions): boolean {
  return typeof options === 'boolean' ? options : options?.capture === true;
}

export function trackAppListener(
  target: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): void {
  const capture = listenerCapture(options);
  const alreadyTracked = _appListeners.some(listener =>
    listener.target === target &&
    listener.event === event &&
    listener.handler === handler &&
    listenerCapture(listener.options) === capture
  );
  if (alreadyTracked) return;

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

export function isFirstPlayTutorialRunActive(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return w.__ccFirstPlayTutorialActive === true || w.__ccFirstPlayTutorialSlowWildMeter === true;
}

function isFirstPlayTutorialLowValueMode(): boolean {
  return isFirstPlayTutorialRunActive();
}

function getArcadeStageSmallValueBias(): number {
  if (typeof window === 'undefined' || !isArcadeHomeRunMode()) return 0;
  const stage = Math.max(1, (((window as any).STATE?.boardNumber ?? (window as any).__ccStartAtLevel ?? 1) | 0));
  return Math.max(0, 0.5 - (stage - 1) * 0.05);
}

function getCurrentJourneyBoardNumber(): number {
  if (typeof window === 'undefined') return 1;
  const w = window as any;
  return Math.max(1, ((w.STATE?.boardNumber ?? w.__ccStartAtLevel ?? 1) | 0));
}

function getJourneyBoardSmallValueBias(): number {
  if (typeof window === 'undefined' || getRunMode() !== RUN_MODE_JOURNEY) return 0;
  return getJourneySmallValueBias(getCurrentJourneyBoardNumber());
}

function pickSmallValueFromPool(pool: number[]): number | null {
  const smallPool = pool.filter(v => v >= 1 && v <= 3);
  if (smallPool.length <= 0) return null;
  return smallPool[(Math.random() * smallPool.length) | 0];
}

export function regularValuePool(exclude?: number | number[]): number[] {
  const base = isFirstPlayTutorialLowValueMode() ? [1, 2, 3] : [1, 2, 3, 4, 5];
  if (Array.isArray(exclude)) {
    const excluded = new Set(exclude.map(v => v | 0));
    const filtered = base.filter(v => !excluded.has(v));
    return filtered.length ? filtered : base;
  }
  if (Number.isFinite(exclude)) {
    const excludedValue = (exclude as number) | 0;
    const filtered = base.filter(v => v !== excludedValue);
    return filtered.length ? filtered : base;
  }
  return base;
}

export function randomRegularTileValue(exclude?: number | number[]): number {
  if (isFirstPlayTutorialLowValueMode()) {
    const excluded = new Set(Array.isArray(exclude) ? exclude.map(v => v | 0) : []);
    if (Number.isFinite(exclude)) excluded.add((exclude as number) | 0);
    const weighted = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3].filter(v => !excluded.has(v));
    const pool = weighted.length ? weighted : [1, 2];
    return pool[(Math.random() * pool.length) | 0];
  }
  const pool = regularValuePool(exclude);
  const journeySmallValueBias = getJourneyBoardSmallValueBias();
  if (journeySmallValueBias > 0 && Math.random() < journeySmallValueBias) {
    const smallValue = pickSmallValueFromPool(pool);
    if (smallValue !== null) return smallValue;
  }
  const smallValueBias = getArcadeStageSmallValueBias();
  if (smallValueBias > 0 && Math.random() < smallValueBias) {
    const smallValue = pickSmallValueFromPool(pool);
    if (smallValue !== null) return smallValue;
  }
  return pool[(Math.random() * pool.length) | 0];
}

/**
 * Get random tile value (weighted distribution).
 * In first-play tutorial, keep the demo board readable with values 1-3 only.
 */
export function randVal(): number {
  if (isFirstPlayTutorialLowValueMode()) {
    return [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3][(Math.random() * 11) | 0];
  }
  const journeySmallValueBias = getJourneyBoardSmallValueBias();
  if (journeySmallValueBias > 0 && Math.random() < journeySmallValueBias) {
    return [1, 2, 3][(Math.random() * 3) | 0];
  }
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
