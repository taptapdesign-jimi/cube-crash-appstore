import { isGameplayHudRevealAllowed } from './gameplay-hud-visibility-policy.ts';

type HudDropDeps = {
  app?: { canvas?: HTMLCanvasElement | null } | null;
  HUD: { HUD_ROOT?: any; playHudDrop?: (opts?: any) => void };
  hudRootFromWindow: any;
  trackAppAnimationFrame: (fn: () => void) => any;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  devError: (...args: any[]) => void;
};

export function handleHudDropOnHalf({
  app,
  HUD,
  hudRootFromWindow,
  trackAppAnimationFrame,
  devLog,
  devWarn,
  devError,
  hudDropPending,
  setHudDropPending,
}: HudDropDeps & { hudDropPending: boolean; setHudDropPending: (v: boolean) => void }){
  if (!isGameplayHudRevealAllowed()) {
    setHudDropPending(false);
    devLog('⏭️ HUD onHalf reveal cancelled because gameplay no longer owns visibility');
    return;
  }
  // 🔥 CRITICAL FIX: Ensure HUD drop is triggered for new games
  if (hudDropPending){
    devLog('🎯 HUD drop pending in sweetPopIn onHalf - triggering drop animation');
    try { 
      const hudRoot = hudRootFromWindow || HUD.HUD_ROOT || null;
      if (!hudRoot) {
        devWarn('⚠️ HUD_ROOT not ready during sweetPopIn onHalf - keeping drop pending');
        return; // keep pending so a later fallback can run
      }
      if (typeof HUD.playHudDrop === 'function') {
        // Start on next paint so user definitely sees the drop (especially iPhone)
        trackAppAnimationFrame(() => trackAppAnimationFrame(() => {
          if (!isGameplayHudRevealAllowed()) return;
          // 🔥 CRITICAL: Show canvas now that HUD is ready to drop
          if (app && app.canvas) {
            app.canvas.style.opacity = '1';
            app.canvas.style.transition = 'opacity 0.3s ease';
          }
          try { (window as any).__ccShowJourneyGameBottomDecorForHudDrop?.(); } catch {}
          HUD.playHudDrop({ forceRestart: true });
        }));
        devLog('✅ HUD drop animation triggered in sweetPopIn onHalf');
        setHudDropPending(false);
      } else {
        devWarn('⚠️ HUD.playHudDrop is not a function');
      }
    } catch (e) {
      devError('❌ Failed to trigger HUD drop in sweetPopIn onHalf:', e);
    }
  } else {
    // 🔥 CRITICAL FIX: Even if not pending, ensure HUD is visible and positioned
    devLog('🎯 HUD drop not pending - ensuring HUD is visible');
    try {
      // 🔥 CRITICAL FIX: Get HUD_ROOT from HUD module or window
      try {
        const hudRoot = hudRootFromWindow || HUD.HUD_ROOT || null;
        if (hudRoot) {
          const top = hudRoot._dropTop ?? 44;
          hudRoot.y = top;
          hudRoot.alpha = 1;
          hudRoot.visible = true;
          hudRoot._dropped = true;
          try { (window as any).__ccShowJourneyGameBottomDecorForHudDrop?.(); } catch {}
          devLog('✅ HUD positioned and made visible in sweetPopIn onHalf');
        }
      } catch (e) {
        devWarn('⚠️ Failed to access HUD_ROOT in sweetPopIn onHalf:', e);
      }
    } catch (e) {
      devError('❌ Failed to ensure HUD visibility:', e);
    }
  }
}
