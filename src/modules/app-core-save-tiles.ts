type SaveTilesDeps = {
  ROWS: number;
  COLS: number;
  tiles: any[];
  grid: any[][];
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function buildGridSnapshot({
  ROWS,
  COLS,
  tiles,
  grid,
  devLog,
  devWarn,
}: SaveTilesDeps){
  // 🔥 CRITICAL FIX: Save all tiles from tiles array, not just from grid
  const gridSnapshot = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const savedTiles: Array<{ snapshot: any; gridX: number; gridY: number }> = [];
  
  // First, save all tiles from tiles array (both active and locked tiles)
  tiles.forEach((tile) => {
    if (!tile || tile.destroyed) {
      return; // Skip destroyed tiles only
    }
    
    // Only skip tiles with invalid value (null, undefined, NaN, negative)
    // Allow value 0 for locked/empty tiles
    const tileValue = tile.value;
    if (tileValue === null || tileValue === undefined || !Number.isFinite(tileValue) || tileValue < 0) {
      return; // Skip tiles with invalid value
    }
    
    const gridX = Number.isFinite(tile.gridX) ? (tile.gridX | 0) : -1;
    const gridY = Number.isFinite(tile.gridY) ? (tile.gridY | 0) : -1;
    
    // Validate grid position
    if (gridX < 0 || gridX >= COLS || gridY < 0 || gridY >= ROWS) {
      devWarn('⚠️ Tile has invalid grid position:', { gridX, gridY, value: tile.value, special: tile.special, locked: tile.locked });
      return;
    }
    
    const tileSnapshot = {
      value: Number.isFinite(tileValue) ? tileValue : 0,
      special: tile.special || null,
      locked: !!tile.locked,
      open: !tile.locked,
      isWild: !!tile.isWild,
      isWildFace: !!tile.isWildFace,
      gridX: gridX,
      gridY: gridY,
    };
    
    savedTiles.push({ snapshot: tileSnapshot, gridX, gridY });
    
    // Also place in grid snapshot at correct position
    if (gridSnapshot[gridY] && gridSnapshot[gridY][gridX] === null) {
      gridSnapshot[gridY][gridX] = tileSnapshot;
    } else if (gridSnapshot[gridY] && gridSnapshot[gridY][gridX] !== null) {
      devWarn('⚠️ Grid position already occupied - overwriting:', { gridX, gridY, existing: gridSnapshot[gridY][gridX], new: tileSnapshot });
      gridSnapshot[gridY][gridX] = tileSnapshot; // Overwrite to ensure latest tile is saved
    }
  });
  
  // 🔥 ADDITIONAL FIX: Also check grid array for any tiles that might not be in tiles array
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const gridTile = grid[r]?.[c];
      if (!gridTile || gridTile.destroyed) continue;
      
      // Check if this tile is already saved
      const alreadySaved = savedTiles.some(st => st.gridX === c && st.gridY === r);
      if (alreadySaved) continue;
      
      // Check if tile has valid value
      const tileValue = gridTile.value;
      if (tileValue === null || tileValue === undefined || !Number.isFinite(tileValue) || tileValue < 0) {
        continue;
      }
      
      // Save tile from grid
      const tileSnapshot = {
        value: Number.isFinite(tileValue) ? tileValue : 0,
        special: gridTile.special || null,
        locked: !!gridTile.locked,
        open: !gridTile.locked,
        isWild: !!gridTile.isWild,
        isWildFace: !!gridTile.isWildFace,
        gridX: c,
        gridY: r,
      };
      
      savedTiles.push({ snapshot: tileSnapshot, gridX: c, gridY: r });
      if (gridSnapshot[r] && gridSnapshot[r][c] === null) {
        gridSnapshot[r][c] = tileSnapshot;
      } else if (gridSnapshot[r] && gridSnapshot[r][c] !== null) {
        devWarn('⚠️ Grid tile already saved - overwriting:', { gridX: c, gridY: r, existing: gridSnapshot[r][c], new: tileSnapshot });
        gridSnapshot[r][c] = tileSnapshot;
      }
    }
  }
  
  devLog('💾 Saved', savedTiles.length, 'tiles total (from tiles array + grid check)');
  return { gridSnapshot, savedTilesCount: savedTiles.length };
}
