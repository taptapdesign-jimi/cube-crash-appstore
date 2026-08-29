type SaveStateDeps = {
  gridSnapshot: any[][];
  score: number;
  level: number;
  boardNumber: number;
  moves: number;
  wildMeter: number;
  wildSpawnCount: number;
  bestScore: number;
  starsCount: number;
  MOVES_MAX: number;
  devLog: (...args: any[]) => void;
};

export function buildSaveState({
  gridSnapshot,
  score,
  level,
  boardNumber,
  moves,
  wildMeter,
  wildSpawnCount,
  bestScore,
  starsCount,
  MOVES_MAX,
  devLog,
}: SaveStateDeps){
  const currentState = {
    grid: gridSnapshot,
    score: Number.isFinite(score) ? score : 0,
    level: Number.isFinite(level) ? level : 1,
    boardNumber: Number.isFinite(boardNumber) ? boardNumber : (Number.isFinite(level) ? level : 1),
    moves: Number.isFinite(moves) ? moves : MOVES_MAX,
    wildMeter: Number.isFinite(wildMeter) ? wildMeter : 0,
    wildSpawnCount: Number.isFinite(wildSpawnCount) ? Math.max(0, Math.trunc(wildSpawnCount)) : 0,
    bestScore: Number.isFinite(bestScore) ? bestScore : 0,
    starsCount: Number.isFinite(starsCount) ? starsCount : 0,
    timestamp: Date.now(),
  };

  devLog('💾 Saving game state:', {
    gridRows: currentState.grid.length,
    gridCols: currentState.grid[0]?.length || 0,
    score: currentState.score,
    level: currentState.level,
    boardNumber: currentState.boardNumber,
    moves: currentState.moves,
    wildMeter: currentState.wildMeter,
    wildSpawnCount: currentState.wildSpawnCount,
  });

  return currentState;
}
