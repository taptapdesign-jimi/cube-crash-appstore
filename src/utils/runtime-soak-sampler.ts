const SAMPLE_INTERVAL_MS = 5_000;

type RuntimeSamplerWindow = Window & {
  __ccPerformanceDiagnostics?: boolean;
  __ccRuntimeTextures?: { size?: number };
  __ccRuntimeSoakSamplerStop?: () => void;
  PIXI?: { utils?: { TextureCache?: Record<string, unknown>; BaseTextureCache?: Record<string, unknown> } };
  webkit?: { messageHandlers?: { consoleLog?: { postMessage?: (message: unknown) => void } } };
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

function readGsapChildren(): number | null {
  try {
    const gsap = (window as any).gsap;
    return gsap?.globalTimeline?.getChildren?.(true, true, true)?.length ?? null;
  } catch {
    return null;
  }
}

function readGsapRoots(): number | null {
  try {
    const gsap = (window as any).gsap;
    return gsap?.globalTimeline?.getChildren?.(false, true, true)?.length ?? null;
  } catch {
    return null;
  }
}

interface FrameTimingWindow {
  samples: number;
  totalMs: number;
  worstMs: number;
  over20Ms: number;
  over34Ms: number;
}

function emitCompactSample(
  frameTiming: FrameTimingWindow | null,
  reason = 'interval',
  force = false,
): void {
  const runtimeWindow = window as RuntimeSamplerWindow;
  const handler = runtimeWindow.webkit?.messageHandlers?.consoleLog;
  if ((!force && runtimeWindow.__ccPerformanceDiagnostics !== true) || !handler?.postMessage) return;

  const journey = document.getElementById('journey-screen');
  const journeyStyle = journey ? window.getComputedStyle(journey) : null;
  const pixiUtils = runtimeWindow.PIXI?.utils;
  handler.postMessage({
    level: 'info',
    message: `[CC_SOAK] ${JSON.stringify({
      at: Math.round(performance.now()),
      reason,
      visibility: document.visibilityState,
      route: document.body?.dataset?.appZone ?? null,
      dom: document.getElementsByTagName('*').length,
      images: document.images.length,
      canvases: document.querySelectorAll('canvas').length,
      cssAnimations: document.getAnimations?.().length ?? null,
      gsapChildren: readGsapChildren(),
      gsapRoots: readGsapRoots(),
      frameTiming: frameTiming && frameTiming.samples > 0 ? {
        samples: frameTiming.samples,
        averageMs: Math.round((frameTiming.totalMs / frameTiming.samples) * 100) / 100,
        worstMs: Math.round(frameTiming.worstMs * 100) / 100,
        over20Ms: frameTiming.over20Ms,
        over34Ms: frameTiming.over34Ms,
      } : null,
      runtimeTextures: runtimeWindow.__ccRuntimeTextures?.size ?? null,
      cleanup: (() => {
        try { return (window as any).CC?.getCleanupStats?.() ?? null; } catch { return null; }
      })(),
      pixiTextureCache: pixiUtils?.TextureCache ? Object.keys(pixiUtils.TextureCache).length : null,
      pixiBaseTextureCache: pixiUtils?.BaseTextureCache ? Object.keys(pixiUtils.BaseTextureCache).length : null,
      journey: journey ? {
        display: journeyStyle?.display ?? null,
        visibility: journeyStyle?.visibility ?? null,
        children: journey.querySelectorAll('*').length,
        images: journey.querySelectorAll('img').length,
      } : null,
    })}`,
  });
}

export function emitRuntimeResourceSnapshot(reason: string): void {
  emitCompactSample(null, reason, true);
}

export function startRuntimeSoakSampler(): () => void {
  const runtimeWindow = window as RuntimeSamplerWindow;
  runtimeWindow.__ccRuntimeSoakSamplerStop?.();
  if (runtimeWindow.__ccPerformanceDiagnostics !== true) return () => {};

  let frameWindow: FrameTimingWindow = {
    samples: 0,
    totalMs: 0,
    worstMs: 0,
    over20Ms: 0,
    over34Ms: 0,
  };
  let lastFrameAt: number | null = null;
  let frameRequest = 0;
  let pendingIdleSample = 0;
  let pendingFallbackSample = 0;
  let skipNextMeasuredDelta = false;
  const sampleFrame = (now: number): void => {
    if (skipNextMeasuredDelta) {
      // Resource diagnostics are intentionally excluded from the frame window:
      // the profiler must not report its own DOM/GSAP traversal as app work.
      skipNextMeasuredDelta = false;
    } else if (lastFrameAt !== null) {
      const frameMs = Math.max(0, now - lastFrameAt);
      // Ignore lifecycle gaps; visibility is already reported separately and
      // a background/resume pause is not a renderer frame.
      if (frameMs <= 250) {
        frameWindow.samples += 1;
        frameWindow.totalMs += frameMs;
        frameWindow.worstMs = Math.max(frameWindow.worstMs, frameMs);
        if (frameMs > 20) frameWindow.over20Ms += 1;
        if (frameMs > 34) frameWindow.over34Ms += 1;
      }
    }
    lastFrameAt = now;
    frameRequest = window.requestAnimationFrame(sampleFrame);
  };
  const scheduleIdleSample = (completedWindow: FrameTimingWindow | null): void => {
    if (pendingIdleSample || pendingFallbackSample) return;
    const emit = () => {
      pendingIdleSample = 0;
      pendingFallbackSample = 0;
      skipNextMeasuredDelta = true;
      emitCompactSample(completedWindow);
      // Reset the RAF baseline after the resource walk so its cost cannot
      // contaminate the next application-frame delta either.
      lastFrameAt = null;
    };
    if (typeof runtimeWindow.requestIdleCallback === 'function') {
      pendingIdleSample = runtimeWindow.requestIdleCallback(emit, { timeout: 1_200 });
      return;
    }
    pendingFallbackSample = window.setTimeout(emit, 0);
  };
  emitCompactSample(null);
  frameRequest = window.requestAnimationFrame(sampleFrame);
  const interval = window.setInterval(() => {
    const completedWindow = frameWindow;
    frameWindow = { samples: 0, totalMs: 0, worstMs: 0, over20Ms: 0, over34Ms: 0 };
    scheduleIdleSample(completedWindow);
  }, SAMPLE_INTERVAL_MS);
  const stop = () => {
    window.clearInterval(interval);
    if (pendingIdleSample && typeof runtimeWindow.cancelIdleCallback === 'function') {
      runtimeWindow.cancelIdleCallback(pendingIdleSample);
    }
    if (pendingFallbackSample) window.clearTimeout(pendingFallbackSample);
    pendingIdleSample = 0;
    pendingFallbackSample = 0;
    if (frameRequest) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    lastFrameAt = null;
    if (runtimeWindow.__ccRuntimeSoakSamplerStop === stop) {
      delete runtimeWindow.__ccRuntimeSoakSamplerStop;
    }
  };
  runtimeWindow.__ccRuntimeSoakSamplerStop = stop;
  return stop;
}
