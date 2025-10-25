// board-merge-chain.ts
// Merge chain logic for board system

import { Container, Graphics, Text } from 'pixi.js';
import { gsap } from 'gsap';
import { MERGE_CHAIN, ANIMATION, EASING } from './board-constants.js';
import { logger } from '../core/logger.js';

// Type definitions
interface Tile extends Container {
  value: number;
  locked: boolean;
  special?: string;
  isWild?: boolean;
  isWildFace?: boolean;
  gridX?: number;
  gridY?: number;
  _wildMergeTarget?: number;
  _wildIdleTl?: gsap.core.Timeline;
  _wildShimmer?: Container;
  _wildShimmerSprite?: Sprite;
  _wildMask?: Graphics;
  refreshShadow?: () => void;
  getBounds?: () => { x: number; y: number; width: number; height: number };
  toGlobal?: (point: { x: number; y: number }) => { x: number; y: number };
  num?: Text;
  stack?: Graphics;
  pips?: Graphics;
  bg?: Graphics;
  border?: Graphics;
}

interface MergeChainState {
  isActive: boolean;
  value: number;
  count: number;
  startTime: number;
  tiles: Tile[];
  callback?: (value: number, count: number) => void;
}

// Global state
let mergeChainState: MergeChainState = {
  isActive: false,
  value: 0,
  count: 0,
  startTime: 0,
  tiles: [],
  callback: undefined
};

/**
 * Set merge chain update callback
 */
export function setMergeChainUpdateCallback(cb: (value: number, count: number) => void): void {
  mergeChainState.callback = cb;
  logger.info('🔗 Set merge chain update callback');
}

/**
 * Start merge chain
 */
export function startMergeChain(): void {
  mergeChainState.isActive = true;
  mergeChainState.value = 0;
  mergeChainState.count = 0;
  mergeChainState.startTime = Date.now();
  mergeChainState.tiles = [];
  
  logger.info('🔗 Started merge chain');
}

/**
 * Update merge chain
 */
export function updateMergeChain(tileValue: number): void {
  if (!mergeChainState.isActive) return;
  
  mergeChainState.value += tileValue;
  mergeChainState.count++;
  
  // Notify callback
  if (mergeChainState.callback) {
    mergeChainState.callback(mergeChainState.value, mergeChainState.count);
  }
  
  logger.info(`🔗 Updated merge chain: value=${mergeChainState.value}, count=${mergeChainState.count}`);
}

/**
 * Finalize merge chain
 */
export function finalizeMergeChain(tileValue: number): number {
  if (!mergeChainState.isActive) return tileValue;
  
  const finalValue = mergeChainState.value + tileValue;
  const finalCount = mergeChainState.count + 1;
  
  // Calculate bonus
  let bonus = 0;
  if (finalCount >= MERGE_CHAIN.CHAIN_BONUS_THRESHOLD) {
    bonus = Math.floor(finalValue * MERGE_CHAIN.BONUS_MULTIPLIER);
  }
  
  // Reset chain
  mergeChainState.isActive = false;
  mergeChainState.value = 0;
  mergeChainState.count = 0;
  mergeChainState.startTime = 0;
  mergeChainState.tiles = [];
  
  logger.info(`🔗 Finalized merge chain: value=${finalValue}, count=${finalCount}, bonus=${bonus}`);
  
  return finalValue + bonus;
}

/**
 * Add tile to merge chain
 */
export function addTileToMergeChain(tile: Tile): void {
  if (!mergeChainState.isActive || !tile) return;
  
  mergeChainState.tiles.push(tile);
  
  // Animate tile addition
  animateTileChainAddition(tile);
  
  logger.info(`🔗 Added tile to merge chain: ${tile.value}`);
}

/**
 * Remove tile from merge chain
 */
export function removeTileFromMergeChain(tile: Tile): void {
  if (!mergeChainState.isActive || !tile) return;
  
  const index = mergeChainState.tiles.indexOf(tile);
  if (index > -1) {
    mergeChainState.tiles.splice(index, 1);
    
    // Animate tile removal
    animateTileChainRemoval(tile);
    
    logger.info(`🔗 Removed tile from merge chain: ${tile.value}`);
  }
}

/**
 * Get merge chain info
 */
export function getMergeChainInfo(): { isActive: boolean; value: number; count: number; tiles: Tile[] } {
  return {
    isActive: mergeChainState.isActive,
    value: mergeChainState.value,
    count: mergeChainState.count,
    tiles: [...mergeChainState.tiles]
  };
}

/**
 * Check if tile is in merge chain
 */
export function isTileInMergeChain(tile: Tile): boolean {
  return mergeChainState.tiles.includes(tile);
}

/**
 * Clear merge chain
 */
export function clearMergeChain(): void {
  mergeChainState.isActive = false;
  mergeChainState.value = 0;
  mergeChainState.count = 0;
  mergeChainState.startTime = 0;
  mergeChainState.tiles = [];
  
  logger.info('🔗 Cleared merge chain');
}

/**
 * Animate tile chain addition
 */
function animateTileChainAddition(tile: Tile): void {
  if (!tile) return;
  
  // Highlight tile
  if (tile.bg) {
    gsap.fromTo(tile.bg, 
      { tint: 0xFFFFFF },
      { 
        tint: 0x00FF00,
        duration: ANIMATION.TILE_MERGE_DURATION / 2,
        ease: EASING.TILE_MERGE,
        yoyo: true,
        repeat: 1
      }
    );
  }
  
  // Scale animation
  gsap.fromTo(tile, 
    { scaleX: 1, scaleY: 1 },
    { 
      scaleX: 1.1,
      scaleY: 1.1,
      duration: ANIMATION.TILE_MERGE_DURATION / 2,
      ease: EASING.TILE_MERGE,
      yoyo: true,
      repeat: 1
    }
  );
}

/**
 * Animate tile chain removal
 */
function animateTileChainRemoval(tile: Tile): void {
  if (!tile) return;
  
  // Fade out highlight
  if (tile.bg) {
    gsap.to(tile.bg, {
      tint: 0xFFFFFF,
      duration: ANIMATION.TILE_MERGE_DURATION / 2,
      ease: EASING.TILE_MERGE
    });
  }
  
  // Scale back to normal
  gsap.to(tile, {
    scaleX: 1,
    scaleY: 1,
    duration: ANIMATION.TILE_MERGE_DURATION / 2,
    ease: EASING.TILE_MERGE
  });
}

/**
 * Animate merge chain completion
 */
export function animateMergeChainCompletion(): void {
  if (!mergeChainState.isActive || mergeChainState.tiles.length === 0) return;
  
  // Animate all tiles in chain
  mergeChainState.tiles.forEach((tile, index) => {
    if (tile) {
      gsap.fromTo(tile, 
        { scaleX: 1, scaleY: 1 },
        { 
          scaleX: 1.3,
          scaleY: 1.3,
          duration: ANIMATION.TILE_MERGE_DURATION / 2,
          ease: EASING.TILE_MERGE,
          delay: index * 0.1,
          yoyo: true,
          repeat: 1
        }
      );
    }
  });
  
  logger.info('🔗 Animated merge chain completion');
}

/**
 * Get merge chain bonus
 */
export function getMergeChainBonus(): number {
  if (!mergeChainState.isActive) return 0;
  
  const count = mergeChainState.count;
  if (count < MERGE_CHAIN.CHAIN_BONUS_THRESHOLD) return 0;
  
  return Math.floor(mergeChainState.value * MERGE_CHAIN.BONUS_MULTIPLIER);
}

/**
 * Check if merge chain is active
 */
export function isMergeChainActive(): boolean {
  return mergeChainState.isActive;
}

/**
 * Get merge chain duration
 */
export function getMergeChainDuration(): number {
  if (!mergeChainState.isActive) return 0;
  
  return Date.now() - mergeChainState.startTime;
}

// All functions are already exported individually above
