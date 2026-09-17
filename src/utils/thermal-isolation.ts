/** Explicit diagnostic only. No persistence, board mutation, or production timer. */
export type ThermalIsolationGroup = 'ambient' | 'journey-units' | 'sheets' | 'pixi-render' | 'css-idle' | 'gsap-idle';
type Counts = Record<string, { calls: number; suppressed: number }>;
let active: { group: ThermalIsolationGroup; suppressed: boolean; counts: Counts } | null = null;
let stopCurrent: (() => void) | null = null;

/** Called at visual owners, never at gameplay commit/cleanup boundaries. */
export function isThermalWorkSuppressed(group: ThermalIsolationGroup): boolean {
  if (!active) return false;
  const count = active.counts[group] ?? (active.counts[group] = { calls: 0, suppressed: 0 });
  count.calls++;
  const suppressed = active.group === group && active.suppressed;
  if (suppressed) count.suppressed++;
  return suppressed;
}

interface IsolationOptions {
  group: ThermalIsolationGroup;
  enabled: boolean;
  fingerprint(): string;
  suppress(): () => void;
  emit(event: Record<string, unknown>): void;
  onStop?(): void;
}

/** A/B/B/A: 5s settling + 20s measurement each. Any input invalidates the run. */
export function startThermalIsolation(options: IsolationOptions): (() => void) | null {
  if (!options.enabled || document.hidden) return null;
  stopCurrent?.();
  const fingerprint = options.fingerprint();
  const run = `${Date.now()}-${options.group}`;
  let phase = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let guard: ReturnType<typeof setInterval> | undefined;
  let restore: (() => void) | null = null;
  let stopped = false;
  const emit = (event: string, extra: Record<string, unknown> = {}) => options.emit({
    event, run, group: options.group, phase, at: performance.now(), wall: Date.now(), ...extra,
  });
  const stop = (reason: string) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    clearInterval(guard);
    active = null;
    stopCurrent = null;
    const release = restore;
    restore = null;
    try { release?.(); } finally {
      for (const name of inputs) window.removeEventListener(name, onInput, true);
      document.removeEventListener('visibilitychange', onVisibility);
      emit('stop', { reason, complete: reason === 'complete' });
      options.onStop?.();
    }
  };
  const onInput = () => stop('input');
  const onVisibility = () => { if (document.hidden) stop('hidden'); };
  const inputs = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'pagehide', 'blur', 'resize'];
  const next = () => {
    if (stopped) return;
    if (options.fingerprint() !== fingerprint) { stop('scene-changed'); return; }
    phase++;
    if (phase === 4) { stop('complete'); return; }
    const suppressed = phase === 1 || phase === 2;
    try {
      if (!suppressed && restore) { const release = restore; restore = null; release(); }
      if (suppressed && !restore) restore = options.suppress();
    } catch { stop('suppression-error'); return; }
    active = { group: options.group, suppressed, counts: {} };
    emit('settle', { suppressed, fingerprint });
    timer = setTimeout(() => {
      if (stopped || !active) return;
      active.counts = {};
      emit('measure-start', { suppressed });
      timer = setTimeout(() => {
        emit('measure-end', { suppressed, counts: active?.counts });
        next();
      }, 20_000);
    }, 5_000);
  };
  stopCurrent = () => stop('replaced');
  for (const name of inputs) window.addEventListener(name, onInput, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  guard = setInterval(() => {
    if (document.hidden || options.fingerprint() !== fingerprint) stop('scene-changed');
  }, 1000);
  emit('start');
  // Give the starting control time to release its pointer and the UI to settle.
  timer = setTimeout(next, 5_000);
  return () => stop('manual');
}
