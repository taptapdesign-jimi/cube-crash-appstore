type SaveGuardDeps = {
  boardNumber: number;
  userMadeMove: boolean;
  gameHasEnded: boolean;
  gridReady: boolean;
  devLog: (...args: any[]) => void;
};

export function canSaveGameState({
  boardNumber,
  userMadeMove,
  gameHasEnded,
  gridReady,
  devLog,
}: SaveGuardDeps){
  // CRITICAL FIX: Don't save game state if game has ended
  if (gameHasEnded) {
    devLog('💾 Game has ended, skipping save');
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
