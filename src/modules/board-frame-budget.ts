import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.ts';

export type BoardFrameBudgetSnapshot = {
  averageFrameMs: number;
  worstFrameMs: number;
  framesOver28Ms: number;
  reducedFx: boolean;
  sampleCount: number;
  sustainedLoadReduction: boolean;
  expectedFrameMs: number;
  framesOverBudget: number;
};

export const IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS = 180_000;

type FrameBudgetTicker = {
  add: (callback: (ticker?: unknown) => void) => unknown;
  remove: (callback: (ticker?: unknown) => void) => unknown;
  maxFPS?: number;
};

let rafId: number | null = null;
let monitorTicker: FrameBudgetTicker | null = null;
let tickerCallback: ((ticker?: unknown) => void) | null = null;
let lastFrameAt = 0;
let frameSamples: number[] = [];
let stableWindows = 0;
let reducedFx = false;
let framesSinceEvaluation = 0;
let activeMonitorElapsedMs = 0;

export function shouldUseSustainedLoadReduction(elapsedMs: number, isMobileRuntime: boolean): boolean {
  return isMobileRuntime && Number.isFinite(elapsedMs) && elapsedMs >= IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS;
}

export function shouldSampleBoardFrameBudget(maxFPS: number | undefined, isMobileRuntime: boolean): boolean {
  // A configured cap is a target, not evidence that its frames were delivered.
  return !isMobileRuntime || maxFPS === undefined || Number.isFinite(maxFPS);
}

function expectedFrameMs(maxFPS?: number): number {
  return MOBILE_RUNTIME_PROFILE.isMobileDevice && Number.isFinite(maxFPS) && Number(maxFPS) > 0
    ? 1000 / Math.min(60, Number(maxFPS))
    : 1000 / 60;
}

export function evaluateBoardFrameBudget(
  samples: number[],
  currentlyReduced = false,
  sustainedLoadReduction = false,
  targetFrameMs = 1000 / 60,
): BoardFrameBudgetSnapshot {
  const usable = samples.filter((value) => Number.isFinite(value) && value > 0).slice(-120);
  const averageFrameMs = usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 16.67;
  const worstFrameMs = usable.length ? Math.max(...usable) : 16.67;
  const framesOver28Ms = usable.filter((value) => value > 28).length;
  const idleAllowance = Math.max(0, targetFrameMs - 1000 / 60);
  const framesOverBudget = usable.filter(value => value - idleAllowance > 28).length;
  const shouldReduce = averageFrameMs - idleAllowance > 20.5 || framesOverBudget >= 7 || worstFrameMs - idleAllowance > 65;
  const canRecover = currentlyReduced && averageFrameMs - idleAllowance < 18.2 && framesOverBudget <= 2;
  return {
    averageFrameMs,
    worstFrameMs,
    framesOver28Ms,
    reducedFx: sustainedLoadReduction || shouldReduce || (currentlyReduced && !canRecover),
    sampleCount: usable.length,
    sustainedLoadReduction,
    expectedFrameMs: targetFrameMs,
    framesOverBudget,
  };
}

function publish(snapshot: BoardFrameBudgetSnapshot): void {
  try {
    (window as any).__ccReducedBoardFx = snapshot.reducedFx;
    (window as any).__ccLastBoardPerf = snapshot;
  } catch {}
}

export function startBoardFrameBudgetMonitor(ticker?: FrameBudgetTicker | null): void {
  if (rafId !== null || tickerCallback !== null) return;
  lastFrameAt = performance.now();
  frameSamples = [];
  stableWindows = 0;
  framesSinceEvaluation = 0;
  activeMonitorElapsedMs = 0;

  let lastTargetFrameMs = expectedFrameMs(ticker?.maxFPS);
  const sampleFrame = (now: number, targetFrameMs = 1000 / 60) => {
    const frameMs = Math.max(1, Math.min(250, now - lastFrameAt));
    // Never compare a preceding 30 FPS sample window with a new 60 FPS target.
    if (targetFrameMs !== lastTargetFrameMs) {
      frameSamples = [];
      framesSinceEvaluation = 0;
      stableWindows = 0;
      lastTargetFrameMs = targetFrameMs;
      lastFrameAt = now;
      return;
    }
    frameSamples.push(frameMs);
    lastFrameAt = now;
    if (targetFrameMs <= 1000 / 55) activeMonitorElapsedMs += frameMs;
    if (frameSamples.length > 120) frameSamples.shift();
    framesSinceEvaluation += 1;
    if (frameSamples.length >= 60 && framesSinceEvaluation >= 15) {
      framesSinceEvaluation = 0;
      const sustainedLoadReduction = shouldUseSustainedLoadReduction(
        activeMonitorElapsedMs,
        MOBILE_RUNTIME_PROFILE.isMobileDevice,
      );
      const candidate = evaluateBoardFrameBudget(frameSamples, reducedFx, sustainedLoadReduction, targetFrameMs);
      if (reducedFx && !candidate.reducedFx) {
        stableWindows += 1;
        if (stableWindows < 4) candidate.reducedFx = true;
      } else {
        stableWindows = 0;
      }
      reducedFx = candidate.reducedFx;
      publish(candidate);
    }
  };

  // Gameplay already owns a Pixi ticker. Sampling it avoids a second
  // perpetual RAF loop and automatically suspends this monitor whenever
  // gameplay or the WebView background lifecycle stops Pixi.
  if (ticker?.add && ticker?.remove) {
    monitorTicker = ticker;
    tickerCallback = () => {
      const now = performance.now();
      if (!shouldSampleBoardFrameBudget(monitorTicker?.maxFPS, MOBILE_RUNTIME_PROFILE.isMobileDevice)) {
        lastFrameAt = now;
        return;
      }
      sampleFrame(now, expectedFrameMs(monitorTicker?.maxFPS));
    };
    monitorTicker.add(tickerCallback);
    return;
  }

  if (typeof requestAnimationFrame !== 'function') return;
  const loop = (now: number) => {
    sampleFrame(now);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

export function stopBoardFrameBudgetMonitor(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  if (monitorTicker && tickerCallback) {
    try { monitorTicker.remove(tickerCallback); } catch {}
  }
  rafId = null;
  monitorTicker = null;
  tickerCallback = null;
  lastFrameAt = 0;
  frameSamples = [];
  stableWindows = 0;
  framesSinceEvaluation = 0;
  activeMonitorElapsedMs = 0;
  reducedFx = false;
  try { (window as any).__ccReducedBoardFx = false; } catch {}
}

export function isBoardFxReduced(): boolean {
  return reducedFx || (typeof window !== 'undefined' && (window as any).__ccReducedBoardFx === true);
}
