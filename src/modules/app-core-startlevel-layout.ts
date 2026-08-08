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

export async function ensureStartLevelLayout({
  layoutBoard,
  initializeBackgroundLayer,
  board,
  backgroundLayer,
  setBackgroundLayer,
  updateGhostVisibility,
  hideGhostPlaceholders,
  devError,
}: StartLevelLayoutDeps): Promise<void> {
  // Prepare the background/ghost state before layout yields. A slow iOS layout
  // may outlive sweetPopIn; hiding ghosts only after that await would erase the
  // correct placeholders that pop-in completion just revealed.
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
  try { hideGhostPlaceholders(); } catch {}
  try {
    await layoutBoard();
  } catch (err) {
    devError('❌ Error in layoutBoard() during startGame:', err);
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
  if ((window as any).__ccEnterAnimationActive === true) {
    try { hideGhostPlaceholders(); } catch {}
  } else {
    // Pop-in completed while layout was pending; restore the authoritative
    // empty-cell placeholder state instead of hiding it permanently.
    try { updateGhostVisibility(); } catch {}
  }
}
