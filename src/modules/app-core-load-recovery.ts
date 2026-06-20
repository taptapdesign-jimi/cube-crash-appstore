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

export type PostLoadRecoveryDecision =
  | { type: 'recovered_stuck' }
  | { type: 'run_endgame_check' };

export function createPostLoadRecoveryTileInfos(tiles: any[]) {
  return tiles
    .filter(t => t && !t.destroyed)
    .map(t => ({
      value: t.value || 0,
      locked: !!t.locked,
      destroyed: !!t.destroyed,
      special: t.special || undefined,
      gridX: t.gridX,
      gridY: t.gridY,
    }));
}

export function resolvePostLoadRecoveryDecision(recoveryResult: { wasStuck?: boolean } | null | undefined): PostLoadRecoveryDecision {
  if (recoveryResult?.wasStuck) {
    return { type: 'recovered_stuck' };
  }
  return { type: 'run_endgame_check' };
}

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
      const tileInfos = createPostLoadRecoveryTileInfos(tiles);

      const currentBoardNum = Number.isFinite(boardNumber) ? boardNumber : 1;

      const recoveryResult = await checkAndRecoverBoard(
        tileInfos,
        currentBoardNum,
        triggerCleanBoardFlow
      );

      const decision = resolvePostLoadRecoveryDecision(recoveryResult);
      if (decision.type === 'recovered_stuck') {
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
