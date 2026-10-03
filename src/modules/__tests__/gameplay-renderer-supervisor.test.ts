import {
  GameplayRendererSupervisor,
  type GameplayRendererFallbackRequest,
  type GameplayRendererSupervisorDependencies,
  type GameplayRendererValidation,
} from '../gameplay-renderer-supervisor';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

function harness() {
  const fallbackRequests: GameplayRendererFallbackRequest[] = [];
  const deps = {
    deadlineMs: 1200,
    maxRecreationAttempts: 1,
    runBounded: jest.fn(async <T>(_label: string, _deadline: number, work: () => Promise<T>) => work()),
    setInputLocked: jest.fn(),
    quiesce: jest.fn(),
    rehydrate: jest.fn<Promise<void>, [number, () => boolean]>().mockResolvedValue(),
    validate: jest.fn<Promise<GameplayRendererValidation>, [number, () => boolean]>()
      .mockResolvedValue({ healthy: true, issues: [] }),
    validatePaintedVisibility: jest.fn<Promise<GameplayRendererValidation>, [number, () => boolean]>()
      .mockResolvedValue({ healthy: true, issues: [] }),
    recreate: jest.fn<Promise<{ rendererGeneration: number }>, [number, string, () => boolean]>()
      .mockImplementation(async (generation) => ({ rendererGeneration: generation + 1 })),
    reveal: jest.fn(),
    presentFallback: jest.fn((request: GameplayRendererFallbackRequest) => { fallbackRequests.push(request); }),
    clearFallback: jest.fn(),
    onStateChange: jest.fn(),
    onDiagnostic: jest.fn(),
  };
  return {
    deps,
    fallbackRequests,
    supervisor: new GameplayRendererSupervisor(
      deps as unknown as GameplayRendererSupervisorDependencies,
    ),
  };
}

test('healthy rehydration validates and reveals exactly once without recreation', async () => {
  const h = harness();

  const result = await h.supervisor.requestRecovery('context-restored', 4);

  expect(result).toEqual({
    state: 'healthy', reason: 'context-restored', trigger: 'manual',
    rendererGeneration: 4, recreationAttempts: 0, issues: [],
  });
  expect(h.deps.rehydrate).toHaveBeenCalledTimes(1);
  expect(h.deps.validate).toHaveBeenCalledTimes(1);
  expect(h.deps.validatePaintedVisibility).toHaveBeenCalledTimes(1);
  expect(h.deps.recreate).not.toHaveBeenCalled();
  expect(h.deps.reveal).toHaveBeenCalledTimes(1);
  expect(h.deps.setInputLocked.mock.calls).toEqual([[true], [false]]);
});

test('structural success cannot reveal a blank or effectively hidden painted frame', async () => {
  const h = harness();
  h.deps.validatePaintedVisibility
    .mockResolvedValueOnce({ healthy: false, issues: ['blank-presented-frame'] })
    .mockResolvedValueOnce({ healthy: true, issues: [] });

  const result = await h.supervisor.requestRecovery('blank-frame', 4, 'gameplay-entry');

  expect(result).toMatchObject({
    state: 'healthy', reason: 'blank-frame', trigger: 'gameplay-entry',
    rendererGeneration: 5, recreationAttempts: 1,
  });
  expect(h.deps.validate).toHaveBeenCalledTimes(2);
  expect(h.deps.validatePaintedVisibility).toHaveBeenCalledTimes(2);
  expect(h.deps.recreate).toHaveBeenCalledTimes(1);
  expect(h.deps.reveal).toHaveBeenCalledWith(5);
  expect(h.deps.onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
    event: 'validation-failed',
    phase: 'recovery:validate-painted-visibility',
    issues: ['blank-presented-frame'],
  }));
});

test('failed validation performs one bounded recreation and validates the new generation before reveal', async () => {
  const h = harness();
  h.deps.validate
    .mockResolvedValueOnce({ healthy: false, issues: ['stale-kanta'] })
    .mockResolvedValueOnce({ healthy: true, issues: [] });

  const result = await h.supervisor.requestRecovery('bad-gpu-pixels', 9);

  expect(result).toMatchObject({ state: 'healthy', rendererGeneration: 10, recreationAttempts: 1 });
  expect(h.deps.recreate).toHaveBeenCalledTimes(1);
  expect(h.deps.rehydrate.mock.calls.map(([generation]) => generation)).toEqual([9, 10]);
  expect(h.deps.validate.mock.calls.map(([generation]) => generation)).toEqual([9, 10]);
  expect(h.deps.reveal).toHaveBeenCalledWith(10);
});

test('rehydration and recreation failure terminates visibly while input remains locked', async () => {
  const h = harness();
  h.deps.rehydrate.mockRejectedValue(new Error('GPU unavailable'));

  const result = await h.supervisor.requestRecovery('loss', 2);

  expect(result).toMatchObject({ state: 'visible-failed', recreationAttempts: 1 });
  expect(h.deps.recreate).toHaveBeenCalledTimes(1);
  expect(h.deps.presentFallback).toHaveBeenCalledTimes(1);
  expect(h.deps.reveal).not.toHaveBeenCalled();
  expect(h.deps.setInputLocked).toHaveBeenCalledWith(true);
  expect(h.deps.setInputLocked).not.toHaveBeenCalledWith(false);
});

test('explicit retry gets a fresh bounded budget and reveals once after the failure clears', async () => {
  const h = harness();
  h.deps.rehydrate.mockRejectedValue(new Error('first failure'));
  await h.supervisor.requestRecovery('loss', 5);
  const fallback = h.fallbackRequests[0];
  h.deps.rehydrate.mockReset().mockResolvedValue();
  h.deps.validate.mockReset().mockResolvedValue({ healthy: true, issues: [] });

  const retried = await fallback.retry();

  expect(retried).toMatchObject({ state: 'healthy', rendererGeneration: 6 });
  expect(h.deps.reveal).toHaveBeenCalledTimes(1);
  expect(h.deps.clearFallback).toHaveBeenCalledTimes(1);
  expect(h.deps.setInputLocked).toHaveBeenLastCalledWith(false);
});

test('a newer context-loss generation supersedes late old work and is the sole reveal owner', async () => {
  const h = harness();
  const firstLoad = deferred<void>();
  h.deps.rehydrate
    .mockImplementationOnce(() => firstLoad.promise)
    .mockResolvedValueOnce();

  const first = h.supervisor.requestRecovery('loss-one', 1);
  const second = h.supervisor.requestRecovery('loss-two', 2);
  firstLoad.resolve();

  await expect(first).resolves.toMatchObject({ state: 'superseded' });
  await expect(second).resolves.toMatchObject({ state: 'healthy', rendererGeneration: 2 });
  expect(h.deps.reveal).toHaveBeenCalledTimes(1);
  expect(h.deps.reveal).toHaveBeenCalledWith(2);
});

test('same-generation duplicate recovery requests coalesce', async () => {
  const h = harness();
  const load = deferred<void>();
  h.deps.rehydrate.mockReturnValueOnce(load.promise);

  const first = h.supervisor.requestRecovery('first', 7);
  const duplicate = h.supervisor.requestRecovery('duplicate', 7);
  expect(duplicate).toBe(first);
  load.resolve();
  await first;

  expect(h.deps.rehydrate).toHaveBeenCalledTimes(1);
  expect(h.deps.reveal).toHaveBeenCalledTimes(1);
});

test('context, foreground and entry callers join one internally owned invalidated generation', async () => {
  const h = harness();
  const load = deferred<void>();
  h.deps.rehydrate.mockReturnValueOnce(load.promise);

  const generation = h.supervisor.invalidateRendererGeneration('webglcontextlost');
  const restored = h.supervisor.joinRecovery('webglcontextrestored', 'context-restored');
  const foreground = h.supervisor.joinRecovery('visibility-foreground', 'foreground');
  const entry = h.supervisor.joinRecovery('startLevel', 'gameplay-entry');

  expect(generation).toBe(1);
  expect(foreground).toBe(restored);
  expect(entry).toBe(restored);
  expect(h.deps.quiesce).toHaveBeenCalledTimes(1);
  expect(h.deps.setInputLocked).toHaveBeenCalledTimes(1);
  load.resolve();

  await expect(restored).resolves.toMatchObject({
    state: 'healthy', rendererGeneration: 1, trigger: 'context-restored',
  });
  expect(h.deps.rehydrate).toHaveBeenCalledTimes(1);
  expect(h.deps.validatePaintedVisibility).toHaveBeenCalledTimes(1);
  expect(h.deps.reveal).toHaveBeenCalledTimes(1);
  expect(h.supervisor.isRecoveryRequired()).toBe(false);
});

test('a healthy generation returns its receipt to later joins without duplicate GPU work', async () => {
  const h = harness();
  h.supervisor.invalidateRendererGeneration('loss');
  const first = await h.supervisor.joinRecovery('restored', 'context-restored');
  h.deps.rehydrate.mockClear();
  h.deps.validate.mockClear();
  h.deps.validatePaintedVisibility.mockClear();
  h.deps.reveal.mockClear();

  const later = await h.supervisor.joinRecovery('entry', 'gameplay-entry');

  expect(later).toBe(first);
  expect(h.deps.rehydrate).not.toHaveBeenCalled();
  expect(h.deps.validate).not.toHaveBeenCalled();
  expect(h.deps.validatePaintedVisibility).not.toHaveBeenCalled();
  expect(h.deps.reveal).not.toHaveBeenCalled();
});

test('same-generation forced invariant starts one fresh bounded validation cycle', async () => {
  const h = harness();
  await h.supervisor.requestRecovery('initial', 2);
  h.deps.rehydrate.mockClear();
  h.deps.reveal.mockClear();

  const result = await h.supervisor.joinRecovery('settled-parity', 'settled-board', { force: true });

  expect(result).toMatchObject({ state: 'healthy', rendererGeneration: 2 });
  expect(h.deps.rehydrate).toHaveBeenCalledTimes(1);
  expect(h.deps.reveal).toHaveBeenCalledTimes(1);
});

test('a stale generation cannot restart recovery after a newer renderer became healthy', async () => {
  const h = harness();
  await h.supervisor.requestRecovery('current', 8);
  h.deps.rehydrate.mockClear();
  h.deps.reveal.mockClear();

  const stale = await h.supervisor.requestRecovery('stale', 7);

  expect(stale).toMatchObject({ state: 'superseded', rendererGeneration: 8 });
  expect(h.deps.rehydrate).not.toHaveBeenCalled();
  expect(h.deps.reveal).not.toHaveBeenCalled();
});

test('deadline rejection follows the same single-recreation then visible-failure path', async () => {
  const h = harness();
  h.deps.runBounded.mockRejectedValue(new Error('deadline exceeded'));

  const result = await h.supervisor.requestRecovery('timeout', 3);

  expect(result.state).toBe('visible-failed');
  expect(h.deps.recreate).not.toHaveBeenCalled();
  expect(h.deps.presentFallback).toHaveBeenCalledTimes(1);
  expect(h.deps.reveal).not.toHaveBeenCalled();
});

test('dispose invalidates late work, clears fallback and releases the supervisor lock', async () => {
  const h = harness();
  const load = deferred<void>();
  h.deps.rehydrate.mockReturnValueOnce(load.promise);
  const pending = h.supervisor.requestRecovery('loss', 3);

  h.supervisor.dispose();
  h.supervisor.dispose();
  load.resolve();

  await expect(pending).resolves.toMatchObject({ state: 'superseded' });
  expect(h.deps.reveal).not.toHaveBeenCalled();
  expect(h.deps.clearFallback).toHaveBeenCalledTimes(1);
  expect(h.deps.setInputLocked).toHaveBeenLastCalledWith(false);
  expect(h.supervisor.getState()).toBe('disposed');
});

test('retiring a route invalidates late work but keeps the sole supervisor reusable', async () => {
  const h = harness();
  const load = deferred<void>();
  h.deps.rehydrate.mockReturnValueOnce(load.promise);
  const retired = h.supervisor.requestRecovery('old-route', 3);

  h.supervisor.retireLifecycle('menu-exit');
  load.resolve();

  await expect(retired).resolves.toMatchObject({ state: 'superseded' });
  expect(h.deps.reveal).not.toHaveBeenCalled();
  expect(h.supervisor.getState()).toBe('idle');
  expect(h.supervisor.isRecoveryRequired()).toBe(false);

  h.supervisor.invalidateRendererGeneration('new-route-context-loss');
  await expect(h.supervisor.joinRecovery('new-route', 'gameplay-entry'))
    .resolves.toMatchObject({ state: 'healthy' });
  expect(h.deps.reveal).toHaveBeenCalledTimes(1);
});
