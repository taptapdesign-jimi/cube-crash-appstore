type LoadDragDeps = {
  STATE: { drag?: any };
  tiles: any[];
  waitTrackedResult: (ms: number) => Promise<'elapsed' | 'cancelled'>;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  devError: (...args: any[]) => void;
};

export async function ensureDragReadyAndRebind({
  STATE,
  tiles,
  waitTrackedResult,
  devLog,
  devWarn,
  devError,
}: LoadDragDeps){
  // Ensure drag system is initialized before proceeding
  if (!STATE.drag) {
    devWarn('⚠️ loadGameState: STATE.drag not initialized, waiting for boot to complete...');
    // Wait for drag system to be initialized (max 2 seconds)
    let attempts = 0;
    const maxAttempts = 40; // 40 * 50ms = 2 seconds
    while (!STATE.drag && attempts < maxAttempts) {
      if (await waitTrackedResult(50) === 'cancelled') return false;
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
    if (tile && !tile.locked && tile.eventMode === 'static' && STATE.drag && typeof STATE.drag.bindToTile === 'function') {
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
