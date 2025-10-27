/**
 * Tile Idle Bounce Animation Module
 * 
 * Random idle animations for tiles with pips when board is idle
 */

import { gsap } from 'gsap';
import type { Tile } from '../types';
import { smokeBubblesAtTile } from './fx.js';

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
  
  const tl = gsap.timeline({
    onComplete: () => {
      state.activeAnimations.delete(tile);
    }
  });
  
  // Phase 1: Scale to 1.3 (0-0.3s)
  tl.to(rotG.scale, {
    x: baseScaleX * 1.3,
    y: baseScaleY * 1.3,
    duration: 0.3,
    ease: 'power2.out'
  });
  
  // Phase 2: Stay at 1.3 and wiggle left-right (0.3-0.5s)
  const wiggleX = 2 + Math.random() * 4; // 2-6px wiggle
  tl.to(rotG, {
    x: -wiggleX,
    duration: 0.1,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 1
  }, '>-0.1');
  
  // Phase 3: Return to original size quickly (0.5-0.65s)
  tl.to(rotG.scale, {
    x: baseScaleX,
    y: baseScaleY,
    duration: 0.15,
    ease: 'back.out(1.5)'
  });
  
  tl.to(rotG, {
    x: 0,
    y: 0,
    duration: 0.15,
    ease: 'back.out(1.5)'
  });
  
  // Phase 4: Activate smoke bubbles AFTER scale returns (0.65s)
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
  }, null, '-=0.15');
  
  console.log('🎲 Animating tile:', tile.value);
}

function stopTileAnimation(tile: Tile): void {
  if (!tile) return;
  
  const rotG = tile.rotG || tile;
  
  try {
    gsap.killTweensOf(rotG);
    gsap.killTweensOf(rotG.scale);
  } catch (e) {
    console.warn('⚠️ Error stopping tile animation:', e);
  }
  
  if (rotG) {
    rotG.x = 0;
    rotG.y = 0;
    rotG.rotation = 0;
    if (rotG.scale) {
      rotG.scale.x = 1;
      rotG.scale.y = 1;
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
  notifyInteraction: notifyBoardInteraction,
  updateTileList
};
