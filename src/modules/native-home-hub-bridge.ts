/** Transport only. The full web runtime remains the sole route, progression and
 * save owner. A navigation Promise resolving is NOT a destination-ready receipt. */
export type NativeHomeHubDestination =
  | { kind: 'world'; worldId: 1 | 2 | 3 }
  | { kind: 'web-hub'; worldId: 1 | 2 | 3 }
  | { kind: 'web-home'; action: 'arcade' | 'settings' | 'journey' }
  | { kind: 'home' | 'hub' | 'arcade' | 'settings' };

export interface NativeHomeHubSnapshot {
  homeSlide: number;
  activeWorldId?: 1 | 2 | 3 | null;
  journeyRequiresTutorial?: boolean;
  worlds: ReadonlyArray<{ worldId: 1 | 2 | 3; completed: number | null; total: number; hasInterimCard?: boolean }>;
}

export type NativeHomeHubEvent =
  | { kind: 'snapshot'; snapshot: NativeHomeHubSnapshot }
  | { kind: 'present'; route: 'home' | 'hub'; snapshot: NativeHomeHubSnapshot }
  | { kind: 'enter-hub'; epoch: number; snapshot: NativeHomeHubSnapshot }
  | { kind: 'ready'; requestId: number; destination: NativeHomeHubDestination }
  | { kind: 'error'; requestId?: number; code: 'invalid-request' | 'stale-request' | 'busy' | 'unsupported' | 'cancelled' | 'disposed' | 'not-ready' | 'navigation-failed' | 'snapshot-failed' };

export interface NativeHomeHubCapabilities {
  /** Project canonical state; null means unknown, never fabricate zero progress. */
  readSnapshot(): NativeHomeHubSnapshot;
  canNavigate(destination: NativeHomeHubDestination): boolean;
  /** Binding must observe canonical ownership AND actual destination readiness.
   * It must cancel/reject stale route work when this signal is aborted. */
  navigate(destination: NativeHomeHubDestination, context: {
    requestId: number;
    signal: AbortSignal;
    isCurrent(): boolean;
  }): Promise<{ ready: true; destination: NativeHomeHubDestination }>;
}

export interface NativeHomeHubBridge {
  /** Swift calls this through evaluateJavaScript/callAsyncJavaScript. IDs are
   * positive monotonically increasing safe integers within this installation. */
  request(message: unknown): Promise<NativeHomeHubEvent>;
  /** Initial state and canonical owner change notifications; no polling. */
  snapshot(): NativeHomeHubEvent;
  cancel(): void;
  dispose(): void;
}

export interface NativeHomeHubBridgeHost {
  __jimiNativeHomeHub?: NativeHomeHubBridge;
  webkit?: { messageHandlers?: { jimiHomeHub?: { postMessage(event: NativeHomeHubEvent): void } } };
}

function destination(value: unknown): NativeHomeHubDestination | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { kind?: unknown; worldId?: unknown };
  if (candidate.kind === 'world' || candidate.kind === 'web-hub') {
    return candidate.worldId === 1 || candidate.worldId === 2 || candidate.worldId === 3
      ? { kind: candidate.kind, worldId: candidate.worldId } : null;
  }
  const action = (value as { action?: unknown }).action;
  if (candidate.kind === 'web-home') return action === 'arcade' || action === 'settings' || action === 'journey' ? { kind: 'web-home', action } : null;
  return candidate.kind === 'home' || candidate.kind === 'hub' || candidate.kind === 'arcade' || candidate.kind === 'settings'
    ? { kind: candidate.kind } : null;
}

function sameDestination(left: NativeHomeHubDestination, right: NativeHomeHubDestination): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'world' || left.kind === 'web-hub') return (right.kind === 'world' || right.kind === 'web-hub') && left.worldId === right.worldId;
  if (left.kind === 'web-home') return right.kind === 'web-home' && left.action === right.action;
  return true;
}

function copySnapshot(value: NativeHomeHubSnapshot): NativeHomeHubSnapshot {
  if (!Number.isSafeInteger(value.homeSlide) || value.homeSlide < 0 || !Array.isArray(value.worlds) || value.worlds.length !== 3) {
    throw new Error('Invalid canonical snapshot');
  }
  const seen = new Set<number>();
  const worlds = value.worlds.map(world => {
    if (![1, 2, 3].includes(world.worldId) || seen.has(world.worldId)
      || !Number.isSafeInteger(world.total) || world.total < 0
      || (world.completed !== null && (!Number.isSafeInteger(world.completed) || world.completed < 0 || world.completed > world.total))) {
      throw new Error('Invalid canonical world snapshot');
    }
    seen.add(world.worldId);
    if (world.hasInterimCard !== undefined && typeof world.hasInterimCard !== 'boolean') throw new Error('Invalid interim state');
    return { worldId: world.worldId, completed: world.completed, total: world.total,
      ...(world.hasInterimCard === undefined ? {} : { hasInterimCard: world.hasInterimCard }) };
  });
  if (value.activeWorldId !== undefined && value.activeWorldId !== null && ![1, 2, 3].includes(value.activeWorldId)) throw new Error('Invalid active World');
  if (value.journeyRequiresTutorial !== undefined && typeof value.journeyRequiresTutorial !== 'boolean') throw new Error('Invalid tutorial policy');
  return { homeSlide: value.homeSlide, worlds,
    ...(value.journeyRequiresTutorial === undefined ? {} : { journeyRequiresTutorial: value.journeyRequiresTutorial }),
    ...(value.activeWorldId === undefined ? {} : { activeWorldId: value.activeWorldId }) };
}

/** Install only after full-runtime capabilities exist and native explicitly opts
 * in. No DOM visibility, storage, animation, input, resource or gameplay work is
 * owned here. Swift must keep its overlay until a matching `ready` event. */
export function installNativeHomeHubBridge(
  capabilities: NativeHomeHubCapabilities,
  host: NativeHomeHubBridgeHost,
): NativeHomeHubBridge {
  host.__jimiNativeHomeHub?.dispose();
  let disposed = false;
  let lastId = 0;
  let active: { id: number; controller: AbortController; finish(event: NativeHomeHubEvent): void } | undefined;
  const emit = (event: NativeHomeHubEvent): NativeHomeHubEvent => {
    if (!disposed) {
      // A missing/broken native receiver must not become an unhandled rejection
      // or mutate web state. No ready receipt reaches native in that case.
      try { host.webkit?.messageHandlers?.jimiHomeHub?.postMessage(event); } catch { /* transport unavailable */ }
    }
    return event;
  };
  const error = (code: Extract<NativeHomeHubEvent, { kind: 'error' }>['code'], requestId?: number) =>
    emit({ kind: 'error', code, ...(requestId === undefined ? {} : { requestId }) });
  const cancel = () => {
    const operation = active;
    if (!operation) return;
    active = undefined;
    operation.controller.abort();
    operation.finish(error(disposed ? 'disposed' : 'cancelled', operation.id));
  };
  const bridge: NativeHomeHubBridge = {
    request(message) {
      if (disposed) return Promise.resolve(error('disposed'));
      const input = message as { id?: unknown; destination?: unknown } | null;
      const id = input && typeof input.id === 'number' && Number.isSafeInteger(input.id) && input.id > 0 ? input.id : undefined;
      const target = destination(input?.destination);
      if (id === undefined || !target) return Promise.resolve(error('invalid-request', id));
      if (id <= lastId) return Promise.resolve(error('stale-request', id));
      lastId = id;
      if (active) return Promise.resolve(error('busy', id));
      try {
        if (!capabilities.canNavigate(target)) return Promise.resolve(error('unsupported', id));
      } catch { return Promise.resolve(error('navigation-failed', id)); }
      return new Promise(resolve => {
        const operation = { id, controller: new AbortController(), finish: resolve };
        active = operation;
        const isCurrent = () => !disposed && active === operation && !operation.controller.signal.aborted;
        // Owned rejection handler consumes late failure even after cancellation.
        const work = new Promise<{ ready: true; destination: NativeHomeHubDestination }>(accept => {
          accept(capabilities.navigate(target, { requestId: id, signal: operation.controller.signal, isCurrent }));
        });
        void work.then(receipt => {
          if (!isCurrent()) return;
          const actual = destination(receipt?.destination);
          active = undefined;
          resolve(receipt?.ready === true && actual && sameDestination(target, actual)
            ? emit({ kind: 'ready', requestId: id, destination: target }) : error('not-ready', id));
        }, () => {
          if (!isCurrent()) return;
          active = undefined;
          resolve(error('navigation-failed', id));
        });
      });
    },
    snapshot() {
      if (disposed) return error('disposed');
      try { return emit({ kind: 'snapshot', snapshot: copySnapshot(capabilities.readSnapshot()) }); }
      catch { return error('snapshot-failed'); }
    },
    cancel,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      if (host.__jimiNativeHomeHub === bridge) delete host.__jimiNativeHomeHub;
    },
  };
  host.__jimiNativeHomeHub = bridge;
  return bridge;
}
