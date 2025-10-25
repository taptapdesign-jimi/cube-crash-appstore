// merge-core.ts
// Core merge functionality for CubeCrash

import { gsap } from 'gsap';
import { STATE, ENDLESS, REFILL_ON_SIX_BY_DEPTH } from './app-state.js';
import * as makeBoard from './board.js';
import { glassCrackAtTile, woodShardsAtTile, innerFlashAtTile } from './fx-visual-effects.js';
import { screenShake } from './fx-animations.js';
import { showMultiplierTile, wildImpactEffect, smokeBubblesAtTile, stopWildIdle } from './fx-special-effects.js';
import { COLS, ROWS, TILE, GAP } from './constants.js';
import * as HUD from './hud-core.js';
import { openAtCell, openEmpties, spawnBounce } from './app-spawn.js';
import { showStarsModal } from './stars-modal.js';
import { showBoardFailModal } from './board-fail-modal.js';
import { rebuildBoard } from './app-board.js';
import { drawBoardBG } from './app-board.js';

// Import refactored modules
import {
  removeTile,
  updateHUD,
  animateScore,
  pulseBoardZoom,
  wobble,
  landBounce,
  landPreBounce,
  isMergeInProgress,
  setMergeInProgress,
  queueMerge,
  processMergeQueue,
  clearMergeQueue,
  getMergeQueueSize,
  calculateMergeValue,
  canMerge,
  getMergeType,
  calculateScoreGain,
  calculateComboIncrease,
  createsSpecialTile,
  getSpecialTileType
} from './merge-utils.js';

import {
  animateMergeEffect,
  animateWildMergeEffect,
  animateScoreIncrease,
  animateComboIncrease,
  animateBoardShake,
  animateTileSpawn,
  animateTileDestroy,
  animateTileBounce,
  animateTileWobble,
  killTileAnimations
} from './merge-animations.js';

import { logger } from '../core/logger.js';

import {
  checkGameOver,
  anyMergePossible,
  canTilesMerge,
  getAllPossibleMerges,
  onGameOver,
  offGameOver,
  clearGameOverCallbacks,
  isGameOverInProgress,
  forceGameOver,
  resetGameOverState
} from './merge-game-over.js';

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

// Global state
let mergeInProgress = false;
const mergeQueue: { src: Tile, dst: Tile, helpers: MergeHelpers }[] = [];

/**
 * Clear wild state from a tile
 */
export function clearWildState(tile: Tile): void {
  if (!tile) {
    logger.warn('⚠️ Cannot clear wild state - invalid tile');
    return;
  }
  
  tile.isWild = false;
  tile._wildMergeTarget = undefined;
  
  logger.info('✅ Wild state cleared');
}

/**
 * Merge two tiles
 */
export function merge(src: Tile, dst: Tile, helpers: MergeHelpers): void {
  if (!src || !dst) {
    logger.warn('⚠️ Cannot merge - invalid tiles');
    return;
  }
  
  if (!canMerge(src, dst)) {
    logger.warn('⚠️ Cannot merge - tiles cannot merge');
    return;
  }
  
  if (isMergeInProgress()) {
    logger.info('⏳ Merge in progress, queuing merge');
    queueMerge(src, dst, helpers);
    return;
  }
  
  logger.info(`🔄 Merging tiles: ${src.value} + ${dst.value}`);
  
  // Start merge process
  setMergeInProgress(true);
  
  try {
    // Calculate new value
    const newValue = calculateMergeValue(src, dst);
    const mergeType = getMergeType(src, dst);
    
    // Update destination tile
    dst.value = newValue;
    if (dst.num) {
      dst.num.text = newValue.toString();
    }
    
    // Calculate score and combo
    const scoreGain = calculateScoreGain(newValue, helpers.combo || 0);
    const newCombo = calculateComboIncrease(helpers.combo || 0);
    
    // Update HUD
    HUD.setScore((helpers.score || 0) + scoreGain);
    HUD.setCombo(newCombo);
    HUD.bumpCombo();
    
    // Animate merge effect
    if (mergeType === 'wild') {
      animateWildMergeEffect(src, dst);
    } else {
      animateMergeEffect(src, dst);
    }
    
    // Animate score increase
    animateScoreIncrease(scoreGain);
    
    // Animate combo increase
    animateComboIncrease(newCombo);
    
    // Remove source tile
    removeTile(src);
    
    // Check for special effects
    checkSpecialEffects(dst, newValue);
    
    // Check for game over
    checkGameOver();
    
    logger.info(`✅ Merge complete - new value: ${newValue}, score: ${scoreGain}, combo: ${newCombo}`);
    
  } catch (error) {
    logger.error('❌ Error during merge:', error);
  } finally {
    // End merge process
    setMergeInProgress(false);
    
    // Process queued merges
    processMergeQueue();
  }
}

/**
 * Check for special effects after merge
 */
function checkSpecialEffects(tile: Tile, newValue: number): void {
  if (!tile) return;
  
  logger.info(`✨ Checking special effects for tile with value: ${newValue}`);
  
  // Check if creates special tile
  if (createsSpecialTile(newValue)) {
    const specialType = getSpecialTileType(newValue);
    logger.info(`🌟 Created special tile: ${specialType}`);
    
    // Apply special tile effects
    applySpecialTileEffects(tile, specialType);
  }
  
  // Check for visual effects
  if (Math.random() < 0.3) {
    glassCrackAtTile(tile);
  }
  
  if (Math.random() < 0.2) {
    woodShardsAtTile(tile);
  }
  
  if (Math.random() < 0.4) {
    innerFlashAtTile(tile);
  }
  
  if (Math.random() < 0.3) {
    smokeBubblesAtTile(tile);
  }
}

/**
 * Apply special tile effects
 */
function applySpecialTileEffects(tile: Tile, specialType: string): void {
  logger.info(`🌟 Applying special tile effects: ${specialType}`);
  
  // Implement special tile effects based on type
  switch (specialType) {
    case 'legendary':
      // Legendary effects
      break;
    case 'epic':
      // Epic effects
      break;
    case 'rare':
      // Rare effects
      break;
    default:
      // Common effects
      break;
  }
}

/**
 * Check if any merge is possible on the board
 */
export function anyMergePossibleOnBoard(tiles: Tile[]): boolean {
  return anyMergePossible(tiles);
}

/**
 * Get all possible merges on the board
 */
export function getAllPossibleMergesOnBoard(tiles: Tile[]): { src: Tile, dst: Tile }[] {
  return getAllPossibleMerges(tiles);
}

/**
 * Check if specific tiles can merge
 */
export function canTilesMergeOnBoard(tile1: Tile, tile2: Tile): boolean {
  return canTilesMerge(tile1, tile2);
}

/**
 * Register game over callback
 */
export function onMergeGameOver(callback: () => void): void {
  onGameOver(callback);
}

/**
 * Unregister game over callback
 */
export function offMergeGameOver(callback: () => void): void {
  offGameOver(callback);
}

/**
 * Clear all game over callbacks
 */
export function clearMergeGameOverCallbacks(): void {
  clearGameOverCallbacks();
}

/**
 * Check if merge is in progress
 */
export function isMergeInProgressOnBoard(): boolean {
  return isMergeInProgress();
}

/**
 * Get merge queue size
 */
export function getMergeQueueSizeOnBoard(): number {
  return getMergeQueueSize();
}

/**
 * Clear merge queue
 */
export function clearMergeQueueOnBoard(): void {
  clearMergeQueue();
}

/**
 * Force game over (for testing)
 */
export function forceMergeGameOver(): void {
  forceGameOver();
}

/**
 * Reset merge state
 */
export function resetMergeState(): void {
  setMergeInProgress(false);
  clearMergeQueue();
  resetGameOverState();
  logger.info('🔄 Reset merge state');
}

// All functions are already exported individually above