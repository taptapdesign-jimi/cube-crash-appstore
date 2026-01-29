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
  
  // CRITICAL: Hide ghost placeholders before exit animation
  try {
    if (backgroundLayer) {
      backgroundLayer.visible = false;
    }
    // Also hide if stored in window._ghostPlaceholders
    if (window._ghostPlaceholders && Array.isArray(window._ghostPlaceholders)) {
      window._ghostPlaceholders.forEach((row: any[]) => {
        row.forEach((ghost: any) => {
          if (ghost && typeof ghost.visible !== 'undefined') {
            ghost.visible = false;
          }
        });
      });
    }
  } catch {
    // Silently ignore errors
  }
}
