type StartLevelRebuildDeps = {
  rebuildBoard: () => void;
  logger: { debug: (...args: any[]) => void };
  getSkipRebuildFlag: () => boolean;
};

export function maybeRebuildBoard({
  rebuildBoard,
  logger,
  getSkipRebuildFlag,
}: StartLevelRebuildDeps){
  const skipRebuild = getSkipRebuildFlag();
  if (skipRebuild) {
    logger.debug('🎯 Skipping rebuildBoard() - will load saved state instead', 'app-core');
    // 🔥 CRITICAL FIX: Don't delete __ccSkipRebuildBoard here - let main.ts handle it after loadGameState()
    // This ensures loadGameState() can be called after bootGame() completes
    // window.__ccSkipRebuildBoard will be deleted in main.ts after loadGameState()
  } else {
    // Start animation immediately - no delay
    rebuildBoard();
  }
}
