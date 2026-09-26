import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.ts';
import { isGameplayRendererTerminalSuspended } from './gameplay-render-suspension.ts';

export type GameplayEntryTickerApp = {
  destroyed?: boolean;
  ticker?: {
    started?: boolean;
    lastTime?: number;
    start?: () => void;
    stop?: () => void;
  };
};

const pendingChecks = new WeakMap<GameplayEntryTickerApp, () => void>();

function pixiRequestId(ticker: NonNullable<GameplayEntryTickerApp['ticker']>): unknown {
  // Pixi 8 clears this before update() and schedules the next RAF afterwards.
  // A throwing listener can leave started=true with no requested frame. Do not
  // infer this state from an absent field on a different ticker implementation.
  return (ticker as { _requestId?: unknown })._requestId;
}

/** One entry-owned check, never a recurring watchdog or a background resume. */
export function ensureGameplayEntryTicker({
  app,
  isCurrent,
  signal,
}: {
  app?: GameplayEntryTickerApp | null;
  isCurrent: () => boolean;
  signal?: AbortSignal | null;
}): () => void {
  const noop = () => {};
  const canRun = () => !!app && !app.destroyed && !signal?.aborted && isCurrent()
    && !(typeof document !== 'undefined' && document.hidden)
    && !isGameplayRendererTerminalSuspended(app);
  if (!canRun() || !app?.ticker) return noop;
  pendingChecks.get(app)?.();
  const ticker = app.ticker;
  if (!ticker.started) {
    ticker.start?.();
    return noop;
  }
  if (pixiRequestId(ticker) !== null || !Number.isFinite(ticker.lastTime)
    || !ticker.stop || !ticker.start || typeof requestAnimationFrame !== 'function') return noop;

  const lastTickAt = ticker.lastTime;
  let frameId: number | null = null;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    signal?.removeEventListener('abort', cancel);
    if (pendingChecks.get(app) === cancel) pendingChecks.delete(app);
  };
  pendingChecks.set(app, cancel);
  signal?.addEventListener('abort', cancel, { once: true });
  frameId = requestAnimationFrame(() => {
    frameId = null;
    const wasCancelled = cancelled;
    cancel();
    if (wasCancelled || !canRun() || app.ticker !== ticker || !ticker.started) return;
    // Wait beyond the current update: _requestId is normally null while Pixi
    // executes its listeners. A delivered frame or a new request is healthy.
    if (pixiRequestId(ticker) !== null || ticker.lastTime !== lastTickAt) return;
    ticker.stop?.();
    if (!canRun() || app.ticker !== ticker) return;
    ticker.start?.();
    emitNativeConsoleDiagnostic('[CC_PIXI_ENTRY]', 'stranded-ticker-restarted', {
      lastTickAt,
      requestPending: pixiRequestId(ticker) != null,
    });
  });
  return cancel;
}
