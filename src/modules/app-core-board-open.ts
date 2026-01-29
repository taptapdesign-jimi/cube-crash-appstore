type BoardOpenDeps = {
  ROWS: number;
  COLS: number;
  board: any;
  grid: any[][];
  tiles: any[];
  makeBoard: { setValue: (tile: any, value: number, delay?: number) => void };
  fixHoverAnchor: (tile: any) => void;
  drag?: { bindToTile?: (tile: any) => void } | null;
  randVal: () => number;
  createLockedHolders: (deps: {
    ROWS: number;
    COLS: number;
    board: any;
    grid: any[][];
    tiles: any[];
    makeBoard: { setValue: (tile: any, value: number, delay?: number) => void };
    fixHoverAnchor: (tile: any) => void;
  }) => void;
  openRandomTiles: (deps: {
    ROWS: number;
    COLS: number;
    grid: any[][];
    makeBoard: { setValue: (tile: any, value: number, delay?: number) => void };
    fixHoverAnchor: (tile: any) => void;
    drag?: { bindToTile?: (tile: any) => void } | null;
    randVal: () => number;
  }) => { total: number; openN: number; tilesOpened: number };
};

export function createAndOpenBoard({
  ROWS,
  COLS,
  board,
  grid,
  tiles,
  makeBoard,
  fixHoverAnchor,
  drag,
  randVal,
  createLockedHolders,
  openRandomTiles,
}: BoardOpenDeps){
  createLockedHolders({
    ROWS,
    COLS,
    board,
    grid,
    tiles,
    makeBoard,
    fixHoverAnchor,
  });
  openRandomTiles({
    ROWS,
    COLS,
    grid,
    makeBoard,
    fixHoverAnchor,
    drag,
    randVal,
  });
}
