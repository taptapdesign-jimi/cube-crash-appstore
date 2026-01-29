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
      
      // Update journey badge count (slideIndex 1 = Journey)
      // Show NEWLY unlocked boards count (excluding board 1 and already viewed boards) as badge
      // This ensures badge only shows boards that haven't been viewed yet
      const newlyUnlockedCount = journeyBoardsManager.getNewlyUnlockedCount();
      if (typeof (window as any).updateNavBadge === 'function') {
        (window as any).updateNavBadge(newlyUnlockedCount, 1); // Pass slideIndex 1 for Journey
        devLog(`🗺️ Journey badge updated: ${newlyUnlockedCount} newly unlocked boards (not yet viewed)`);
      }
    } catch (error) {
      devWarn('⚠️ Failed to sync journey boards with game progress:', error);
    }
  }).catch((error) => {
    devWarn('⚠️ Failed to import journey boards manager:', error);
  });
}
