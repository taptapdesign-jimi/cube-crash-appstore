export interface SceneTransitionContext {
  readonly signal: AbortSignal;
  isCurrent(): boolean;
}

export interface SceneHandle {
  setVisible(visible: boolean): void;
  setInputEnabled(enabled: boolean): void;
  enter(context: SceneTransitionContext): Promise<void> | void;
  exit(context: SceneTransitionContext): Promise<void> | void;
  /** Synchronously stops all adapter-owned motion, including a pending hook. */
  cancelMotion(): void;
  /** Releases this handle and detaches its root. A renderer may separately
   * retain bounded Home/Hub/one-World DOM or assets; this is not texture destroy. */
  dispose(): void;
}

export interface SceneNavigationResult<Id extends string = string> {
  id: Id;
  status: 'shown' | 'superseded' | 'cancelled' | 'failed' | 'disposed';
  error?: unknown;
}

export interface SceneDirectorState<Id extends string = string> {
  phase: 'idle' | 'preparing' | 'exiting' | 'entering' | 'disposed';
  currentId: Id | null;
  transitionId: Id | null;
  pendingId: Id | null;
}

export interface SceneDirector<Id extends string = string> {
  navigate(id: Id): Promise<SceneNavigationResult<Id>>;
  /** Also serves background suspension: restore the last committed scene,
   * cancel in-flight motion, discard queued navigation; no enter replay. */
  cancel(): void;
  dispose(): void;
  getState(): SceneDirectorState<Id>;
}

type Request<Id extends string> = {
  id: Id;
  promise: Promise<SceneNavigationResult<Id>>;
  finish(result: SceneNavigationResult<Id>): void;
};

type Operation<Id extends string> = {
  request: Request<Id>;
  epoch: number;
  controller: AbortController;
};

const CANCELLED = Symbol('scene-director-cancelled');

/** One active transition and one replaceable latest request; never a FIFO
 * backlog. An accepted transition finishes before the newest request starts.
 * Preparation and outgoing exit start together; the current root remains the
 * only visible scene until both finish. Input is disabled from exit start and
 * enabled only after incoming enter succeeds. The outgoing handle
 * remains available for rollback until that commit.
 *
 * prepare must return a fresh, hidden, input-disabled handle and obey the
 * context for asynchronous writes. Late handles are immediately disposed.
 * No overlay, renderer, clock, event listener on a global surface, or cache is
 * created here. At most the committed and incoming handles are retained.
 */
export function createSceneDirector<Id extends string = string>(dependencies: {
  prepare(id: Id, context: SceneTransitionContext): Promise<SceneHandle> | SceneHandle;
}): SceneDirector<Id> {
  let phase: SceneDirectorState<Id>['phase'] = 'idle';
  let current: { id: Id; handle: SceneHandle } | null = null;
  let incoming: SceneHandle | null = null;
  let active: Operation<Id> | null = null;
  let pending: Request<Id> | null = null;
  let epoch = 0;
  let disposed = false;
  const retired = new WeakSet<SceneHandle>();

  const safely = (work: () => void): void => { try { work(); } catch {} };
  const retire = (handle: SceneHandle): void => {
    if (retired.has(handle)) return;
    retired.add(handle);
    safely(() => handle.cancelMotion());
    safely(() => handle.setInputEnabled(false));
    safely(() => handle.setVisible(false));
    safely(() => handle.dispose());
  };
  const restoreCurrent = (): void => {
    if (!current || disposed) return;
    safely(() => current!.handle.cancelMotion());
    safely(() => current!.handle.setVisible(true));
    safely(() => current!.handle.setInputEnabled(true));
  };
  const makeRequest = (id: Id): Request<Id> => {
    let finish!: Request<Id>['finish'];
    const promise = new Promise<SceneNavigationResult<Id>>(resolve => { finish = resolve; });
    return { id, promise, finish };
  };
  const isCurrent = (operation: Operation<Id>): boolean => !disposed
    && active === operation && operation.epoch === epoch && !operation.controller.signal.aborted;
  const assertCurrent = (operation: Operation<Id>): void => {
    if (!isCurrent(operation)) throw CANCELLED;
  };

  // Aborting never waits on an adapter promise that failed to settle. Both
  // branches retain rejection handlers, so a later rejection is still caught.
  const awaitOwned = <T>(work: Promise<T> | T, operation: Operation<Id>): Promise<T> => new Promise((resolve, reject) => {
    const signal = operation.controller.signal;
    const onAbort = () => reject(CANCELLED);
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(work).then(value => {
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    }, error => {
      signal.removeEventListener('abort', onAbort);
      reject(error);
    });
    if (signal.aborted) onAbort();
  });

  const run = async (operation: Operation<Id>): Promise<void> => {
    const request = operation.request;
    const context: SceneTransitionContext = {
      signal: operation.controller.signal,
      isCurrent: () => isCurrent(operation),
    };
    let prepared: SceneHandle | null = null;
    try {
      phase = current ? 'exiting' : 'preparing';
      // Promise executors start both hooks now and convert synchronous hook
      // failures into owned rejections. No decode wait precedes outgoing motion.
      const exiting = new Promise<void>(resolve => {
        assertCurrent(operation);
        if (!current) { resolve(); return; }
        current.handle.setInputEnabled(false);
        assertCurrent(operation);
        resolve(current.handle.exit(context));
      });
      const preparation = new Promise<SceneHandle>(resolve => {
        assertCurrent(operation);
        resolve(dependencies.prepare(request.id, context));
      }).then(handle => {
        if (!isCurrent(operation)) {
          retire(handle);
          throw CANCELLED;
        }
        prepared = handle;
        incoming = handle;
        handle.setInputEnabled(false);
        handle.setVisible(false);
        assertCurrent(operation);
        return handle;
      });
      [prepared] = await Promise.all([
        awaitOwned(preparation, operation),
        awaitOwned(exiting, operation),
      ]);
      assertCurrent(operation);

      if (current) {
        current.handle.setVisible(false);
      }
      assertCurrent(operation);
      phase = 'entering';
      prepared.setVisible(true);
      assertCurrent(operation);
      await awaitOwned(prepared.enter(context), operation);
      assertCurrent(operation);
      prepared.setInputEnabled(true);
      assertCurrent(operation);
      const outgoing = current;
      current = { id: request.id, handle: prepared };
      incoming = null;
      if (outgoing) retire(outgoing.handle);
      request.finish({ id: request.id, status: 'shown' });
    } catch (error) {
      const status = disposed ? 'disposed' : error === CANCELLED || !isCurrent(operation) ? 'cancelled' : 'failed';
      // Stop the still-running sibling hook when preparation or exit failed.
      operation.controller.abort();
      if (prepared && current?.handle !== prepared) retire(prepared);
      if (incoming === prepared) incoming = null;
      if (active === operation) restoreCurrent();
      request.finish({
        id: request.id,
        status,
        ...(error === CANCELLED ? {} : { error }),
      });
    } finally {
      if (active === operation) {
        active = null;
        phase = disposed ? 'disposed' : 'idle';
        const next = pending;
        pending = null;
        if (next && !disposed) start(next);
      }
    }
  };

  const start = (request: Request<Id>): void => {
    if (current?.id === request.id) {
      request.finish({ id: request.id, status: 'shown' });
      return;
    }
    const operation: Operation<Id> = { request, epoch: ++epoch, controller: new AbortController() };
    active = operation;
    // run catches preparation, enter/exit and adapter write failures itself.
    void run(operation);
  };

  return {
    navigate(id) {
      if (disposed) return Promise.resolve({ id, status: 'disposed' });
      if (active && !active.controller.signal.aborted && active.request.id === id) {
        pending?.finish({ id: pending.id, status: 'superseded' });
        pending = null;
        return active.request.promise;
      }
      if (pending?.id === id) return pending.promise;
      const request = makeRequest(id);
      if (active) {
        pending?.finish({ id: pending.id, status: 'superseded' });
        pending = request;
      } else start(request);
      return request.promise;
    },
    cancel() {
      if (disposed) return;
      epoch++;
      pending?.finish({ id: pending.id, status: 'cancelled' });
      pending = null;
      if (active) {
        active.request.finish({ id: active.request.id, status: 'cancelled' });
        active.controller.abort();
      }
      if (incoming) retire(incoming);
      incoming = null;
      restoreCurrent();
      phase = 'idle';
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      epoch++;
      phase = 'disposed';
      pending?.finish({ id: pending.id, status: 'disposed' });
      pending = null;
      if (active) {
        active.request.finish({ id: active.request.id, status: 'disposed' });
        active.controller.abort();
      }
      if (incoming) retire(incoming);
      incoming = null;
      if (current) retire(current.handle);
      current = null;
    },
    getState: () => ({
      phase,
      currentId: current?.id ?? null,
      transitionId: active && !active.controller.signal.aborted ? active.request.id : null,
      pendingId: pending?.id ?? null,
    }),
  };
}
