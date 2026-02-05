import { logger } from '../core/logger.js';

type PerfMonitorOptions = {
  sampleMs?: number;
};

let rafId: number | null = null;
let lastSample = 0;
let frames = 0;
let enabled = false;
let observer: PerformanceObserver | null = null;
let longTaskCount = 0;
let longTaskTotalMs = 0;

function resetLongTasks(): void {
  longTaskCount = 0;
  longTaskTotalMs = 0;
}

function recordLongTaskEntries(entries: PerformanceEntryList): void {
  for (const entry of entries.getEntries()) {
    longTaskCount += 1;
    longTaskTotalMs += entry.duration || 0;
  }
}

function startRafLoop(sampleMs: number): void {
  lastSample = performance.now();
  frames = 0;
  resetLongTasks();

  const loop = (now: number) => {
    frames += 1;
    const elapsed = now - lastSample;
    if (elapsed >= sampleMs) {
      const fps = Math.round((frames * 1000) / elapsed);
      const mem = (performance as any).memory?.usedJSHeapSize;
      const memMB = typeof mem === 'number' ? Math.round(mem / 1024 / 1024) : null;
      const payload: Record<string, number> = {
        fps,
        longTaskCount,
        longTaskTotalMs: Math.round(longTaskTotalMs)
      };
      if (memMB !== null) payload.memoryMB = memMB;
      logger.info('Perf sample', 'perf-monitor', payload);
      lastSample = now;
      frames = 0;
      resetLongTasks();
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

function startLongTaskObserver(): void {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    observer = new PerformanceObserver(recordLongTaskEntries);
    observer.observe({ entryTypes: ['longtask'] });
  } catch {
    observer = null;
  }
}

function stopLongTaskObserver(): void {
  try {
    observer?.disconnect();
  } catch {}
  observer = null;
}

export function startPerfMonitor(options: PerfMonitorOptions = {}): void {
  if (enabled) return;
  if (typeof performance === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
  enabled = true;
  const sampleMs = options.sampleMs ?? 5000;
  startLongTaskObserver();
  startRafLoop(sampleMs);
  logger.info('Perf monitor enabled', 'perf-monitor', { sampleMs });
}

export function stopPerfMonitor(): void {
  if (!enabled) return;
  enabled = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  stopLongTaskObserver();
  logger.info('Perf monitor disabled', 'perf-monitor');
}

export function startPerfMonitorIfEnabled(): void {
  try {
    const flag = localStorage.getItem('cc_perf_monitor');
    if (flag === '1' || flag === 'true') {
      startPerfMonitor();
    }
  } catch {
    // ignore storage errors
  }
}
