type PopInRunnerDeps = {
  tiles: any[];
  sweetPopIn: (tiles: any[], opts: { onHalf?: () => void; signal?: AbortSignal }) => Promise<any> | any;
  onHalf: () => void;
  beforePopIn?: () => Promise<void>;
  onPopInStarted?: () => void;
  shouldAbort?: () => boolean;
  getAbortSignal?: () => AbortSignal | null;
  devLog: (...args: any[]) => void;
};

export function createSweetPopInRunner({
  tiles,
  sweetPopIn,
  onHalf,
  beforePopIn,
  onPopInStarted,
  shouldAbort,
  getAbortSignal,
  devLog,
}: PopInRunnerDeps){
  return async () => {
    if (shouldAbort?.()) return;
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
    if (shouldAbort?.()) return;
    const popInPromise = sweetPopIn(tiles, {
      onHalf,
      signal: getAbortSignal?.() ?? undefined,
    });
    try { onPopInStarted?.(); } catch {}
    return Promise.resolve(popInPromise).then(() => {
      if (shouldAbort?.()) return;
      (window as any).__ccEnterAnimationActive = false;
      if (typeof (window as any).updateGhostVisibility === 'function') {
        (window as any).updateGhostVisibility();
      }
    });
  };
}
