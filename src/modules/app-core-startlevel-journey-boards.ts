import { JOURNEY_SLIDE_INDEX } from './homepage-slide-order.js';

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
      
      // Update Journey badge count.
      // Show NEWLY unlocked boards count (excluding board 1 and already viewed boards) as badge
      // This ensures badge only shows boards that haven't been viewed yet
      const newlyUnlockedCount = journeyBoardsManager.getNewlyUnlockedCount();
      if (typeof (window as any).updateNavBadge === 'function') {
        (window as any).updateNavBadge(newlyUnlockedCount, JOURNEY_SLIDE_INDEX);
        devLog(`🗺️ Journey badge updated: ${newlyUnlockedCount} newly unlocked boards (not yet viewed)`);
      }
    } catch (error) {
      devWarn('⚠️ Failed to sync journey boards with game progress:', error);
    }
  }).catch((error) => {
    devWarn('⚠️ Failed to import journey boards manager:', error);
  });
}
