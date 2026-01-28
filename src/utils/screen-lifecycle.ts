// Simple lifecycle tracker for screens/modules
// Tracks timeouts, RAFs, intervals, listeners, and custom cleanup callbacks.

import { logger } from '../core/logger.js';

type CleanupFn = () => void;

type ListenerEntry = {
  target: EventTarget;
  event: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};

export function createScreenLifecycle(name: string) {
  const timeouts = new Set<NodeJS.Timeout>();
  const intervals = new Set<NodeJS.Timeout>();
  const rafs = new Set<number>();
  const listeners: ListenerEntry[] = [];
  const cleanups: CleanupFn[] = [];

  const trackTimeout = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      try { fn(); } finally { timeouts.delete(t); }
    }, ms);
    timeouts.add(t);
    return t;
  };

  const trackInterval = (fn: () => void, ms: number) => {
    const i = setInterval(fn, ms);
    intervals.add(i);
    return i;
  };

  const trackRaf = (fn: FrameRequestCallback) => {
    const id = requestAnimationFrame((ts) => {
      try { fn(ts); } finally { rafs.delete(id); }
    });
    rafs.add(id);
    return id;
  };

  const trackListener = (
    target: EventTarget,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => {
    target.addEventListener(event, handler, options);
    listeners.push({ target, event, handler, options });
  };

  const trackCleanup = (fn: CleanupFn) => {
    cleanups.push(fn);
  };

  const cleanup = () => {
    if (timeouts.size || intervals.size || rafs.size || listeners.length || cleanups.length) {
      logger.debug(
        `🧹 Cleaning lifecycle for ${name}: t=${timeouts.size}, i=${intervals.size}, r=${rafs.size}, l=${listeners.length}, c=${cleanups.length}`,
        name
      );
    }
    timeouts.forEach(t => { try { clearTimeout(t); } catch {} });
    intervals.forEach(i => { try { clearInterval(i); } catch {} });
    rafs.forEach(r => { try { cancelAnimationFrame(r); } catch {} });
    timeouts.clear();
    intervals.clear();
    rafs.clear();
    for (const { target, event, handler, options } of listeners) {
      try { target.removeEventListener(event, handler, options); } catch {}
    }
    listeners.length = 0;
    for (const fn of cleanups) {
      try { fn(); } catch {}
    }
    cleanups.length = 0;
  };

  return { trackTimeout, trackInterval, trackRaf, trackListener, trackCleanup, cleanup };
}
