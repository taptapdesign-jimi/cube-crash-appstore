import { isGameplayRendererTerminalSuspended } from './gameplay-render-suspension.ts';
import { killInvalidPixiGsapTweens } from './pixi-gsap-cleanup.ts';
import { ensureGameplayEntryTicker, type GameplayEntryTickerApp } from './gameplay-entry-ticker.ts';

type EnsureAnimationDeps = {
  gsap: { globalTimeline: { resume: () => void }; ticker?: { wake?: () => void } };
  app?: GameplayEntryTickerApp | null;
  isCurrent?: () => boolean;
  signal?: AbortSignal | null;
};

export function ensureAnimationRunning({ gsap, app, isCurrent = () => true, signal }: EnsureAnimationDeps){
  if (!isCurrent() || signal?.aborted || isGameplayRendererTerminalSuspended(app)) return;
  // 🔥 CRITICAL: Ensure GSAP + ticker are running before pop-in starts
  try { killInvalidPixiGsapTweens(gsap); } catch {}
  try { gsap.globalTimeline.resume(); } catch {}
  try { gsap.ticker?.wake?.(); } catch {}
  try { ensureGameplayEntryTicker({ app, isCurrent, signal }); } catch {}
}
