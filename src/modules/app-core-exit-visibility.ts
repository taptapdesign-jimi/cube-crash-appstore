type EnsureExitVisibilityDeps = {
  app?: { canvas?: HTMLCanvasElement | null; ticker?: { started: boolean; start: () => void } } | null;
  stage?: { visible?: boolean; alpha?: number } | null;
  board?: { visible?: boolean; alpha?: number } | null;
  hud?: { visible?: boolean; alpha?: number } | null;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function ensureExitVisibility({
  app,
  stage,
  board,
  hud,
  devLog,
  devWarn,
}: EnsureExitVisibilityDeps){
  // 🔥 CRITICAL FIX: Ensure canvas/app is visible BEFORE playing exit animation
  // This fixes the bug where board "just disappears" without animation
  try {
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.style.display = 'block';
      appElement.style.visibility = 'visible';
      appElement.style.opacity = '1';
      devLog('✅ Board exit: App element visibility ensured');
    }
    
    // Also ensure canvas is visible
    if (app && app.canvas) {
      app.canvas.style.display = 'block';
      app.canvas.style.visibility = 'visible';
      app.canvas.style.opacity = '1';
      devLog('✅ Board exit: Canvas visibility ensured');
    }
    
    // Ensure PIXI stage is visible and rendering
    if (stage) {
      stage.visible = true;
      stage.alpha = 1;
    }
    if (board) {
      board.visible = true;
      board.alpha = 1;
    }
    if (hud) {
      hud.visible = true;
      hud.alpha = 1;
    }
    
    // Ensure PIXI ticker is running for animations
    if (app && app.ticker && !app.ticker.started) {
      app.ticker.start();
      devLog('✅ Board exit: PIXI ticker restarted for exit animation');
    }
  } catch (e) {
    devWarn('⚠️ Board exit: Error ensuring visibility:', e);
  }
}
