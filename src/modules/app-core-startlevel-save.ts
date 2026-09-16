type StartLevelSaveDeps = {
  boardNumber: number;
  trackAppTimeout: (fn: () => void, ms: number) => any;
  saveGameState: () => void;
  devLog: (...args: any[]) => void;
};

export function saveAfterBoardStart({
  boardNumber,
  trackAppTimeout,
  saveGameState,
  devLog,
}: StartLevelSaveDeps){
  // CRITICAL: Save game state after starting ANY board so hard exit (no move) can still resume
  // Board 1: save after start so "hard exit na pocetku" restores the same board
  // Board 2+: same — ensures resume works even if user never made a move
  devLog('💾 Board', boardNumber, 'started, scheduling save for resume capability');
  trackAppTimeout(() => {
    saveGameState();
    devLog('✅ Game state saved after board start (board', boardNumber, ')');
  }, 100);
}

type ArcadeEntrySaveDeps = {
  boardNumber: number;
  isArcade: boolean;
  isCurrentEntry: () => boolean;
  saveGameState: () => void;
  readSavedRound: () => number | null;
  isSavedStateResumable: () => boolean;
  onCommitted?: () => void;
  devLog: (...args: any[]) => void;
};

/** Commit the new Arcade Round after its entry settles, when the 100ms
 * board-start save may have been skipped by transient animation guards. */
export function saveArcadeRoundAfterEntry({
  boardNumber,
  isArcade,
  isCurrentEntry,
  saveGameState,
  readSavedRound,
  isSavedStateResumable,
  onCommitted,
  devLog,
}: ArcadeEntrySaveDeps): boolean {
  if (!isArcade || !isCurrentEntry()) return false;
  saveGameState();
  const saved = readSavedRound() === boardNumber && isSavedStateResumable();
  if (saved) onCommitted?.();
  devLog(saved
    ? `💾 Arcade Round ${boardNumber} entry checkpoint committed`
    : `⚠️ Arcade Round ${boardNumber} entry checkpoint skipped by save guard`);
  return saved;
}
