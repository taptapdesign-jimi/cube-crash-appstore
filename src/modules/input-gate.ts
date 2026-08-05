// Centralized gameplay input gate for drag-start decisions.
// Keeps transient animation locks in one place so future special dice can share the same rules.

import { STATE } from './app-state.ts';
import { isWildLikeTile } from './final-merge-rules.ts';
import { isSpecialDiceMagnetLikeTile, isSpecialDiceResolutionOwned } from './special-dice-registry.ts';

export type InputGateLockReason =
  | 'juice-bubbles'
  | 'sparkle-text'
  | 'magnetic-text'
  | 'tnt-boom'
  | 'magnet-pull'
  | (string & {});

type InputGateLockScope = 'all' | 'wild-only';

type InputGateLock = {
  expiresAt: number;
  scope: InputGateLockScope;
};

type CanStartTileDragInput = {
  tile?: any;
  isWildTile?: boolean;
};

export type InputGateDecision = {
  allowed: boolean;
  reasons: string[];
};

const LOCKS_KEY = '__ccInputGateLocks';
const LEGACY_WILD_LOCKS_KEY = '__ccWildFxDragLocks';
const LEGACY_WILD_BLOCKED_KEY = '__ccWildFxDragBlocked';
const TIMER_KEY = '__ccInputGateUnlockTimers';
const DEFAULT_TTL_MS = 5200;

function isWildOrSpecialTile(tile: any): boolean {
  if (!tile || tile.destroyed) return false;
  if (isWildLikeTile(tile)) return true;
  if (isSpecialDiceMagnetLikeTile(tile)) return true;
  const special = tile.special || tile._ccWildSpecial || tile._ccSpecialDiceArchetype || tile._ccSpecialDiceVariant;
  return typeof special === 'string' && special.length > 0;
}

function canRebindAfterVisualTail(tile: any): boolean {
  if (!isWildOrSpecialTile(tile)) return false;
  // A visual-tail timer may expire while a different special still owns the
  // board mutation. Never let that timer bypass the central transaction gate.
  if (!canStartTileDrag({ tile, isWildTile: true }).allowed) return false;
  if (isSpecialDiceResolutionOwned(tile)) return false;
  if (tile._ccWildSpawnDropping === true) return false;
  if (tile._ccWildSpawnHandoffLock === true) return false;
  if (tile._wildMagnetAffected === true) return false;
  if (tile._pendingRemoval === true || tile._beingRemoved === true || tile._cleanupQueued === true) return false;
  if (tile.visible === false) return false;
  if (typeof tile.alpha === 'number' && tile.alpha <= 0.01) return false;
  return true;
}

function unlockWildTilesForVisualTail(reason: string): void {
  try {
    const drag = STATE?.drag;
    const tiles = Array.isArray(STATE?.tiles) ? STATE.tiles : [];
    if (!drag || typeof drag.bindToTile !== 'function' || tiles.length === 0) return;

    tiles.forEach((tile: any) => {
      if (!canRebindAfterVisualTail(tile)) return;
      try { tile.locked = false; } catch {}
      try { tile.eventMode = 'static'; } catch {}
      try { tile.interactive = true; } catch {}
      try { tile.interactiveChildren = true; } catch {}
      try { tile.cursor = 'pointer'; } catch {}
      if (tile.rotG && !tile.rotG.destroyed) {
        try { tile.rotG.eventMode = 'static'; } catch {}
        try { tile.rotG.interactive = true; } catch {}
        try { tile.rotG.interactiveChildren = false; } catch {}
        try { tile.rotG.cursor = 'pointer'; } catch {}
      }
      try { drag.bindToTile(tile); } catch {}
    });
  } catch {}
}

function getWindow(): any | null {
  return typeof window !== 'undefined' ? (window as any) : null;
}

function nowMs(): number {
  return Date.now();
}

function getLocks(): Record<string, InputGateLock> {
  const w = getWindow();
  if (!w) return {};
  if (!w[LOCKS_KEY] || typeof w[LOCKS_KEY] !== 'object') {
    w[LOCKS_KEY] = {};
  }
  return w[LOCKS_KEY];
}

function getUnlockTimers(): Record<string, ReturnType<typeof setTimeout>> {
  const w = getWindow();
  if (!w) return {};
  if (!w[TIMER_KEY] || typeof w[TIMER_KEY] !== 'object') {
    w[TIMER_KEY] = {};
  }
  return w[TIMER_KEY];
}

function syncLegacyWildLocks(locks: Record<string, InputGateLock>): void {
  const w = getWindow();
  if (!w) return;
  const legacyLocks: Record<string, number> = {};
  Object.entries(locks).forEach(([reason, lock]) => {
    if (lock.scope === 'wild-only') legacyLocks[reason] = lock.expiresAt;
  });
  w[LEGACY_WILD_LOCKS_KEY] = legacyLocks;
  w[LEGACY_WILD_BLOCKED_KEY] = Object.keys(legacyLocks).length > 0;
}

function pruneExpiredLocks(): Record<string, InputGateLock> {
  const locks = getLocks();
  const now = nowMs();
  Object.keys(locks).forEach((reason) => {
    const lock = locks[reason];
    if (!lock || !Number.isFinite(lock.expiresAt) || lock.expiresAt <= now) {
      delete locks[reason];
    }
  });
  syncLegacyWildLocks(locks);
  return locks;
}

function clearUnlockTimer(reason: InputGateLockReason): void {
  const timers = getUnlockTimers();
  const t = timers[reason];
  if (!t) return;
  try { clearTimeout(t); } catch {}
  delete timers[reason];
}

export function setInputGateLock(
  reason: InputGateLockReason,
  active: boolean,
  options: { ttlMs?: number; scope?: InputGateLockScope } = {},
): void {
  const locks = getLocks();
  clearUnlockTimer(reason);
  if (active) {
    const ttlMs = Math.max(250, options.ttlMs ?? DEFAULT_TTL_MS);
    locks[reason] = {
      expiresAt: nowMs() + ttlMs,
      scope: options.scope ?? 'all',
    };
  } else {
    delete locks[reason];
  }
  pruneExpiredLocks();
}

export function startInputGateLockForAnimation(
  reason: InputGateLockReason,
  totalDurationMs: number,
  options: { releaseAtRatio?: number; scope?: InputGateLockScope } = {},
): void {
  const duration = Math.max(300, totalDurationMs | 0);
  const ratio = Math.min(0.95, Math.max(0.2, options.releaseAtRatio ?? 0.7));
  const releaseAfterMs = Math.max(220, Math.round(duration * ratio));
  setInputGateLock(reason, true, { ttlMs: duration, scope: options.scope ?? 'all' });
  const timers = getUnlockTimers();
  clearUnlockTimer(reason);
	  timers[reason] = setTimeout(() => {
	    try {
	      setInputGateLock(reason, false);
	      if ((options.scope ?? 'all') === 'wild-only') {
	        unlockWildTilesForVisualTail(String(reason));
	      }
	    } catch {}
	  }, releaseAfterMs);
}

export function clearInputGateLocks(reasonPrefix?: string): void {
  const locks = getLocks();
  const timers = getUnlockTimers();
  Object.keys(locks).forEach((reason) => {
    if (!reasonPrefix || reason.startsWith(reasonPrefix)) {
      delete locks[reason];
      try {
        if (timers[reason]) clearTimeout(timers[reason]);
      } catch {}
      delete timers[reason];
    }
  });
  pruneExpiredLocks();
}

export function getInputGateLockReasons(input: CanStartTileDragInput = {}): string[] {
  const locks = pruneExpiredLocks();
  const isWildTile = input.isWildTile === true;
  const reasons: string[] = [];
  Object.entries(locks).forEach(([reason, lock]) => {
    if (lock.scope === 'all' || (lock.scope === 'wild-only' && isWildTile)) {
      reasons.push(reason);
    }
  });
  return reasons;
}

function getLegacyRuntimeReasons(input: CanStartTileDragInput): string[] {
  const w = getWindow();
  if (!w) return [];
  const reasons: string[] = [];

  const magnetPullActive =
    w.__ccWildMagnetPullInProgress === true ||
    (typeof w.CC?.isWildMagnetPullInProgress === 'function' && w.CC.isWildMagnetPullInProgress() === true) ||
    typeof w.__ccActiveMagnetPullCleanup === 'function';
  if (magnetPullActive) reasons.push('magnet-pull');

  if (w.__ccTntDragBlocked === true) {
    if (w.__ccTntAnimationActive !== true) {
      try { w.__ccTntDragBlocked = false; } catch {}
    } else {
      reasons.push('tnt-boom');
    }
  }

  const tile = input.tile;
  if (isSpecialDiceResolutionOwned(tile)) reasons.push('special-dice-resolving');
  if (tile?._ccWildSpawnDropping === true) reasons.push('wild-spawn-dropping');
  if (tile?._ccWildSpawnHandoffLock === true) reasons.push('wild-spawn-handoff');
  if (tile?._wildMagnetAffected === true) reasons.push('magnet-affected-tile');
  if (tile?.locked === true && input.isWildTile !== true) reasons.push('locked-tile');

  return reasons;
}

export function canStartTileDrag(input: CanStartTileDragInput = {}): InputGateDecision {
  const reasons = [
    ...getLegacyRuntimeReasons(input),
    ...getInputGateLockReasons(input),
  ];
  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function isInputGateLocked(input: CanStartTileDragInput = {}): boolean {
  return !canStartTileDrag(input).allowed;
}
