type StopTileBounceDeps = {
  TILE_IDLE_BOUNCE: any;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function stopTileIdleBounce({ TILE_IDLE_BOUNCE, devLog, devWarn }: StopTileBounceDeps){
  // 🔥 CRITICAL: Stop tile idle bounce before rebuild
  try {
    if (TILE_IDLE_BOUNCE && typeof TILE_IDLE_BOUNCE.stop === 'function') {
      TILE_IDLE_BOUNCE.stop();
      devLog('✅ rebuildBoard: Tile idle bounce stopped');
    }
  } catch (e) {
    devWarn('⚠️ rebuildBoard: Error stopping tile idle bounce:', e);
  }
}
