import { isArcadeHomeRunMode } from './run-mode.js';
import { arcadeStatsService } from '../services/arcade-stats-service.js';
import { isFirstPlayTutorialRunActive } from './app-core-utils.js';

type MergeScoreDeps = {
  effSum: number;
  score: number;
  wildActive: boolean;
  SCORE_CAP: number;
  statsService: {
    updateHighScore: (score: number) => void;
    incrementHelpersUsed: (n: number) => void;
  };
  devLog: (...args: any[]) => void;
  devError: (...args: any[]) => void;
};

export function applyMergeScore({
  effSum,
  score,
  wildActive,
  SCORE_CAP,
  statsService,
  devLog,
  devError,
}: MergeScoreDeps){
  const nextScore = Math.min(SCORE_CAP, score + effSum);
  
  devLog('🎮 MERGE: Score updated to:', nextScore);
  devLog('🎮 MERGE: statsService exists?', typeof statsService !== 'undefined');
  devLog('🎮 MERGE: statsService.updateHighScore exists?', typeof statsService?.updateHighScore === 'function');
  
  if (!isFirstPlayTutorialRunActive()) {
    // STATS TRACKING: Update high score immediately after score update
    try {
      statsService.updateHighScore(nextScore);
      devLog('✅ MERGE: statsService.updateHighScore called successfully');
    } catch (error) {
      devError('❌ MERGE: statsService.updateHighScore failed:', error);
    }

    // Arcade one-off run keeps its own independent high score.
    if (isArcadeHomeRunMode()) {
      try {
        arcadeStatsService.updateHighScore(nextScore);
        devLog('✅ MERGE: arcadeStatsService.updateHighScore called successfully');
      } catch (error) {
        devError('❌ MERGE: arcadeStatsService.updateHighScore failed:', error);
      }
    }
  }
  
  // COLLECTIBLES: Check for score-based unlocks
  if (nextScore >= 100 && typeof (window as any).collectiblesManager !== 'undefined' && (window as any).collectiblesManager) {
    const manager = (window as any).collectiblesManager;
    if (typeof manager.unlockCard === 'function') {
      manager.unlockCard('score_100');
    }
  }
  
  if (wildActive && !isFirstPlayTutorialRunActive()) {
    devLog('🎯 MERGE: Wild merge detected');
    try {
      statsService.incrementHelpersUsed(1);
      devLog('✅ MERGE: Incremented helpers used');
    } catch (error) {
      devError('❌ MERGE: Failed to increment helpers used:', error);
    }
  }
  
  return nextScore;
}
