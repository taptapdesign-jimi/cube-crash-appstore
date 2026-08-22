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

type ActiveJourneyTransitionAudit = {
  marker: string;
  markerAt: number;
};

let activeTransitionAudit: ActiveJourneyTransitionAudit | null = null;

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
    activeCssAnimations: typeof document.getAnimations === 'function'
      ? document.getAnimations().filter((animation) => animation.playState === 'running').length
      : -1,
    willChangeCount: elements.filter((element) => getComputedStyle(element).willChange !== 'auto').length,
    filterCount: elements.filter((element) => {
      const style = getComputedStyle(element);
      return style.filter !== 'none' || style.backdropFilter !== 'none';
    }).length,
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
  if (typeof window === 'undefined' || !/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return () => {};
  }

  const startedAt = performance.now();
  let lastFrameAt = startedAt;
  let frameId: number | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;
  const samples: number[] = [];
  const container = document.getElementById('journey-boards-container') as HTMLElement | null;
  const transitionAudit = { marker: 'audit-start', markerAt: startedAt };
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
    });
  };

  const sampleFrame = (frameAt: number): void => {
    if (finished) return;
    const frameMs = frameAt - lastFrameAt;
    samples.push(frameMs);
    if (frameMs > 50) {
      emitIOSNativeDiagnostic('world-transition-long-frame', {
        ...context,
        frameMs: Math.round(frameMs),
        ...getTransitionWorkSnapshot(container, transitionAudit),
      });
    }
    lastFrameAt = frameAt;
    frameId = requestAnimationFrame(sampleFrame);
  };

  emitIOSNativeDiagnostic('world-enter-performance-begin', { ...context });
  frameId = requestAnimationFrame(sampleFrame);
  stopTimer = setTimeout(() => finish('timeout'), 2500);
  return finish;
}
