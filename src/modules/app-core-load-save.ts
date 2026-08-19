import { COLS, ROWS } from './constants.ts';
import { validateAndNormalizeGameSave } from './app-core-save-schema.ts';

type LoadSaveDeps = {
  boardNumber: number;
  getBoardSaveKey: (n: number) => string;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  storage?: Storage;
  rows?: number;
  cols?: number;
};

type LoadSaveResult = {
  gameState: any;
  saveKey: string;
  currentBoardNumber: number;
} | null;

export function loadSavedBoardState({
  boardNumber,
  getBoardSaveKey,
  devLog,
  devWarn,
  storage,
  rows = ROWS,
  cols = COLS,
}: LoadSaveDeps): LoadSaveResult {
  const currentBoardNumber = Number.isFinite(boardNumber) ? boardNumber : 1;
  const saveKey = getBoardSaveKey(currentBoardNumber);
  const resolvedStorage =
    storage ??
    (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!resolvedStorage) {
    devWarn(`⚠️ No localStorage available for board ${currentBoardNumber} (${saveKey})`);
    return null;
  }
  const savedGame = resolvedStorage.getItem(saveKey);

  if (!savedGame) {
    devLog(`⚠️ No saved game found for board ${currentBoardNumber} (${saveKey})`);
    return null;
  }

  let gameState;
  try {
    gameState = JSON.parse(savedGame);
  } catch (error) {
    devWarn(`⚠️ Corrupted save file for board ${currentBoardNumber}, removing...`, error);
    resolvedStorage.removeItem(saveKey);
    return null;
  }

  const validation = validateAndNormalizeGameSave(gameState, {
    rows,
    cols,
    allowLegacy: true,
  });
  if ('issues' in validation) {
    devWarn(`⚠️ Invalid saved board schema for board ${currentBoardNumber}, removing...`, validation.issues);
    resolvedStorage.removeItem(saveKey);
    return null;
  }
  gameState = validation.gameState;
  if (gameState.boardNumber !== currentBoardNumber) {
    devWarn(`⚠️ Saved board identity mismatch for ${saveKey}; expected ${currentBoardNumber}, got ${gameState.boardNumber}. Removing save.`);
    resolvedStorage.removeItem(saveKey);
    return null;
  }
  if (validation.migratedLegacy) {
    devLog(`🔄 Migrated legacy board save ${currentBoardNumber} to schema ${gameState.schemaVersion}`);
  }

  devLog('📊 Game state:', {
    score: gameState.score,
    level: gameState.level,
    boardNumber: gameState.boardNumber,
    moves: gameState.moves,
  });

  const timestamp = Number(gameState.timestamp);
  const hasTimestamp = Number.isFinite(timestamp) && timestamp > 0;
  const saveAge = hasTimestamp ? Date.now() - timestamp : 0;
  devLog('⏰ Save age:', hasTimestamp ? Math.round(saveAge / 1000) + ' seconds' : 'no timestamp');
  // Only reject if we have a valid timestamp and it's older than 7 days (allow continue next day)
  if (hasTimestamp && saveAge > 7 * 24 * 60 * 60 * 1000) {
    devLog(`⚠️ Saved game for board ${currentBoardNumber} is too old (${Math.round(saveAge / 86400000)} days), starting fresh`);
    resolvedStorage.removeItem(saveKey);
    return null;
  }

  return { gameState, saveKey, currentBoardNumber };
}
