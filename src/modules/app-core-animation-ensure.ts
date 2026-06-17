import { killInvalidPixiGsapTweens } from './pixi-gsap-cleanup.ts';

type EnsureAnimationDeps = {
  gsap: { globalTimeline: { resume: () => void }; ticker?: { wake?: () => void } };
  app?: { ticker?: { started: boolean; start: () => void } } | null;
};

export function ensureAnimationRunning({ gsap, app }: EnsureAnimationDeps){
  // 🔥 CRITICAL: Ensure GSAP + ticker are running before pop-in starts
  try { killInvalidPixiGsapTweens(gsap); } catch {}
  try { gsap.globalTimeline.resume(); } catch {}
  try { gsap.ticker?.wake?.(); } catch {}
  try { if (app?.ticker && !app.ticker.started) app.ticker.start(); } catch {}
}
