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
