import type { Grid } from '../types/game-types.js';

type GridDeps = {
  ROWS: number;
  COLS: number;
  setGrid: (grid: Grid) => void;
  setStateGrid: (grid: Grid) => void;
};

export function createEmptyGrid(deps: GridDeps): Grid {
  const fresh = Array.from({ length: deps.ROWS }, () => Array(deps.COLS).fill(null));
  deps.setGrid(fresh);
  deps.setStateGrid(fresh);
  return fresh;
}
