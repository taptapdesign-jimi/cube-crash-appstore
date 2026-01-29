type LoadBasicsDeps = {
  gameState: any;
  MOVES_MAX: number;
  STATE: { bestScore?: number };
  setScore: (v: number) => void;
  setLevel: (v: number) => void;
  setBoardNumber: (v: number) => void;
  setMoves: (v: number) => void;
  setWildMeter: (v: number) => void;
  devLog: (...args: any[]) => void;
};

export function restoreBasicState({
  gameState,
  MOVES_MAX,
  STATE,
  setScore,
  setLevel,
  setBoardNumber,
  setMoves,
  setWildMeter,
  devLog,
}: LoadBasicsDeps){
  const score = Number.isFinite(gameState.score) ? gameState.score : 0;
  const level = Number.isFinite(gameState.level) ? gameState.level : 1;
  // Prioritize boardNumber from saved state, fallback to level
  const boardNumber = Number.isFinite(gameState.boardNumber) ? gameState.boardNumber : (Number.isFinite(gameState.level) ? gameState.level : 1);
  const moves = Number.isFinite(gameState.moves) ? gameState.moves : MOVES_MAX;
  const wildMeter = Number.isFinite(gameState.wildMeter) ? gameState.wildMeter : 0;
  
  setScore(score);
  setLevel(level);
  setBoardNumber(boardNumber);
  setMoves(moves);
  setWildMeter(wildMeter);
  
  devLog('📊 loadGameState: Restored state - boardNumber:', boardNumber, 'level:', level, 'score:', score, 'moves:', moves);

  if (Number.isFinite(gameState.bestScore)) {
    STATE.bestScore = gameState.bestScore;
  }

  const savedStarsCount = Number.isFinite(gameState.starsCount) ? gameState.starsCount : 0;
  devLog('💾 Will restore stars count after HUD initialization:', savedStarsCount);

  return { score, level, boardNumber, moves, wildMeter, savedStarsCount };
}
