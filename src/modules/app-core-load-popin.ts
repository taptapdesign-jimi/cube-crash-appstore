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

  // Hide ghost placeholders during enter animation; restore after
  if (typeof (window as any).hideGhostPlaceholders === 'function') {
    (window as any).hideGhostPlaceholders();
  }

  // Hide all tiles before animation
  tiles.forEach(t => { if (t) t.visible = false; });

  // Enable per-tile haptics only for load/continue pop-in flow.
  (window as any).__ccLoadPopInHapticPerTile = true;

  // Play same sweetPopIn animation as new game
  sweetPopIn(tiles, { onHalf }).then(() => {
    delete (window as any).__ccLoadPopInHapticPerTile;
    (window as any).__ccEnterAnimationActive = false;
    if (typeof (window as any).updateGhostVisibility === 'function') {
      (window as any).updateGhostVisibility();
    }
    devLog('✅ Continue animation completed');
    onComplete();
  }).catch((error) => {
    delete (window as any).__ccLoadPopInHapticPerTile;
    devLog('⚠️ Continue animation failed:', error);
  });
}
