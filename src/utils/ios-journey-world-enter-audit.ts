import { emitIOSNativeDiagnostic } from './ios-native-diagnostic.js';

export interface JourneyWorldEnterAuditContext {
  worldId: number;
  source: string;
  unitCount: number;
  targetCount: number;
}

export interface JourneyWorldEnterFrameSummary {
  count: number;
  averageMs: number;
  worstMs: number;
  over20: number;
  over34: number;
  over50: number;
}

export function summarizeJourneyWorldEnterFrames(samples: number[]): JourneyWorldEnterFrameSummary {
  const finiteSamples = samples.filter(Number.isFinite).map((sample) => Math.max(0, Math.min(250, sample)));
  const average = finiteSamples.length
    ? finiteSamples.reduce((sum, sample) => sum + sample, 0) / finiteSamples.length
    : 0;

  return {
    count: finiteSamples.length,
    averageMs: Number(average.toFixed(2)),
    worstMs: Number((finiteSamples.length ? Math.max(...finiteSamples) : 0).toFixed(2)),
    over20: finiteSamples.filter((sample) => sample > 20).length,
    over34: finiteSamples.filter((sample) => sample > 34).length,
    over50: finiteSamples.filter((sample) => sample > 50).length,
  };
}

export function startIOSJourneyWorldEnterAudit(
  context: JourneyWorldEnterAuditContext,
): (reason: string) => void {
  if (typeof window === 'undefined' || !/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return () => {};
  }

  const startedAt = performance.now();
  let lastFrameAt = startedAt;
  let frameId: number | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;
  const samples: number[] = [];

  const finish = (reason: string): void => {
    if (finished) return;
    finished = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    if (stopTimer !== null) clearTimeout(stopTimer);
    emitIOSNativeDiagnostic('world-enter-performance', {
      ...context,
      reason,
      durationMs: Math.round(performance.now() - startedAt),
      frames: summarizeJourneyWorldEnterFrames(samples),
    });
  };

  const sampleFrame = (frameAt: number): void => {
    if (finished) return;
    samples.push(frameAt - lastFrameAt);
    lastFrameAt = frameAt;
    frameId = requestAnimationFrame(sampleFrame);
  };

  emitIOSNativeDiagnostic('world-enter-performance-begin', { ...context });
  frameId = requestAnimationFrame(sampleFrame);
  stopTimer = setTimeout(() => finish('timeout'), 2500);
  return finish;
}
