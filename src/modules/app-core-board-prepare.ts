type PrepareBoardDeps = {
  resetBoardContainer: () => void;
  resetTilesForRebuild: () => void;
  initializeBoardGrid: () => void;
};

export function prepareBoardForRebuild({
  resetBoardContainer,
  resetTilesForRebuild,
  initializeBoardGrid,
}: PrepareBoardDeps){
  resetBoardContainer();
  resetTilesForRebuild();
  initializeBoardGrid();
}
