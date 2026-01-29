type BoardSetupDeps = {
  createEmptyGrid: () => void;
  drawBoardBG: (mode: string) => void;
};

export function initializeBoardGrid({ createEmptyGrid, drawBoardBG }: BoardSetupDeps){
  createEmptyGrid();
  drawBoardBG('none');
}
