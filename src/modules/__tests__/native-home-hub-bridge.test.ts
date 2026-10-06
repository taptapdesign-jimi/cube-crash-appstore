import { installNativeHomeHubBridge, type NativeHomeHubCapabilities, type NativeHomeHubBridgeHost, type NativeHomeHubDestination } from '../native-home-hub-bridge';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const postMessage = jest.fn();
  const host: NativeHomeHubBridgeHost = { webkit: { messageHandlers: { jimiHomeHub: { postMessage } } } };
  const snapshot = { homeSlide: 1, worlds: [
    { worldId: 1 as const, completed: 4, total: 10 },
    { worldId: 3 as const, completed: null, total: 10 },
    { worldId: 2 as const, completed: 0, total: 10 },
  ] };
  const capabilities: jest.Mocked<NativeHomeHubCapabilities> = {
    readSnapshot: jest.fn(() => snapshot),
    canNavigate: jest.fn((_destination: NativeHomeHubDestination) => true),
    navigate: jest.fn(async (destination: NativeHomeHubDestination, _context: Parameters<NativeHomeHubCapabilities['navigate']>[1]) => ({ ready: true as const, destination })),
  };
  const bridge = installNativeHomeHubBridge(capabilities, host);
  return { host, postMessage, capabilities, bridge, snapshot };
}

test('installs without polling, state reads or route side effects; snapshot copies canonical unknown/count values', () => {
  const f = fixture();
  expect(f.host.__jimiNativeHomeHub).toBe(f.bridge);
  expect(f.capabilities.readSnapshot).not.toHaveBeenCalled();
  expect(f.capabilities.navigate).not.toHaveBeenCalled();
  const event = f.bridge.snapshot();
  expect(event).toEqual({ kind: 'snapshot', snapshot: f.snapshot });
  f.snapshot.worlds[0].completed = 7;
  expect(event.kind === 'snapshot' && event.snapshot.worlds[0].completed).toBe(4);
  expect(event.kind === 'snapshot' && event.snapshot.worlds[1].completed).toBeNull();
  expect(f.postMessage).toHaveBeenCalledTimes(1);
});

test.each([null, {}, { id: 0, destination: { kind: 'hub' } }, { id: 1, destination: { kind: 'world', worldId: 4 } }, { id: '1', destination: { kind: 'arcade' } }])('rejects invalid native messages before capabilities: %p', async message => {
  const f = fixture();
  expect(await f.bridge.request(message)).toMatchObject({ kind: 'error', code: 'invalid-request' });
  expect(f.capabilities.navigate).not.toHaveBeenCalled();
});

test('emits ready only after explicit matching destination readiness; consumes busy/replayed IDs without duplicate action', async () => {
  const f = fixture();
  const target: NativeHomeHubDestination = { kind: 'world', worldId: 2 };
  const gate = deferred<{ ready: true; destination: NativeHomeHubDestination }>();
  f.capabilities.navigate.mockReturnValueOnce(gate.promise);
  const pending = f.bridge.request({ id: 1, destination: target });
  expect(f.postMessage).not.toHaveBeenCalled();
  expect(await f.bridge.request({ id: 2, destination: { kind: 'settings' } })).toMatchObject({ code: 'busy' });
  gate.resolve({ ready: true, destination: target });
  expect(await pending).toEqual({ kind: 'ready', requestId: 1, destination: target });
  expect(await f.bridge.request({ id: 1, destination: target })).toMatchObject({ code: 'stale-request' });
  expect(await f.bridge.request({ id: 2, destination: target })).toMatchObject({ code: 'stale-request' });
  expect(f.capabilities.navigate).toHaveBeenCalledTimes(1);
  expect(await f.bridge.request({ id: 3, destination: target })).toMatchObject({ kind: 'ready' });
});

test.each([undefined, { ready: false, destination: { kind: 'hub' } }, { ready: true, destination: { kind: 'world', worldId: 1 } }])('ordinary completion/wrong destination never hides native: %p', async receipt => {
  const f = fixture();
  f.capabilities.navigate.mockResolvedValueOnce(receipt as any);
  expect(await f.bridge.request({ id: 1, destination: { kind: 'hub' } })).toMatchObject({ kind: 'error', code: 'not-ready' });
  expect(f.postMessage.mock.calls.some(([event]) => event.kind === 'ready')).toBe(false);
});

test.each(['resolve', 'reject'] as const)('cancel settles immediately and suppresses late %s; a later request can proceed', async ending => {
  const f = fixture();
  const gate = deferred<{ ready: true; destination: NativeHomeHubDestination }>();
  f.capabilities.navigate.mockReturnValueOnce(gate.promise);
  const pending = f.bridge.request({ id: 1, destination: { kind: 'arcade' } });
  const context = f.capabilities.navigate.mock.calls[0][1];
  f.bridge.cancel();
  expect(await pending).toMatchObject({ code: 'cancelled', requestId: 1 });
  expect(context.signal.aborted).toBe(true);
  expect(context.isCurrent()).toBe(false);
  expect(await f.bridge.request({ id: 2, destination: { kind: 'settings' } })).toMatchObject({ kind: 'ready' });
  const calls = f.postMessage.mock.calls.length;
  if (ending === 'resolve') gate.resolve({ ready: true, destination: { kind: 'arcade' } });
  else gate.reject(new Error('late'));
  await Promise.resolve(); await Promise.resolve();
  expect(f.postMessage).toHaveBeenCalledTimes(calls);
});

test('replacement disposes former owner, suppresses all late messages and stale disposal cannot remove new binding', async () => {
  const f = fixture();
  const gate = deferred<{ ready: true; destination: NativeHomeHubDestination }>();
  f.capabilities.navigate.mockReturnValueOnce(gate.promise);
  const pending = f.bridge.request({ id: 1, destination: { kind: 'hub' } });
  const replacement = installNativeHomeHubBridge(f.capabilities, f.host);
  expect(await pending).toMatchObject({ code: 'disposed' });
  f.bridge.dispose();
  expect(f.host.__jimiNativeHomeHub).toBe(replacement);
  gate.resolve({ ready: true, destination: { kind: 'hub' } });
  await Promise.resolve(); await Promise.resolve();
  expect(f.postMessage).not.toHaveBeenCalled();
  expect(f.bridge.snapshot()).toMatchObject({ code: 'disposed' });
  expect(await f.bridge.request({ id: 2, destination: { kind: 'home' } })).toMatchObject({ code: 'disposed' });
  replacement.dispose(); replacement.dispose();
  expect(f.host.__jimiNativeHomeHub).toBeUndefined();
});

test('unsupported/failed routes and invalid snapshots fail closed without fake ready', async () => {
  const f = fixture();
  f.capabilities.canNavigate.mockReturnValueOnce(false);
  expect(await f.bridge.request({ id: 1, destination: { kind: 'settings' } })).toMatchObject({ code: 'unsupported' });
  expect(f.capabilities.navigate).not.toHaveBeenCalled();
  f.capabilities.navigate.mockImplementationOnce(() => { throw new Error('route unavailable'); });
  expect(await f.bridge.request({ id: 2, destination: { kind: 'home' } })).toMatchObject({ code: 'navigation-failed' });
  f.snapshot.worlds[0].completed = 11;
  expect(f.bridge.snapshot()).toMatchObject({ code: 'snapshot-failed' });
  expect(f.postMessage.mock.calls.some(([event]) => event.kind === 'ready')).toBe(false);
});

test('broken native transport cannot throw through gameplay routing or state projection', async () => {
  const f = fixture();
  f.postMessage.mockImplementation(() => { throw new Error('native unavailable'); });
  expect(f.bridge.snapshot().kind).toBe('snapshot');
  expect(await f.bridge.request({ id: 1, destination: { kind: 'home' } })).toMatchObject({ kind: 'ready' });
});
