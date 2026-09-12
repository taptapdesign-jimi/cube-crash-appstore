type StartLevelJourneyBoardsDeps = {
  n: number;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function syncJourneyBoards({ n, devLog, devWarn }: StartLevelJourneyBoardsDeps){
  // 🗺️ JOURNEY PROGRESSION: Unlock journey boards based on boardNumber
  // Unlock all boards up to and including the current boardNumber
  import('./journey-boards-manager.js').then(({ journeyBoardsManager }) => {
    try {
      journeyBoardsManager.syncWithGameProgress(n);
      devLog(`🗺️ Journey boards synced through stage ${n}`);
    } catch (error) {
      devWarn('⚠️ Failed to sync journey boards with game progress:', error);
    }
  }).catch((error) => {
    devWarn('⚠️ Failed to import journey boards manager:', error);
  });
}
