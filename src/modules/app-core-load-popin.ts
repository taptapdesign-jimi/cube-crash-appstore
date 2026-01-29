type LoadPopInDeps = {
  tiles: any[];
  backgroundLayer: any;
  sweetPopIn: (tiles: any[], opts?: any) => Promise<void>;
  onHalf: () => void;
  onComplete: () => void;
  devLog: (...args: any[]) => void;
};

export function playLoadPopInAnimation({
  tiles,
  backgroundLayer,
  sweetPopIn,
  onHalf,
  onComplete,
  devLog,
}: LoadPopInDeps){
  // Ensure background layer is visible from the start
  if (backgroundLayer) {
    backgroundLayer.visible = true;
  }

  // Hide all tiles before animation (ghosts stay visible)
  tiles.forEach(t => { if (t) t.visible = false; });

  // Play same sweetPopIn animation as new game
  sweetPopIn(tiles, { onHalf }).then(() => {
    devLog('✅ Continue animation completed');
    onComplete();
  });
}
