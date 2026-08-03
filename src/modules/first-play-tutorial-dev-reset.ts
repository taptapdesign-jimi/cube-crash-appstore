import { ARCADE_SAVE_KEY } from '../utils/board-save-utils.js';

export const FIRST_PLAY_TUTORIAL_TRANSIENT_SAVE_KEYS = Object.freeze([
  'cc_saved_game',
  'cc_board_completed',
  'cubeCrash_gameState',
  ARCADE_SAVE_KEY,
]);

/**
 * Removes only state that can divert the next Homepage Play tap into resume.
 * Journey progression, board highscores, stars, collectibles, and settings stay intact.
 */
export function clearFirstPlayTutorialResumeBlockers(storage: Storage = localStorage): void {
  FIRST_PLAY_TUTORIAL_TRANSIENT_SAVE_KEYS.forEach(key => storage.removeItem(key));
  if (typeof window !== 'undefined') {
    delete (window as any).__ccBoardJustCompleted;
    delete (window as any).__ccCleanBoardInProgress;
  }
}

