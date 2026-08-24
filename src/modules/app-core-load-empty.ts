import { tileIsActive } from './endgame-checker.ts';

type EmptyLoadDeps = {
  tiles: any[];
  boardNumber: number;
  getPendingCleanBoard: (boardNumber: number) => { pending: boolean };
  clearPendingCleanBoard: () => void;
  getBoardSaveKey: (boardNumber: number) => string;
  triggerCleanBoardFlow: (...args: any[]) => any;
  runFailFlow?: (options: { reason: string; waitMs?: number; resetHint?: boolean; exitTimeoutMs?: number; persistStuckState?: boolean }) => any;
  showFinalScreen?: (options?: { confirmedFailFlow?: boolean }) => any;
  clearLoadedTiles?: () => void;
  trackAppTimeout: (fn: () => void, ms: number) => any;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function handleEmptyLoadState({
  tiles,
  boardNumber,
  getPendingCleanBoard,
  clearPendingCleanBoard,
  getBoardSaveKey,
  runFailFlow,
  showFinalScreen,
  clearLoadedTiles,
  trackAppTimeout,
  devLog,
  devWarn,
}: EmptyLoadDeps): { handled: boolean; nextBoardNumber?: number }{
  const tilesLoaded = tiles.length > 0;
  const hasActiveTiles = tiles.some(t => tileIsActive(t));

  if (tilesLoaded && hasActiveTiles) {
    return { handled: false };
  }

  devWarn('⚠️ loadGameState: No tiles loaded or no active tiles - saved state was invalid/empty');
  devWarn('⚠️ loadGameState: tiles.length =', tiles.length, 'hasActiveTiles =', hasActiveTiles);

  const currentBoardNum = Number.isFinite(boardNumber) ? boardNumber : 1;
  const pendingCheck = getPendingCleanBoard(currentBoardNum);

  const lockedTilesCount = tiles.filter(t => t && !t.destroyed && t.locked).length;
  const totalTilesCount = tiles.filter(t => t && !t.destroyed).length;

  devLog('🔍 RECOVERY CHECK in loadGameState failure path:', {
    pendingCleanBoard: pendingCheck.pending,
    lockedTilesCount,
    totalTilesCount,
    hasActiveTiles,
    tilesLoaded,
    boardNumber: currentBoardNum,
  });

  const isWinRecovery = pendingCheck.pending;
  const isFailRecovery = !pendingCheck.pending && tilesLoaded && !hasActiveTiles;
  const shouldRecover = isWinRecovery || isFailRecovery;

  if (!shouldRecover) {
    try { localStorage.removeItem('cc_saved_game'); } catch {}
    return { handled: true };
  }

  devLog('🚨🚨🚨 STUCK STATE DETECTED in loadGameState - recovering!', {
    recoveryType: isWinRecovery ? 'WIN (clean board)' : 'FAIL (stuck)',
    currentBoard: currentBoardNum,
  });

  const saveKey = getBoardSaveKey(currentBoardNum);
  try { localStorage.removeItem(saveKey); } catch {}
  try { localStorage.removeItem('cc_saved_game'); } catch {}

  clearPendingCleanBoard();
  try { clearLoadedTiles?.(); } catch {}
  tiles.length = 0;

  if (isWinRecovery) {
    devLog('🏆 WIN RECOVERY: User completed board', currentBoardNum, '- advancing to next');

    try {
      const journeyKey = 'cc_journey_progress';
      const journeyData = localStorage.getItem(journeyKey);
      if (journeyData) {
        const journey = JSON.parse(journeyData);
        if (!journey.completedBoards) journey.completedBoards = [];
        if (!journey.completedBoards.includes(currentBoardNum)) {
          journey.completedBoards.push(currentBoardNum);
          if (!journey.highestBoard || currentBoardNum >= journey.highestBoard) {
            journey.highestBoard = currentBoardNum + 1;
          }
          localStorage.setItem(journeyKey, JSON.stringify(journey));
          devLog('✅ WIN RECOVERY: Marked board', currentBoardNum, 'as completed in journey');
        }
      }
    } catch (e) {
      devWarn('⚠️ WIN RECOVERY: Failed to update journey state:', e);
    }

    devLog('🚨 WIN RECOVERY: Advancing to board', currentBoardNum + 1);
    return { handled: true, nextBoardNumber: currentBoardNum + 1 };
  }

  devLog('💀 FAIL RECOVERY: User was stuck on board', currentBoardNum, '- restarting same board');

  const fromInterimBoard = (window as any).__ccFromInterimBoard === true ||
    (window as any).__ccIsInterimBoard === true ||
    localStorage.getItem('__ccFromInterimBoard') === 'true';

  if (fromInterimBoard) {
    devLog('🔄 FAIL RECOVERY: User is resuming from interim board - rebuilding board fresh (no fail screen)');
    (window as any).__ccFromInterimBoard = false;
    (window as any).__ccIsInterimBoard = false;
    try { localStorage.removeItem('__ccFromInterimBoard'); } catch {}
  } else {
    trackAppTimeout(() => {
      try {
        devLog('💀 FAIL RECOVERY: Showing fail screen for board', currentBoardNum);
        if (typeof runFailFlow === 'function') {
          runFailFlow({
            reason: 'load_empty_stuck_recovery',
            waitMs: 0,
            resetHint: false,
            exitTimeoutMs: 500,
          });
        } else if (typeof showFinalScreen === 'function') {
          showFinalScreen({ confirmedFailFlow: true });
        } else if (typeof (window as any).showFinalScreen === 'function') {
          (window as any).showFinalScreen({ confirmedFailFlow: true });
        } else if (typeof (window as any).showEndRunModal === 'function') {
          (window as any).showEndRunModal();
        }
      } catch (e) {
        devWarn('⚠️ FAIL RECOVERY: Could not show fail screen:', e);
      }
    }, 1000);
  }

  devLog('🚨 FAIL RECOVERY: Restarting board', currentBoardNum);
  return { handled: true };
}
