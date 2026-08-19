type ExitCleanupDeps = {
  HUD: { cleanupSmokeBubbles?: () => void };
  backgroundLayer: any | null;
  finalResidualAlreadyPopped?: boolean;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function cleanupBeforeBoardExit({
  HUD,
  backgroundLayer,
  finalResidualAlreadyPopped = false,
  devLog,
  devWarn,
}: ExitCleanupDeps){
  // CRITICAL: Cleanup smoke bubbles immediately before exit animation
  try {
    if (typeof HUD.cleanupSmokeBubbles === 'function') {
      HUD.cleanupSmokeBubbles();
      devLog('✅ Board exit: Smoke bubbles cleaned up');
    }
  } catch (e) {
    devWarn('⚠️ Board exit: Error cleaning up smoke bubbles:', e);
  }
  // A successful final handoff already animated and retired the ghost grid. Never
  // resurrect it for a later generic board-exit owner (for example immediately
  // before the completion/thumbs-up surface).
  if (finalResidualAlreadyPopped) {
    try {
      if (backgroundLayer) backgroundLayer.visible = false;
      window._ghostPlaceholders?.forEach?.((row: any[]) => {
        row?.forEach?.((ghost: any) => { if (ghost) ghost.visible = false; });
      });
      devLog('👻 Board exit preserved retired final ghost layer');
    } catch {}
    return;
  }

  // Keep ghost placeholders visible for the board exit animation. They used to be hidden
  // here, which made no-moves boards visually collapse before the exit could play.
  try {
    if (backgroundLayer) {
      backgroundLayer.visible = true;
    }
    if (window._ghostPlaceholders && Array.isArray(window._ghostPlaceholders)) {
      window._ghostPlaceholders.forEach((row: any[]) => {
        row.forEach((ghost: any) => {
          if (ghost && typeof ghost.visible !== 'undefined') {
            ghost.visible = true;
          }
        });
      });
    }
    try { (window as any).hideGhostsUnderLockedTiles?.('board-exit-cleanup'); } catch {}
  } catch {
    // Silently ignore errors
  }
}
