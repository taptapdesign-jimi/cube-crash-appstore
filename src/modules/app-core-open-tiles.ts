type OpenRandomTilesDeps = {
  ROWS: number;
  COLS: number;
  grid: any[][];
  makeBoard: {
    setValue: (tile: any, value: number, delay?: number) => void;
    syncTileZIndex?: (tile: any, board?: any, animating?: boolean) => void;
  };
  fixHoverAnchor: (tile: any) => void;
  drag?: { bindToTile?: (tile: any) => void } | null;
  randVal: () => number;
};

export function openRandomTiles({
  ROWS,
  COLS,
  grid,
  makeBoard,
  fixHoverAnchor,
  drag,
  randVal,
}: OpenRandomTilesDeps){
  const total = COLS * ROWS;
  const openN = Math.max(1, Math.round(total * 0.30));
  const ids = [...Array(total).keys()];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  ids.slice(0, openN).forEach((idx) => {
    const r = (idx / COLS) | 0;
    const c = idx % COLS;
    const t = grid[r][c];
    fixHoverAnchor(t);
    t.locked = false;
    makeBoard.syncTileZIndex?.(t, t?.parent);
    t.eventMode = 'static';
    t.cursor = 'pointer';
    if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
    makeBoard.setValue(t, t.value || randVal(), 0);
  });
  return { total, openN, tilesOpened: openN };
}
