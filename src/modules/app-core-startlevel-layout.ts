type StartLevelLayoutDeps = {
  layoutBoard: () => Promise<void>;
  initializeBackgroundLayer: () => void;
  board: any;
  backgroundLayer: any | null;
  setBackgroundLayer: (v: any) => void;
  updateGhostVisibility: () => void;
  devError: (...args: any[]) => void;
};

export function ensureStartLevelLayout({
  layoutBoard,
  initializeBackgroundLayer,
  board,
  backgroundLayer,
  setBackgroundLayer,
  updateGhostVisibility,
  devError,
}: StartLevelLayoutDeps){
  // Ensure layout and background layer are initialized once per startLevel
  layoutBoard().catch(err => {
    devError('❌ Error in layoutBoard() during startGame:', err);
  });
  let layer = backgroundLayer;
  if (!layer) {
    initializeBackgroundLayer();
    layer = backgroundLayer;
  }
  if (layer) {
    layer.visible = true;
    layer.zIndex = -10000;
    try {
      if (board && board.children.includes(layer)) {
        board.removeChild(layer);
      }
      if (board) {
        board.addChildAt(layer, 0);
        board.sortChildren();
      }
    } catch {}
  }
  setBackgroundLayer(layer);
  try { updateGhostVisibility(); } catch {}
}
