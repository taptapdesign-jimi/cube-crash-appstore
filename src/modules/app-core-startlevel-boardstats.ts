type StartLevelBoardStatsDeps = {
  n: number;
  devLog: (...args: any[]) => void;
};

export function incrementBoardTimesPlayed({ n, devLog }: StartLevelBoardStatsDeps){
  // 🔥 JOURNEY BOARDS: Increment times played for this board
  try {
    import('../services/board-stats-service.js').then(({ boardStatsService }) => {
      boardStatsService.incrementBoardTimesPlayed(n);
      devLog(`🎮 Board ${n} times played incremented`);
    }).catch(() => {
      // Ignore import errors
    });
  } catch {}
}
