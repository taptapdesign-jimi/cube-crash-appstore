type StartLevelLayoutDeps = {
  layoutBoard: () => Promise<void>;
  initializeBackgroundLayer: () => void;
  board: any;
  backgroundLayer: any | null;
  setBackgroundLayer: (v: any) => void;
  updateGhostVisibility: () => void;
  hideGhostPlaceholders: () => void;
  devError: (...args: any[]) => void;
};

export function ensureStartLevelLayout({
  layoutBoard,
  initializeBackgroundLayer,
  board,
  backgroundLayer,
  setBackgroundLayer,
  updateGhostVisibility,
  hideGhostPlaceholders,
  devError,
}: StartLevelLayoutDeps){
  // Ensure layout and background layer are initialized once per startLevel
  layoutBoard().catch(err => {
    devError('❌ Error in layoutBoard() during startGame:', err);
  });
  let layer = backgroundLayer;
  if (!layer) {
    initializeBackgroundLayer();
    try { hideGhostPlaceholders(); } catch {}
    try {
      layer = board?.children?.find?.((c: any) => c && c.label === 'BackgroundLayer') ?? null;
    } catch {
      layer = null;
    }
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
  // Do NOT call updateGhostVisibility here — it would show ghosts for one frame before hide.
  // Just hide ghosts; they will be shown correctly at the end of enter animation (sweetPopIn/playLoadPopIn).
  try { hideGhostPlaceholders(); } catch {}
}
