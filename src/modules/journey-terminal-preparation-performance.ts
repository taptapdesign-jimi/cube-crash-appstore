import { arePerformanceDiagnosticsEnabled } from '../utils/runtime-diagnostics-policy.js';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

type PreparationDetail = {
  worldId?: number;
  existingUnits?: number;
  cold?: boolean;
  reused?: boolean;
  targetCount?: number;
  imageCount?: number;
};

export interface JourneyTerminalPreparationPerformance {
  start(name: string): () => void;
  phase<T>(name: string, work: () => T): T;
  mark(name: string): void;
  detail(values: PreparationDetail): void;
  finish(reason: string): void;
}

/** One opt-in record per return; no polling, RAF loop, or additional DOM reads.
 * Phases may nest (image dispatch is inside warm dispatch); do not sum them. */
export function beginJourneyTerminalPreparationPerformance(
  transitionId: number,
  source: string,
  boardId: number,
): JourneyTerminalPreparationPerformance | null {
  if (!arePerformanceDiagnosticsEnabled()) return null;
  const startedAt = performance.now();
  const phases: Array<{ name: string; atMs: number; durationMs: number }> = [];
  const detail: PreparationDetail = {};
  let ended = false;
  let timeout = 0;
  const record = (name: string, at: number, duration: number): void => {
    if (ended || phases.length >= 32) return;
    phases.push({ name, atMs: Math.round(at - startedAt), durationMs: Math.round(duration) });
  };
  const finish = (reason: string): void => {
    if (ended) return;
    ended = true;
    clearTimeout(timeout);
    emitNativeConsoleDiagnostic('[CC_JOURNEY_RETURN_PREP]', 'summary', {
      transitionId, source, boardId, startedAt: Math.round(startedAt),
      durationMs: Math.round(performance.now() - startedAt), reason, ...detail, phases,
    });
  };
  timeout = window.setTimeout(() => finish('timeout'), 5000);
  const start = (name: string): (() => void) => {
    if (ended) return () => {};
    const at = performance.now();
    let recorded = false;
    return () => {
      if (recorded || ended) return;
      recorded = true;
      record(name, at, performance.now() - at);
    };
  };
  return {
    start,
    phase: (name, work) => {
      const end = start(name);
      try { return work(); } finally { end(); }
    },
    mark: (name) => { if (!ended) record(name, performance.now(), 0); },
    detail: (values) => { if (!ended) Object.assign(detail, values); },
    finish,
  };
}
