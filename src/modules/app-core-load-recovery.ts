type LoadRecoveryDeps = {
  tiles: any[];
  boardNumber: number;
  checkAndRecoverBoard: (tileInfos: any[], boardNumber: number, triggerCleanBoardFlow: any) => Promise<{ wasStuck: boolean }>;
  triggerCleanBoardFlow: any;
  checkLevelEnd?: () => void;
  trackAppTimeout: (fn: () => void, ms: number) => any;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function schedulePostLoadRecoveryCheck({
  tiles,
  boardNumber,
  checkAndRecoverBoard,
  triggerCleanBoardFlow,
  checkLevelEnd,
  trackAppTimeout,
  devLog,
  devWarn,
}: LoadRecoveryDeps){
  trackAppTimeout(async () => {
    try {
      const tileInfos = tiles
        .filter(t => t && !t.destroyed)
        .map(t => ({
          value: t.value || 0,
          locked: !!t.locked,
          destroyed: !!t.destroyed,
          special: t.special || undefined,
          gridX: t.gridX,
          gridY: t.gridY,
        }));

      const currentBoardNum = Number.isFinite(boardNumber) ? boardNumber : 1;

      const recoveryResult = await checkAndRecoverBoard(
        tileInfos,
        currentBoardNum,
        triggerCleanBoardFlow
      );

      if (recoveryResult.wasStuck) {
        devLog('🚨 BOARD RECOVERY EXECUTED:', recoveryResult);
        return;
      }

      if (typeof checkLevelEnd === 'function') {
        devLog('🔍 Post-load endgame check scheduled - validating restored board for no-moves state');
        checkLevelEnd();
      }
    } catch (e) {
      devWarn('⚠️ Board recovery check failed (non-fatal):', e);
      if (typeof checkLevelEnd === 'function') {
        try {
          devLog('🔍 Post-load endgame fallback check scheduled after recovery error');
          checkLevelEnd();
        } catch (checkError) {
          devWarn('⚠️ Post-load endgame fallback check failed:', checkError);
        }
      }
    }
  }, 1300);
}
