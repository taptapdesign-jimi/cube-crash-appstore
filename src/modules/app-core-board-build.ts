type LockedHolderDeps = {
  ROWS: number;
  COLS: number;
  board: any;
  grid: any;
  tiles: any[];
  makeBoard: any;
  fixHoverAnchor: (t: any) => void;
};

export function createLockedHolders(deps: LockedHolderDeps) {
  const { ROWS, COLS, board, grid, tiles, makeBoard, fixHoverAnchor } = deps;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      makeBoard.createTile({ board, grid, tiles, c, r, val: 0, locked: true });
      fixHoverAnchor(grid[r][c]);
    }
  }
}
