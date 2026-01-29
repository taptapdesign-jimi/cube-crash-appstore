type SelectExitTilesDeps = {
  STATE: { tiles?: any[] } | null;
  tiles: any[];
  windowTiles: any[];
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  HUD: { playHudRise?: (opts?: any) => void };
  waitTracked: (ms: number) => Promise<void>;
};

export async function selectTilesForExit({
  STATE,
  tiles,
  windowTiles,
  devLog,
  devWarn,
  HUD,
  waitTracked,
}: SelectExitTilesDeps){
  const tilesToAnimate = STATE?.tiles || [];
  const moduleTiles = tiles || [];
  const winTiles = windowTiles || [];
  
  devLog('🔍 Board exit: Tile sources:', {
    'STATE.tiles': tilesToAnimate.length,
    'module tiles': moduleTiles.length,
    'window.STATE.tiles': winTiles.length,
    'tilesToAnimate valid': tilesToAnimate.filter((t: any) => t && !t.destroyed).length
  });
  
  const effectiveTiles = tilesToAnimate.length > 0 ? tilesToAnimate :
    (moduleTiles.length > 0 ? moduleTiles : winTiles);
  
  devLog('🎯 Board exit: Using', effectiveTiles.length, 'tiles for animation');
  
  if (effectiveTiles.length === 0) {
    devWarn('⚠️ No tiles to animate - skipping tile exit animation');
    devWarn('⚠️ DEBUG: STATE =', STATE);
    devWarn('⚠️ DEBUG: tiles module var =', tiles);
    // Still trigger HUD exit even if no tiles
    try { 
      HUD.playHudRise?.({}); 
      devLog('✅ HUD exit animation started (no tiles)');
    } catch (e) {
      devWarn('⚠️ Failed to call HUD.playHudRise:', e);
    }
    // 🔥 CRITICAL FIX: Even with no tiles, wait for HUD animation to be visible
    await waitTracked(400);
    return { effectiveTiles: [], skip: true };
  }
  
  return { effectiveTiles, skip: false };
}
