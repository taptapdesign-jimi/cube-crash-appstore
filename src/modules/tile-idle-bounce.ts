/**
 * Tile Idle Bounce Animation Module
 * 
 * Random idle animations for tiles with pips when board is idle
 */

import { gsap } from 'gsap';
import type { Tile } from '../types';
import { smokeBubblesAtTile } from "./fx.ts";
import { TILE } from './constants.js';

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

export function startTileIdleBounce(tiles: Tile[], board: any): void {
  if (!ENABLE_TILE_IDLE_BOUNCE) return;
  
  state.tiles = tiles.filter(t => t && t.value > 0 && !t.locked && !t.destroyed);
  state.board = board;
  state.isActive = true;
  state.lastInteractionTime = Date.now();
  state.activeAnimations = new Set();
  
  setTimeout(() => {
    animateRandomTile();
  }, IDLE_WAIT_TIME);
  
  console.log('✅ Tile idle bounce started:', state.tiles.length, 'tiles');
}

export function stopTileIdleBounce(): void {
  state.isActive = false;
  
  if (state.animationTimer) {
    clearTimeout(state.animationTimer);
    state.animationTimer = null;
  }
  
  state.activeAnimations.forEach(tile => {
    stopTileAnimation(tile);
  });
  state.activeAnimations.clear();
  
  console.log('⏹️ Tile idle bounce stopped');
}

// 🔥 CRITICAL FIX: Reset function for complete cleanup
export function resetTileIdleBounce(): void {
  stopTileIdleBounce();
  state.tiles = [];
  state.board = null;
  state.lastInteractionTime = 0;
  console.log('🔄 Tile idle bounce state reset');
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
  const tl = gsap.timeline({
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
      smokeBubblesAtTile(state.board, tile, 96, {
        behind: true,
        sizeScale: 0.67,  // Reduced by 40% (1.12 * 0.6 = 0.67)
        distanceScale: 0.7,
        countScale: 0.75,
        haloScale: 1.1,
        strength: 0.5 + Math.random() * 0.3,
        trailAlpha: 0.3,  // Set to 0.3
        baseAlpha: 0.3   // Set to 0.3
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
  console.log('🔄 Updated tile list:', state.tiles.length, 'tiles');
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
