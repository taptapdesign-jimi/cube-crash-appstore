// src/modules/board-recovery.ts
// 🔥 CRITICAL: Board stuck state detection and recovery module
// Handles edge cases where app is force-quit during last merge animations
// (e.g., wild juice bubbles, wild star particles) leaving board in stuck state

import { logger } from '../core/logger.js';

// ============================================================================
// TYPES
// ============================================================================

interface RecoveryResult {
  wasStuck: boolean;
  reason: string;
  recovered: boolean;
}

interface TileInfo {
  value: number;
  locked: boolean;
  destroyed: boolean;
  special?: string;
  gridX?: number;
  gridY?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY_PENDING_CLEAN_BOARD = 'cc_pending_clean_board';
const MAX_MERGE_VALUE = 6;

// ============================================================================
// PENDING CLEAN BOARD FLAG (Prevention)
// ============================================================================

/**
 * Set pending clean board flag when last merge is detected.
 * This flag persists across app restarts and signals that clean board
 * should be triggered on next load if it wasn't completed.
 * 
 * @param boardNumber - Current board number for board-specific tracking
 */
export function setPendingCleanBoard(boardNumber: number): void {
  try {
    const data = {
      boardNumber,
      timestamp: Date.now(),
      reason: 'last_merge_detected'
    };
    localStorage.setItem(STORAGE_KEY_PENDING_CLEAN_BOARD, JSON.stringify(data));
    logger.info('🚨 setPendingCleanBoard: Flag set', 'board-recovery', data);
  } catch (e) {
    logger.warn('⚠️ setPendingCleanBoard: Failed to set flag', 'board-recovery', e);
  }
}

/**
 * Clear pending clean board flag after clean board flow completes successfully.
 * Call this at the END of clean board flow, after all animations and state updates.
 */
export function clearPendingCleanBoard(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PENDING_CLEAN_BOARD);
    logger.info('✅ clearPendingCleanBoard: Flag cleared', 'board-recovery');
  } catch (e) {
    logger.warn('⚠️ clearPendingCleanBoard: Failed to clear flag', 'board-recovery', e);
  }
}

/**
 * Check if pending clean board flag is set for a specific board.
 * 
 * @param boardNumber - Board number to check
 * @returns Object with pending status and data, or null if not pending
 */
export function getPendingCleanBoard(boardNumber: number): { pending: boolean; data: any } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PENDING_CLEAN_BOARD);
    if (!stored) {
      return { pending: false, data: null };
    }
    
    const data = JSON.parse(stored);
    
    // Check if flag is for this board
    if (data.boardNumber !== boardNumber) {
      logger.debug('🔍 getPendingCleanBoard: Flag exists but for different board', 'board-recovery', {
        flagBoard: data.boardNumber,
        currentBoard: boardNumber
      });
      return { pending: false, data: null };
    }
    
    // Check if flag is not too old (max 24 hours)
    const age = Date.now() - (data.timestamp || 0);
    if (age > 24 * 60 * 60 * 1000) {
      logger.debug('🔍 getPendingCleanBoard: Flag too old, clearing', 'board-recovery', { age });
      clearPendingCleanBoard();
      return { pending: false, data: null };
    }
    
    return { pending: true, data };
  } catch (e) {
    logger.warn('⚠️ getPendingCleanBoard: Failed to check flag', 'board-recovery', e);
    return { pending: false, data: null };
  }
}

// ============================================================================
// STUCK STATE DETECTION (Recovery)
// ============================================================================

/**
 * Analyze tiles to detect if board is in a stuck state.
 * Stuck state occurs when:
 * 1. Only 1 active tile exists (the merge-6 result)
 * 2. No locked tiles available for spawn
 * 3. The single tile is value 6 (merge completed but clean board didn't trigger)
 * 
 * @param tiles - Array of tile objects from game state
 * @returns Detection result with reason
 */
export function detectStuckState(tiles: TileInfo[]): { isStuck: boolean; reason: string; details: any } {
  if (!tiles || !Array.isArray(tiles)) {
    return { isStuck: false, reason: 'no_tiles_array', details: {} };
  }
  
  // Filter active tiles (not locked, not destroyed, has value)
  const activeTiles = tiles.filter(t => 
    t && 
    !t.destroyed && 
    !t.locked && 
    typeof t.value === 'number' && 
    t.value > 0
  );
  
  // Filter locked tiles (available for spawn)
  const lockedTiles = tiles.filter(t => 
    t && 
    !t.destroyed && 
    t.locked === true
  );
  
  const details = {
    totalTiles: tiles.length,
    activeTilesCount: activeTiles.length,
    lockedTilesCount: lockedTiles.length,
    activeTileValues: activeTiles.map(t => t.value),
    activeTileSpecials: activeTiles.map(t => t.special || 'none')
  };
  
  logger.debug('🔍 detectStuckState: Analyzing board', 'board-recovery', details);
  
  // STUCK CASE 1: Single merge-6 tile, no locked tiles
  // This is the classic "force quit during last merge animation" scenario
  if (activeTiles.length === 1 && 
      activeTiles[0].value === MAX_MERGE_VALUE && 
      lockedTiles.length === 0) {
    return {
      isStuck: true,
      reason: 'single_merge6_no_locked',
      details: {
        ...details,
        description: 'Board has single merge-6 tile with no locked tiles - likely force quit during last merge animation'
      }
    };
  }
  
  // STUCK CASE 2: No active tiles at all, no locked tiles
  // Board is completely empty but wasn't cleaned up
  if (activeTiles.length === 0 && lockedTiles.length === 0) {
    return {
      isStuck: true,
      reason: 'empty_board_no_locked',
      details: {
        ...details,
        description: 'Board is empty with no locked tiles - state corruption or incomplete clean board'
      }
    };
  }
  
  // STUCK CASE 3: Only wild tiles remain that can't merge
  // Wild + Wild same value can't merge, leading to stuck state
  if (activeTiles.length === 2 && lockedTiles.length === 0) {
    const bothWild = activeTiles.every(t => 
      t.special === 'wild' || t.special === 'wild-juice' || t.special === 'wild-tnt' || t.special === 'wild-magnet'
    );
    const sameValue = activeTiles[0].value === activeTiles[1].value;
    
    if (bothWild && sameValue) {
      return {
        isStuck: true,
        reason: 'two_wilds_same_value_no_locked',
        details: {
          ...details,
          description: 'Two wild tiles with same value cannot merge - stuck state'
        }
      };
    }
  }
  
  // Multiple live tiles with no valid moves are not a clean-board recovery case.
  // The gameplay endgame checker must handle that path so the player sees No Moves + fail screen.
  
  // Not stuck
  return {
    isStuck: false,
    reason: 'board_ok',
    details
  };
}

// ============================================================================
// RECOVERY EXECUTION
// ============================================================================

function getRecoveryTileGroups(tiles: TileInfo[]): { activeTiles: TileInfo[]; lockedTiles: TileInfo[] } {
  const activeTiles = (tiles || []).filter(t =>
    t &&
    !t.destroyed &&
    !t.locked &&
    typeof t.value === 'number' &&
    t.value > 0
  );
  const lockedTiles = (tiles || []).filter(t =>
    t &&
    !t.destroyed &&
    t.locked === true
  );
  return { activeTiles, lockedTiles };
}

function isCleanBoardRecoveryCompatible(tiles: TileInfo[]): boolean {
  const { activeTiles, lockedTiles } = getRecoveryTileGroups(tiles);
  if (activeTiles.length === 0 && lockedTiles.length === 0) return true;
  return activeTiles.length === 1 &&
    activeTiles[0]?.value === MAX_MERGE_VALUE &&
    lockedTiles.length === 0;
}

function shouldTriggerCleanBoardForStuckReason(reason: string): boolean {
  return reason === 'single_merge6_no_locked' || reason === 'empty_board_no_locked';
}

/**
 * Main recovery function - call this after loading board state.
 * Checks for pending clean board flag AND stuck state detection.
 * If either indicates recovery is needed, triggers clean board flow.
 * 
 * @param tiles - Array of tile objects from game state
 * @param boardNumber - Current board number
 * @param triggerCleanBoardFn - Function to trigger clean board flow
 * @returns Recovery result
 */
export async function checkAndRecoverBoard(
  tiles: TileInfo[],
  boardNumber: number,
  triggerCleanBoardFn: (reason: string) => Promise<void>
): Promise<RecoveryResult> {
  logger.info('🔍 checkAndRecoverBoard: Starting recovery check', 'board-recovery', { boardNumber });
  
  // Check 1: Pending clean board flag (explicit intent)
  const pendingCheck = getPendingCleanBoard(boardNumber);
  if (pendingCheck.pending) {
    if (!isCleanBoardRecoveryCompatible(tiles)) {
      logger.warn('⚠️ RECOVERY: Ignoring stale pending clean-board flag because saved board is playable/non-clean', 'board-recovery', {
        pending: pendingCheck.data,
        activeTiles: getRecoveryTileGroups(tiles).activeTiles.map(t => ({
          value: t.value,
          special: t.special || null,
          gridX: t.gridX,
          gridY: t.gridY
        })),
      });
      clearPendingCleanBoard();
    } else {
    logger.warn('🚨 RECOVERY: Pending clean board flag detected!', 'board-recovery', pendingCheck.data);
    
    try {
      // Clear flag BEFORE triggering (prevent infinite loop if trigger fails)
      clearPendingCleanBoard();
      
      // Trigger clean board with small delay to ensure UI is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      await triggerCleanBoardFn('board_recovery_pending_flag');
      
      return {
        wasStuck: true,
        reason: 'pending_clean_board_flag',
        recovered: true
      };
    } catch (e) {
      logger.error('❌ RECOVERY: Failed to trigger clean board from pending flag', 'board-recovery', e);
      return {
        wasStuck: true,
        reason: 'pending_clean_board_flag',
        recovered: false
      };
    }
    }
  }
  
  // Check 2: Stuck state detection (heuristic)
  const stuckCheck = detectStuckState(tiles);
  if (stuckCheck.isStuck) {
    if (!shouldTriggerCleanBoardForStuckReason(stuckCheck.reason)) {
      logger.warn('⚠️ RECOVERY: Stuck state is not a clean-board recovery; leaving it to endgame checker', 'board-recovery', stuckCheck);
      return {
        wasStuck: false,
        reason: stuckCheck.reason,
        recovered: false
      };
    }

    logger.warn('🚨 RECOVERY: Stuck state detected!', 'board-recovery', stuckCheck);
    
    try {
      // Trigger clean board with small delay to ensure UI is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      await triggerCleanBoardFn(`board_recovery_stuck_${stuckCheck.reason}`);
      
      return {
        wasStuck: true,
        reason: stuckCheck.reason,
        recovered: true
      };
    } catch (e) {
      logger.error('❌ RECOVERY: Failed to trigger clean board from stuck detection', 'board-recovery', e);
      return {
        wasStuck: true,
        reason: stuckCheck.reason,
        recovered: false
      };
    }
  }
  
  // Board is OK
  logger.info('✅ checkAndRecoverBoard: Board is healthy, no recovery needed', 'board-recovery');
  return {
    wasStuck: false,
    reason: 'board_ok',
    recovered: false
  };
}

// ============================================================================
// EXPORTS FOR EXTERNAL USE
// ============================================================================

export default {
  // Prevention (set flag when last merge detected)
  setPendingCleanBoard,
  clearPendingCleanBoard,
  getPendingCleanBoard,
  
  // Detection (check if stuck)
  detectStuckState,
  
  // Recovery (main entry point)
  checkAndRecoverBoard
};
