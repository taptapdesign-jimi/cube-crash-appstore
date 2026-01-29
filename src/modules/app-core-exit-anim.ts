type ExitAnimDeps = {
  tiles: any[];
  sweetPopOut: (tiles: any[], opts?: any) => Promise<any>;
  waitTracked: (ms: number) => Promise<void>;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export async function runExitAnimation({
  tiles,
  sweetPopOut,
  waitTracked,
  devLog,
  devWarn,
}: ExitAnimDeps){
  // 🔥 CRITICAL FIX: Filter out destroyed/invalid tiles before animation
  const validTiles = tiles.filter((t: any) => t && !t.destroyed && t.scale && typeof t.alpha !== 'undefined');
  devLog('🎯 Board exit: Valid tiles for animation:', validTiles.length, 'of', tiles.length);
  
  if (validTiles.length === 0) {
    devWarn('⚠️ All tiles are destroyed/invalid - skipping sweetPopOut');
    // Wait for HUD animation to complete
    await waitTracked(400);
    return;
  }
  
  // Play sweetPopOut (board tiles exit animation)
  // HUD exit already started above, so they run in parallel
  await sweetPopOut(validTiles, {
    // No onHalf callback needed - HUD already started above
  });
  
  // CRITICAL: Wait for the longest animation to complete
  // HUD rise duration: 0.3s (300ms)
  // sweetPopOut max duration: ~0.38-0.55s
  // Wait for the longer of the two (sweetPopOut is usually longer)
  // Add small buffer to ensure both complete
  const maxAnimationTime = Math.max(550, 300); // sweetPopOut max ~550ms, HUD 300ms
  devLog(`⏳ Waiting for exit animations to complete (${maxAnimationTime}ms)...`);
  await waitTracked(maxAnimationTime);
}
