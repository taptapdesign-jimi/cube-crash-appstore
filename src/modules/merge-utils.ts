// merge-utils.ts
// Utility functions for merge system

import { gsap } from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';
import { logger } from '../core/logger.js';

import { 
  MERGE_ANIMATION_DURATION,
  SCORE_ANIMATION_DURATION,
  COMBO_ANIMATION_DURATION,
  BOARD_ZOOM_FACTOR,
  BOARD_ZOOM_DURATION,
  BOARD_ZOOM_RETURN_DURATION,
  TILE_WOBBLE_STRENGTH,
  TILE_WOBBLE_DURATION,
  SCORE_MULTIPLIER,
  COMBO_MULTIPLIER,
  EASING
} from './merge-constants.js';

// Type definitions
interface Tile extends Container {
  value: number;
  stackDepth?: number;
  gridX: number;
  gridY: number;
  special?: string;
  isWild?: boolean;
  isWildFace?: boolean;
  locked: boolean;
  eventMode: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parent: Container | null;
  num?: Text;
  bg?: Graphics;
  rotG?: Container;
  shadow?: Graphics;
  refreshShadow?: () => void;
  targetX?: number;
  targetY?: number;
  _zBeforeDrag?: number;
  _magnetHomeX?: number;
  _magnetHomeY?: number;
  _lastVelX?: number;
  _lastVelY?: number;
  _isBeingMerged?: boolean;
  _isBeingDestroyed?: boolean;
  _isBeingSpawned?: boolean;
}

interface MergeHelpers {
  score: number;
  combo: number;
  board: number;
  moves: number;
  setScore: (score: number) => void;
  setCombo: (combo: number) => void;
  setBoard: (board: number) => void;
  setMoves: (moves: number) => void;
  animateScore: (score: number, duration?: number) => void;
  animateCombo: (combo: number, duration?: number) => void;
  updateHUD: () => void;
}

interface PulseBoardZoomOptions {
  duration?: number;
  returnDuration?: number;
  factor?: number;
  ease?: string;
  returnEase?: string;
}

// Global state
let mergeInProgress = false;
const mergeQueue: { src: Tile, dst: Tile, helpers: MergeHelpers }[] = [];

/**
 * Play sound effect
 */
export function play(name: string, vol: number | null = null): void {
  // Implement sound system
  const audioElement = document.getElementById(`sound-${name}`) as HTMLAudioElement;
  if (audioElement) {
    audioElement.volume = vol || 1;
    audioElement.play().catch(error => {
      logger.warn(`Failed to play sound ${name}:`, error);
    });
  }
}

/**
 * Remove tile from board
 */
export function removeTile(t: Tile): void {
  if (!t || !t.parent) return;
  
  logger.info(`🗑️ Removing tile: ${t.value}`);
  
  // Kill any active animations
  gsap.killTweensOf(t);
  if (t.rotG) gsap.killTweensOf(t.rotG);
  if (t.shadow) gsap.killTweensOf(t.shadow);
  
  // Remove from parent
  t.parent.removeChild(t);
  
  // Mark as destroyed
  t._isBeingDestroyed = true;
}

/**
 * Update HUD
 */
export function updateHUD(): void {
  // Implement HUD update
  const scoreElement = document.getElementById('score-value');
  const movesElement = document.getElementById('moves-value');
  const comboElement = document.getElementById('combo-value');
  
  if (scoreElement) scoreElement.textContent = score.toString();
  if (movesElement) movesElement.textContent = moves.toString();
  if (comboElement) comboElement.textContent = combo.toString();
}

/**
 * Animate score increase
 */
export function animateScore(toValue: number, duration = SCORE_ANIMATION_DURATION): void {
  logger.info(`💰 Animating score to: ${toValue}`);
  
  // Implement score animation
  const scoreElement = document.getElementById('score-value');
  if (scoreElement) {
    gsap.fromTo(scoreElement, {
      scale: 1,
      alpha: 1
    }, {
      scale: 1.2,
      alpha: 0.8,
      duration: duration / 2,
      yoyo: true,
      repeat: 1,
      ease: EASING.EASE_OUT
    });
  }
}

/**
 * Pulse board zoom effect
 */
export function pulseBoardZoom(factor = BOARD_ZOOM_FACTOR, opts: PulseBoardZoomOptions = {}): gsap.core.Timeline | null {
  const {
    duration = BOARD_ZOOM_DURATION,
    returnDuration = BOARD_ZOOM_RETURN_DURATION,
    ease = EASING.EASE_OUT,
    returnEase = EASING.EASE_OUT
  } = opts;
  
  logger.info(`🔍 Pulsing board zoom: ${factor}`);
  
  // Implement board zoom animation
  const boardElement = document.getElementById('board');
  if (boardElement) {
    const tl = gsap.timeline();
    tl.to(boardElement, {
      scale: 1.1,
      duration: duration / 2,
      ease: EASING.EASE_OUT
    })
    .to(boardElement, {
      scale: 1,
      duration: duration / 2,
      ease: EASING.EASE_IN
    });
  }
  
  tl.to({}, {
    duration: duration,
    ease: ease,
    onComplete: () => {
      logger.info(`✅ Board zoom complete: ${factor}`);
    }
  });
  
  return tl;
}

/**
 * Wobble tile effect
 */
export function wobble(t: Tile): void {
  if (!t || t._isBeingDestroyed) return;
  
  logger.info(`🌀 Wobbling tile: ${t.value}`);
  
  gsap.fromTo(t, 
    { rotation: 0 },
    {
      rotation: TILE_WOBBLE_STRENGTH,
      duration: TILE_WOBBLE_DURATION,
      ease: EASING.EASE_OUT,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        t.rotation = 0;
      }
    }
  );
}

/**
 * Land bounce effect
 */
export function landBounce(t: Tile): void {
  if (!t || t._isBeingDestroyed) return;
  
  logger.info(`🏀 Land bounce tile: ${t.value}`);
  
  gsap.fromTo(t.scale,
    { x: 1, y: 1 },
    {
      x: 1.1,
      y: 1.1,
      duration: 0.1,
      ease: EASING.EASE_OUT,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        t.scale.set(1, 1);
      }
    }
  );
}

/**
 * Land pre-bounce effect
 */
export function landPreBounce(t: Tile): Promise<void> {
  return new Promise((resolve) => {
    if (!t || t._isBeingDestroyed) {
      resolve();
      return;
    }
    
    logger.info(`🏀 Land pre-bounce tile: ${t.value}`);
    
    gsap.fromTo(t.scale,
      { x: 0.8, y: 0.8 },
      {
        x: 1.05,
        y: 1.05,
        duration: 0.15,
        ease: EASING.EASE_OUT,
        onComplete: () => {
          gsap.to(t.scale, {
            x: 1,
            y: 1,
            duration: 0.1,
            ease: EASING.EASE_OUT,
            onComplete: resolve
          });
        }
      }
    );
  });
}

/**
 * Check if merge is in progress
 */
export function isMergeInProgress(): boolean {
  return mergeInProgress;
}

/**
 * Set merge in progress state
 */
export function setMergeInProgress(value: boolean): void {
  mergeInProgress = value;
}

/**
 * Add merge to queue
 */
export function queueMerge(src: Tile, dst: Tile, helpers: MergeHelpers): void {
  mergeQueue.push({ src, dst, helpers });
  logger.info(`📋 Queued merge: ${src.value} -> ${dst.value} (queue size: ${mergeQueue.length})`);
}

/**
 * Process merge queue
 */
export function processMergeQueue(): void {
  if (mergeQueue.length === 0 || mergeInProgress) return;
  
  const nextMerge = mergeQueue.shift();
  if (nextMerge) {
    logger.info(`🔄 Processing queued merge: ${nextMerge.src.value} -> ${nextMerge.dst.value}`);
    // Process the merge
    processMerge(nextMerge.src, nextMerge.dst);
  }
}

/**
 * Clear merge queue
 */
export function clearMergeQueue(): void {
  mergeQueue.length = 0;
  logger.info('🧹 Cleared merge queue');
}

/**
 * Get merge queue size
 */
export function getMergeQueueSize(): number {
  return mergeQueue.length;
}

/**
 * Calculate merge value
 */
export function calculateMergeValue(src: Tile, dst: Tile): number {
  if (!src || !dst) return 0;
  
  const baseValue = src.value + dst.value;
  const wildBonus = (src.isWild || dst.isWild) ? 2 : 1;
  
  return baseValue * wildBonus;
}

/**
 * Check if tiles can merge
 */
export function canMerge(src: Tile, dst: Tile): boolean {
  if (!src || !dst) return false;
  if (src === dst) return false;
  if (src.locked || dst.locked) return false;
  if (src._isBeingMerged || dst._isBeingMerged) return false;
  if (src._isBeingDestroyed || dst._isBeingDestroyed) return false;
  
  return true;
}

/**
 * Get merge type
 */
export function getMergeType(src: Tile, dst: Tile): string {
  if (src.isWild || dst.isWild) return 'wild';
  if (src.special || dst.special) return 'special';
  return 'normal';
}

/**
 * Calculate score gain
 */
export function calculateScoreGain(mergeValue: number, combo: number): number {
  const baseScore = mergeValue * SCORE_MULTIPLIER;
  const comboBonus = combo * COMBO_MULTIPLIER;
  
  return baseScore + comboBonus;
}

/**
 * Calculate combo increase
 */
export function calculateComboIncrease(currentCombo: number): number {
  return currentCombo + COMBO_MULTIPLIER;
}

/**
 * Check if merge creates special tile
 */
export function createsSpecialTile(mergeValue: number): boolean {
  return mergeValue >= 10; // Example threshold
}

/**
 * Get special tile type
 */
export function getSpecialTileType(mergeValue: number): string {
  if (mergeValue >= 20) return 'legendary';
  if (mergeValue >= 15) return 'epic';
  if (mergeValue >= 10) return 'rare';
  return 'common';
}

// All functions are already exported individually above