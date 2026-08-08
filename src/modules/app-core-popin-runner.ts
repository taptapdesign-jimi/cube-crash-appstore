type PopInRunnerDeps = {
  tiles: any[];
  sweetPopIn: (tiles: any[], opts: { onHalf?: () => void }) => Promise<any> | any;
  onHalf: () => void;
  beforePopIn?: () => Promise<void>;
  onPopInStarted?: () => void;
  devLog: (...args: any[]) => void;
};

export function createSweetPopInRunner({
  tiles,
  sweetPopIn,
  onHalf,
  beforePopIn,
  onPopInStarted,
  devLog,
}: PopInRunnerDeps){
  return async () => {
    devLog('🎯 Starting sweetPopIn from app.js with', tiles.length, 'tiles');
    if (typeof (window as any).hideGhostPlaceholders === 'function') {
      (window as any).hideGhostPlaceholders();
    }
    if (beforePopIn) {
      try {
        await beforePopIn();
      } catch (error) {
        devLog('⚠️ Fresh Arcade Round cue failed; continuing with board entrance:', error);
      }
    }
    const popInPromise = sweetPopIn(tiles, { onHalf });
    try { onPopInStarted?.(); } catch {}
    return Promise.resolve(popInPromise).then(() => {
      (window as any).__ccEnterAnimationActive = false;
      if (typeof (window as any).updateGhostVisibility === 'function') {
        (window as any).updateGhostVisibility();
      }
    });
  };
}
