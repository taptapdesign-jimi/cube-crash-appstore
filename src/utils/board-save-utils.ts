/**
 * Board-Specific Save State Utilities
 * 
 * 🔥 USER REQUEST: Each Journey board should have its own save state
 * This prevents conflicts when switching between boards (e.g., Board 07 → Board 03)
 * 
 * Previously: All boards shared a single 'cc_saved_game' localStorage key
 * Now: Each board has its own key: 'cc_saved_game_board_01', 'cc_saved_game_board_02', etc.
 */

/**
 * Get the localStorage key for a specific board's save state
 * @param boardNumber - Board number (1-based)
 * @returns localStorage key string (e.g., 'cc_saved_game_board_07')
 */
export function getBoardSaveKey(boardNumber: number): string {
  // Pad board number to 2 digits (1 → 01, 12 → 12)
  const paddedNumber = String(boardNumber).padStart(2, '0');
  return `cc_saved_game_board_${paddedNumber}`;
}

export const ARCADE_SAVE_KEY = 'cc_arcade_run_state_v1';

export function getArcadeSaveKey(): string {
  return ARCADE_SAVE_KEY;
}

export function hasArcadeSavedState(): boolean {
  return localStorage.getItem(ARCADE_SAVE_KEY) !== null;
}

export function clearArcadeSaveState(): void {
  localStorage.removeItem(ARCADE_SAVE_KEY);
  console.log(`🗑️ Cleared Arcade save state (${ARCADE_SAVE_KEY})`);
}

/**
 * Get all board-specific save keys from localStorage
 * Useful for cleanup, migration, or debugging
 * @returns Array of save key strings
 */
export function getAllBoardSaveKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('cc_saved_game_board_')) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Get board number from a board-specific save key
 * @param saveKey - Save key (e.g., 'cc_saved_game_board_07')
 * @returns Board number or null if invalid key
 */
export function getBoardNumberFromKey(saveKey: string): number | null {
  const match = saveKey.match(/cc_saved_game_board_(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Check if a specific board has a saved state
 * @param boardNumber - Board number to check
 * @returns true if save state exists for this board
 */
export function hasSavedStateForBoard(boardNumber: number): boolean {
  const saveKey = getBoardSaveKey(boardNumber);
  return localStorage.getItem(saveKey) !== null;
}

/**
 * Delete saved state for a specific board
 * @param boardNumber - Board number to clear
 */
export function clearBoardSaveState(boardNumber: number): void {
  const saveKey = getBoardSaveKey(boardNumber);
  localStorage.removeItem(saveKey);
  console.log(`🗑️ Cleared save state for board ${boardNumber} (${saveKey})`);
}

/**
 * 🔥 MIGRATION: Convert old global 'cc_saved_game' to board-specific save
 * This should run once to migrate existing saves
 * @returns true if migration was performed
 */
export function migrateGlobalSaveToBoard(): boolean {
  const OLD_GLOBAL_KEY = 'cc_saved_game';
  const oldSave = localStorage.getItem(OLD_GLOBAL_KEY);
  
  if (!oldSave) {
    console.log('📦 No global save to migrate');
    return false;
  }
  
  try {
    const state = JSON.parse(oldSave);
    const boardNum = state.boardNumber || state.level || 1;
    const newKey = getBoardSaveKey(boardNum);
    
    // Check if board-specific save already exists
    const existingBoardSave = localStorage.getItem(newKey);
    if (existingBoardSave) {
      console.log(`📦 Board ${boardNum} already has a save, skipping migration`);
      // Still remove global save to prevent confusion
      localStorage.removeItem(OLD_GLOBAL_KEY);
      return false;
    }
    
    // Migrate to board-specific key
    localStorage.setItem(newKey, oldSave);
    console.log(`✅ Migrated global save to ${newKey} for board ${boardNum}`);
    
    // Remove old global key to prevent confusion
    localStorage.removeItem(OLD_GLOBAL_KEY);
    console.log(`🗑️ Removed old global save key (${OLD_GLOBAL_KEY})`);
    
    return true;
  } catch (error) {
    console.warn('⚠️ Failed to migrate global save:', error);
    return false;
  }
}

/**
 * Get all saved boards with their metadata
 * Useful for debugging and showing user which boards have progress
 * @returns Array of objects with board number and save data
 */
export function getAllSavedBoards(): Array<{ boardNumber: number; saveKey: string; timestamp?: number; score?: number }> {
  const savedBoards: Array<{ boardNumber: number; saveKey: string; timestamp?: number; score?: number }> = [];
  const allKeys = getAllBoardSaveKeys();
  
  allKeys.forEach(key => {
    const boardNumber = getBoardNumberFromKey(key);
    if (boardNumber === null) return;
    
    try {
      const saveData = localStorage.getItem(key);
      if (saveData) {
        const state = JSON.parse(saveData);
        savedBoards.push({
          boardNumber,
          saveKey: key,
          timestamp: state.timestamp,
          score: state.score
        });
      }
    } catch (error) {
      console.warn(`⚠️ Failed to parse save data for ${key}:`, error);
    }
  });
  
  // Sort by board number
  return savedBoards.sort((a, b) => a.boardNumber - b.boardNumber);
}

/**
 * Debug: Log all saved boards to console
 */
export function debugLogAllSavedBoards(): void {
  const savedBoards = getAllSavedBoards();
  console.log('📊 All Saved Boards:');
  console.table(savedBoards);
}
