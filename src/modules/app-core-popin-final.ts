type PopInFinalDeps = {
  app?: { canvas?: HTMLCanvasElement | null } | null;
  board?: { alpha?: number; visible?: boolean; renderable?: boolean } | null;
  tiles: any[];
  HUD: { HUD_ROOT?: any; playHudDrop?: (opts?: any) => void };
  hudRootFromWindow: any;
  trackAppAnimationFrame: (fn: () => void) => any;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  devError: (...args: any[]) => void;
};

export function handleSweetPopInComplete({
  app,
  board,
  tiles,
  HUD,
  hudRootFromWindow,
  trackAppAnimationFrame,
  devLog,
  devWarn,
  devError,
  hudDropPending,
  setHudDropPending,
}: PopInFinalDeps & { hudDropPending: boolean; setHudDropPending: (v: boolean) => void }){
  // 🔥 CRITICAL FIX: Final check - ensure HUD is visible and positioned after animation
  if (hudDropPending) {
    devLog('🎯 HUD drop still pending after sweetPopIn - triggering now');
    try {
      if (typeof HUD.playHudDrop === 'function') {
        trackAppAnimationFrame(() => trackAppAnimationFrame(() => {
          // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
          if (app && app.canvas) {
            app.canvas.style.opacity = '1';
            app.canvas.style.transition = 'opacity 0.3s ease';
          }
          try { (window as any).__ccShowJourneyGameBottomDecorForHudDrop?.(); } catch {}
          HUD.playHudDrop({ forceRestart: true });
        }));
        devLog('✅ HUD drop animation triggered after sweetPopIn');
      }
    } catch (e) {
      devError('❌ Failed to trigger HUD drop after sweetPopIn:', e);
    }
    setHudDropPending(false);
  }
  
  // 🔥 CRITICAL FIX: Ensure HUD is visible even if animation didn't trigger
  try {
    const hudRoot = hudRootFromWindow || HUD.HUD_ROOT || null;
    if (hudRoot) {
      const top = hudRoot._dropTop ?? 44;
      hudRoot.y = top;
      hudRoot.alpha = 1;
      hudRoot.visible = true;
      hudRoot._dropped = true;
      try { (window as any).__ccShowJourneyGameBottomDecorForHudDrop?.(); } catch {}
      devLog('✅ HUD final position set after sweetPopIn');
    }
  } catch (e) {
    devError('❌ Failed to ensure HUD visibility after sweetPopIn:', e);
  }

  // 🔥 CRITICAL FIX: Ensure tiles are fully visible after sweetPopIn
  // GSAP cleanup can interrupt the pop-in tweens and leave tiles at low alpha
  try {
    if (board) {
      board.alpha = 1;
      board.visible = true;
      board.renderable = true;
    }
    let fixedCount = 0;
    for (const t of tiles) {
      if (!t || t.destroyed) continue;
      if (t.locked || (t.value | 0) <= 0) continue;
      if (t.alpha !== 1) { t.alpha = 1; fixedCount++; }
      if (t.visible !== true) { t.visible = true; fixedCount++; }
      if (t.renderable === false) { t.renderable = true; fixedCount++; }
    }
    if (fixedCount > 0) {
      devLog(`✅ sweetPopIn: Forced visibility on ${fixedCount} tile props`);
    }
  } catch (e) {
    devWarn('⚠️ sweetPopIn: Failed to force tile visibility:', e);
  }
}
