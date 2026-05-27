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

function isFirstPlayTutorialDemoBoard(): boolean {
  return typeof window !== 'undefined' && (window as any).__ccFirstPlayTutorialActive === true;
}

function firstPlayTutorialDemoCells(COLS: number, ROWS: number): Array<{ c: number; r: number; value: number }> {
  const centerRow = Math.max(0, Math.min(ROWS - 3, Math.floor(ROWS / 2) - 1));
  const lowerRow = Math.max(2, Math.min(ROWS - 1, centerRow + 2));
  const leftCol = Math.max(0, Math.min(COLS - 3, Math.floor(COLS / 2) - 1));
  const rightCol = Math.max(2, Math.min(COLS - 1, leftCol + 2));
  const oneCol = Math.max(0, COLS - 2);
  const oneRow = Math.min(ROWS - 1, 1);
  const desired = [
    { c: leftCol, r: centerRow, value: 3 },
    { c: rightCol, r: lowerRow, value: 2 },
    { c: oneCol, r: oneRow, value: 1 },
    { c: 0, r: 0, value: 2 },
    { c: 1, r: 0, value: 2 },
    { c: 2, r: 0, value: 2 },
    { c: 0, r: 2, value: 2 },
    { c: 1, r: 2, value: 2 },
    { c: 2, r: 2, value: 1 },
    { c: 3, r: 2, value: 1 },
    { c: 0, r: ROWS - 3, value: 2 },
    { c: 1, r: ROWS - 3, value: 2 },
    { c: 2, r: ROWS - 3, value: 2 },
    { c: COLS - 1, r: Math.min(ROWS - 1, 4), value: 2 },
    { c: 0, r: ROWS - 1, value: 2 },
    { c: 1, r: ROWS - 1, value: 2 },
    { c: 2, r: ROWS - 1, value: 1 },
    { c: 3, r: ROWS - 1, value: 1 },
  ];
  const seen = new Set<string>();
  return desired.filter(({ c, r }) => {
    const key = `${c}:${r}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  });
}

function openTile({ grid, makeBoard, fixHoverAnchor, drag, c, r, value }: {
  grid: any[][];
  makeBoard: OpenRandomTilesDeps['makeBoard'];
  fixHoverAnchor: (tile: any) => void;
  drag?: { bindToTile?: (tile: any) => void } | null;
  c: number;
  r: number;
  value: number;
}): boolean {
  const t = grid[r]?.[c];
  if (!t) return false;
  fixHoverAnchor(t);
  t.locked = false;
  makeBoard.syncTileZIndex?.(t, t?.parent);
  t.eventMode = 'static';
  t.cursor = 'pointer';
  if (drag && typeof drag.bindToTile === 'function') drag.bindToTile(t);
  makeBoard.setValue(t, value, 0);
  return true;
}

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
  if (isFirstPlayTutorialDemoBoard()) {
    const cells = firstPlayTutorialDemoCells(COLS, ROWS);
    let tilesOpened = 0;
    cells.forEach(({ c, r, value }) => {
      if (openTile({ grid, makeBoard, fixHoverAnchor, drag, c, r, value })) tilesOpened++;
    });
    try {
      (window as any).__ccFirstPlayTutorialDemoBoardReady = true;
    } catch {}
    return { total, openN: cells.length, tilesOpened };
  }

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
