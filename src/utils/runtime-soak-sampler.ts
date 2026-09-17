import { areDetailedRuntimeDiagnosticsEnabled } from './runtime-diagnostics-policy.js';
import { getSoundtrackRuntimeStats } from '../modules/soundtrack-manager.js';
import { getSharedPixiSheetCacheStats } from '../modules/shared-pixi-sheet-animation.js';
import { getDecodedGameplayAudioStats } from '../modules/gameplay-audio-buffer-player.js';

const SAMPLE_INTERVAL_MS = 5_000;
const MAX_LONG_FRAME_RECORDS = 24;

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
  over250Ms: number;
  // Absolute performance.now() callback times, matching transition phase clocks.
  // This interval is time between RAF callback executions, not GPU render time.
  longFrames: Array<{ startAtMs: number; endAtMs: number; durationMs: number }>;
  longFrameOverflow: number;
}

function emitCompactSample(
  frameTiming: FrameTimingWindow | null,
  reason = 'interval',
  force = false,
  cacheOnly = false,
): boolean {
  const runtimeWindow = window as RuntimeSamplerWindow;
  const handler = runtimeWindow.webkit?.messageHandlers?.consoleLog;
  if ((!force && runtimeWindow.__ccPerformanceDiagnostics !== true) || !handler?.postMessage) return false;

  const resources = (force && !cacheOnly) || areDetailedRuntimeDiagnosticsEnabled();
  let resourceSnapshot: Record<string, unknown> = {};
  if (resources || cacheOnly) {
    resourceSnapshot = {
      soundtrack: getSoundtrackRuntimeStats(),
      gameplayAudio: getDecodedGameplayAudioStats(),
      sharedPixiSheets: getSharedPixiSheetCacheStats(),
      runtimeTextures: runtimeWindow.__ccRuntimeTextures?.size ?? null,
    };
  }
  if (resources) {
    const journey = document.getElementById('journey-screen');
    const journeyStyle = journey ? window.getComputedStyle(journey) : null;
    const pixiUtils = runtimeWindow.PIXI?.utils;
    resourceSnapshot = {
      ...resourceSnapshot,
      route: document.body?.dataset?.appZone ?? null,
      dom: document.getElementsByTagName('*').length,
      images: document.images.length,
      canvases: document.querySelectorAll('canvas').length,
      cssAnimations: document.getAnimations?.().length ?? null,
      gsapChildren: readGsapChildren(),
      gsapRoots: readGsapRoots(),
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
    };
  }
  handler.postMessage({
    level: 'info',
    message: `[CC_SOAK] ${JSON.stringify({
      at: Math.round(performance.now()),
      reason,
      visibility: document.visibilityState,
      sampleMode: resources ? 'resources' : cacheOnly ? 'cache-only' : 'timing-only',
      frameTiming: frameTiming && frameTiming.samples > 0 ? {
        samples: frameTiming.samples,
        averageMs: Math.round((frameTiming.totalMs / frameTiming.samples) * 100) / 100,
        worstMs: Math.round(frameTiming.worstMs * 100) / 100,
        over20Ms: frameTiming.over20Ms,
        over34Ms: frameTiming.over34Ms,
        over250Ms: frameTiming.over250Ms,
        longFrames: frameTiming.longFrames,
        longFrameOverflow: frameTiming.longFrameOverflow,
      } : null,
      ...resourceSnapshot,
    })}`,
  });
  return resources;
}

export function emitRuntimeResourceSnapshot(reason: string): void {
  emitCompactSample(null, reason, true);
}

/** Pressure callbacks and their async completion receipts must not force DOM,
 * style or animation traversal while the device is already under pressure.
 * Detailed diagnostics can explicitly opt back into that broader snapshot. */
export function emitRuntimeMemoryPressureSnapshot(reason: string): void {
  emitCompactSample(null, reason, true, true);
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
    over250Ms: 0,
    longFrames: [],
    longFrameOverflow: 0,
  };
  let lastFrameAt: number | null = null;
  let frameRequest = 0;
  let pendingIdleSample = 0;
  let pendingFallbackSample = 0;
  let skipNextMeasuredDelta = false;
  const sampleFrame = (): void => {
    // RAF's supplied timestamp can precede this callback and its synchronous
    // work. Sample the same clock as transition-performance phase boundaries.
    const now = performance.now();
    if (skipNextMeasuredDelta) {
      // Resource diagnostics are intentionally excluded from the frame window:
      // the profiler must not report its own DOM/GSAP traversal as app work.
      skipNextMeasuredDelta = false;
    } else if (lastFrameAt !== null && document.visibilityState === 'visible') {
      const frameMs = Math.max(0, now - lastFrameAt);
      // Foreground stalls are real samples even above 250ms. Lifecycle
      // boundaries reset the baseline instead of filtering by duration.
      frameWindow.samples += 1;
      frameWindow.totalMs += frameMs;
      frameWindow.worstMs = Math.max(frameWindow.worstMs, frameMs);
      if (frameMs > 20) frameWindow.over20Ms += 1;
      if (frameMs > 34) {
        frameWindow.over34Ms += 1;
        if (frameWindow.longFrames.length < MAX_LONG_FRAME_RECORDS) {
          frameWindow.longFrames.push({
            startAtMs: Math.round(lastFrameAt * 100) / 100,
            endAtMs: Math.round(now * 100) / 100,
            durationMs: Math.round(frameMs * 100) / 100,
          });
        } else {
          frameWindow.longFrameOverflow += 1;
        }
      }
      if (frameMs > 250) frameWindow.over250Ms += 1;
    }
    lastFrameAt = document.visibilityState === 'visible' ? now : null;
    frameRequest = window.requestAnimationFrame(sampleFrame);
  };
  const scheduleIdleSample = (completedWindow: FrameTimingWindow | null): void => {
    if (pendingIdleSample || pendingFallbackSample) return;
    const emit = () => {
      pendingIdleSample = 0;
      pendingFallbackSample = 0;
      const walkedResources = emitCompactSample(completedWindow);
      if (walkedResources) {
        // Only a full resource walk excludes its own expensive traversal.
        // Timing-only summaries retain all deltas, including bridge/log cost.
        skipNextMeasuredDelta = true;
        lastFrameAt = null;
      }
    };
    if (typeof runtimeWindow.requestIdleCallback === 'function') {
      pendingIdleSample = runtimeWindow.requestIdleCallback(emit, { timeout: 1_200 });
      return;
    }
    pendingFallbackSample = window.setTimeout(emit, 0);
  };
  const resetFrameBaseline = () => { lastFrameAt = null; };
  document.addEventListener('visibilitychange', resetFrameBaseline);
  window.addEventListener('pagehide', resetFrameBaseline);
  window.addEventListener('pageshow', resetFrameBaseline);
  emitCompactSample(null);
  frameRequest = window.requestAnimationFrame(sampleFrame);
  const interval = window.setInterval(() => {
    const completedWindow = frameWindow;
    frameWindow = { samples: 0, totalMs: 0, worstMs: 0, over20Ms: 0, over34Ms: 0, over250Ms: 0, longFrames: [], longFrameOverflow: 0 };
    scheduleIdleSample(completedWindow);
  }, SAMPLE_INTERVAL_MS);
  const stop = () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', resetFrameBaseline);
    window.removeEventListener('pagehide', resetFrameBaseline);
    window.removeEventListener('pageshow', resetFrameBaseline);
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
