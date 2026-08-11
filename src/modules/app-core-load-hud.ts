import { isArcadeHomeRunMode } from './run-mode.js';

type LoadHudDeps = {
  app?: { canvas?: HTMLCanvasElement | null } | null;
  hud?: any;
  HUD: {
    HUD_ROOT?: any;
    playHudDrop?: (opts?: any) => void;
    createUnifiedHudContainer?: () => void;
  };
  getHudRootFromWindow: () => any;
  trackAppAnimationFrame: (fn: () => void) => any;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  devError: (...args: any[]) => void;
  isHudDropPending: () => boolean;
  setHudDropPending: (v: boolean) => void;
};

export function ensureHudAfterLoad({
  app,
  hud,
  HUD,
  getHudRootFromWindow,
  trackAppAnimationFrame,
  devLog,
  devWarn,
  devError,
  isHudDropPending,
  setHudDropPending,
}: LoadHudDeps){
  // Ensure HUD is visible
  if (hud) {
    hud.visible = true;
    hud.alpha = 1;
    devLog('🔍 HUD check: visible?', hud.visible, 'alpha:', hud.alpha, 'children:', hud.children.length, 'parent:', hud.parent?.constructor.name);
  }

  // During a coordinated entry this function only prepares the canonical
  // hidden HUD pose. The tile pop-in midpoint is the sole reveal owner.
  if (isHudDropPending()) {
    try {
      const existingHUD = document.querySelector('[data-unified-hud]');
      if (!existingHUD && typeof HUD.createUnifiedHudContainer === 'function') {
        HUD.createUnifiedHudContainer();
      }
      const hudRoot = getHudRootFromWindow() || HUD.HUD_ROOT || null;
      if (hudRoot) {
        const top = hudRoot._dropTop ?? 44;
        hudRoot.visible = true;
        hudRoot.alpha = 0;
        hudRoot.y = top - 140;
        hudRoot._dropped = false;
      }
      devLog('✅ Loaded HUD prepared for coordinated entry reveal');
    } catch (error) {
      devWarn('⚠️ Failed to prepare loaded HUD hidden pose:', error);
    }
    return;
  }
  
  // Always trigger HUD drop animation when loading saved state
  try {
    if (!isHudDropPending()) {
      devLog('🎯 HUD drop not pending - ensuring HUD is visible');
      const hudRootHere = getHudRootFromWindow() || HUD.HUD_ROOT || null;
      if (hudRootHere) {
        const top = hudRootHere._dropTop ?? 44;
        hudRootHere.y = top;
        hudRootHere.alpha = 1;
        hudRootHere.visible = true;
        hudRootHere._dropped = true;
        try { (window as any).__ccShowJourneyGameBottomDecorForHudDrop?.(); } catch {}
        devLog('✅ HUD positioned and made visible');
      }
    }
    
    // Recreate DOM-based HUD if it was destroyed
    const existingHUD = document.querySelector('[data-unified-hud]');
    devLog('🔍 DOM HUD exists?', !!existingHUD);
    if (!existingHUD && typeof HUD.createUnifiedHudContainer === 'function') {
      devLog('⚠️ DOM HUD missing, recreating...');
      try {
        HUD.createUnifiedHudContainer();
        devLog('✅ DOM HUD recreated');
        
        if (typeof HUD.playHudDrop === 'function') {
          trackAppAnimationFrame(() => trackAppAnimationFrame(() => {
            if (app && app.canvas) {
              app.canvas.style.opacity = '1';
              app.canvas.style.transition = 'opacity 0.3s ease';
            }
            try { (window as any).__ccShowJourneyGameBottomDecorForHudDrop?.(); } catch {}
            HUD.playHudDrop({ forceRestart: true });
          }));
          devLog('✅ HUD drop animation scheduled after recreation (next paint, forceRestart)');
        }
      } catch (error) {
        devError('❌ Failed to recreate DOM HUD:', error);
      }
    }
    
    // Fallback: Ensure HUD_ROOT is visible and positioned correctly
    try {
      const hudRoot = getHudRootFromWindow() || HUD.HUD_ROOT || null;
      if (hudRoot) {
        const top = hudRoot._dropTop ?? 44;
        hudRoot.y = top;
        hudRoot.alpha = 1;
        hudRoot.visible = true;
        hudRoot._dropped = true;
        devLog('✅ HUD_ROOT positioned and made visible (fallback)');
      } else {
        devWarn('⚠️ HUD_ROOT not found - HUD may not be initialized yet');
      }
    } catch (e) {
      devWarn('⚠️ Failed to access HUD_ROOT:', e);
    }
    
    // Ensure board indicator is visible only in Arcade. Journey uses the
    // illustrated bottom decor instead of the rounded Stage/Board label.
    try {
      const boardIndicator =
        document.getElementById('hud-board-indicator') ||
        document.getElementById('hud-board');
      if (boardIndicator) {
        if (isArcadeHomeRunMode()) {
          boardIndicator.style.display = 'flex';
          boardIndicator.style.visibility = 'visible';
          boardIndicator.style.opacity = '1';
          boardIndicator.style.zIndex = '2500';
          boardIndicator.style.pointerEvents = 'none';
          boardIndicator.setAttribute('data-state', 'visible');
          devLog('✅ Board indicator made visible');
        } else {
          boardIndicator.style.display = 'none';
          boardIndicator.style.opacity = '0';
          boardIndicator.setAttribute('data-state', 'hidden');
          devLog('✅ Board indicator hidden for Journey load');
        }
      }
    } catch (e) {
      devWarn('⚠️ Failed to show board indicator:', e);
    }
  } catch (error) {
    devError('❌ Failed to trigger HUD animations:', error);
  }
}
