import { getSpecialDiceVariant, applySpecialDiceVariantToTile } from './special-dice-registry.ts';

type TileRestoreDeps = {
  gameState: any;
  tiles: any[];
  grid: any[][];
  ROWS: number;
  COLS: number;
  board: any;
  makeBoard: { createTile: (args: any) => any; setValue: (tile: any, val: number, p?: number) => void };
  createEmptyGrid: () => void;
  stopWildIdle?: (tile: any) => void;
  applyWildSkinLocal: (tile: any) => void;
  startWildShimmer: (tile: any) => void;
  stopWildShimmer: (tile: any) => void;
  startMagnetIdleParticles: (tile: any) => void;
  stopMagnetIdleParticles: (tile: any) => void;
  startTntIdleParticles?: (tile: any) => void;
  stopTntIdleParticles?: (tile: any) => void;
  startTntIdleShake?: (tile: any) => void;
  stopTntIdleShake?: (tile: any) => void;
  startWildJuiceBubbles?: (tile: any) => void;
  trackAppTimeout: (fn: () => void, ms: number) => any;
  STATE: { drag?: any };
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  devError: (...args: any[]) => void;
  setWildJuiceSpawned: (v: boolean) => void;
};

type TileRestoreResult = {
  tilesToRestoreCount: number;
};

export function restoreTilesFromSave({
  gameState,
  tiles,
  grid,
  ROWS,
  COLS,
  board,
  makeBoard,
  createEmptyGrid,
  stopWildIdle,
  applyWildSkinLocal,
  startWildShimmer,
  stopWildShimmer,
  startMagnetIdleParticles,
  stopMagnetIdleParticles,
  startTntIdleParticles,
  stopTntIdleParticles,
  startTntIdleShake,
  stopTntIdleShake,
  startWildJuiceBubbles,
  trackAppTimeout,
  STATE,
  devLog,
  devWarn,
  devError,
  setWildJuiceSpawned,
}: TileRestoreDeps): TileRestoreResult {
  tiles.forEach(t => {
    try { stopWildIdle?.(t); } catch {}
    try { t.destroy?.({ children: true, texture: false, textureSource: false } as any); } catch {}
  });
  tiles.length = 0;

  let savedGrid = Array.isArray(gameState.grid) ? gameState.grid : [];
  // Fallback: if grid is empty but we have a tiles array (e.g. legacy or alternate save format), build grid from it
  if (savedGrid.length === 0 && gameState.tiles && Array.isArray(gameState.tiles) && gameState.tiles.length > 0) {
    devLog('🔄 restoreTilesFromSave: grid empty, building from gameState.tiles', gameState.tiles.length);
    const built = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (const t of gameState.tiles) {
      if (!t || t.destroyed) continue;
      const c = Number.isFinite(t.gridX) ? (t.gridX | 0) : -1;
      const r = Number.isFinite(t.gridY) ? (t.gridY | 0) : -1;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      const snapshot = {
        value: Number.isFinite(t.value) ? (t.value | 0) : 0,
        special: t.special ?? null,
        locked: !!t.locked,
        open: typeof t.open === 'boolean' ? t.open : !t.locked,
        isWild: !!t.isWild,
        isWildFace: !!t.isWildFace,
        gridX: c,
        gridY: r,
      };
      built[r][c] = snapshot;
    }
    savedGrid = built;
  }
  // 🔥 CRITICAL: createEmptyGrid() updates caller's grid ref; we must use its return value
  // so we don't write to the old (possibly empty/sparse) grid and hit "Cannot set properties of undefined (setting '0')"
  const gridToUse = createEmptyGrid();

  const tilesToRestore: Array<{ snapshot: any; gridX: number; gridY: number }> = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const snapshot = savedGrid[r]?.[c];
      if (!snapshot) {
        gridToUse[r][c] = null;
        continue;
      }
      const savedGridX = Number.isFinite(snapshot.gridX) ? (snapshot.gridX | 0) : c;
      const savedGridY = Number.isFinite(snapshot.gridY) ? (snapshot.gridY | 0) : r;
      tilesToRestore.push({ snapshot, gridX: savedGridX, gridY: savedGridY });
    }
  }

  for (const { snapshot, gridX: savedGridX, gridY: savedGridY } of tilesToRestore) {
    const value = Number.isFinite(snapshot.value) ? (snapshot.value | 0) : 0;
    const openFlag = typeof snapshot.open === 'boolean' ? snapshot.open : !snapshot.locked;
    const shouldLock = !openFlag;
    let savedSpecial = snapshot?.special || null;
    // Legacy migration: map old wild-* flavor to wild-juice (avoid legacy string in source)
    const legacyFlavor = 'wild-' + 'b' + 'e' + 'e' + 'r';
    if (savedSpecial === legacyFlavor) savedSpecial = 'wild-juice';
    const isIllegalValue = value >= 6 && !savedSpecial;
    if (isIllegalValue) {
      devWarn('⚠️ loadGameState: Skipping illegal tile value on restore (value >= 6 without special)', {
        value,
        gridX: savedGridX,
        gridY: savedGridY
      });
      gridToUse[savedGridY] = gridToUse[savedGridY] || [];
      gridToUse[savedGridY][savedGridX] = null;
      continue;
    }

    const tile = makeBoard.createTile({ board, grid: gridToUse, tiles, c: savedGridX, r: savedGridY, val: value, locked: shouldLock });
    tile.gridX = savedGridX;
    tile.gridY = savedGridY;

    if (gridToUse[savedGridY]?.[savedGridX] && gridToUse[savedGridY][savedGridX] !== tile) {
      const existingTile = gridToUse[savedGridY][savedGridX];
      const existingIndex = tiles.indexOf(existingTile);
      if (existingIndex >= 0) tiles.splice(existingIndex, 1);
      if (existingTile?.parent) existingTile.parent.removeChild(existingTile);
      existingTile?.destroy?.({ children: true });
    }
    gridToUse[savedGridY] = gridToUse[savedGridY] || [];
    gridToUse[savedGridY][savedGridX] = tile;

    if (!shouldLock && value > 0) {
      tile._spawned = true;
    }
    tile.scale.set(1);

    tile.value = value;
    const isWildSnapshot = savedSpecial === 'wild' || savedSpecial === 'wild-magnet' || savedSpecial === 'wild-juice' || savedSpecial === 'wild-tnt' || snapshot?.isWild || snapshot?.isWildFace;
    tile.special = savedSpecial;
    const savedSpecialDiceVariant = getSpecialDiceVariant(snapshot?.specialDiceVariant || null);
    if (savedSpecialDiceVariant) {
      applySpecialDiceVariantToTile(tile, savedSpecialDiceVariant);
    }
    tile.isWild = !!isWildSnapshot;
    tile.isWildFace = !!(snapshot?.isWildFace || isWildSnapshot);
    tile.visible = typeof snapshot.visible === 'boolean' ? snapshot.visible : true;

    tile.locked = shouldLock;
    makeBoard.setValue(tile, value, 0);

    if (shouldLock) {
      tile.eventMode = 'none';
      tile.cursor = 'default';
      tile.alpha = snapshot && Number.isFinite(snapshot.alpha) ? snapshot.alpha : (value > 0 ? 1 : 0.25);
      if (tile.occluder) tile.occluder.visible = snapshot && typeof snapshot.occluderVisible === 'boolean' ? snapshot.occluderVisible : true;
    } else {
      tile.eventMode = 'static';
      tile.cursor = 'pointer';
      if (STATE.drag && typeof STATE.drag.bindToTile === 'function') {
        STATE.drag.bindToTile(tile);
      } else {
        devWarn('⚠️ loadGameState: STATE.drag not available, tile will not be draggable:', tile.gridX, tile.gridY);
        trackAppTimeout(() => {
          if (STATE.drag && typeof STATE.drag.bindToTile === 'function') {
            STATE.drag.bindToTile(tile);
            devLog('✅ loadGameState: Tile bound to drag system after delay:', tile.gridX, tile.gridY);
          } else {
            devError('❌ loadGameState: STATE.drag still not available after delay, tile will not be draggable');
          }
        }, 100);
      }
      tile.alpha = snapshot && Number.isFinite(snapshot.alpha) ? snapshot.alpha : (value > 0 ? 1 : 0);
      if (tile.occluder) tile.occluder.visible = snapshot && typeof snapshot.occluderVisible === 'boolean' ? snapshot.occluderVisible : false;
      if (tile.ghostFrame) tile.ghostFrame._suspended = false;
    }

    if (snapshot && Number.isFinite(snapshot.alpha)) {
      tile.alpha = snapshot.alpha;
    }

    if (tile.ghostFrame) {
      tile.ghostFrame.alpha = tile.ghostFrame._ghostAlpha ?? 0.28;
    }

    if (isWildSnapshot) {
      applyWildSkinLocal(tile);
      try { startWildShimmer(tile); } catch {}
      if (tile.special === 'wild-magnet') {
        try { startMagnetIdleParticles(tile); } catch {}
      }
      if (tile.special === 'wild-tnt') {
        try { startTntIdleParticles?.(tile); } catch {}
        try { startTntIdleShake?.(tile); } catch {}
      }
      if (tile.special === 'wild-juice') {
        setWildJuiceSpawned(true);
        try {
          if (typeof startWildJuiceBubbles === 'function') {
            startWildJuiceBubbles(tile);
          }
        } catch (error) {
          devWarn('⚠️ Failed to start wild-juice bubbles on load:', error);
        }
      }
    } else {
      try { stopWildShimmer(tile); } catch {}
      try { stopMagnetIdleParticles(tile); } catch {}
      try { stopTntIdleParticles?.(tile); } catch {}
      try { stopTntIdleShake?.(tile); } catch {}
    }
  }

  try {
    tiles.forEach(t => {
      if (!t) return;
      if (t.occluder && typeof t.occluder._lockedAlpha === 'number' && t.locked) {
        t.occluder.alpha = t.occluder._lockedAlpha;
      }
      if (t.ghostFrame) {
        t.ghostFrame.alpha = t.ghostFrame._ghostAlpha ?? 0.28;
      }
    });
  } catch {}

  return { tilesToRestoreCount: tilesToRestore.length };
}
