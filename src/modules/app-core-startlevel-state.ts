type StartLevelStateDeps = {
  n: number;
  STATE: { score?: number; boardNumber?: number };
  boardSpecificRules: { setCurrentBoard: (n: number) => void };
  devLog: (...args: any[]) => void;
};

export function applyStartLevelState({
  n,
  STATE,
  boardSpecificRules,
  devLog,
}: StartLevelStateDeps){
  // 🎯 BOARD-SPECIFIC RULES: Set current board for board-specific rules
  let boardNumber = n | 0;
  boardSpecificRules.setCurrentBoard(boardNumber);
  devLog(`🎯 Board-specific rules: Set to board ${boardNumber}`);
  
  const preservedScore = Number((window as any).__ccPreserveScore);
  const shouldPreserveScore = Number.isFinite(preservedScore) && preservedScore >= 0;
  const score = shouldPreserveScore ? (preservedScore | 0) : 0;
  STATE.score = score;
  if (shouldPreserveScore) {
    devLog(`🎯 startLevel: Preserved score ${score} for board ${n}`);
  } else {
    devLog(`🎯 startLevel: Reset score to 0 for board ${n} (no accumulation between boards)`);
  }

  delete (window as any).__ccResumeScore;
  
  let level = n; // Set level to the board number
  boardNumber = n; // Set board number to the level number
  
  // 🔥 CRITICAL FIX: Update STATE.boardNumber immediately so layoutBoard() uses correct board number
  STATE.boardNumber = boardNumber;
  devLog(`🎯 startLevel: Set boardNumber to ${boardNumber} and synced STATE.boardNumber`);
  
  return { level, boardNumber, score };
}
