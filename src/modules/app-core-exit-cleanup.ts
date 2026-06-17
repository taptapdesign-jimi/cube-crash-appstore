type ExitCleanupDeps = {
  HUD: { cleanupSmokeBubbles?: () => void };
  backgroundLayer: any | null;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function cleanupBeforeBoardExit({
  HUD,
  backgroundLayer,
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
  } catch {
    // Silently ignore errors
  }
}
