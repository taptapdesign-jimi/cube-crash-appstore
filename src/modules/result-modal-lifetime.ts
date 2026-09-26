/** Own scheduled presentation work independently of later result screens.
 * Hidden time does not consume entrance delays; disposal retires every wait. */
export function createResultModalLifetime() {
  let disposed = false;
  let suspended = false;
  type TimeoutEntry = { callback: () => void; remaining: number; started: number; version: number; id?: ReturnType<typeof setTimeout> };
  type FrameEntry = { callback: FrameRequestCallback; version: number; id?: number };
  const timeouts = new Set<TimeoutEntry>();
  const frames = new Set<FrameEntry>();
  const cleanups = new Set<() => void>();
  const armTimeout = (entry: TimeoutEntry): void => {
    const version = ++entry.version;
    entry.started = performance.now();
    entry.id = setTimeout(() => {
      if (version !== entry.version || !timeouts.has(entry)) return;
      timeouts.delete(entry);
      if (!disposed && !suspended) entry.callback();
    }, entry.remaining);
  };
  const armFrame = (entry: FrameEntry): void => {
    const version = ++entry.version;
    entry.id = requestAnimationFrame((now) => {
      if (version !== entry.version || !frames.has(entry)) return;
      frames.delete(entry);
      if (!disposed && !suspended) entry.callback(now);
    });
  };
  const clearTimeouts = (): void => {
    timeouts.forEach((entry) => clearTimeout(entry.id));
    timeouts.clear();
  };
  const clearFrames = (): void => {
    frames.forEach((entry) => { if (entry.id !== undefined) cancelAnimationFrame(entry.id); });
    frames.clear();
  };
  const onDispose = (cleanup: () => void): (() => void) => {
    if (disposed) cleanup();
    else cleanups.add(cleanup);
    return () => { cleanups.delete(cleanup); };
  };

  return {
    isActive: () => !disposed,
    clearTimeouts,
    clearFrames,
    onDispose,
    timeout(callback: () => void, delay: number): void {
      if (disposed) return;
      const entry: TimeoutEntry = { callback, remaining: Math.max(0, delay), started: 0, version: 0 };
      timeouts.add(entry);
      if (!suspended) armTimeout(entry);
    },
    frame(callback: FrameRequestCallback): void {
      if (disposed) return;
      const entry: FrameEntry = { callback, version: 0 };
      frames.add(entry);
      if (!suspended) armFrame(entry);
    },
    setSuspended(next: boolean): void {
      if (disposed || next === suspended) return;
      suspended = next;
      if (suspended) {
        timeouts.forEach((entry) => {
          entry.version += 1;
          clearTimeout(entry.id);
          entry.id = undefined;
          entry.remaining = Math.max(0, entry.remaining - (performance.now() - entry.started));
        });
        frames.forEach((entry) => {
          entry.version += 1;
          if (entry.id !== undefined) cancelAnimationFrame(entry.id);
          entry.id = undefined;
        });
      } else {
        timeouts.forEach(armTimeout);
        frames.forEach(armFrame);
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearTimeouts();
      clearFrames();
      const retiring = Array.from(cleanups);
      cleanups.clear();
      retiring.forEach((cleanup) => { try { cleanup(); } catch { /* Retire every owner. */ } });
    },
  };
}

export type ResultModalLifetime = ReturnType<typeof createResultModalLifetime>;
