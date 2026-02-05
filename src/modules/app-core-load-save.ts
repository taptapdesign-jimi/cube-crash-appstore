type LoadSaveDeps = {
  boardNumber: number;
  getBoardSaveKey: (n: number) => string;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  storage?: Storage;
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
  storage
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

  devLog('📊 Game state:', {
    score: gameState.score,
    level: gameState.level,
    boardNumber: gameState.boardNumber,
    moves: gameState.moves,
  });

  const timestamp = Number(gameState.timestamp) || 0;
  const saveAge = Number.isFinite(timestamp) ? Date.now() - timestamp : 0;
  devLog('⏰ Save age:', Number.isFinite(timestamp) ? Math.round(saveAge / 1000) + ' seconds' : 'no timestamp');
  // Only reject if we have a valid timestamp and it's older than 7 days (allow continue next day)
  if (Number.isFinite(timestamp) && saveAge > 7 * 24 * 60 * 60 * 1000) {
    devLog(`⚠️ Saved game for board ${currentBoardNumber} is too old (${Math.round(saveAge / 86400000)} days), starting fresh`);
    resolvedStorage.removeItem(saveKey);
    return null;
  }

  return { gameState, saveKey, currentBoardNumber };
}
