export type BoardFrameBudgetSnapshot = {
  averageFrameMs: number;
  worstFrameMs: number;
  framesOver28Ms: number;
  reducedFx: boolean;
  sampleCount: number;
  sustainedLoadReduction: boolean;
};

export const IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS = 180_000;

let rafId: number | null = null;
let lastFrameAt = 0;
let frameSamples: number[] = [];
let stableWindows = 0;
let reducedFx = false;
let framesSinceEvaluation = 0;
let monitorStartedAt = 0;

export function shouldUseSustainedLoadReduction(elapsedMs: number, isIOSRuntime: boolean): boolean {
  return isIOSRuntime && Number.isFinite(elapsedMs) && elapsedMs >= IOS_SUSTAINED_LOAD_REDUCTION_AFTER_MS;
}

function detectIOSRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function evaluateBoardFrameBudget(
  samples: number[],
  currentlyReduced = false,
  sustainedLoadReduction = false,
): BoardFrameBudgetSnapshot {
  const usable = samples.filter((value) => Number.isFinite(value) && value > 0).slice(-120);
  const averageFrameMs = usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 16.67;
  const worstFrameMs = usable.length ? Math.max(...usable) : 16.67;
  const framesOver28Ms = usable.filter((value) => value > 28).length;
  const shouldReduce = averageFrameMs > 20.5 || framesOver28Ms >= 7 || worstFrameMs > 65;
  const canRecover = currentlyReduced && averageFrameMs < 18.2 && framesOver28Ms <= 2;
  return {
    averageFrameMs,
    worstFrameMs,
    framesOver28Ms,
    reducedFx: sustainedLoadReduction || shouldReduce || (currentlyReduced && !canRecover),
    sampleCount: usable.length,
    sustainedLoadReduction,
  };
}

function publish(snapshot: BoardFrameBudgetSnapshot): void {
  try {
    (window as any).__ccReducedBoardFx = snapshot.reducedFx;
    (window as any).__ccLastBoardPerf = snapshot;
  } catch {}
}

export function startBoardFrameBudgetMonitor(): void {
  if (rafId !== null || typeof requestAnimationFrame !== 'function') return;
  lastFrameAt = performance.now();
  monitorStartedAt = lastFrameAt;
  frameSamples = [];
  stableWindows = 0;
  framesSinceEvaluation = 0;
  const loop = (now: number) => {
    frameSamples.push(Math.max(1, Math.min(250, now - lastFrameAt)));
    lastFrameAt = now;
    if (frameSamples.length > 120) frameSamples.shift();
    framesSinceEvaluation += 1;
    if (frameSamples.length >= 60 && framesSinceEvaluation >= 15) {
      framesSinceEvaluation = 0;
      const sustainedLoadReduction = shouldUseSustainedLoadReduction(
        now - monitorStartedAt,
        detectIOSRuntime(),
      );
      const candidate = evaluateBoardFrameBudget(frameSamples, reducedFx, sustainedLoadReduction);
      if (reducedFx && !candidate.reducedFx) {
        stableWindows += 1;
        if (stableWindows < 4) candidate.reducedFx = true;
      } else {
        stableWindows = 0;
      }
      reducedFx = candidate.reducedFx;
      publish(candidate);
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

export function stopBoardFrameBudgetMonitor(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  lastFrameAt = 0;
  frameSamples = [];
  stableWindows = 0;
  framesSinceEvaluation = 0;
  monitorStartedAt = 0;
  reducedFx = false;
  try { (window as any).__ccReducedBoardFx = false; } catch {}
}

export function isBoardFxReduced(): boolean {
  return reducedFx || (typeof window !== 'undefined' && (window as any).__ccReducedBoardFx === true);
}
