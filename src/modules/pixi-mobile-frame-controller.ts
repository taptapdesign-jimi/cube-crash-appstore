import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.js';

interface PixiCadenceTicker {
  maxFPS: number;
  add(callback: () => void): void;
  remove(callback: () => void): void;
}

const ACTIVE_FPS = 60;
const ACTIVITY_TAIL_MS = 2400;
let ownedTicker: PixiCadenceTicker | null = null;
let activeUntil = 0;
let tickOwner: (() => void) | null = null;
let listenersInstalled = false;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function applyCadence(): void {
  if (!ownedTicker) return;
  ownedTicker.maxFPS = now() < activeUntil
    ? ACTIVE_FPS
    : MOBILE_RUNTIME_PROFILE.settledIdleMaxFramesPerSecond;
}

function noteInteraction(): void {
  markPixiMobileActivity();
}

function installListeners(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;
  window.addEventListener('pointerdown', noteInteraction, { passive: true, capture: true });
  window.addEventListener('pointermove', noteInteraction, { passive: true, capture: true });
  window.addEventListener('touchstart', noteInteraction, { passive: true, capture: true });
  window.addEventListener('touchmove', noteInteraction, { passive: true, capture: true });
}

function removeListeners(): void {
  if (!listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = false;
  window.removeEventListener('pointerdown', noteInteraction, true);
  window.removeEventListener('pointermove', noteInteraction, true);
  window.removeEventListener('touchstart', noteInteraction, true);
  window.removeEventListener('touchmove', noteInteraction, true);
}

/** Keep authored gameplay transitions at 60fps, then return an unchanged mobile
 * board to 30fps. It samples the existing Pixi ticker and owns no extra RAF. */
export function startPixiMobileFrameController(ticker?: PixiCadenceTicker | null): void {
  if (!MOBILE_RUNTIME_PROFILE.isMobileDevice || !ticker) return;
  if (ownedTicker === ticker) {
    markPixiMobileActivity(5000);
    return;
  }
  stopPixiMobileFrameController();
  ownedTicker = ticker;
  tickOwner = applyCadence;
  ownedTicker.add(tickOwner);
  installListeners();
  markPixiMobileActivity(5000);
}

export function markPixiMobileActivity(durationMs = ACTIVITY_TAIL_MS): void {
  if (!ownedTicker) return;
  activeUntil = Math.max(activeUntil, now() + Math.max(0, durationMs));
  applyCadence();
}

export function stopPixiMobileFrameController(): void {
  if (ownedTicker && tickOwner) {
    try { ownedTicker.remove(tickOwner); } catch {}
    ownedTicker.maxFPS = 0;
  }
  ownedTicker = null;
  tickOwner = null;
  activeUntil = 0;
  removeListeners();
}

export function getPixiMobileFrameControllerSnapshot(): {
  active: boolean;
  maxFPS: number;
  activeUntil: number;
} {
  return {
    active: ownedTicker !== null,
    maxFPS: ownedTicker?.maxFPS ?? 0,
    activeUntil,
  };
}
