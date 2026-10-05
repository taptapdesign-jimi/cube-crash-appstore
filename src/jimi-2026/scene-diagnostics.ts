import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

export interface SceneDiagnostics {
  /** Measures synchronous invocation only. For an awaited operation use paired
   * marks, e.g. resource-wait-start/resource-wait-end, around the await. */
  phase<T>(name: string, work: () => T): T;
  mark(name: string): void;
  /** Idempotent; stops all diagnostic work before emitting one final receipt. */
  finish(reason: string): void;
}

export const SCENE_DIAGNOSTIC_LIMITS = Object.freeze({
  phases: 64,
  marks: 64,
  stalls: 32,
  labelLength: 96,
  maxDurationMs: 15_000,
  stallThresholdMs: 34,
});

type Phase = { name: string; atMs: number; durationMs: number; failed: boolean };
type Mark = { name: string; atMs: number };
type Stall = { startAtMs: number; endAtMs: number; durationMs: number };

const disabled: SceneDiagnostics = Object.freeze({
  phase<T>(_name: string, work: () => T): T { return work(); },
  mark(_name: string): void {},
  finish(_reason: string): void {},
});
const round = (value: number): number => Math.round(value * 10) / 10;
const label = (value: string): string => value.slice(0, SCENE_DIAGNOSTIC_LIMITS.labelLength);

/** One opt-in route observation, not a route/animation owner. All timestamps use
 * performance.now(); marks/phases are relative to startAtMs, stalls are absolute
 * on that same clock. No layout, asset, scene graph or computed-style reads.
 * RAF gaps and synchronous durations cannot prove presented frames or GPU cause.
 * No work resumes automatically after background, abort or pagehide. */
export function createSceneDiagnostics(route: string, enabled: boolean, signal?: AbortSignal): SceneDiagnostics {
  if (!enabled) return disabled;

  const lifecycle = createScreenLifecycle('jimi-scene-diagnostics');
  const start = performance.now();
  let previous = start;
  let stopped = false;
  let samples = 0;
  let worstIntervalMs = 0;
  let phasesDropped = 0;
  let marksDropped = 0;
  let stallsDropped = 0;
  let stallCount = 0;
  const phases: Phase[] = [];
  const marks: Mark[] = [];
  const stalls: Stall[] = [];

  const finish = (reason: string): void => {
    if (stopped) return;
    stopped = true;
    lifecycle.cleanup();
    const finishedAt = performance.now();
    emitNativeConsoleDiagnostic('[JIMI_SCENE_DIAGNOSTICS]', label(route), {
      reason: label(reason),
      startAtMs: round(start),
      elapsedMs: round(finishedAt - start),
      // The unsampled last-callback/start -> finish tail is not a RAF interval.
      commitTailMs: round(finishedAt - previous),
      samples,
      worstIntervalMs: round(worstIntervalMs),
      stallThresholdMs: SCENE_DIAGNOSTIC_LIMITS.stallThresholdMs,
      stallCount,
      phases,
      marks,
      stalls,
      phasesDropped,
      marksDropped,
      stallsDropped,
      metric: 'Synchronous phases and RAF callback gaps; not presented frames or GPU attribution',
    });
  };

  const diagnostics: SceneDiagnostics = {
    phase<T>(name: string, work: () => T): T {
      if (stopped) return work();
      const phaseStart = performance.now();
      let failed = false;
      try { return work(); }
      catch (error) { failed = true; throw error; }
      finally {
        // A synchronous work callback may itself trigger cancellation/pagehide.
        // Never mutate a receipt after finish has published it.
        if (!stopped) {
          const phaseEnd = performance.now();
          if (phases.length < SCENE_DIAGNOSTIC_LIMITS.phases) {
            phases.push({ name: label(name), atMs: round(phaseStart - start), durationMs: round(phaseEnd - phaseStart), failed });
          } else phasesDropped++;
        }
      }
    },
    mark(name) {
      if (stopped) return;
      if (marks.length < SCENE_DIAGNOSTIC_LIMITS.marks) marks.push({ name: label(name), atMs: round(performance.now() - start) });
      else marksDropped++;
    },
    finish,
  };

  const sample = (): void => {
    if (stopped) return;
    const now = performance.now();
    const duration = now - previous;
    samples++;
    worstIntervalMs = Math.max(worstIntervalMs, duration);
    if (duration > SCENE_DIAGNOSTIC_LIMITS.stallThresholdMs) {
      stallCount++;
      if (stalls.length < SCENE_DIAGNOSTIC_LIMITS.stalls) {
        stalls.push({ startAtMs: round(previous), endAtMs: round(now), durationMs: round(duration) });
      } else stallsDropped++;
    }
    previous = now;
    lifecycle.trackRaf(sample);
  };

  if (signal?.aborted) { finish('cancelled'); return diagnostics; }
  if (document.hidden) { finish('background'); return diagnostics; }
  if (signal) lifecycle.trackListener(signal, 'abort', () => finish('cancelled'), { once: true });
  lifecycle.trackListener(document, 'visibilitychange', () => { if (document.hidden) finish('background'); });
  lifecycle.trackListener(window, 'pagehide', () => finish('pagehide'), { once: true });
  // A diagnostic must not become a permanent idle loop if its caller stalls.
  lifecycle.trackTimeout(() => finish('timeout'), SCENE_DIAGNOSTIC_LIMITS.maxDurationMs);
  lifecycle.trackRaf(sample);
  return diagnostics;
}
