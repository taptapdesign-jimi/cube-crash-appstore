import { isGameplayHudRevealAllowed } from './gameplay-hud-visibility-policy.ts';

type HudDropDeps = {
  HUD: { playHudDrop?: (opts?: any) => void };
  app?: { canvas?: HTMLCanvasElement | null } | null;
  trackAppAnimationFrame: (fn: () => void) => any;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  isHudDropPending: () => boolean;
  setHudDropPending: (v: boolean) => void;
};

type HudFinalDeps = {
  getHudRoot: () => any;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function triggerHudDropIfPending({
  HUD,
  app,
  trackAppAnimationFrame,
  devLog,
  devWarn,
  isHudDropPending,
  setHudDropPending,
}: HudDropDeps){
  if (!isGameplayHudRevealAllowed()) {
    setHudDropPending(false);
    return;
  }
  if (!isHudDropPending()) return;
  devLog('🎯 HUD drop still pending in onHalf - triggering now');
  try {
    if (typeof HUD.playHudDrop === 'function') {
      trackAppAnimationFrame(() => trackAppAnimationFrame(() => {
        if (!isGameplayHudRevealAllowed()) return;
        if (app && app.canvas) {
          app.canvas.style.opacity = '1';
          app.canvas.style.transition = 'opacity 0.3s ease';
        }
        HUD.playHudDrop({ forceRestart: true });
      }));
      devLog('✅ HUD drop animation scheduled in onHalf callback (next paint, forceRestart)');
    }
  } catch (e) {
    devWarn('⚠️ Failed to trigger HUD drop in onHalf:', e);
  }
  setHudDropPending(false);
}

export function ensureHudFinalPosition({ getHudRoot, devLog, devWarn }: HudFinalDeps){
  if (!isGameplayHudRevealAllowed()) return;
  try {
    const hudRoot = getHudRoot();
    if (hudRoot) {
      const top = hudRoot._dropTop ?? 44;
      hudRoot.y = top;
      hudRoot.alpha = 1;
      hudRoot.visible = true;
      hudRoot._dropped = true;
      devLog('✅ HUD final position set after animation');
    }
  } catch (e) {
    devWarn('⚠️ Failed to access HUD_ROOT in loadGameState:', e);
  }
}
