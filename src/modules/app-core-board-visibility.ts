type BoardVisibilityDeps = {
  tiles: any[];
  drawBoardBG: (mode: string) => void;
};

export function finalizeBoardVisibility({ tiles, drawBoardBG }: BoardVisibilityDeps){
  try { tiles.forEach((t) => { t.visible = false; }); } catch {}
  drawBoardBG('active+empty');
}
