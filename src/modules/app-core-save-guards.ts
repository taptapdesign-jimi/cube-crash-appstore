type SaveGuardDeps = {
  boardNumber: number;
  userMadeMove: boolean;
  gameHasEnded: boolean;
  gridReady: boolean;
  gameplayTransientBusy?: boolean;
  runMode?: string | null;
  cameFromJourney?: boolean;
  cameFromInterimBoard?: boolean;
  devLog: (...args: any[]) => void;
};

export function canSaveGameState({
  boardNumber,
  userMadeMove,
  gameHasEnded,
  gridReady,
  gameplayTransientBusy = false,
  runMode,
  cameFromJourney,
  cameFromInterimBoard,
  devLog,
}: SaveGuardDeps){
  // Arcade now has its own isolated save key, so it can resume without touching Journey board saves.
  if (runMode === 'arcade_home') {
    // Journey context has priority: stale runMode must not disable journey resume.
    if (cameFromJourney || cameFromInterimBoard) {
      devLog('💾 Arcade runMode ignored because Journey context is active');
    } else {
      devLog('💾 Arcade home run - saving to Arcade run state');
    }
  }

  // CRITICAL FIX: Don't save game state if game has ended
  if (gameHasEnded) {
    devLog('💾 Game has ended, skipping save');
    return false;
  }

  if (gameplayTransientBusy) {
    devLog('💾 Gameplay has transient drop/endgame handoff state, skipping save');
    return false;
  }

  // Grid must be ready so we have something to save
  if (!gridReady) {
    devLog('💾 Grid not ready, skipping save');
    return false;
  }

  // 🔥 CRITICAL: Save for ALL boards when grid is ready so hard exit (even before first move) can resume
  // Previously Board 1 was only saved after first move → hard exit at start caused rebuild
  if (boardNumber >= 2) {
    devLog('💾 Board', boardNumber, '- saving (board 2+ always save)');
  } else {
    devLog('💾 Board 1 - saving (enables resume after hard exit at start)');
  }

  return true;
}
