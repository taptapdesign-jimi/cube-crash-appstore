type LoadLayoutDeps = {
  layoutBoard: () => Promise<void>;
  StarsCollector: { setStarsCount?: (n: number) => void };
  HUD: { setStarsCount?: (n: number) => void };
  savedStarsCount: number;
  isCurrent?: () => boolean;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export async function layoutAndRestoreStars({
  layoutBoard,
  StarsCollector,
  HUD,
  savedStarsCount,
  isCurrent = () => true,
  devLog,
  devWarn,
}: LoadLayoutDeps){
  // Call layout to position HUD correctly (initializes stars collector)
  if (!isCurrent()) return;
  await layoutBoard();
  if (!isCurrent()) return;
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
