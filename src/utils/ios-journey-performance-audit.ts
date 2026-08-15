import animationManager from '../modules/animation-manager.js';
import { getAppCleanupStats } from '../modules/app-core-utils.js';

type AuditState = { id: number; boardNumber: number; startedAt: number; lastFrameAt: number; lastReportAt: number; samples: number[]; frameId: number | null; stopTimer: ReturnType<typeof setTimeout> | null };
let sequence = 0;
let activeAudit: AuditState | null = null;
const now = () => performance.now();

function emitNativeAudit(message: string, payload: unknown): void {
  try {
    const handler = (window as any).webkit?.messageHandlers?.consoleLog;
    if (!handler?.postMessage) return;
    handler.postMessage({
      level: 'info',
      message: `${message} ${JSON.stringify(payload)}`,
    });
  } catch {}
}

function elementSnapshot(element: HTMLElement | null) {
  if (!element) return null;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return { connected: element.isConnected, hidden: element.hidden, display: style.display, visibility: style.visibility, opacity: style.opacity, transform: style.transform, willChange: style.willChange, width: Math.round(rect.width), height: Math.round(rect.height), childCount: element.querySelectorAll('*').length, imageCount: element.querySelectorAll('img').length };
}

function finish(reason: string): void {
  const audit = activeAudit;
  if (!audit) return;
  activeAudit = null;
  if (audit.frameId !== null) cancelAnimationFrame(audit.frameId);
  if (audit.stopTimer !== null) clearTimeout(audit.stopTimer);
  const payload = { id: audit.id, boardNumber: audit.boardNumber, reason, durationMs: Math.round(now() - audit.startedAt) };
  console.info('🧪 JourneyIOSPerf complete', payload);
  emitNativeAudit('🧪 JourneyIOSPerf complete', payload);
}

function report(audit: AuditState, reportAt: number): void {
  const samples = audit.samples.splice(0);
  const average = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 0;
  const overlay = document.getElementById('cc-board-transition-overlay') as HTMLElement | null;
  const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
  const bottomDecor = document.getElementById('journey-game-bottom-decor') as HTMLImageElement | null;
  const animatedElements = typeof document.getAnimations === 'function' ? document.getAnimations().length : -1;
  const willChangeElements = Array.from(document.querySelectorAll<HTMLElement>('[style*="will-change"]')).filter(element => getComputedStyle(element).willChange !== 'auto').length;
  let gsapChildren = -1;
  try { gsapChildren = ((window as any).gsap?.globalTimeline?.getChildren?.(true, true, true) || []).length; } catch {}
  const payload = {
    id: audit.id, boardNumber: audit.boardNumber, atMs: Math.round(reportAt - audit.startedAt),
    frames: { count: samples.length, averageMs: Number(average.toFixed(2)), worstMs: Number((samples.length ? Math.max(...samples) : 0).toFixed(2)), over20: samples.filter(value => value > 20).length, over28: samples.filter(value => value > 28).length, over34: samples.filter(value => value > 34).length, over50: samples.filter(value => value > 50).length },
    transitionActive: (window as any).__ccBoardTransitionActive === true,
    enterAnimationActive: (window as any).__ccEnterAnimationActive === true,
    overlay: elementSnapshot(overlay), journeyScreen: elementSnapshot(journeyScreen),
    bottomDecor: bottomDecor ? { ...elementSnapshot(bottomDecor), naturalWidth: bottomDecor.naturalWidth, naturalHeight: bottomDecor.naturalHeight, src: bottomDecor.currentSrc || bottomDecor.src } : null,
    animatedElements, willChangeElements, gsapChildren,
    animationManager: animationManager.getStats(), resources: getAppCleanupStats(),
    boardBudget: (window as any).__ccLastBoardPerf || null, dragPerf: (window as any).__ccLastDragPerf || null, mergePerf: (window as any).__ccLastMergePerf || null,
  };
  (window as any).__ccLastJourneyIOSPerf = payload;
  console.info('🧪 JourneyIOSPerf sample', payload);
  emitNativeAudit('🧪 JourneyIOSPerf sample', payload);
}

export function startIOSJourneyPerformanceAudit(boardNumber: number): void {
  if (typeof window === 'undefined' || !/iPad|iPhone|iPod/.test(navigator.userAgent)) return;
  finish('superseded');
  const startedAt = now();
  const audit: AuditState = { id: ++sequence, boardNumber, startedAt, lastFrameAt: startedAt, lastReportAt: startedAt, samples: [], frameId: null, stopTimer: null };
  activeAudit = audit;
  const beginPayload = { id: audit.id, boardNumber };
  console.info('🧪 JourneyIOSPerf begin', beginPayload);
  emitNativeAudit('🧪 JourneyIOSPerf begin', beginPayload);
  const loop = (frameAt: number) => {
    if (activeAudit !== audit) return;
    audit.samples.push(Math.max(0, Math.min(250, frameAt - audit.lastFrameAt)));
    audit.lastFrameAt = frameAt;
    if (frameAt - audit.lastReportAt >= 1000) { audit.lastReportAt = frameAt; report(audit, frameAt); }
    audit.frameId = requestAnimationFrame(loop);
  };
  audit.frameId = requestAnimationFrame(loop);
  audit.stopTimer = setTimeout(() => finish('diagnostic-window-complete'), 30000);
}

export function stopIOSJourneyPerformanceAudit(reason = 'transition-cleanup'): void {
  finish(reason);
}
