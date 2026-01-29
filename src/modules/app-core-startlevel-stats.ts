type StartLevelStatsDeps = {
  n: number;
  statsService: { updateHighestBoard: (n: number) => void };
  devLog: (...args: any[]) => void;
  devError: (...args: any[]) => void;
};

export function updateStartLevelStats({
  n,
  statsService,
  devLog,
  devError,
}: StartLevelStatsDeps){
  // STATS TRACKING: Update highest board reached
  devLog('🎯 Updating highest board to:', n);
  try {
    statsService.updateHighestBoard(n);
    devLog('✅ Highest board updated successfully');
  } catch (error) {
    devError('❌ Failed to update highest board:', error);
  }
}
