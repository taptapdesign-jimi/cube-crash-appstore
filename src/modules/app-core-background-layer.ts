type EnsureBackgroundLayerDeps = {
  board: any;
  backgroundLayer: any | null;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function ensureBackgroundLayerVisible({
  board,
  backgroundLayer,
  devLog,
  devWarn,
}: EnsureBackgroundLayerDeps){
  if (backgroundLayer) {
    backgroundLayer.visible = true; // Keep visible - v70 style
    // Ensure it's at the bottom of board children
    try {
      if (board.children.includes(backgroundLayer)) {
        const currentIndex = board.getChildIndex(backgroundLayer);
        if (currentIndex !== 0) {
          board.removeChild(backgroundLayer);
          board.addChildAt(backgroundLayer, 0);
          board.sortChildren();
          devLog('✅ Background layer repositioned to bottom in rebuildBoard()');
        }
      } else {
        // Background layer not in board - add it
        board.addChildAt(backgroundLayer, 0);
        board.sortChildren();
        devLog('✅ Background layer added to board in rebuildBoard()');
      }
    } catch (e) {
      devWarn('⚠️ rebuildBoard: Failed to ensure background layer in board:', e);
    }
    devLog('✅ Background layer ensured in rebuildBoard()');
  } else {
    devWarn('⚠️ rebuildBoard: backgroundLayer is null - will be created in startLevel()');
  }
}
