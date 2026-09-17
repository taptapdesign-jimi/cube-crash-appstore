type LoadDragDeps = {
  STATE: { drag?: any };
  tiles: any[];
  waitTrackedResult: (ms: number) => Promise<'elapsed' | 'cancelled'>;
  isCurrent?: () => boolean;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  devError: (...args: any[]) => void;
};

export async function ensureDragReadyAndRebind({
  STATE,
  tiles,
  waitTrackedResult,
  isCurrent = () => true,
  devLog,
  devWarn,
  devError,
}: LoadDragDeps){
  if (!isCurrent()) return false;
  // Ensure drag system is initialized before proceeding
  if (!STATE.drag) {
    devWarn('⚠️ loadGameState: STATE.drag not initialized, waiting for boot to complete...');
    // Wait for drag system to be initialized (max 2 seconds)
    let attempts = 0;
    const maxAttempts = 40; // 40 * 50ms = 2 seconds
    while (!STATE.drag && attempts < maxAttempts) {
      if (await waitTrackedResult(50) === 'cancelled' || !isCurrent()) return false;
      attempts++;
    }
    if (!STATE.drag) {
      devError('❌ loadGameState: STATE.drag still not initialized after waiting, tiles may not be draggable');
    } else {
      devLog('✅ loadGameState: STATE.drag initialized after', attempts * 50, 'ms');
    }
  }
  
  // Re-bind all unlocked tiles to drag system
  tiles.forEach(tile => {
    if (isCurrent() && tile && !tile.destroyed && !tile.locked && tile.eventMode === 'static' && STATE.drag && typeof STATE.drag.bindToTile === 'function') {
      try {
        STATE.drag.bindToTile(tile);
      } catch (e) {
        devWarn('⚠️ loadGameState: Failed to bind tile to drag system:', e);
      }
    }
  });
  devLog('✅ loadGameState: Re-bound all unlocked tiles to drag system');
  return true;
}
