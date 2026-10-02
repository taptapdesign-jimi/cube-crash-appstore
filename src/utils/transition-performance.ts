import { arePerformanceDiagnosticsEnabled } from './runtime-diagnostics-policy.js';
import { emitNativeConsoleDiagnostic } from './ios-native-diagnostic.js';

export interface TransitionPerformance {
  phase<T>(name: string, work: () => T, aggregate?: boolean): T;
  mark(name: string): void;
  finish(reason?: string): void;
}

const disabled: TransitionPerformance = {
  phase: (_name, work) => work(),
  mark: () => {},
  finish: () => {},
};

/** Short opt-in capture: no DOM reads, per-frame logging or production ticker. */
export function beginTransitionPerformance(name: string): TransitionPerformance {
  if (!arePerformanceDiagnosticsEnabled()) return disabled;
  const startedAt = performance.now();
  const phases: Array<{ name: string; atMs: number; durationMs: number }> = [];
  const phaseTotals = new Map<string, { name: string; atMs: number; durationMs: number; samples: number; worstMs: number }>();
  const stalls: Array<{ atMs: number; durationMs: number }> = [];
  let previous = startedAt;
  let frames = 0;
  let worstMs = 0;
  let over34Ms = 0;
  let ended = false;
  let raf = 0;
  let timeout = 0;
  const finish = (reason = 'complete'): void => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    clearTimeout(timeout);
    document.removeEventListener('visibilitychange', onVisibility);
    emitNativeConsoleDiagnostic('[CC_TRANSITION_PERF]', name, {
      startedAt: Math.round(startedAt),
      durationMs: Math.round(performance.now() - startedAt),
      reason, frames, worstMs: Math.round(worstMs), over34Ms, stalls, phases,
      ...(phaseTotals.size ? { phaseTotals: Array.from(phaseTotals.values()).map(phase => ({
        ...phase, durationMs: Math.round(phase.durationMs), worstMs: Math.round(phase.worstMs),
      })) } : {}),
    });
  };
  const onVisibility = (): void => {
    if (document.visibilityState !== 'visible') finish('hidden');
  };
  const tick = (): void => {
    if (ended) return;
    // RAF's timestamp belongs to the frame start and can predate a capture
    // begun by another callback in that same frame. Keep one monotonic clock
    // for setup, callback gaps and the summary's relative offsets.
    const now = performance.now();
    const durationMs = now - previous;
    previous = now;
    frames += 1;
    worstMs = Math.max(worstMs, durationMs);
    if (durationMs > 34) {
      over34Ms += 1;
      if (stalls.length < 24) stalls.push({ atMs: Math.round(now - startedAt), durationMs: Math.round(durationMs) });
    }
    raf = requestAnimationFrame(tick);
  };
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(tick);
  timeout = window.setTimeout(() => finish('timeout'), 5000);
  return {
    mark: (phaseName) => {
      if (!ended && phases.length < 32) {
        phases.push({ name: phaseName, atMs: Math.round(performance.now() - startedAt), durationMs: 0 });
      }
    },
    phase: (phaseName, work, aggregate = false) => {
      const at = performance.now();
      try { return work(); }
      finally {
        if (!ended && aggregate && (phaseTotals.has(phaseName) || phaseTotals.size < 16)) {
          const durationMs = performance.now() - at;
          const total = phaseTotals.get(phaseName) ?? {
            name: phaseName, atMs: Math.round(at - startedAt), durationMs: 0, samples: 0, worstMs: 0,
          };
          total.durationMs += durationMs;
          total.samples += 1;
          total.worstMs = Math.max(total.worstMs, durationMs);
          phaseTotals.set(phaseName, total);
        } else if (!ended && !aggregate && phases.length < 32) {
          phases.push({ name: phaseName, atMs: Math.round(at - startedAt), durationMs: Math.round(performance.now() - at) });
        }
      }
    },
    finish,
  };
}
