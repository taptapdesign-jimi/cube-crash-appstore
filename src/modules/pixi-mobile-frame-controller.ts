import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.js';

interface PixiCadenceTicker {
  maxFPS: number;
  add(callback: () => void): void;
  remove(callback: () => void): void;
}

const ACTIVE_FPS = 60;
// Generic one-shot activity only needs a short final-paint tail. Direct
// manipulation, board entry, merges and authored finales own explicit leases.
const ACTIVITY_TAIL_MS = 300;
// Snap-back paints for 235ms. Accepted merges and finales own their own exact
// leases, so a 250ms input tail covers the rejected-drop animation without
// holding 60fps through the player's full pause between moves.
const DIRECT_MANIPULATION_RELEASE_TAIL_MS = 250;
let ownedTicker: PixiCadenceTicker | null = null;
let activeUntil = 0;
let tickOwner: (() => void) | null = null;
let listenersInstalled = false;
const activityLeases = new Set<symbol>();
let releaseDirectManipulation: (() => void) | null = null;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function getActiveFramesPerSecond(): number {
  // Explicit native diagnostic only. Normal and release launches never define
  // this flag, so authored gameplay retains its 60fps activity leases.
  if (typeof window !== 'undefined'
    && (window as any).__ccThermalPixiActiveFpsCap === 30) return 30;
  return ACTIVE_FPS;
}

function applyCadence(): void {
  if (!ownedTicker) return;
  ownedTicker.maxFPS = activityLeases.size > 0 || now() < activeUntil
    ? getActiveFramesPerSecond()
    : MOBILE_RUNTIME_PROFILE.settledIdleMaxFramesPerSecond;
}

function beginDirectManipulation(): void {
  if (releaseDirectManipulation) return;
  releaseDirectManipulation = acquirePixiMobileActivityLease(
    'direct-manipulation',
    DIRECT_MANIPULATION_RELEASE_TAIL_MS,
  );
}

function endDirectManipulation(): void {
  const release = releaseDirectManipulation;
  releaseDirectManipulation = null;
  release?.();
}

function handleVisibilityChange(): void {
  if (typeof document !== 'undefined' && document.hidden) endDirectManipulation();
}

function installListeners(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;
  window.addEventListener('pointerdown', beginDirectManipulation, { passive: true, capture: true });
  window.addEventListener('pointerup', endDirectManipulation, { passive: true, capture: true });
  window.addEventListener('pointercancel', endDirectManipulation, { passive: true, capture: true });
  window.addEventListener('touchstart', beginDirectManipulation, { passive: true, capture: true });
  window.addEventListener('touchend', endDirectManipulation, { passive: true, capture: true });
  window.addEventListener('touchcancel', endDirectManipulation, { passive: true, capture: true });
  window.addEventListener('blur', endDirectManipulation);
  window.addEventListener('pagehide', endDirectManipulation);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
}

function removeListeners(): void {
  if (!listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = false;
  window.removeEventListener('pointerdown', beginDirectManipulation, true);
  window.removeEventListener('pointerup', endDirectManipulation, true);
  window.removeEventListener('pointercancel', endDirectManipulation, true);
  window.removeEventListener('touchstart', beginDirectManipulation, true);
  window.removeEventListener('touchend', endDirectManipulation, true);
  window.removeEventListener('touchcancel', endDirectManipulation, true);
  window.removeEventListener('blur', endDirectManipulation);
  window.removeEventListener('pagehide', endDirectManipulation);
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
  endDirectManipulation();
}

/** Keep authored gameplay transitions at 60fps, then return an unchanged mobile
 * board to 30fps. It samples the existing Pixi ticker and owns no extra RAF. */
export function startPixiMobileFrameController(ticker?: PixiCadenceTicker | null): void {
  if (!MOBILE_RUNTIME_PROFILE.isMobileDevice || !ticker) return;
  if (ownedTicker === ticker) {
    applyCadence();
    return;
  }
  stopPixiMobileFrameController();
  ownedTicker = ticker;
  tickOwner = applyCadence;
  ownedTicker.add(tickOwner);
  installListeners();
  applyCadence();
}

export function markPixiMobileActivity(durationMs = ACTIVITY_TAIL_MS): void {
  if (!ownedTicker) return;
  activeUntil = Math.max(activeUntil, now() + Math.max(0, durationMs));
  applyCadence();
}

/** Keep authored Pixi motion at active cadence for its real lifecycle rather
 * than estimating its duration. The returned release is idempotent and leaves
 * a short paint tail so the final frame is presented before settled idle. */
export function acquirePixiMobileActivityLease(
  label = 'anonymous',
  releaseTailMs = 180,
): () => void {
  if (!ownedTicker) return () => {};
  const token = Symbol(label);
  activityLeases.add(token);
  applyCadence();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activityLeases.delete(token);
    activeUntil = Math.max(activeUntil, now() + Math.max(0, releaseTailMs));
    applyCadence();
  };
}

export function stopPixiMobileFrameController(): void {
  endDirectManipulation();
  if (ownedTicker && tickOwner) {
    try { ownedTicker.remove(tickOwner); } catch {}
    ownedTicker.maxFPS = 0;
  }
  ownedTicker = null;
  tickOwner = null;
  activeUntil = 0;
  activityLeases.clear();
  removeListeners();
}

export function getPixiMobileFrameControllerSnapshot(): {
  active: boolean;
  maxFPS: number;
  activeUntil: number;
  activityLeaseCount: number;
} {
  return {
    active: ownedTicker !== null,
    maxFPS: ownedTicker?.maxFPS ?? 0,
    activeUntil,
    activityLeaseCount: activityLeases.size,
  };
}
