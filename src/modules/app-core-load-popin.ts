type LoadPopInDeps = {
  tiles: any[];
  backgroundLayer: any;
  sweetPopIn: (tiles: any[], opts?: any) => Promise<void>;
  onHalf: () => void;
  onComplete: () => void;
  beforePopIn?: () => Promise<void>;
  onPopInStarted?: () => void;
  devLog: (...args: any[]) => void;
};

export function playLoadPopInAnimation({
  tiles,
  backgroundLayer,
  sweetPopIn,
  onHalf,
  onComplete,
  beforePopIn,
  onPopInStarted,
  devLog,
}: LoadPopInDeps): void {
  // Ensure background layer is visible from the start
  if (backgroundLayer) {
    backgroundLayer.visible = true;
  }

  // A saved game stores active tiles, while empty/locked board cells live in
  // the ghost layer. Resolve both before hiding them so one timeline owns the
  // complete board entrance.
  const wasEnterAnimationActive = (window as any).__ccEnterAnimationActive === true;
  try {
    // updateGhostVisibility intentionally suppresses ghosts during entry. We
    // briefly calculate the final board composition, then restore the guard.
    (window as any).__ccEnterAnimationActive = false;
    (window as any).updateGhostVisibility?.();
  } catch {}
  finally {
    (window as any).__ccEnterAnimationActive = wasEnterAnimationActive;
  }
  const ghostTiles: any[] = [];
  const ghostRows = (window as any)._ghostPlaceholders;
  if (Array.isArray(ghostRows)) {
    for (const row of ghostRows) {
      if (!Array.isArray(row)) continue;
      for (const ghost of row) {
        if (ghost && !ghost.destroyed && ghost.visible !== false) ghostTiles.push(ghost);
      }
    }
  }
  const enterTiles = [...tiles, ...ghostTiles];

  // Hide the complete board until its shared entrance begins.
  enterTiles.forEach(t => { if (t) t.visible = false; });

  const runPopIn = async () => {
    if (beforePopIn) {
      try {
        await beforePopIn();
      } catch (error) {
        devLog('⚠️ Deferred load pre-pop-in cue failed; continuing with board entrance:', error);
      }
    }
    try {
      const popInPromise = sweetPopIn(enterTiles, { onHalf });
      try { onPopInStarted?.(); } catch {}
      await popInPromise;
      devLog('✅ Continue animation completed');
    } catch (error) {
      devLog('⚠️ Continue animation failed:', error);
    } finally {
      delete (window as any).__ccGameStartInProgress;
      delete (window as any).__ccGameStartInProgressSince;
      (window as any).__ccEnterAnimationActive = false;
      if (typeof (window as any).updateGhostVisibility === 'function') {
        (window as any).updateGhostVisibility();
      }
      // Recovery/endgame validation belongs after the complete visual entrance.
      // While the cue runs, every restored tile is intentionally hidden and a
      // parallel check could falsely classify the saved board as completed.
      onComplete();
    }
  };

  // ui-manager keeps #app hidden while restoring state. Starting GSAP now
  // would spend the entrance off-screen and make active tiles appear instant.
  // Begin on the first frame where the board host is actually visible.
  const appElement = document.getElementById('app');
  let visibilityFrames = 0;
  const startWhenVisible = () => {
    const style = appElement ? window.getComputedStyle(appElement) : null;
    const visible = !appElement || (style?.display !== 'none' && style?.visibility !== 'hidden');
    if (visible || visibilityFrames++ >= 120) {
      window.requestAnimationFrame(() => { void runPopIn(); });
      return;
    }
    window.requestAnimationFrame(startWhenVisible);
  };
  startWhenVisible();
}
