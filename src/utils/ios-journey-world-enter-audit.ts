import { emitIOSNativeDiagnostic } from './ios-native-diagnostic.js';
import { areContinuousRuntimeDiagnosticsEnabled } from './runtime-diagnostics-policy.js';

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

interface JourneyWorldSlowFrame {
  frameMs: number;
  marker: string;
  markerAgeMs: number;
  intervalStartMarker?: string;
  intervalEndMarker?: string;
}

type ActiveJourneyTransitionAudit = {
  marker: string;
  markerAt: number;
};

let activeTransitionAudit: ActiveJourneyTransitionAudit | null = null;

interface JourneyRoutePhaseAccumulator {
  count: number;
  totalMs: number;
  worstMs: number;
  over20: number;
  over34: number;
  over50: number;
}

interface JourneyRouteSlowFrame extends JourneyWorldSlowFrame {
  elapsedMs: number;
}

type ActiveJourneyRouteAudit = {
  startedAt: number;
  lastFrameAt: number;
  marker: string;
  markerAt: number;
  frameId: number | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
  phases: Map<string, JourneyRoutePhaseAccumulator>;
  slowFrames: JourneyRouteSlowFrame[];
};

let activeRouteAudit: ActiveJourneyRouteAudit | null = null;

function createRoutePhaseAccumulator(): JourneyRoutePhaseAccumulator {
  return { count: 0, totalMs: 0, worstMs: 0, over20: 0, over34: 0, over50: 0 };
}

export function beginIOSJourneyRouteAudit(source = 'homepage-slider'): void {
  if (!areContinuousRuntimeDiagnosticsEnabled()) return;
  if (typeof window === 'undefined' || !/iPad|iPhone|iPod/.test(navigator.userAgent)) return;
  if (activeRouteAudit) finishIOSJourneyRouteAudit('superseded');

  const startedAt = performance.now();
  const audit: ActiveJourneyRouteAudit = {
    startedAt,
    lastFrameAt: startedAt,
    marker: 'homepage-to-journey-prep',
    markerAt: startedAt,
    frameId: null,
    stopTimer: null,
    phases: new Map(),
    slowFrames: [],
  };
  activeRouteAudit = audit;

  const sampleFrame = (frameAt: number): void => {
    if (activeRouteAudit !== audit) return;
    const frameMs = Math.max(0, Math.min(250, frameAt - audit.lastFrameAt));
    const phase = audit.phases.get(audit.marker) || createRoutePhaseAccumulator();
    phase.count += 1;
    phase.totalMs += frameMs;
    phase.worstMs = Math.max(phase.worstMs, frameMs);
    if (frameMs > 20) phase.over20 += 1;
    if (frameMs > 34) phase.over34 += 1;
    if (frameMs > 50) phase.over50 += 1;
    audit.phases.set(audit.marker, phase);
    if (frameMs > 20) {
      audit.slowFrames.push({
        frameMs: Number(frameMs.toFixed(2)),
        marker: audit.marker,
        markerAgeMs: Math.round(frameAt - audit.markerAt),
        elapsedMs: Math.round(frameAt - audit.startedAt),
      });
      audit.slowFrames.sort((left, right) => right.frameMs - left.frameMs);
      if (audit.slowFrames.length > 16) audit.slowFrames.length = 16;
    }
    audit.lastFrameAt = frameAt;
    audit.frameId = requestAnimationFrame(sampleFrame);
  };

  emitIOSNativeDiagnostic('journey-route-performance-begin', { source });
  audit.frameId = requestAnimationFrame(sampleFrame);
  audit.stopTimer = setTimeout(() => finishIOSJourneyRouteAudit('timeout'), 60_000);
}

export function markIOSJourneyRouteAudit(marker: string): void {
  const audit = activeRouteAudit;
  if (!audit) return;
  audit.marker = marker;
  audit.markerAt = performance.now();
  emitIOSNativeDiagnostic('journey-route-marker', {
    marker,
    elapsedMs: Math.round(audit.markerAt - audit.startedAt),
  });
}

export function finishIOSJourneyRouteAudit(reason = 'complete'): void {
  const audit = activeRouteAudit;
  if (!audit) return;
  activeRouteAudit = null;
  if (audit.frameId !== null) cancelAnimationFrame(audit.frameId);
  if (audit.stopTimer !== null) clearTimeout(audit.stopTimer);

  const phases = Array.from(audit.phases.entries()).map(([marker, phase]) => ({
    marker,
    frames: {
      count: phase.count,
      averageMs: Number((phase.count ? phase.totalMs / phase.count : 0).toFixed(2)),
      worstMs: Number(phase.worstMs.toFixed(2)),
      over20: phase.over20,
      over34: phase.over34,
      over50: phase.over50,
    },
  }));
  const allFrames = phases.reduce((total, phase) => total + phase.frames.count, 0);
  const weightedTotal = phases.reduce(
    (total, phase) => total + (phase.frames.averageMs * phase.frames.count),
    0,
  );
  emitIOSNativeDiagnostic('journey-route-performance', {
    reason,
    durationMs: Math.round(performance.now() - audit.startedAt),
    frames: {
      count: allFrames,
      averageMs: Number((allFrames ? weightedTotal / allFrames : 0).toFixed(2)),
      worstMs: Number(Math.max(0, ...phases.map((phase) => phase.frames.worstMs)).toFixed(2)),
      over20: phases.reduce((total, phase) => total + phase.frames.over20, 0),
      over34: phases.reduce((total, phase) => total + phase.frames.over34, 0),
      over50: phases.reduce((total, phase) => total + phase.frames.over50, 0),
    },
    phases,
    slowFrames: audit.slowFrames,
  });
}

export function markIOSJourneyTransitionAudit(marker: string): void {
  if (!activeTransitionAudit) return;
  activeTransitionAudit.marker = marker;
  activeTransitionAudit.markerAt = performance.now();
  emitIOSNativeDiagnostic('world-transition-marker', { marker });
}

function getTransitionWorkSnapshot(
  container: HTMLElement | null,
  transitionAudit: ActiveJourneyTransitionAudit,
): Record<string, unknown> {
  const elements = container ? Array.from(container.querySelectorAll<HTMLElement>('*')) : [];
  let gsapChildren = -1;
  try { gsapChildren = ((window as any).gsap?.globalTimeline?.getChildren?.(true, true, true) || []).length; } catch {}
  return {
    marker: transitionAudit.marker,
    markerAgeMs: Math.round(performance.now() - transitionAudit.markerAt),
    childCount: elements.length,
    imageCount: container?.querySelectorAll('img').length ?? 0,
    // A slow-frame observer must not force style resolution over the complete
    // scene and create the next slow frame itself. Inline ownership is enough
    // for transition attribution; expensive computed snapshots belong in a
    // separately scheduled idle diagnostic.
    activeCssAnimations: -1,
    willChangeCount: elements.filter((element) => (
      !!element.style.willChange && element.style.willChange !== 'auto'
    )).length,
    filterCount: elements.filter((element) => (
      (!!element.style.filter && element.style.filter !== 'none') ||
      (!!element.style.backdropFilter && element.style.backdropFilter !== 'none')
    )).length,
    gsapChildren,
  };
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
  if (!areContinuousRuntimeDiagnosticsEnabled()) return () => {};
  if (typeof window === 'undefined' || !/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return () => {};
  }

  const startedAt = performance.now();
  let lastFrameAt = startedAt;
  let frameId: number | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;
  const samples: number[] = [];
  const slowFrames: JourneyWorldSlowFrame[] = [];
  const container = document.getElementById('journey-boards-container') as HTMLElement | null;
  const transitionAudit = { marker: 'audit-start', markerAt: startedAt };
  let intervalStartMarker = transitionAudit.marker;
  activeTransitionAudit = transitionAudit;

  const finish = (reason: string): void => {
    if (finished) return;
    finished = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    if (stopTimer !== null) clearTimeout(stopTimer);
    if (activeTransitionAudit === transitionAudit) activeTransitionAudit = null;
    emitIOSNativeDiagnostic('world-enter-performance', {
      ...context,
      reason,
      durationMs: Math.round(performance.now() - startedAt),
      frames: summarizeJourneyWorldEnterFrames(samples),
      slowFrames,
    });
  };

  const sampleFrame = (frameAt: number): void => {
    if (finished) return;
    const frameMs = frameAt - lastFrameAt;
    const intervalEndMarker = transitionAudit.marker;
    samples.push(frameMs);
    if (frameMs > 20) {
      slowFrames.push({
        frameMs: Number(frameMs.toFixed(2)),
        marker: intervalStartMarker,
        markerAgeMs: Math.round(performance.now() - transitionAudit.markerAt),
        intervalStartMarker,
        intervalEndMarker,
      });
      slowFrames.sort((left, right) => right.frameMs - left.frameMs);
      if (slowFrames.length > 8) slowFrames.length = 8;
    }
    if (frameMs > 50) {
      emitIOSNativeDiagnostic('world-transition-long-frame', {
        ...context,
        frameMs: Math.round(frameMs),
        ...getTransitionWorkSnapshot(container, transitionAudit),
        intervalStartMarker,
        intervalEndMarker,
      });
    }
    lastFrameAt = frameAt;
    intervalStartMarker = transitionAudit.marker;
    frameId = requestAnimationFrame(sampleFrame);
  };

  emitIOSNativeDiagnostic('world-enter-performance-begin', { ...context });
  frameId = requestAnimationFrame(sampleFrame);
  stopTimer = setTimeout(() => finish('timeout'), 2500);
  return finish;
}
