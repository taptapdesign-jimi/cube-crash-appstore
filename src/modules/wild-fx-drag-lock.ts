// @ts-nocheck

type WildFxDragLockReason = 'juice-bubbles' | 'sparkle-text' | 'magnetic-text';

const LOCKS_KEY = '__ccWildFxDragLocks';
const LEGACY_FLAG_KEY = '__ccWildFxDragBlocked';
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

export function setWildFxDragLock(reason: WildFxDragLockReason, active: boolean, ttlMs = DEFAULT_TTL_MS): void {
  const w = getWindow();
  if (!w) return;
  const locks = getLocks();
  if (active) {
    locks[reason] = Date.now() + Math.max(250, ttlMs);
  } else {
    delete locks[reason];
  }
  syncLegacyFlag();
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
