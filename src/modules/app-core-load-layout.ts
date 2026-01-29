type LoadLayoutDeps = {
  layoutBoard: () => Promise<void>;
  StarsCollector: { setStarsCount?: (n: number) => void };
  HUD: { setStarsCount?: (n: number) => void };
  savedStarsCount: number;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export async function layoutAndRestoreStars({
  layoutBoard,
  StarsCollector,
  HUD,
  savedStarsCount,
  devLog,
  devWarn,
}: LoadLayoutDeps){
  // Call layout to position HUD correctly (initializes stars collector)
  await layoutBoard();
  devLog('✅ Layout called for saved game - HUD should be positioned');
  
  // Restore stars count AFTER layoutBoard
  try {
    if (typeof StarsCollector.setStarsCount === 'function') {
      StarsCollector.setStarsCount(savedStarsCount);
      devLog('💾 Restored stars count from saved game:', savedStarsCount);
      
      // Also update HUD display immediately after restoring stars count
      if (typeof HUD.setStarsCount === 'function') {
        HUD.setStarsCount(savedStarsCount);
        devLog('💾 Updated HUD star count display:', savedStarsCount);
      }
    } else {
      devWarn('⚠️ StarsCollector.setStarsCount not available, stars count not restored');
    }
  } catch (error) {
    devWarn('⚠️ Failed to restore stars count from saved game:', error);
  }
}
