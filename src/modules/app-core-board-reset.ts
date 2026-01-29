type ResetDeps = {
  board: any;
  boardBG: any;
  backgroundLayer: any;
  setBackgroundLayer: (v: any) => void;
  ROWS: number;
  COLS: number;
  initializeBackgroundLayer: () => void;
  updateGhostVisibility: () => void;
  devLog: (...args: unknown[]) => void;
  devWarn: (...args: unknown[]) => void;
  devError: (...args: unknown[]) => void;
};

export function resetBoardContainerHelper(deps: ResetDeps) {
  const {
    board,
    boardBG,
    backgroundLayer,
    setBackgroundLayer,
    ROWS,
    COLS,
    initializeBackgroundLayer,
    updateGhostVisibility,
    devLog,
    devWarn,
    devError,
  } = deps;

  devLog('🔄 resetBoardContainer (app.js): Board children count:', board.children.length);
  devLog('🔄 resetBoardContainer (app.js): Board children labels:', board.children.map((c: any) => c.label || c.constructor.name));

  const bgLayer = board.children.find((c: any) => c.label === 'BackgroundLayer');
  const bgLayerRef = backgroundLayer;
  devLog('🔄 resetBoardContainer (app.js): Found backgroundLayer in board:', !!bgLayer);
  devLog('🔄 resetBoardContainer (app.js): Global backgroundLayer exists:', !!bgLayerRef);

  const isBgLayerDestroyed = bgLayer ? bgLayer.destroyed : (bgLayerRef ? bgLayerRef.destroyed : true);
  devLog('🔄 resetBoardContainer (app.js): Background layer destroyed:', isBgLayerDestroyed);

  board.removeChildren();

  // Re-add persistent layers
  board.addChildAt(boardBG, 0);

  const layerToAdd = (!isBgLayerDestroyed && (bgLayer || bgLayerRef)) ? (bgLayer || bgLayerRef) : null;
  if (layerToAdd && !layerToAdd.destroyed) {
    try {
      board.addChildAt(layerToAdd, 0);
      layerToAdd.visible = true;
      layerToAdd.zIndex = -10000;
      devLog('✅ resetBoardContainer (app.js): Background layer preserved and re-added');
      if (!(window as any)._ghostPlaceholders && backgroundLayer && backgroundLayer.children.length > 0) {
        devLog('🔄 resetBoardContainer (app.js): Reinitializing window._ghostPlaceholders from backgroundLayer children...');
        (window as any)._ghostPlaceholders = [];
        for (let r = 0; r < ROWS; r++) {
          (window as any)._ghostPlaceholders[r] = [];
          for (let c = 0; c < COLS; c++) {
            const ghostLabel = `Ghost_${c}_${r}`;
            const ghost = backgroundLayer.children.find((child: any) => child.label === ghostLabel);
            if (ghost) {
              (window as any)._ghostPlaceholders[r][c] = ghost;
            }
          }
        }
        devLog('✅ resetBoardContainer (app.js): window._ghostPlaceholders reinitialized from backgroundLayer');
      }
    } catch (e) {
      devWarn('⚠️ resetBoardContainer (app.js): Failed to re-add background layer:', e);
      if (bgLayerRef === backgroundLayer) {
        setBackgroundLayer(null);
      }
    }
  } else {
    devWarn('⚠️ resetBoardContainer (app.js): Background layer NOT found or destroyed - will need reinit');
    setBackgroundLayer(null);
    if (!backgroundLayer) {
      devLog('🔄 resetBoardContainer (app.js): Recreating background layer...');
      try {
        initializeBackgroundLayer();
        devLog('✅ resetBoardContainer (app.js): Background layer recreated successfully');
      } catch (e) {
        devError('❌ resetBoardContainer (app.js): Failed to recreate background layer:', e);
      }
    }
  }

  boardBG.zIndex = -1000;
  boardBG.eventMode = 'none';
  board.sortableChildren = true;
  board.sortChildren();

  try {
    if (backgroundLayer) {
      updateGhostVisibility();
    }
  } catch {}

  devLog('🔄 resetBoardContainer (app.js): Final children count:', board.children.length);
  devLog('🔄 resetBoardContainer (app.js): Background layer in board after reset:', !!board.children.find((c: any) => c.label === 'BackgroundLayer'));
}
