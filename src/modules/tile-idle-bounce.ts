// @ts-nocheck

/**
 * Tile Idle Bounce Animation Module
 * 
 * Random idle animations for tiles with pips when board is idle
 */

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import type { Tile } from '../types';
import { smokeBubblesAtTile } from "./fx.ts";
import { TILE } from './constants.js';
import { createGameplayTileCartoonVariant } from './gameplay-tile-cartoon-motion.js';
import { usesRigidSpecialDiceIdle } from './special-dice-registry.js';
import { acquirePixiMobileActivityLease } from './pixi-mobile-frame-controller.js';

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));
const isVerboseGameplayLogsEnabled = () => (typeof window !== 'undefined') && (window as any).__ccVerboseGameplayLogs === true;

const ENABLE_TILE_IDLE_BOUNCE = true;

const IDLE_WAIT_TIME = 4000;  // 4 seconds after interaction
const ANIMATION_INTERVAL = 3000;
const RANDOM_INTERVAL = 1000;

interface IdleBounceState {
  tiles: Tile[];
  board: any;
  isActive: boolean;
  lastInteractionTime: number;
  animationTimer: number | null;
  activeAnimations: Set<Tile>;
}

let state: IdleBounceState = {
  tiles: [],
  board: null,
  isActive: false,
  lastInteractionTime: 0,
  animationTimer: null,
  activeAnimations: new Set()
};

let visibilityListenerInstalled = false;
let scheduledWakeDueAt = 0;
let parkedWakeDelayMs: number | null = null;
let hiddenStartedAt = 0;

function clearIdleSchedule(): void {
  if (state.animationTimer) {
    clearTimeout(state.animationTimer);
    state.animationTimer = null;
  }
  scheduledWakeDueAt = 0;
}

function scheduleIdleWake(delayMs: number): void {
  clearIdleSchedule();
  if (!state.isActive) return;
  const boundedDelay = Math.max(0, delayMs);
  if (typeof document !== 'undefined' && document.hidden) {
    if (hiddenStartedAt <= 0) hiddenStartedAt = Date.now();
    parkedWakeDelayMs = boundedDelay;
    return;
  }
  parkedWakeDelayMs = null;
  scheduledWakeDueAt = Date.now() + boundedDelay;
  state.animationTimer = setTimeout(() => {
    state.animationTimer = null;
    scheduledWakeDueAt = 0;
    animateRandomTile();
  }, boundedDelay);
}

function scheduleInitialIdleBounce(): void {
  scheduleIdleWake(IDLE_WAIT_TIME);
}

function parkIdleSchedule(): void {
  if (!state.isActive) return;
  if (hiddenStartedAt > 0) return;
  // Hidden time is not gameplay idle time. Park every recurring wakeup until
  // the same live owner becomes visible again.
  hiddenStartedAt = Date.now();
  parkedWakeDelayMs = scheduledWakeDueAt > 0
    ? Math.max(0, scheduledWakeDueAt - hiddenStartedAt)
    : parkedWakeDelayMs;
  clearIdleSchedule();
}

function resumeIdleSchedule(): void {
  if (!state.isActive || (typeof document !== 'undefined' && document.hidden)) return;
  if (hiddenStartedAt <= 0 && parkedWakeDelayMs === null) return;
  const visibleAt = Date.now();
  if (hiddenStartedAt > 0) {
    // Hidden wall-clock time must not count as gameplay idle time. If a board
    // interaction was reported while hidden, resume from a fresh visible idle
    // origin; otherwise preserve the exact pre-background idle phase.
    if (state.lastInteractionTime <= hiddenStartedAt) {
      state.lastInteractionTime += visibleAt - hiddenStartedAt;
    } else {
      state.lastInteractionTime = visibleAt;
    }
  }
  hiddenStartedAt = 0;
  const resumeDelay = parkedWakeDelayMs ?? IDLE_WAIT_TIME;
  parkedWakeDelayMs = null;
  scheduleIdleWake(resumeDelay);
}

function handleIdleVisibilityChange(): void {
  if (document.hidden) parkIdleSchedule();
  else resumeIdleSchedule();
}

function handleIdlePageHide(): void {
  // WKWebView can publish pagehide without a matching visibilitychange.
  parkIdleSchedule();
}

function handleIdlePageShow(): void {
  resumeIdleSchedule();
}

function installIdleVisibilityListener(): void {
  if (visibilityListenerInstalled || typeof document === 'undefined') return;
  visibilityListenerInstalled = true;
  document.addEventListener('visibilitychange', handleIdleVisibilityChange);
  window.addEventListener('pagehide', handleIdlePageHide);
  window.addEventListener('pageshow', handleIdlePageShow);
}

function removeIdleVisibilityListener(): void {
  if (!visibilityListenerInstalled || typeof document === 'undefined') return;
  visibilityListenerInstalled = false;
  document.removeEventListener('visibilitychange', handleIdleVisibilityChange);
  window.removeEventListener('pagehide', handleIdlePageHide);
  window.removeEventListener('pageshow', handleIdlePageShow);
}

function isWildTile(tile: Tile | null | undefined): boolean {
  if (!tile) return false;
  if (tile.isWild === true || tile.isWildFace === true) return true;
  const special = typeof tile.special === 'string' ? tile.special.toLowerCase() : '';
  // Covers current and future wild flavors: wild, wild-juice, wild-magnet, wild-tnt, etc.
  return special === 'wild' || special.startsWith('wild-');
}

function hasCompetingOuterTransformOwner(tile: Tile | null | undefined): boolean {
  if (!tile) return true;
  const candidate = tile as any;
  return (
    candidate._mergeImpactTl != null ||
    candidate._ccPickupScaleTimeline != null ||
    candidate._ccSnapBackTimeline != null ||
    candidate._isBeingSpawned === true ||
    candidate._ccWildSpawnDropping === true ||
    candidate._pendingRemoval === true ||
    candidate._beingRemoved === true ||
    candidate._cleanupQueued === true ||
    candidate._skipIdleScaleReset === true
  );
}

function restoreCanonicalIdlePose(tile: Tile | null | undefined): void {
  if (!tile || tile.destroyed || (tile as any)._skipIdleScaleReset === true) return;
  try {
    tile.scale?.set?.(1, 1);
    tile.rotation = 0;
    (tile as any)._ccDragBaseScaleX = 1;
    (tile as any)._ccDragBaseScaleY = 1;
  } catch {}
}

export function startTileIdleBounce(tiles: Tile[], board: any): void {
  if (!ENABLE_TILE_IDLE_BOUNCE) return;

  // `start` is a lifecycle boundary, not an additive subscription. Layout and
  // recovery paths may legitimately call it more than once for the same board.
  // Dispose the previous timer/timelines before replacing their tracking Set;
  // otherwise old idle timelines become orphaned and several asymmetric scale
  // poses can multiply into a permanently squashed regular tile.
  stopTileIdleBounce();
  
  state.tiles = tiles.filter(t => (
    t && t.value > 0 && !t.locked && !t.destroyed && !usesRigidSpecialDiceIdle(t)
  ));
  state.board = board;
  state.isActive = true;
  state.lastInteractionTime = Date.now();
  state.activeAnimations = new Set();
  installIdleVisibilityListener();
  scheduleInitialIdleBounce();
  
  if (isVerboseGameplayLogsEnabled()) {
    console.log('✅ Tile idle bounce started:', state.tiles.length, 'tiles');
  }
}

export function stopTileIdleBounce(): void {
  state.isActive = false;
  clearIdleSchedule();
  parkedWakeDelayMs = null;
  hiddenStartedAt = 0;
  removeIdleVisibilityListener();
  
  state.activeAnimations.forEach(tile => {
    stopTileAnimation(tile);
  });
  state.activeAnimations.clear();
  
  if (isVerboseGameplayLogsEnabled()) {
    console.log('⏹️ Tile idle bounce stopped');
  }
}

// 🔥 CRITICAL FIX: Reset function for complete cleanup
export function resetTileIdleBounce(): void {
  stopTileIdleBounce();
  state.tiles = [];
  state.board = null;
  state.lastInteractionTime = 0;
  if (isVerboseGameplayLogsEnabled()) {
    console.log('🔄 Tile idle bounce state reset');
  }
}

export function notifyBoardInteraction(): void {
  state.lastInteractionTime = Date.now();
  
  state.activeAnimations.forEach(tile => {
    stopTileAnimation(tile);
  });
  state.activeAnimations.clear();
  
  clearIdleSchedule();
  
  // CRITICAL: Restart the loop after resetting the timer
  // This ensures animations will resume after IDLE_WAIT_TIME
  if (state.isActive) scheduleIdleWake(IDLE_WAIT_TIME);
}

function animateRandomTile(): void {
  if (!state.isActive) return;

  // Visibility ownership normally clears the timer before this callback can
  // run. Keep this race guard first so no drag retry can repopulate hidden
  // scheduling after visibilitychange.
  if (typeof document !== 'undefined' && document.hidden) {
    state.animationTimer = null;
    if (hiddenStartedAt <= 0) hiddenStartedAt = Date.now();
    // The due callback already reached its logical deadline. Preserve that
    // exact phase so foreground resume can run it immediately.
    parkedWakeDelayMs = 0;
    return;
  }

  if (typeof window !== 'undefined' && (window as any).__ccGameplayDragActive === true) {
    state.lastInteractionTime = Date.now();
    scheduleIdleWake(500);
    return;
  }

  // Keep tile list fresh so idle effects can target newly spawned tiles
  const liveTiles = (typeof window !== 'undefined' && (window as any).STATE?.tiles)
    ? (window as any).STATE.tiles
    : state.tiles;
  updateTileList(liveTiles);

  const idleTime = Date.now() - state.lastInteractionTime;
  if (idleTime < IDLE_WAIT_TIME) {
    scheduleIdleWake(100);
    return;
  }
  
  const availableTiles = state.tiles.filter(t => 
    t
    && t.value > 0
    && !t.locked
    && !t.destroyed
    && !usesRigidSpecialDiceIdle(t)
    && !state.activeAnimations.has(t)
    && !(t as any)._idleBounceTl
    && !hasCompetingOuterTransformOwner(t)
  );
  
  if (availableTiles.length === 0) {
    scheduleIdleWake(800);
    return;
  }
  
  const randomTile = availableTiles[Math.floor(Math.random() * availableTiles.length)];
  
  if (randomTile) {
    animateTile(randomTile);
  }
  
  const nextDelay = ANIMATION_INTERVAL + (Math.random() * 2 - 1) * RANDOM_INTERVAL;
  scheduleIdleWake(nextDelay);
}

function animateTile(tile: Tile): void {
  if (
    !tile ||
    tile.destroyed ||
    usesRigidSpecialDiceIdle(tile) ||
    (tile as any)._idleBounceTl ||
    hasCompetingOuterTransformOwner(tile)
  ) return;

  // The outer board-tile contract is always 1x1/0deg. Never capture a live or
  // interrupted squash frame as the next idle cycle's baseline.
  restoreCanonicalIdlePose(tile);
  
  state.activeAnimations.add(tile);
  
  // Animate the complete tile from its center so every stack layer follows.
  const baseTileScaleX = 1;
  const baseTileScaleY = 1;
  const variant = createGameplayTileCartoonVariant('idle');

  // Keep tilt secondary to the shared stretch/squash pose.
  const tiltDirection = Math.random() > 0.5 ? 1 : -1;
  const tiltDegrees = variant.tiltDegrees * (0.82 + Math.random() * 0.36);
  const tiltRadians = (tiltDegrees * tiltDirection) * (Math.PI / 180);
  
  // Store original rotation
  const originalRotation = 0;
  const releaseFrameLease = acquirePixiMobileActivityLease('regular-tile-idle-bounce', 60);
  (tile as any)._ccIdleBounceFrameLease = releaseFrameLease;
  const restoreIdlePose = () => {
    if ((tile as any)._ccIdleBounceFrameLease === releaseFrameLease) {
      delete (tile as any)._ccIdleBounceFrameLease;
    }
    releaseFrameLease();
    state.activeAnimations.delete(tile);
    if ((tile as any)._idleBounceTl !== tl) return;
    (tile as any)._idleBounceTl = null;
    restoreCanonicalIdlePose(tile);
  };
  
  // 🔥 CRITICAL: Store timeline reference on tile for cleanup
  let tl: gsap.core.Timeline | null = null;
  tl = trackTimeline({
    onComplete: restoreIdlePose,
    onInterrupt: restoreIdlePose,
  });
  (tile as any)._idleBounceTl = tl;

  // One bounded cartoon cycle: anticipation -> random stretch/squash -> rebound -> settle.
  tl.to(tile.scale, {
    x: baseTileScaleX * variant.anticipation.scaleX,
    y: baseTileScaleY * variant.anticipation.scaleY,
    duration: variant.anticipation.durationSeconds,
    ease: variant.anticipation.ease,
  });
  tl.to(tile, {
    rotation: originalRotation + tiltRadians,
    duration: variant.anticipation.durationSeconds,
    ease: variant.anticipation.ease,
  }, '<');

  tl.to(tile.scale, {
    x: baseTileScaleX * variant.peak.scaleX,
    y: baseTileScaleY * variant.peak.scaleY,
    duration: variant.peak.durationSeconds,
    ease: variant.peak.ease,
  });
  tl.to(tile, {
    rotation: originalRotation - tiltRadians * 0.32,
    duration: variant.peak.durationSeconds,
    ease: variant.peak.ease,
  }, '<');

  tl.to(tile.scale, {
    x: baseTileScaleX * variant.rebound.scaleX,
    y: baseTileScaleY * variant.rebound.scaleY,
    duration: variant.rebound.durationSeconds,
    ease: variant.rebound.ease,
  });
  tl.to(tile, {
    rotation: originalRotation,
    duration: variant.rebound.durationSeconds,
    ease: variant.rebound.ease,
  }, '<');

  tl.to(tile.scale, {
    x: baseTileScaleX,
    y: baseTileScaleY,
    duration: variant.settleDurationSeconds,
    ease: variant.settleEase,
  });

  // Keep the existing bounded idle smoke, aligned with the cartoon peak.
  tl.call(() => {
    // USER REQUEST: Idle smoke belongs only to regular cubes, never to active wild cubes.
    if (state.board && tile && !isWildTile(tile)) {
      smokeBubblesAtTile(state.board, tile, TILE, 1.10, {
        behind: true,
        baseAlpha: 0.58,
        sizeScale: 1.10,
        distanceScale: 0.75,
        countScale: 1.04,
        ttl: 0.28,
        durationScale: 0.84,
        blendMode: 'add',
        spawnShape: 'box',
        fxTag: 'tile-idle-smoke',
        groupedOwner: true,
      });
    }
  }, null, variant.anticipation.durationSeconds + variant.peak.durationSeconds);
}

function stopTileAnimation(tile: Tile): void {
  if (!tile) return;
  try {
    (tile as any)._ccIdleBounceFrameLease?.();
    delete (tile as any)._ccIdleBounceFrameLease;
  } catch {}
  
  try {
    // 🔥 CRITICAL: Kill all GSAP tweens on tile and its properties
    gsap.killTweensOf(tile);
    gsap.killTweensOf(tile.scale);
    gsap.killTweensOf(tile.rotation);
    
    // 🔥 CRITICAL: Kill any timeline animations stored on tile
    if ((tile as any)._idleBounceTl) {
      try {
        (tile as any)._idleBounceTl.kill();
        (tile as any)._idleBounceTl = null;
      } catch {}
    }
  } catch (e) {
    console.warn('⚠️ Error stopping tile animation:', e);
  }
  
  if (tile) {
    // Reset scale/rotation unless tile is being manipulated by another system (e.g., wild-magnet pull)
    restoreCanonicalIdlePose(tile);
  }
}

export function stopTileIdleBounceForTile(tile: Tile): void {
  if (!tile) return;
  state.activeAnimations.delete(tile);
  stopTileAnimation(tile);
}

export function updateTileList(tiles: Tile[]): void {
  const boardGrid = state.board?.grid;
  state.tiles = tiles.filter(t => {
    if (!t || t.destroyed) return false;
    if (t.visible === false) return false;
    if (t.locked) return false;
    if ((t.value | 0) <= 0) return false;
    if (usesRigidSpecialDiceIdle(t)) return false;
    if (t.eventMode && t.eventMode !== 'static') return false;
    if (boardGrid && typeof t.gridX === 'number' && typeof t.gridY === 'number') {
      const row = boardGrid[t.gridY];
      if (!row || row[t.gridX] !== t) return false;
    }
    return true;
  });
  if (isVerboseGameplayLogsEnabled()) {
    console.log('🔄 Updated tile list:', state.tiles.length, 'tiles');
  }
}

// Exports for easy access
export const TILE_IDLE_BOUNCE = {
  ENABLE: ENABLE_TILE_IDLE_BOUNCE,
  start: startTileIdleBounce,
  stop: stopTileIdleBounce,
  reset: resetTileIdleBounce, // 🔥 CRITICAL FIX: Export reset function
  notifyInteraction: notifyBoardInteraction,
  stopForTile: stopTileIdleBounceForTile,
  updateTileList
};
