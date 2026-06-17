// @ts-nocheck

type WildFxDragLockReason = 'juice-bubbles' | 'sparkle-text' | 'magnetic-text';

const LOCKS_KEY = '__ccWildFxDragLocks';
const LEGACY_FLAG_KEY = '__ccWildFxDragBlocked';
const TIMER_KEY = '__ccWildFxDragUnlockTimers';
const DEFAULT_TTL_MS = 5200;

function getWindow(): any | null {
  return typeof window !== 'undefined' ? (window as any) : null;
}

function getLocks(): Record<string, number> {
  const w = getWindow();
  if (!w) return {};
  if (!w[LOCKS_KEY] || typeof w[LOCKS_KEY] !== 'object') {
    w[LOCKS_KEY] = {};
  }
  return w[LOCKS_KEY];
}

function syncLegacyFlag(): boolean {
  const w = getWindow();
  if (!w) return false;
  const locks = getLocks();
  const now = Date.now();
  Object.keys(locks).forEach((reason) => {
    if (!Number.isFinite(locks[reason]) || locks[reason] <= now) {
      delete locks[reason];
    }
  });
  const active = Object.keys(locks).length > 0;
  w[LEGACY_FLAG_KEY] = active;
  return active;
}

function getUnlockTimers(): Record<string, ReturnType<typeof setTimeout>> {
  const w = getWindow();
  if (!w) return {};
  if (!w[TIMER_KEY] || typeof w[TIMER_KEY] !== 'object') {
    w[TIMER_KEY] = {};
  }
  return w[TIMER_KEY];
}

function clearUnlockTimer(reason: WildFxDragLockReason): void {
  const timers = getUnlockTimers();
  const t = timers[reason];
  if (!t) return;
  try { clearTimeout(t); } catch {}
  delete timers[reason];
}

export function setWildFxDragLock(reason: WildFxDragLockReason, active: boolean, ttlMs = DEFAULT_TTL_MS): void {
  const w = getWindow();
  if (!w) return;
  const locks = getLocks();
  clearUnlockTimer(reason);
  if (active) {
    locks[reason] = Date.now() + Math.max(250, ttlMs);
  } else {
    delete locks[reason];
  }
  syncLegacyFlag();
}

/**
 * Lock drag while FX starts, then auto-release around 70% by default.
 * This keeps the dramatic start protected but avoids over-blocking the tail.
 */
export function startWildFxDragLockForAnimation(
  reason: WildFxDragLockReason,
  totalDurationMs: number,
  releaseAtRatio = 0.7,
): void {
  const duration = Math.max(300, totalDurationMs | 0);
  const ratio = Math.min(0.95, Math.max(0.2, releaseAtRatio));
  const releaseAfterMs = Math.max(220, Math.round(duration * ratio));
  setWildFxDragLock(reason, true, duration);
  const timers = getUnlockTimers();
  clearUnlockTimer(reason);
  timers[reason] = setTimeout(() => {
    try { setWildFxDragLock(reason, false); } catch {}
  }, releaseAfterMs);
}

export function isWildFxDragLocked(): boolean {
  const w = getWindow();
  if (!w) return false;
  return w.__ccTntDragBlocked === true || syncLegacyFlag();
}

export function getWildFxDragLockReasons(): string[] {
  syncLegacyFlag();
  return Object.keys(getLocks());
}
