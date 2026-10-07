import { createScreenLifecycle } from '../utils/screen-lifecycle.js';

/** Finite native-to-web coverage gate; timeout never authorizes a reveal. */
export function prepareSettingsSourcePaint(isCurrent: () => boolean) {
  const lifecycle = createScreenLifecycle('settings-source-paint');
  let settled = false;
  let resolveReady!: (prepared: boolean) => void;
  const ready = new Promise<boolean>((resolve) => { resolveReady = resolve; });
  const finish = (prepared: boolean) => {
    if (settled) return;
    settled = true;
    lifecycle.cleanup();
    resolveReady(prepared);
  };
  let remaining = 2;
  const frame = () => {
    if (!isCurrent() || document.hidden) { finish(false); return; }
    remaining -= 1;
    if (remaining === 0) finish(true);
    else lifecycle.trackRaf(frame);
  };
  lifecycle.trackListener(document, 'visibilitychange', () => {
    if (document.hidden) finish(false);
  });
  lifecycle.trackTimeout(() => finish(false), 500);
  lifecycle.trackRaf(frame);
  return { ready, cancel: () => finish(false) };
}
