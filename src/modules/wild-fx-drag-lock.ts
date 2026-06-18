// @ts-nocheck

import {
  getInputGateLockReasons,
  isInputGateLocked,
  setInputGateLock,
  startInputGateLockForAnimation,
} from './input-gate.ts';

type WildFxDragLockReason = 'juice-bubbles' | 'sparkle-text' | 'magnetic-text';

const DEFAULT_TTL_MS = 5200;

export function setWildFxDragLock(reason: WildFxDragLockReason, active: boolean, ttlMs = DEFAULT_TTL_MS): void {
  setInputGateLock(reason, active, { ttlMs, scope: 'wild-only' });
}

/**
 * Lock special/wild dice while FX starts, then auto-release around 70% by default.
 * This preserves the protected gameplay impact while allowing future visual-tail unlocks centrally.
 */
export function startWildFxDragLockForAnimation(
  reason: WildFxDragLockReason,
  totalDurationMs: number,
  releaseAtRatio = 0.7,
): void {
  startInputGateLockForAnimation(reason, totalDurationMs, {
    releaseAtRatio,
    scope: 'wild-only',
  });
}

export function isWildFxDragLocked(): boolean {
  return isInputGateLocked({ isWildTile: true });
}

export function getWildFxDragLockReasons(): string[] {
  return getInputGateLockReasons({ isWildTile: true });
}
