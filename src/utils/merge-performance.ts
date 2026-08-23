export type MergePerformanceKind = 'regular-stack' | 'regular-merge6' | 'wild-merge';

export type MergePerformanceMeta = {
  kind: MergePerformanceKind;
  sourceValue: number;
  targetValue: number;
  sourceSpecial?: string | null;
  targetSpecial?: string | null;
  rendererResolution?: number;
};

export type MergePerformanceMilestone = {
  name: string;
  atMs: number;
};

export type MergePerformanceSummary = MergePerformanceMeta & {
  id: number;
  reason: string;
  durationMs: number;
  sampleCount: number;
  averageFrameMs: number;
  worstFrameMs: number;
  framesOver20Ms: number;
  framesOver28Ms: number;
  framesOver34Ms: number;
  milestones: MergePerformanceMilestone[];
};

type ActiveMergeTrace = {
  id: number;
  meta: MergePerformanceMeta;
  startedAt: number;
  lastFrameAt: number;
  samples: number[];
  milestones: MergePerformanceMilestone[];
  frameId: number | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

let sequence = 0;
let activeTrace: ActiveMergeTrace | null = null;

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function summarizeMergeFrames(samples: number[]) {
  const usable = samples.filter(value => Number.isFinite(value) && value >= 0);
  const average = usable.length
    ? usable.reduce((sum, value) => sum + value, 0) / usable.length
    : 0;
  return {
    sampleCount: usable.length,
    averageFrameMs: Number(average.toFixed(2)),
    worstFrameMs: Number((usable.length ? Math.max(...usable) : 0).toFixed(2)),
    framesOver20Ms: usable.filter(value => value > 20).length,
    framesOver28Ms: usable.filter(value => value > 28).length,
    framesOver34Ms: usable.filter(value => value > 34).length,
  };
}

function publish(summary: MergePerformanceSummary): void {
  if (typeof window === 'undefined') return;
  (window as any).__ccLastMergePerf = summary;
  const history = Array.isArray((window as any).__ccMergePerfHistory)
    ? (window as any).__ccMergePerfHistory
    : [];
  history.push(summary);
  (window as any).__ccMergePerfHistory = history.slice(-10);
}

export function finishMergePerformanceTrace(reason = 'settled'): MergePerformanceSummary | null {
  const trace = activeTrace;
  if (!trace) return null;
  activeTrace = null;
  if (trace.frameId !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(trace.frameId);
  }
  if (trace.timeoutId !== null) clearTimeout(trace.timeoutId);
  const durationMs = Math.max(0, now() - trace.startedAt);
  const summary: MergePerformanceSummary = {
    id: trace.id,
    ...trace.meta,
    reason,
    durationMs: Number(durationMs.toFixed(1)),
    ...summarizeMergeFrames(trace.samples),
    milestones: trace.milestones,
  };
  publish(summary);
  console.info('🧪 MergePerf summary', summary);
  return summary;
}

export function beginMergePerformanceTrace(meta: MergePerformanceMeta): number {
  if (!areContinuousRuntimeDiagnosticsEnabled()) return 0;
  finishMergePerformanceTrace('superseded-by-next-merge');
  const startedAt = now();
  const trace: ActiveMergeTrace = {
    id: ++sequence,
    meta,
    startedAt,
    lastFrameAt: startedAt,
    samples: [],
    milestones: [{ name: 'drop', atMs: 0 }],
    frameId: null,
    timeoutId: null,
  };
  activeTrace = trace;
  if (typeof requestAnimationFrame === 'function') {
    const loop = (frameAt: number) => {
      if (activeTrace !== trace) return;
      trace.samples.push(Math.max(0, Math.min(250, frameAt - trace.lastFrameAt)));
      trace.lastFrameAt = frameAt;
      trace.frameId = requestAnimationFrame(loop);
    };
    trace.frameId = requestAnimationFrame(loop);
  }
  const windowMs = meta.kind === 'regular-stack' ? 700 : 2200;
  trace.timeoutId = setTimeout(() => finishMergePerformanceTrace('settled-window-complete'), windowMs);
  return trace.id;
}

export function markMergePerformance(name: string): void {
  if (!activeTrace) return;
  activeTrace.milestones.push({
    name,
    atMs: Number(Math.max(0, now() - activeTrace.startedAt).toFixed(1)),
  });
}

export function resetMergePerformanceForTests(): void {
  if (activeTrace?.frameId !== null && activeTrace?.frameId !== undefined && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(activeTrace.frameId);
  }
  if (activeTrace?.timeoutId) clearTimeout(activeTrace.timeoutId);
  activeTrace = null;
  sequence = 0;
}
import { areContinuousRuntimeDiagnosticsEnabled } from './runtime-diagnostics-policy.js';
