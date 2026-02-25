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
  
  // 🔥 MEMORY LEAK FIX: Don't run when tab is hidden - prevents 700MB+ leak over 1h idle
  // User left game open, tab in background → tile bounce kept creating smoke particles
  if (typeof document !== 'undefined' && document.hidden) {
    state.animationTimer = setTimeout(animateRandomTile, 2000); // Recheck in 2s
    return;
  }
  
  const idleTime = Date.now() - state.lastInteractionTime;
  if (idleTime < IDLE_WAIT_TIME) {
    state.animationTimer = setTimeout(animateRandomTile, 100);
    return;
  }
  
  const availableTiles = state.tiles.filter(t => 
    t && t.value > 0 && !t.locked && !t.destroyed && !state.activeAnimations.has(t)
  );
  
  if (availableTiles.length === 0) {
    state.animationTimer = setTimeout(animateRandomTile, 500);
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
  
  const rotG = tile.rotG || tile;
  const baseScaleX = rotG.scale?.x || 1;
  const baseScaleY = rotG.scale?.y || 1;
  
  // For center scaling, we need to animate the parent tile's scale, not rotG
  // This way it scales from the true geometric center without moving
  const baseTileScaleX = tile.scale?.x || 1;
  const baseTileScaleY = tile.scale?.y || 1;
  
  // Random tilt angle: 1-5 degrees left or right
  const tiltDirection = Math.random() > 0.5 ? 1 : -1;
  const tiltDegrees = 1 + Math.random() * 4; // 1-5 degrees
  const tiltRadians = (tiltDegrees * tiltDirection) * (Math.PI / 180);
  
  // Store original rotation
  const originalRotation = tile.rotation || 0;
  
  // 🔥 CRITICAL: Store timeline reference on tile for cleanup
  const tl = trackTimeline({
    onComplete: () => {
      state.activeAnimations.delete(tile);
      (tile as any)._idleBounceTl = null;
    }
  });
  (tile as any)._idleBounceTl = tl;
  
  // Phase 1: Scale up with rotation - fast 0.1s
  tl.to(tile.scale, {
    x: baseTileScaleX * 1.05,  // Very subtle scale up
    y: baseTileScaleY * 1.05,
    duration: 0.1,
    ease: 'power2.out'
  });
  
  // Simultaneously rotate the tile
  tl.to(tile, {
    rotation: originalRotation + tiltRadians,
    duration: 0.1,
    ease: 'power2.out'
  }, '<'); // Start at same time as scale
  
  // Phase 2: Return to scale and rotation - fast 0.1s
  tl.to(tile.scale, {
    x: baseTileScaleX,
    y: baseTileScaleY,
    duration: 0.1,
    ease: 'power2.in'
  });
  
  // Return rotation to 0 to avoid merge conflicts
  tl.to(tile, {
    rotation: originalRotation,
    duration: 0.1,
    ease: 'power2.in'
  }, '<'); // Start at same time as scale return
  
  // Activate smoke bubbles at 0.1s (peak of animation)
  tl.call(() => {
    if (state.board && tile) {
      // Match stack smoke (non-merge6) look
      smokeBubblesAtTile(state.board, tile, 96, 0.6, {
        behind: true,
        baseAlpha: 0.35,
        sizeScale: 0.4,
        distanceScale: 0.3,
        countScale: 0.3,
        ttl: 0.16,
        durationScale: 0.4,
        blendMode: 'add',
        spawnShape: 'box'
      });
    }
  }, null, 0.1);
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
  state.tiles = tiles.filter(t => t && t.value > 0 && !t.locked && !t.destroyed);
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
