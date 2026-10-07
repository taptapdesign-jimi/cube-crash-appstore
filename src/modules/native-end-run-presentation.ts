import { createResultModalLifetime } from './result-modal-lifetime.js';

export type NativeEndRunAction = 'close' | 'restart' | 'exit';
export type NativeEndRunModel = { title: string; subtitle: string; restartLabel: string; exitLabel: string };
type Session = { id: number; ready: boolean; exitComplete: Promise<boolean>; close(): void; dispose(): void; isCurrent(): boolean };
type NativeHost = Window & {
  __jimiNativeEndRunEnabled?: boolean;
  __jimiNativeEndRun?: { ready(id: number): boolean; activate(id: number, action: string): boolean; closed(id: number): boolean; rejected(id: number): void };
  webkit?: { messageHandlers?: { jimiHomeHub?: { postMessage(value: unknown): void } } };
};
let sequence = 0;
let active: Session | undefined;

export function canPresentNativeEndRun(): boolean {
  const host = window as NativeHost;
  return host.__jimiNativeEndRunEnabled === true && typeof host.webkit?.messageHandlers?.jimiHomeHub?.postMessage === 'function';
}

/** Presentation lease only. Every accepted action delegates the existing modal owner. */
export function presentNativeEndRun(model: NativeEndRunModel, callbacks: {
  isCurrent(): boolean; onReady(): void; onFallback(): void; onAction(action: NativeEndRunAction): boolean;
}): Session | null {
  if (!canPresentNativeEndRun()) return null;
  active?.dispose();
  const host = window as NativeHost;
  const id = ++sequence;
  const lifetime = createResultModalLifetime();
  const onVisibility = () => lifetime.setSuspended(host.document.hidden);
  host.document.addEventListener('visibilitychange', onVisibility);
  lifetime.onDispose(() => host.document.removeEventListener('visibilitychange', onVisibility));
  onVisibility();
  let disposed = false, consumed = false, closing = false;
  let finishExit!: (completed: boolean) => void;
  const exitComplete = new Promise<boolean>((resolve) => { finishExit = resolve; });
  const post = (command: string) => host.webkit!.messageHandlers!.jimiHomeHub!.postMessage({ kind: 'end-run-modal', command, id, ...(command === 'present' ? { model } : {}) });
  const current = () => !disposed && active === session && callbacks.isCurrent();
  const session: Session = {
    id, ready: false, exitComplete, isCurrent: current,
    close() {
      if (!current() || closing) return;
      closing = true; lifetime.clearTimeouts();
      // A lost native receipt must retire its cover before canonical cleanup.
      lifetime.timeout(() => { try { post('revoke'); } finally { finishExit(true); } }, 1500);
      try { post('close'); } catch { finishExit(true); session.dispose(); }
    },
    dispose() { if (disposed) return; disposed = true; finishExit(false); lifetime.dispose(); try { post('revoke'); } catch { /* Transport already retired. */ } if (active === session) active = undefined; },
  };
  active = session;
  const fallback = () => { if (!current() || closing) return; session.dispose(); callbacks.onFallback(); };
  lifetime.timeout(fallback, 1000);
  host.__jimiNativeEndRun = {
    ready(receipt) {
      if (receipt !== id || !current() || closing || host.document.hidden) return false;
      session.ready = true; lifetime.clearTimeouts(); callbacks.onReady(); return true;
    },
    activate(receipt, action) {
      if (receipt !== id || !current() || !session.ready || consumed || closing || host.document.hidden
        || !['close','restart','exit'].includes(action)) return false;
      consumed = true;
      const accepted = callbacks.onAction(action as NativeEndRunAction);
      if (!accepted && current()) consumed = false;
      return accepted;
    },
    closed(receipt) {
      // The canonical shell is already marked closing; admission validity is
      // intentionally different from the exact presentation's exit receipt.
      if (receipt !== id || disposed || active !== session || !closing || host.document.hidden) return false;
      lifetime.clearTimeouts(); finishExit(true); return true;
    },
    rejected(receipt) { if (receipt === id) fallback(); },
  };
  try { post('present'); } catch { session.dispose(); return null; }
  return session;
}
