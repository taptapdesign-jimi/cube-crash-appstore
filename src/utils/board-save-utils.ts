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

const JOURNEY_COMPLETED_BOARD_KEY_PREFIX = 'cc_journey_completed_board_';

export function getJourneyCompletedBoardKey(boardNumber: number): string {
  return `${JOURNEY_COMPLETED_BOARD_KEY_PREFIX}${String(boardNumber).padStart(2, '0')}`;
}

/** A completed Journey board must not resume its last playable snapshot. This
 * tombstone is board-scoped and survives the Clean Board modal and hard exit. */
export function isJourneyBoardSaveCompleted(
  boardNumber: number,
  storage: Pick<Storage, 'getItem'> = localStorage,
): boolean {
  return storage.getItem(getJourneyCompletedBoardKey(boardNumber)) === '1';
}

/** Older builds wrote this result receipt before Clean Board but left the
 * board snapshot until a CTA tap. Match only the exact completed board. */
export function hasMatchingJourneyCompletionReceipt(
  boardNumber: number,
  storage: Pick<Storage, 'getItem'> = localStorage,
): boolean {
  const serialized = storage.getItem('cc_board_completed');
  if (!serialized) return false;
  try {
    const receipt = JSON.parse(serialized);
    return Number.isInteger(receipt?.completedLevel)
      && Number.isInteger(receipt?.nextLevel)
      && receipt.completedLevel === boardNumber
      && receipt.nextLevel === boardNumber + 1;
  } catch {
    return false;
  }
}

export function markJourneyBoardSaveCompleted(
  boardNumber: number,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
  // Write the durable guard first: if removal is interrupted, the saved two
  // terminal dice still cannot become a Continue route after relaunch.
  storage.setItem(getJourneyCompletedBoardKey(boardNumber), '1');
  storage.removeItem(getBoardSaveKey(boardNumber));
}

/** Repair a pre-upgrade Clean Board hard exit and veto any late save/load.
 * Arcade callers must stay outside this Journey-only owner. */
export function protectCompletedJourneyBoardSave(
  boardNumber: number,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage,
): boolean {
  if (isJourneyBoardSaveCompleted(boardNumber, storage)) {
    storage.removeItem(getBoardSaveKey(boardNumber));
    return true;
  }
  if (!hasMatchingJourneyCompletionReceipt(boardNumber, storage)) return false;
  markJourneyBoardSaveCompleted(boardNumber, storage);
  return true;
}

/** Called immediately before legacy global completion receipts are consumed
 * by unrelated Home/Arcade entry routes. It repairs only exact Journey
 * completion data and never alters Arcade progression or save state. */
export function migrateJourneyCompletionReceiptBeforeClear(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage,
): number | null {
  const serialized = storage.getItem('cc_board_completed');
  if (!serialized) return null;
  let receipt: any;
  try {
    receipt = JSON.parse(serialized);
  } catch {
    return null;
  }
  const boardNumber = receipt?.completedLevel;
  if (!Number.isInteger(boardNumber) || boardNumber < 1) return null;
  return protectCompletedJourneyBoardSave(boardNumber, storage) ? boardNumber : null;
}

export function clearJourneyBoardSaveCompleted(
  boardNumber: number,
  storage: Pick<Storage, 'removeItem'> = localStorage,
): void {
  storage.removeItem(getJourneyCompletedBoardKey(boardNumber));
}

export const ARCADE_SAVE_KEY = 'cc_arcade_run_state_v1';
export const ARCADE_PENDING_ROUND_KEY = 'cc_arcade_pending_round_v1';

export type PendingArcadeRound = { round: number; score: number; ownerId?: string };

/** Receipt for an accepted stage continuation before its fresh board exists. */
export function getPendingArcadeRound(): PendingArcadeRound | null {
  try {
    const serialized = localStorage.getItem(ARCADE_PENDING_ROUND_KEY);
    if (!serialized) return null;
    const receipt = JSON.parse(serialized);
    const round = Number(receipt?.round);
    const score = Number(receipt?.score);
    if (!Number.isInteger(round) || round < 2 || !Number.isFinite(score) || score < 0) return null;
    const ownerId = typeof receipt?.ownerId === 'string' ? receipt.ownerId : undefined;
    return ownerId ? { round, score, ownerId } : { round, score };
  } catch {
    return null;
  }
}

export function setPendingArcadeRound(round: number, score: number, ownerId?: string): void {
  if (!Number.isInteger(round) || round < 2 || !Number.isFinite(score) || score < 0) {
    throw new Error('Invalid Arcade continuation receipt');
  }
  localStorage.setItem(ARCADE_PENDING_ROUND_KEY, JSON.stringify({ round, score, ownerId }));
}

export function clearPendingArcadeRound(expectedOwnerId?: string): void {
  if (expectedOwnerId && getPendingArcadeRound()?.ownerId !== expectedOwnerId) return;
  localStorage.removeItem(ARCADE_PENDING_ROUND_KEY);
}

export function clearPendingArcadeRoundIfCovered(savedRound: number): void {
  const pending = getPendingArcadeRound();
  if (pending && savedRound >= pending.round) clearPendingArcadeRound(pending.ownerId);
}

export function getArcadeSaveKey(): string {
  return ARCADE_SAVE_KEY;
}

export function isArcadeSaveStateResumable(state: any): boolean {
  if (!state || typeof state !== 'object') return false;
  const savedRound = Number.isFinite(Number(state.boardNumber))
    ? Number(state.boardNumber)
    : Number(state.level);
  if (!Number.isFinite(savedRound) || savedRound < 1) return false;

  const gridTiles = Array.isArray(state.grid)
    ? state.grid.flatMap((row: any) => Array.isArray(row) ? row : [])
    : [];
  const candidates = gridTiles.length > 0
    ? gridTiles
    : (Array.isArray(state.tiles) ? state.tiles : []);
  const isArcadePlayableTile = (snapshot: any): boolean => {
    if (!snapshot || snapshot.destroyed === true || snapshot.locked === true || snapshot.open === false) return false;
    const value = Number(snapshot.value);
    const special = typeof snapshot.special === 'string' ? snapshot.special : '';
    // A regular six is a legal Arcade continuation owner while another tile
    // exists; only a lone six/terminal residue must be rejected.
    return (Number.isFinite(value) && value > 0 && value <= 6) || special.length > 0;
  };
  return candidates.filter(isArcadePlayableTile).length >= 2;
}

export function hasArcadeSavedState(options: ResumableSaveOptions = {}): boolean {
  return getPendingArcadeRound() !== null || hasArcadePersistedBoardState(options);
}

export function hasArcadePersistedBoardState(options: ResumableSaveOptions = {}): boolean {
  const storage = options.storage ?? localStorage;
  const serialized = storage.getItem(ARCADE_SAVE_KEY);
  if (!serialized) return false;
  try {
    const resumable = isArcadeSaveStateResumable(JSON.parse(serialized));
    if (!resumable && options.clearInvalid) storage.removeItem(ARCADE_SAVE_KEY);
    return resumable;
  } catch {
    if (options.clearInvalid) storage.removeItem(ARCADE_SAVE_KEY);
    return false;
  }
}

export function getArcadeSavedRound(): number | null {
  const serialized = localStorage.getItem(ARCADE_SAVE_KEY);
  if (!serialized) return null;

  try {
    const state = JSON.parse(serialized) as { boardNumber?: unknown; level?: unknown };
    const candidate = Number.isFinite(Number(state.boardNumber))
      ? Number(state.boardNumber)
      : Number(state.level);
    if (!Number.isFinite(candidate)) return null;
    return Math.max(1, Math.trunc(candidate));
  } catch {
    return null;
  }
}

export function clearArcadeSaveState(): void {
  localStorage.removeItem(ARCADE_SAVE_KEY);
  clearPendingArcadeRound();
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

type ResumableSaveOptions = {
  clearInvalid?: boolean;
  storage?: Pick<Storage, 'getItem' | 'removeItem'> & Partial<Pick<Storage, 'setItem'>>;
};

function isPlayableSavedTile(snapshot: any): boolean {
  if (!snapshot || snapshot.destroyed === true) return false;
  if (snapshot.locked === true || snapshot.open === false) return false;
  const value = Number(snapshot.value);
  const special = typeof snapshot.special === 'string' ? snapshot.special : '';
  return (Number.isFinite(value) && value > 0 && value < 6) || special.length > 0;
}

/**
 * A Journey save is resumable only when it belongs to the requested board and
 * still contains at least two playable tiles. Terminal clean-board residue
 * (for example one remaining star/special) must never produce Continue.
 */
export function isBoardSaveStateResumable(state: any, boardNumber: number): boolean {
  if (!state || typeof state !== 'object') return false;
  const savedBoard = Number.isFinite(Number(state.boardNumber))
    ? Number(state.boardNumber)
    : Number(state.level);
  if (Number.isFinite(savedBoard) && Math.floor(savedBoard) !== Math.floor(boardNumber)) return false;

  const gridTiles = Array.isArray(state.grid)
    ? state.grid.flatMap((row: any) => Array.isArray(row) ? row : [])
    : [];
  const candidates = gridTiles.length > 0
    ? gridTiles
    : (Array.isArray(state.tiles) ? state.tiles : []);
  return candidates.filter(isPlayableSavedTile).length >= 2;
}

export function hasResumableSavedStateForBoard(
  boardNumber: number,
  options: ResumableSaveOptions = {},
): boolean {
  const storage = options.storage ?? localStorage;
  const saveKey = getBoardSaveKey(boardNumber);
  const completed = typeof storage.setItem === 'function'
    ? protectCompletedJourneyBoardSave(boardNumber, storage as Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>)
    : isJourneyBoardSaveCompleted(boardNumber, storage)
      || hasMatchingJourneyCompletionReceipt(boardNumber, storage);
  if (completed) {
    if (options.clearInvalid) storage.removeItem(saveKey);
    return false;
  }
  const serialized = storage.getItem(saveKey);
  if (!serialized) return false;
  try {
    const resumable = isBoardSaveStateResumable(JSON.parse(serialized), boardNumber);
    if (!resumable && options.clearInvalid) storage.removeItem(saveKey);
    return resumable;
  } catch {
    if (options.clearInvalid) storage.removeItem(saveKey);
    return false;
  }
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
