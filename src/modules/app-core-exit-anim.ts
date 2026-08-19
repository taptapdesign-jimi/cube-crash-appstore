import { resolveExitWaits } from './exit-transition-waits.js';

type ExitAnimDeps = {
  tiles: any[];
  sweetPopOut: (tiles: any[], opts?: any) => Promise<any>;
  waitTrackedResult: (ms: number) => Promise<'elapsed' | 'cancelled'>;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export async function runExitAnimation({
  tiles,
  sweetPopOut,
  waitTrackedResult,
  devLog,
  devWarn,
}: ExitAnimDeps){
  const waits = resolveExitWaits();
  // 🔥 CRITICAL FIX: Filter out destroyed/invalid tiles before animation
  const validTiles = tiles.filter((t: any) => t && !t.destroyed && t.scale && typeof t.alpha !== 'undefined');
  devLog('🎯 Board exit: Valid tiles for animation:', validTiles.length, 'of', tiles.length);
  
  if (validTiles.length === 0) {
    devWarn('⚠️ All tiles are destroyed/invalid - skipping sweetPopOut');
    // Wait for HUD animation to complete
    return await waitTrackedResult(waits.noTilesFallbackMs) !== 'cancelled';
  }
  
  // Play sweetPopOut (board tiles exit animation)
  // HUD exit already started above, so they run in parallel
  await sweetPopOut(validTiles, {
    // No onHalf callback needed - HUD already started above
  });

  // sweetPopOut resolves on completion; keep only a tiny settle window for render flush.
  return await waitTrackedResult(waits.postPopOutSettleMs) !== 'cancelled';
}
