type PopInSafetyDeps = {
  tiles: any[];
  gsap: { globalTimeline: { resume: () => void } };
  app?: { ticker?: { started: boolean; start: () => void } } | null;
  updateGhostVisibility: () => void;
  devWarn: (...args: any[]) => void;
  trackAppTimeout: (fn: () => void, ms: number) => any;
};

export function schedulePopInSafetyNet({
  tiles,
  gsap,
  app,
  updateGhostVisibility,
  devWarn,
  trackAppTimeout,
}: PopInSafetyDeps){
  trackAppTimeout(() => {
    try {
      let invisibleCount = 0;
      for (const t of tiles) {
        if (!t || t.destroyed) continue;
        if (t.locked || (t.value | 0) <= 0) continue;
        if (!t.visible || (t.alpha ?? 0) < 0.9) invisibleCount++;
      }
      if (invisibleCount > 0) {
        devWarn(`⚠️ sweetPopIn safety: Forcing visibility on ${invisibleCount} tiles`);
        try { gsap.globalTimeline.resume(); } catch {}
        try { if (app?.ticker && !app.ticker.started) app.ticker.start(); } catch {}
        for (const t of tiles) {
          if (!t || t.destroyed) continue;
          if (t.locked || (t.value | 0) <= 0) continue;
          t.visible = true;
          t.alpha = 1;
          t.renderable = true;
          try {
            if (t.scale?.set) t.scale.set(1, 1);
            else if (t.scale) {
              t.scale.x = 1;
              t.scale.y = 1;
            }
          } catch {}
          try {
            if (t.rotG) t.rotG.alpha = 1;
            if (t.base) t.base.alpha = 1;
            if (t.pips) t.pips.alpha = 1;
            if (t.num) t.num.alpha = 1;
          } catch {}
        }
        try {
          (window as any).__ccEnterAnimationActive = false;
          updateGhostVisibility();
        } catch {}
      }
    } catch (e) {
      devWarn('⚠️ sweetPopIn safety failed:', e);
    }
  }, 800);
}
