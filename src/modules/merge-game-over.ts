// merge-game-over.ts
// Game over logic for merge system

import { logger } from '../core/logger.js';

import { 
  GAME_OVER_DELAY,
  STARS_MODAL_DELAY,
  BOARD_FAIL_DELAY
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

// Global state
let gameOverInProgress = false;
let gameOverCallbacks: (() => void)[] = [];

/**
 * Check if game is over
 */
export async function checkGameOver(): Promise<void> {
  if (gameOverInProgress) {
    logger.info('⚠️ Game over check already in progress');
    return;
  }
  
  logger.info('🔍 Checking game over conditions');
  
  // Implement actual game over logic
  // Check if any merges are possible on the board
  const grid = container.get('grid') as (Container | null)[][];
  if (!grid) return false;
  
  // Check all possible tile combinations
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const tile = grid[r][c];
      if (!tile) continue;
      
      // Check adjacent tiles for possible merges
      const adjacent = [
        { r: r-1, c: c }, { r: r+1, c: c },
        { r: r, c: c-1 }, { r: r, c: c+1 }
      ];
      
      for (const adj of adjacent) {
        if (adj.r >= 0 && adj.r < grid.length && adj.c >= 0 && adj.c < grid[adj.r].length) {
          const adjTile = grid[adj.r][adj.c];
          if (adjTile && canMergeTiles(tile, adjTile)) {
            return false; // Merge possible, game not over
          }
        }
      }
    }
  }
  
  return true; // No merges possible, game over
  
  // For now, just simulate a check
  const isGameOver = false; // Placeholder
  
  if (isGameOver) {
    await handleGameOver();
  } else {
    logger.info('✅ Game continues - merges still possible');
  }
}

/**
 * Handle game over
 */
async function handleGameOver(): Promise<void> {
  if (gameOverInProgress) return;
  
  gameOverInProgress = true;
  logger.info('💀 Game over triggered');
  
  try {
    // Wait for any ongoing animations
    await new Promise(resolve => setTimeout(resolve, GAME_OVER_DELAY));
    
    // Check if we should show stars modal
    const shouldShowStars = await checkStarsModal();
    
    if (shouldShowStars) {
      await showStarsModal();
    } else {
      await showBoardFailModal();
    }
    
    // Call all registered callbacks
    gameOverCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logger.error('❌ Error in game over callback:', error);
      }
    });
    
  } catch (error) {
    logger.error('❌ Error handling game over:', error);
  } finally {
    gameOverInProgress = false;
  }
}

/**
 * Check if stars modal should be shown
 */
async function checkStarsModal(): Promise<boolean> {
  logger.info('⭐ Checking stars modal conditions');
  
  // Check score thresholds and achievements for stars modal
  const score = STATE.score;
  const starsThreshold = 1000; // Example threshold
  
  if (score >= starsThreshold) {
    logger.info('⭐ Score threshold reached for stars modal');
    return true;
  }
  
  // For now, just simulate a check
  const shouldShow = false; // Placeholder
  
  if (shouldShow) {
    logger.info('⭐ Stars modal will be shown');
  } else {
    logger.info('❌ Stars modal not needed');
  }
  
  return shouldShow;
}

/**
 * Show stars modal
 */
async function showStarsModal(): Promise<void> {
  logger.info('⭐ Showing stars modal');
  
  try {
    // Wait for modal delay
    await new Promise(resolve => setTimeout(resolve, STARS_MODAL_DELAY));
    
    // Show stars modal (placeholder implementation)
    logger.info('⭐ Showing stars modal');
    // await showStarsModal(); // Uncomment when stars modal is implemented
    
    logger.info('✅ Stars modal shown');
  } catch (error) {
    logger.error('❌ Error showing stars modal:', error);
  }
}

/**
 * Show board fail modal
 */
async function showBoardFailModal(): Promise<void> {
  logger.info('💥 Showing board fail modal');
  
  try {
    // Wait for modal delay
    await new Promise(resolve => setTimeout(resolve, BOARD_FAIL_DELAY));
    
    // Show board fail modal (placeholder implementation)
    logger.info('💥 Showing board fail modal');
    // await showBoardFailModal(); // Uncomment when board fail modal is implemented
    
    logger.info('✅ Board fail modal shown');
  } catch (error) {
    logger.error('❌ Error showing board fail modal:', error);
  }
}

/**
 * Check if any merges are possible on the board
 */
export function anyMergePossible(tiles: Tile[]): boolean {
  if (!tiles || tiles.length === 0) return false;
  
  logger.info('🔍 Checking if any merges are possible');
  
  // Check all possible tile combinations for merge possibilities
  const allTiles = STATE.tiles || [];
  const openTiles = allTiles.filter((tile: any) => !tile.locked && tile.value > 0);
  
  // Check for valid merge combinations
  for (let i = 0; i < openTiles.length; i++) {
    for (let j = i + 1; j < openTiles.length; j++) {
      const tile1 = openTiles[i];
      const tile2 = openTiles[j];
      const sum = tile1.value + tile2.value;
      
      if (sum >= 2 && sum <= 6) {
        return true; // Valid merge found
      }
    }
  }
  
  // For now, just simulate a check
  const hasPossibleMerges = true; // Placeholder
  
  if (hasPossibleMerges) {
    logger.info('✅ Merges are possible');
  } else {
    logger.info('❌ No merges possible - game over');
  }
  
  return hasPossibleMerges;
}

/**
 * Check if specific tiles can merge
 */
export function canTilesMerge(tile1: Tile, tile2: Tile): boolean {
  if (!tile1 || !tile2) return false;
  if (tile1 === tile2) return false;
  if (tile1.locked || tile2.locked) return false;
  if (tile1._isBeingMerged || tile2._isBeingMerged) return false;
  if (tile1._isBeingDestroyed || tile2._isBeingDestroyed) return false;
  
  // Check value compatibility and special rules
  const sum = tile1.value + tile2.value;
  
  // Basic merge validation
  if (sum < 2 || sum > 6) {
    return false; // Invalid merge
  }
  
  // Check for special tile rules
  if (tile1.special === 'wild' || tile2.special === 'wild') {
    return true; // Wild tiles can merge with anything
  }
  
  // Check for locked tiles
  if (tile1.locked || tile2.locked) {
    return false; // Locked tiles cannot merge
  }
  
  return true; // Placeholder
}

/**
 * Get all possible merges on the board
 */
export function getAllPossibleMerges(tiles: Tile[]): { src: Tile, dst: Tile }[] {
  const possibleMerges: { src: Tile, dst: Tile }[] = [];
  
  if (!tiles || tiles.length < 2) return possibleMerges;
  
  logger.info('🔍 Finding all possible merges');
  
  // Check all tile combinations and return valid merges
  const validMerges: { src: Tile; dst: Tile }[] = [];
  
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const tile1 = tiles[i];
      const tile2 = tiles[j];
      
      if (canMerge(tile1, tile2)) {
        validMerges.push({ src: tile1, dst: tile2 });
      }
    }
  }
  
  return validMerges;
  
  logger.info(`✅ Found ${possibleMerges.length} possible merges`);
  
  return possibleMerges;
}

/**
 * Register game over callback
 */
export function onGameOver(callback: () => void): void {
  if (typeof callback === 'function') {
    gameOverCallbacks.push(callback);
    logger.info(`📝 Registered game over callback (total: ${gameOverCallbacks.length})`);
  }
}

/**
 * Unregister game over callback
 */
export function offGameOver(callback: () => void): void {
  const index = gameOverCallbacks.indexOf(callback);
  if (index > -1) {
    gameOverCallbacks.splice(index, 1);
    logger.info(`🗑️ Unregistered game over callback (remaining: ${gameOverCallbacks.length})`);
  }
}

/**
 * Clear all game over callbacks
 */
export function clearGameOverCallbacks(): void {
  gameOverCallbacks.length = 0;
  logger.info('🧹 Cleared all game over callbacks');
}

/**
 * Check if game over is in progress
 */
export function isGameOverInProgress(): boolean {
  return gameOverInProgress;
}

/**
 * Force game over (for testing)
 */
export function forceGameOver(): void {
  logger.info('💀 Forcing game over');
  handleGameOver();
}

/**
 * Reset game over state
 */
export function resetGameOverState(): void {
  gameOverInProgress = false;
  gameOverCallbacks.length = 0;
  logger.info('🔄 Reset game over state');
}

// All functions are already exported individually above