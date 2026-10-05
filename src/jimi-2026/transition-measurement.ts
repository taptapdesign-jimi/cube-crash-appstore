import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

/** Opt-in, transition-scoped RAF intervals, not presented GPU FPS. No idle loop. */
export function measureTransition(route: string, enabled: boolean): (result: string) => void {
  if (!enabled) return () => {};
  const lifecycle = createScreenLifecycle('jimi-transition-measurement');
  const start = performance.now();
  let previous = start;
  let worstIntervalMs = 0;
  let over34Ms = 0;
  let samples = 0;
  let stopped = false;
  const sample = () => {
    if (stopped) return;
    const now = performance.now();
    const interval = now - previous;
    previous = now;
    worstIntervalMs = Math.max(worstIntervalMs, interval);
    if (interval > 34) over34Ms++;
    samples++;
    lifecycle.trackRaf(sample);
  };
  lifecycle.trackRaf(sample);
  return result => {
    if (stopped) return;
    stopped = true;
    lifecycle.cleanup();
    const finishedAt = performance.now();
    emitNativeConsoleDiagnostic('[JIMI_TRANSITION]', route, { result,
      elapsedMs: Math.round(finishedAt - start),
      // Unsampled time since the last callback (or start), including any
      // synchronous commit/retirement tail. Not an additional RAF interval,
      // and neither this nor callback timing proves a presented GPU frame.
      commitTailMs: Math.round((finishedAt - previous) * 10) / 10,
      worstIntervalMs: Math.round(worstIntervalMs * 10) / 10, over34Ms, samples,
      metric: 'RAF interval, not GPU presented FPS' });
  };
}
