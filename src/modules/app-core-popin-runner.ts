type PopInRunnerDeps = {
  tiles: any[];
  sweetPopIn: (tiles: any[], opts: { onHalf?: () => void }) => Promise<any> | any;
  onHalf: () => void;
  devLog: (...args: any[]) => void;
};

export function createSweetPopInRunner({
  tiles,
  sweetPopIn,
  onHalf,
  devLog,
}: PopInRunnerDeps){
  return () => {
    devLog('🎯 Starting sweetPopIn from app.js with', tiles.length, 'tiles');
    if (typeof (window as any).hideGhostPlaceholders === 'function') {
      (window as any).hideGhostPlaceholders();
    }
    return sweetPopIn(tiles, { onHalf }).then(() => {
      (window as any).__ccEnterAnimationActive = false;
      if (typeof (window as any).updateGhostVisibility === 'function') {
        (window as any).updateGhostVisibility();
      }
    });
  };
}
