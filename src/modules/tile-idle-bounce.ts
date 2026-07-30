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

// 🔥 FIX: Track initial timeout separately
let initialTimeout: ReturnType<typeof setTimeout> | null = null;

function isWildTile(tile: Tile | null | undefined): boolean {
  if (!tile) return false;
  if (tile.isWild === true || tile.isWildFace === true) return true;
  const special = typeof tile.special === 'string' ? tile.special.toLowerCase() : '';
  // Covers current and future wild flavors: wild, wild-juice, wild-magnet, wild-tnt, etc.
  return special === 'wild' || special.startsWith('wild-');
}

export function startTileIdleBounce(tiles: Tile[], board: any): void {
  if (!ENABLE_TILE_IDLE_BOUNCE) return;
  
  state.tiles = tiles.filter(t => t && t.value > 0 && !t.locked && !t.destroyed);
  state.board = board;
  state.isActive = true;
  state.lastInteractionTime = Date.now();
  state.activeAnimations = new Set();
  
  // 🔥 FIX: Track initial timeout for cleanup
  initialTimeout = setTimeout(() => {
    initialTimeout = null;
    animateRandomTile();
  }, IDLE_WAIT_TIME);
  
  if (isVerboseGameplayLogsEnabled()) {
    console.log('✅ Tile idle bounce started:', state.tiles.length, 'tiles');
  }
}

export function stopTileIdleBounce(): void {
  state.isActive = false;
  
  // 🔥 FIX: Clear initial timeout as well
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  
  if (state.animationTimer) {
    clearTimeout(state.animationTimer);
    state.animationTimer = null;
  }
  
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
  
  if (state.animationTimer) {
    clearTimeout(state.animationTimer);
    state.animationTimer = null;
  }
  
  // CRITICAL: Restart the loop after resetting the timer
  // This ensures animations will resume after IDLE_WAIT_TIME
  if (state.isActive) {
    state.animationTimer = setTimeout(() => {
      animateRandomTile();
    }, IDLE_WAIT_TIME);
  }
}

function animateRandomTile(): void {
  if (!state.isActive) return;

  if (typeof window !== 'undefined' && (window as any).__ccGameplayDragActive === true) {
    state.lastInteractionTime = Date.now();
    state.animationTimer = setTimeout(animateRandomTile, 500);
    return;
  }

  // 🔥 MEMORY LEAK FIX: Don't run when tab is hidden - prevents 700MB+ leak over 1h idle
  // User left game open, tab in background → tile bounce kept creating smoke particles
  if (typeof document !== 'undefined' && document.hidden) {
    state.animationTimer = setTimeout(animateRandomTile, 2000); // Recheck in 2s
    return;
  }

  // Keep tile list fresh so idle effects can target newly spawned tiles
  const liveTiles = (typeof window !== 'undefined' && (window as any).STATE?.tiles)
    ? (window as any).STATE.tiles
    : state.tiles;
  updateTileList(liveTiles);

  const idleTime = Date.now() - state.lastInteractionTime;
  if (idleTime < IDLE_WAIT_TIME) {
    state.animationTimer = setTimeout(animateRandomTile, 100);
    return;
  }
  
  const availableTiles = state.tiles.filter(t => 
    t && t.value > 0 && !t.locked && !t.destroyed && !state.activeAnimations.has(t)
  );
  
  if (availableTiles.length === 0) {
    state.animationTimer = setTimeout(animateRandomTile, 800);
    return;
  }
  
  const randomTile = availableTiles[Math.floor(Math.random() * availableTiles.length)];
  
  if (randomTile) {
    animateTile(randomTile);
  }
  
  const nextDelay = ANIMATION_INTERVAL + (Math.random() * 2 - 1) * RANDOM_INTERVAL;
  state.animationTimer = setTimeout(animateRandomTile, nextDelay);
}

function animateTile(tile: Tile): void {
  if (!tile || tile.destroyed) return;
  
  state.activeAnimations.add(tile);
  
  // Animate the complete tile from its center so every stack layer follows.
  const baseTileScaleX = tile.scale?.x || 1;
  const baseTileScaleY = tile.scale?.y || 1;
  const variant = createGameplayTileCartoonVariant('idle');

  // Keep tilt secondary to the shared stretch/squash pose.
  const tiltDirection = Math.random() > 0.5 ? 1 : -1;
  const tiltDegrees = variant.tiltDegrees * (0.82 + Math.random() * 0.36);
  const tiltRadians = (tiltDegrees * tiltDirection) * (Math.PI / 180);
  
  // Store original rotation
  const originalRotation = tile.rotation || 0;
  
  // 🔥 CRITICAL: Store timeline reference on tile for cleanup
  const tl = trackTimeline({
    onComplete: () => {
      state.activeAnimations.delete(tile);
      (tile as any)._idleBounceTl = null;
      if (!tile.destroyed && tile.scale) {
        tile.scale.x = baseTileScaleX;
        tile.scale.y = baseTileScaleY;
        tile.rotation = originalRotation;
      }
    },
    onInterrupt: () => {
      state.activeAnimations.delete(tile);
      (tile as any)._idleBounceTl = null;
    },
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
        fxTag: 'tile-idle-smoke'
      });
    }
  }, null, variant.anticipation.durationSeconds + variant.peak.durationSeconds);
}

function stopTileAnimation(tile: Tile): void {
  if (!tile) return;
  
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
    if (!((tile as any)._skipIdleScaleReset)) {
      if (tile.scale) {
        tile.scale.x = 1;
        tile.scale.y = 1;
      }
      tile.rotation = 0;
    }
  }
}

export function updateTileList(tiles: Tile[]): void {
  const boardGrid = state.board?.grid;
  state.tiles = tiles.filter(t => {
    if (!t || t.destroyed) return false;
    if (t.visible === false) return false;
    if (t.locked) return false;
    if ((t.value | 0) <= 0) return false;
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
  updateTileList
};
