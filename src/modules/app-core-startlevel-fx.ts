type StartLevelFxDeps = {
  resetGlobalFxLayer: (reason: string) => void;
  cleanupFxForBoardReset: (reason: string) => void;
  softResetBoardView: (reason: string) => void;
  devLog: (...args: any[]) => void;
};

export function runStartLevelFxPrep({
  resetGlobalFxLayer,
  cleanupFxForBoardReset,
  softResetBoardView,
  devLog,
}: StartLevelFxDeps){
  // Reset global FX layer to avoid stale transforms/masks between boards
  resetGlobalFxLayer('startLevel');
  // Avoid double FX cleanup if endgame-flow just cleaned up
  const lastFxCleanup = (window as any).__ccLastFxCleanupAt || 0;
  const recentlyCleaned = (Date.now() - lastFxCleanup) < 1000;
  if (!recentlyCleaned) {
    cleanupFxForBoardReset('startLevel');
  } else {
    devLog('⏭️ startLevel: Skipping cleanupFxForBoardReset (recently cleaned in endgame-flow)');
  }
  softResetBoardView('startLevel');
}
