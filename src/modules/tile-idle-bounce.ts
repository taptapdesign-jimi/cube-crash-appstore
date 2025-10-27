/**
 * Tile Idle Bounce Animation Module
 * 
 * Random idle animations for tiles with pips when board is idle
 */

import { gsap } from 'gsap';
import type { Tile } from '../types';
import { smokeBubblesAtTile } from './fx.js';
import { TILE } from './constants.js';

const ENABLE_TILE_IDLE_BOUNCE = true;

const IDLE_WAIT_TIME = 2000;
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
  
  console.log('👆 Board interaction detected');
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
  
  const tl = gsap.timeline({
    onComplete: () => {
      state.activeAnimations.delete(tile);
    }
  });
  
  // Simple cartoon bounce - scale the tile itself (not rotG) for center-point scaling
  tl.to(tile.scale, {
    x: baseTileScaleX * 1.15,
    y: baseTileScaleY * 1.15,
    duration: 0.3,
    ease: 'back.out(2)' // Strong bounce out
  });
  
  // Return to normal with bounce
  tl.to(tile.scale, {
    x: baseTileScaleX,
    y: baseTileScaleY,
    duration: 0.3,
    ease: 'elastic.out(1, 0.3)' // Soft elastic bounce
  });
  
  // Activate smoke bubbles 0.2s before end of animation
  tl.call(() => {
    if (state.board && tile) {
      smokeBubblesAtTile(state.board, tile, 96, {
        behind: true,
        sizeScale: 1.12,
        distanceScale: 0.7,
        countScale: 0.75,
        haloScale: 1.1,
        strength: 0.5 + Math.random() * 0.3
      });
    }
  }, null, '-=0.2');
  
  console.log('🎲 Animating tile:', tile.value);
}

function stopTileAnimation(tile: Tile): void {
  if (!tile) return;
  
  try {
    gsap.killTweensOf(tile);
    gsap.killTweensOf(tile.scale);
  } catch (e) {
    console.warn('⚠️ Error stopping tile animation:', e);
  }
  
  if (tile && tile.scale) {
    tile.scale.x = 1;
    tile.scale.y = 1;
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
  notifyInteraction: notifyBoardInteraction,
  updateTileList
};
