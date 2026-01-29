type StartLevelJourneyDeps = {
  n: number;
  score: number;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function updateJourneyRunState({
  n,
  score,
  devLog,
  devWarn,
}: StartLevelJourneyDeps){
  // 🔥 JOURNEY PROGRESSION: Update currentRunState when starting a level
  try {
    import('./journey-progression-state.js').then(({ journeyProgressionState }) => {
      const currentScore = score || 0;
      journeyProgressionState.setCurrentRunState(n, currentScore);
      devLog(`🗺️ Journey: Current run state set for board ${n} with score ${currentScore}`);
    }).catch((error) => {
      devWarn('⚠️ Failed to update Journey progression state in startLevel:', error);
    });
  } catch (error) {
    devWarn('⚠️ Failed to update Journey progression state in startLevel:', error);
  }
}
