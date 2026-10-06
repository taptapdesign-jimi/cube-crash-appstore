import { installNativeHomeHubRuntime, type NativeHomeHubRuntime, type NativeHomeHubRuntimeHost, type NativeHomeHubRuntimeOwners } from '../native-home-hub-runtime';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const installed: NativeHomeHubRuntime[] = [];

async function fixture() {
  document.body.innerHTML = '<section id="home" hidden></section><section id="journey-screen"><div id="journey-boards-container" data-journey-v700-view="hub"></div></section>';
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  let zone = 'journey', epoch = 0;
  const postMessage = jest.fn();
  const host: NativeHomeHubRuntimeHost = { __jimiNativeHomeHubEnabled: true, document,
    getComputedStyle: element => window.getComputedStyle(element),
    webkit: { messageHandlers: { jimiHomeHub: { postMessage } } } };
  const owners: NativeHomeHubRuntimeOwners = {
    appZone: {
      getCurrentZone: () => zone, getPresentationEpoch: () => epoch,
      isPresentationCurrent: (value, expected) => value === epoch && (!expected || zone === expected),
      markHomeMenu: jest.fn(() => { zone = 'home'; epoch++; }),
      markJourneyMenu: jest.fn(() => { zone = 'journey'; epoch++; }),
      showHomepageShell: jest.fn(async () => { zone = 'home'; epoch++; }),
      showJourneyShell: jest.fn(async () => { zone = 'journey'; epoch++; }),
    },
    slider: { getCurrentSlide: () => 0, setSlideInstant: jest.fn(), syncHiddenSlideState: jest.fn() },
    ui: { showHomepageQuietly: jest.fn(), hideHomepage: jest.fn(async () => {}),
      showCollectiblesScreen: jest.fn(async () => {}), activateNativeHomepageAction: jest.fn(async () => true) },
    journey: {
      getBoardById: jest.fn(() => ({ unlocked: true })), suspendForHomepage: jest.fn(),
      prepareFirstPlayTutorialHubReturn: jest.fn(), waitForJourneyV700HubPresentation: jest.fn(async () => true),
      waitForJourneyV700HubEnterCompletion: jest.fn(async () => {}), activateNativeHubWorld: jest.fn(() => true),
      prepareNativeWorld: jest.fn(async () => true), activatePreparedNativeWorld: jest.fn(async () => true),
      cancelNativeWorldPreparation: jest.fn(),
    },
    finalizeHome: jest.fn(), cancelHomeEnter: jest.fn(), hideHomeNavigation: jest.fn(),
    isFirstPlayTutorialForced: jest.fn(() => false),
    createFeedback: jest.fn(() => ({ pressCTA: jest.fn(() => true), pressTab: jest.fn(() => true),
      pressSwipe: jest.fn(() => true), pressBack: jest.fn(() => true), homeMotion: jest.fn(() => true),
      hubAmbience: jest.fn(() => true), hubExit: jest.fn(() => true), stop: jest.fn(), releaseToWeb: jest.fn(), dispose: jest.fn() })),
  };
  const runtime = (await installNativeHomeHubRuntime(host, async () => owners))!;
  installed.push(runtime);
  return { runtime, owners, postMessage };
}

async function flush() { for (let count = 0; count < 12; count++) await Promise.resolve(); }

afterEach(() => {
  installed.splice(0).forEach(runtime => runtime.dispose());
  document.body.replaceChildren();
});

test('direct World readiness waits for selected preparation, then activation waits for actual enter without replaying web Hub', async () => {
  const { runtime, owners, postMessage } = await fixture();
  const prepared = deferred<boolean>(), entered = deferred<boolean>();
  (owners.journey.prepareNativeWorld as jest.Mock).mockReturnValueOnce(prepared.promise);
  (owners.journey.activatePreparedNativeWorld as jest.Mock).mockReturnValueOnce(entered.promise);
  const request = runtime.request({ id: 1, destination: { kind: 'world', worldId: 3 } });
  await flush();
  expect(owners.journey.prepareNativeWorld).toHaveBeenCalledWith(3, expect.any(AbortSignal));
  expect(postMessage.mock.calls.some(([event]) => event.kind === 'ready')).toBe(false);
  expect(owners.journey.activatePreparedNativeWorld).not.toHaveBeenCalled();
  prepared.resolve(true);
  expect(await request).toEqual({ kind: 'ready', requestId: 1, destination: { kind: 'world', worldId: 3 } });
  expect(await runtime.activateWorld(99)).toBe(false);
  let completed = false;
  const activation = runtime.activateWorld(1).then(value => { completed = true; return value; });
  await flush();
  expect(completed).toBe(false);
  expect(await runtime.activateWorld(1)).toBe(false);
  entered.resolve(true);
  expect(await activation).toBe(true);
  expect(owners.journey.activatePreparedNativeWorld).toHaveBeenCalledTimes(1);
  expect(owners.journey.activatePreparedNativeWorld).toHaveBeenCalledWith(3);
  expect(owners.ui.showCollectiblesScreen).not.toHaveBeenCalled();
  expect(owners.journey.waitForJourneyV700HubPresentation).not.toHaveBeenCalled();
  expect(owners.journey.waitForJourneyV700HubEnterCompletion).not.toHaveBeenCalled();
  expect(owners.journey.activateNativeHubWorld).not.toHaveBeenCalled();
  expect(owners.ui.activateNativeHomepageAction).not.toHaveBeenCalled();
});

test('direct World cannot bypass the canonical first-play policy', async () => {
  const { runtime, owners } = await fixture();
  (owners.isFirstPlayTutorialForced as jest.Mock).mockReturnValue(true);
  expect(await runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } })).toMatchObject({ kind: 'error', code: 'unsupported' });
  expect(owners.journey.prepareNativeWorld).not.toHaveBeenCalled();
  expect(await runtime.activateWorld(1)).toBe(false);
});

test.each(['cancel', 'background', 'dispose', 'foreign'] as const)('late World preparation after %s cannot publish readiness or activate', async boundary => {
  const { runtime, owners, postMessage } = await fixture();
  const prepared = deferred<boolean>();
  (owners.journey.prepareNativeWorld as jest.Mock).mockReturnValueOnce(prepared.promise);
  const request = runtime.request({ id: 1, destination: { kind: 'world', worldId: 2 } });
  await flush();
  if (boundary === 'cancel') runtime.cancel();
  else if (boundary === 'dispose') runtime.dispose();
  else if (boundary === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  else owners.appZone.markHomeMenu('foreign-route');
  const cancels = (owners.journey.cancelNativeWorldPreparation as jest.Mock).mock.calls.length;
  prepared.resolve(true);
  expect(await request).toMatchObject({ kind: 'error' });
  expect(await runtime.activateWorld(1)).toBe(false);
  expect(postMessage.mock.calls.some(([event]) => event.kind === 'ready' || event.kind === 'present')).toBe(false);
  expect(owners.journey.activatePreparedNativeWorld).not.toHaveBeenCalled();
  if (boundary === 'foreign') expect(owners.journey.cancelNativeWorldPreparation).toHaveBeenCalledTimes(cancels);
});

test.each(['cancel', 'background', 'foreign'] as const)('prepared receipt loses activation authority after %s', async boundary => {
  const { runtime, owners, postMessage } = await fixture();
  expect(await runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } })).toMatchObject({ kind: 'ready' });
  if (boundary === 'cancel') runtime.cancel();
  else if (boundary === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  else owners.appZone.markJourneyMenu('foreign-world-owner');
  const cancels = (owners.journey.cancelNativeWorldPreparation as jest.Mock).mock.calls.length;
  expect(await runtime.activateWorld(1)).toBe(false);
  expect(owners.journey.activatePreparedNativeWorld).not.toHaveBeenCalled();
  expect(postMessage.mock.calls.some(([event]) => event.kind === 'present')).toBe(false);
  if (boundary === 'foreign') expect(owners.journey.cancelNativeWorldPreparation).toHaveBeenCalledTimes(cancels);
});

test('cancelled A resolving after prepared B cannot cancel or activate B through A receipt', async () => {
  const { runtime, owners } = await fixture();
  const old = deferred<boolean>();
  (owners.journey.prepareNativeWorld as jest.Mock).mockReturnValueOnce(old.promise);
  const requestA = runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } });
  await flush();
  runtime.cancel();
  await requestA;
  expect(await runtime.request({ id: 2, destination: { kind: 'world', worldId: 2 } })).toMatchObject({ kind: 'ready' });
  const cancels = (owners.journey.cancelNativeWorldPreparation as jest.Mock).mock.calls.length;
  old.resolve(true);
  await flush();
  expect(owners.journey.cancelNativeWorldPreparation).toHaveBeenCalledTimes(cancels);
  expect(await runtime.activateWorld(1)).toBe(false);
  expect(await runtime.activateWorld(2)).toBe(true);
  expect(owners.journey.activatePreparedNativeWorld).toHaveBeenCalledTimes(1);
  expect(owners.journey.activatePreparedNativeWorld).toHaveBeenCalledWith(2);
});

test('failed selected preparation cannot emit a ready or invented presentation receipt', async () => {
  const { runtime, owners, postMessage } = await fixture();
  (owners.journey.prepareNativeWorld as jest.Mock).mockResolvedValueOnce(false);
  expect(await runtime.request({ id: 1, destination: { kind: 'world', worldId: 3 } })).toMatchObject({ kind: 'error' });
  expect(await runtime.activateWorld(1)).toBe(false);
  expect(postMessage.mock.calls.some(([event]) => event.kind === 'ready' || event.kind === 'present')).toBe(false);
  expect(owners.journey.activatePreparedNativeWorld).not.toHaveBeenCalled();
});

test('a newer prepared World replaces the old receipt, never activating its stale World', async () => {
  const { runtime, owners } = await fixture();
  await runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } });
  expect(await runtime.request({ id: 2, destination: { kind: 'world', worldId: 3 } })).toMatchObject({ kind: 'ready' });
  expect(await runtime.activateWorld(1)).toBe(false);
  expect(await runtime.activateWorld(2)).toBe(true);
  expect(owners.journey.activatePreparedNativeWorld).toHaveBeenCalledTimes(1);
  expect(owners.journey.activatePreparedNativeWorld).toHaveBeenCalledWith(3);
});

test('failed current activation releases its own preparation and permits a covered native retry without invented present', async () => {
  const { runtime, owners, postMessage } = await fixture();
  (owners.journey.activatePreparedNativeWorld as jest.Mock).mockResolvedValueOnce(false);
  await runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } });
  expect(await runtime.activateWorld(1)).toBe(false);
  expect(owners.journey.cancelNativeWorldPreparation).toHaveBeenCalled();
  expect(postMessage.mock.calls.some(([event]) => event.kind === 'present')).toBe(false);
  expect(await runtime.request({ id: 2, destination: { kind: 'world', worldId: 2 } })).toMatchObject({ kind: 'ready' });
});

test('cancel after a foreign route acquired the epoch cannot retire that foreign manager owner', async () => {
  const { runtime, owners } = await fixture();
  await runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } });
  owners.appZone.markJourneyMenu('foreign-world-owner');
  const cancels = (owners.journey.cancelNativeWorldPreparation as jest.Mock).mock.calls.length;
  runtime.cancel();
  expect(owners.journey.cancelNativeWorldPreparation).toHaveBeenCalledTimes(cancels);
  expect(await runtime.activateWorld(1)).toBe(false);
});

test('foreign epoch revokes old native navigation authority instead of allowing a stale Hub retry to replace it', async () => {
  const { runtime, owners, postMessage } = await fixture();
  await runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } });
  owners.appZone.markHomeMenu('foreign-home-owner');
  expect(await runtime.activateWorld(1)).toBe(false);
  expect(await runtime.request({ id: 2, destination: { kind: 'hub' } })).toMatchObject({ kind: 'error', code: 'unsupported' });
  expect(owners.appZone.getCurrentZone()).toBe('home');
  document.getElementById('home')!.hidden = false;
  await runtime.present('home'); // Genuine settled canonical owner, not retry.
  expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'present', route: 'home' }));
});

test('new native request before activation cannot replace an already foreign prepared-World epoch', async () => {
  const { runtime, owners } = await fixture();
  await runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } });
  owners.appZone.markHomeMenu('foreign-home-owner');
  expect(await runtime.request({ id: 2, destination: { kind: 'hub' } })).toMatchObject({ kind: 'error', code: 'unsupported' });
  expect(owners.appZone.getCurrentZone()).toBe('home');
});

test('failed activation after a foreign epoch does not cancel or re-adopt that foreign route', async () => {
  const { runtime, owners, postMessage } = await fixture();
  const entered = deferred<boolean>();
  (owners.journey.activatePreparedNativeWorld as jest.Mock).mockReturnValueOnce(entered.promise);
  await runtime.request({ id: 1, destination: { kind: 'world', worldId: 2 } });
  const activation = runtime.activateWorld(1);
  await flush();
  owners.appZone.markJourneyMenu('foreign-world-owner');
  const cancels = (owners.journey.cancelNativeWorldPreparation as jest.Mock).mock.calls.length;
  entered.resolve(false);
  expect(await activation).toBe(false);
  expect(owners.journey.cancelNativeWorldPreparation).toHaveBeenCalledTimes(cancels);
  expect(postMessage.mock.calls.some(([event]) => event.kind === 'present')).toBe(false);
  expect(runtime.selectSlide(0)).toBe(false);
});

test.each(['prepare-failed', 'activation-failed', 'cancelled'] as const)('recovery authorizes only the matching current %s World receipt', async boundary => {
  const { runtime, owners } = await fixture();
  if (boundary === 'prepare-failed') (owners.journey.prepareNativeWorld as jest.Mock).mockResolvedValueOnce(false);
  await runtime.request({ id: 1, destination: { kind: 'world', worldId: 2 } });
  if (boundary === 'activation-failed') {
    (owners.journey.activatePreparedNativeWorld as jest.Mock).mockResolvedValueOnce(false);
    expect(await runtime.activateWorld(1)).toBe(false);
  } else if (boundary === 'cancelled') runtime.cancel();
  expect(runtime.recoverWorld(99)).toBe(false);
  expect(runtime.recoverWorld(1)).toBe(true);
  expect(await runtime.request({ id: 2, destination: { kind: 'world', worldId: 3 } })).toMatchObject({ kind: 'ready' });
  expect(runtime.recoverWorld(1)).toBe(false);
  expect(await runtime.activateWorld(2)).toBe(true);
  expect(runtime.recoverWorld(2)).toBe(false);
});

test.each(['shell', 'home-cleanup'] as const)('recovery during deferred %s settles the request immediately without cancelling an unstarted manager and permits retry', async phase => {
  const { runtime, owners, postMessage } = await fixture();
  const gate = deferred<void>();
  if (phase === 'shell') {
    (owners.appZone.showJourneyShell as jest.Mock).mockImplementationOnce(() => {
      owners.appZone.markJourneyMenu('deferred-shell');
      return gate.promise;
    });
  } else (owners.ui.hideHomepage as jest.Mock).mockReturnValueOnce(gate.promise);
  const first = runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } });
  await flush();
  expect(owners.journey.prepareNativeWorld).not.toHaveBeenCalled();
  expect(runtime.recoverWorld(1)).toBe(true);
  expect(await first).toMatchObject({ kind: 'error', code: 'cancelled' });
  expect(owners.journey.cancelNativeWorldPreparation).not.toHaveBeenCalled();
  expect(await runtime.request({ id: 2, destination: { kind: 'world', worldId: 2 } })).toMatchObject({ kind: 'ready' });
  gate.resolve();
  await flush();
  expect(owners.journey.prepareNativeWorld).toHaveBeenCalledTimes(1);
  expect(owners.journey.cancelNativeWorldPreparation).not.toHaveBeenCalled();
  expect(postMessage.mock.calls.some(([event]) => event.kind === 'ready' && event.requestId === 1)).toBe(false);
  expect(await runtime.activateWorld(2)).toBe(true);
});

test.each(['shell', 'home-cleanup'] as const)('foreign epoch during deferred %s denies recovery and preserves the foreign manager', async phase => {
  const { runtime, owners } = await fixture();
  const gate = deferred<void>();
  if (phase === 'shell') {
    (owners.appZone.showJourneyShell as jest.Mock).mockImplementationOnce(() => {
      owners.appZone.markJourneyMenu('deferred-shell');
      return gate.promise;
    });
  } else (owners.ui.hideHomepage as jest.Mock).mockReturnValueOnce(gate.promise);
  const request = runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } });
  await flush();
  owners.appZone.markHomeMenu('foreign-owner');
  expect(runtime.recoverWorld(1)).toBe(false);
  gate.resolve();
  expect(await request).toMatchObject({ kind: 'error' });
  expect(owners.journey.prepareNativeWorld).not.toHaveBeenCalled();
  expect(owners.journey.cancelNativeWorldPreparation).not.toHaveBeenCalled();
  expect(owners.appZone.getCurrentZone()).toBe('home');
});

test.each(['shell-background', 'shell-error', 'cleanup-background', 'cleanup-error'] as const)('early %s failure owns a recoverable receipt without an unstarted manager cancellation', async boundary => {
  const { runtime, owners } = await fixture();
  const gate = deferred<void>();
  if (boundary.startsWith('shell')) {
    (owners.appZone.showJourneyShell as jest.Mock).mockImplementationOnce(() => {
      owners.appZone.markJourneyMenu('deferred-shell');
      return gate.promise;
    });
  } else (owners.ui.hideHomepage as jest.Mock).mockReturnValueOnce(gate.promise);
  const request = runtime.request({ id: 1, destination: { kind: 'world', worldId: 2 } });
  await flush();
  if (boundary.endsWith('background')) {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    gate.resolve();
  } else gate.reject(new Error('Actual preparation dependency failed'));
  expect(await request).toMatchObject({ kind: 'error' });
  expect(owners.journey.prepareNativeWorld).not.toHaveBeenCalled();
  expect(owners.journey.cancelNativeWorldPreparation).not.toHaveBeenCalled();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  expect(runtime.recoverWorld(1)).toBe(true);
  expect(await runtime.request({ id: 2, destination: { kind: 'world', worldId: 3 } })).toMatchObject({ kind: 'ready' });
});

test('recovery during actual World enter atomically cancels its manager and late completion cannot restore success', async () => {
  const { runtime, owners } = await fixture();
  const entered = deferred<boolean>();
  (owners.journey.activatePreparedNativeWorld as jest.Mock).mockReturnValueOnce(entered.promise);
  await runtime.request({ id: 1, destination: { kind: 'world', worldId: 1 } });
  const activation = runtime.activateWorld(1);
  await flush();
  expect(runtime.recoverWorld(1)).toBe(true);
  expect(owners.journey.cancelNativeWorldPreparation).toHaveBeenCalledTimes(1);
  expect(await runtime.request({ id: 2, destination: { kind: 'world', worldId: 3 } })).toMatchObject({ kind: 'ready' });
  entered.resolve(true);
  expect(await activation).toBe(false);
  expect(owners.journey.cancelNativeWorldPreparation).toHaveBeenCalledTimes(1);
  expect(await runtime.activateWorld(2)).toBe(true);
});

test('manager synchronous Journey epoch publication is captured and does not invalidate its legitimate preparation', async () => {
  const { runtime, owners } = await fixture();
  (owners.journey.prepareNativeWorld as jest.Mock).mockImplementationOnce(async () => {
    owners.appZone.markJourneyMenu('canonical-route-coordinator-begin');
    return true;
  });
  expect(await runtime.request({ id: 1, destination: { kind: 'world', worldId: 3 } })).toMatchObject({ kind: 'ready' });
  expect(await runtime.activateWorld(1)).toBe(true);
  expect(runtime.recoverWorld(1)).toBe(false);
  expect(owners.journey.cancelNativeWorldPreparation).not.toHaveBeenCalled();
});

async function liveWorld(worldId: 1 | 2 | 3 = 2) {
  const f = await fixture();
  await f.runtime.request({ id: 1, destination: { kind: 'world', worldId } });
  expect(await f.runtime.activateWorld(1)).toBe(true);
  const screen = document.getElementById('journey-screen')!;
  const container = document.getElementById('journey-boards-container')!;
  container.dataset.journeyV700View = 'world';
  container.dataset.journeyV700WorldId = String(worldId);
  f.postMessage.mockClear();
  (f.owners.ui.hideHomepage as jest.Mock).mockClear();
  (f.owners.journey.suspendForHomepage as jest.Mock).mockClear();
  (f.owners.createFeedback as jest.Mock).mockClear();
  return { ...f, screen, container, worldId };
}

test('World-to-native-Hub admission is pure and requires the exact current live World', async () => {
  const f = await liveWorld();
  const before = document.body.innerHTML;
  expect(f.runtime.canPresentHubFromWorld(2)).toBe(true);
  expect(f.runtime.canPresentHubFromWorld(1)).toBe(false);
  expect(f.runtime.canPresentHubFromWorld(3)).toBe(false);
  expect(document.body.innerHTML).toBe(before);
  expect(f.postMessage).not.toHaveBeenCalled();
  expect(f.owners.ui.hideHomepage).not.toHaveBeenCalled();
  expect(f.owners.journey.suspendForHomepage).not.toHaveBeenCalled();
});

test.each(['background', 'screen-hidden', 'world-hidden', 'detached', 'outside-screen', 'first-play', 'foreign-zone', 'hub'] as const)('native Hub return admission rejects %s without quiescing the current route', async boundary => {
  const f = await liveWorld();
  if (boundary === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  else if (boundary === 'screen-hidden') f.screen.hidden = true;
  else if (boundary === 'world-hidden') f.container.hidden = true;
  else if (boundary === 'detached') f.container.remove();
  else if (boundary === 'outside-screen') document.body.append(f.container);
  else if (boundary === 'first-play') (f.owners.isFirstPlayTutorialForced as jest.Mock).mockReturnValue(true);
  else if (boundary === 'foreign-zone') f.owners.appZone.markHomeMenu('foreign');
  else f.container.dataset.journeyV700View = 'hub';
  expect(f.runtime.canPresentHubFromWorld(2)).toBe(false);
  expect(f.owners.journey.suspendForHomepage).not.toHaveBeenCalled();
  expect(f.postMessage).not.toHaveBeenCalled();
});

test('actual completed Hub stage awaits cleanup then emits enter-hub exactly once and admits native input', async () => {
  const f = await liveWorld();
  const gate = deferred<void>();
  f.container.dataset.journeyV700View = 'hub';
  delete f.container.dataset.journeyV700WorldId;
  (f.owners.ui.hideHomepage as jest.Mock).mockReturnValueOnce(gate.promise);
  (f.owners.journey.suspendForHomepage as jest.Mock).mockImplementation(() => { f.screen.hidden = true; });
  const epoch = f.owners.appZone.getPresentationEpoch();
  const presentation = f.runtime.presentHubFromWorld(2, epoch);
  await flush();
  expect(f.postMessage).not.toHaveBeenCalled();
  expect(await f.runtime.presentHubFromWorld(2, epoch)).toBe(false);
  expect(f.owners.ui.hideHomepage).toHaveBeenCalledTimes(1);
  gate.resolve();
  expect(await presentation).toBe(true);
  expect(f.postMessage).toHaveBeenCalledTimes(1);
  expect(f.postMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'enter-hub', snapshot: expect.any(Object) }));
  expect(await f.runtime.presentHubFromWorld(2, epoch)).toBe(false);
  expect(await f.runtime.request({ id: 2, destination: { kind: 'home' } })).toMatchObject({ kind: 'ready' });
});

test.each(['old-epoch', 'not-hub', 'background', 'first-play'] as const)('completed native Hub return rejects %s before side effects', async boundary => {
  const f = await liveWorld();
  f.container.dataset.journeyV700View = boundary === 'not-hub' ? 'world' : 'hub';
  const epoch = f.owners.appZone.getPresentationEpoch();
  if (boundary === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  if (boundary === 'first-play') (f.owners.isFirstPlayTutorialForced as jest.Mock).mockReturnValue(true);
  expect(await f.runtime.presentHubFromWorld(2, boundary === 'old-epoch' ? epoch - 1 : epoch)).toBe(false);
  expect(f.postMessage).not.toHaveBeenCalled();
  expect(f.owners.ui.hideHomepage).not.toHaveBeenCalled();
  expect(f.owners.journey.suspendForHomepage).not.toHaveBeenCalled();
});

test.each(['foreign-epoch', 'background', 'screen-replaced', 'ancestor-replaced', 'container-replaced', 'world-view', 'cancel', 'dispose'] as const)('native Hub return cleanup completing after %s cannot publish or adopt', async boundary => {
  const f = await liveWorld();
  f.container.dataset.journeyV700View = 'hub';
  const gate = deferred<void>();
  (f.owners.ui.hideHomepage as jest.Mock).mockReturnValueOnce(gate.promise);
  const presentation = f.runtime.presentHubFromWorld(2, f.owners.appZone.getPresentationEpoch());
  await flush();
  if (boundary === 'foreign-epoch') f.owners.appZone.markJourneyMenu('foreign');
  else if (boundary === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  else if (boundary === 'screen-replaced') f.screen.replaceWith(f.screen.cloneNode(true));
  else if (boundary === 'ancestor-replaced') {
    const replacement = document.createElement('section');
    replacement.id = 'journey-screen';
    replacement.append(f.container);
    f.screen.replaceWith(replacement);
  }
  else if (boundary === 'container-replaced') f.container.replaceWith(f.container.cloneNode(true));
  else if (boundary === 'world-view') f.container.dataset.journeyV700View = 'world';
  else if (boundary === 'cancel') f.runtime.cancel();
  else f.runtime.dispose();
  gate.resolve();
  expect(await presentation).toBe(false);
  expect(f.postMessage.mock.calls.some(([event]) => event.kind === 'enter-hub' || event.kind === 'present')).toBe(false);
  expect(f.owners.createFeedback).not.toHaveBeenCalled();
});

test('throwing native transport reports false and never transfers World ownership to an unpresented Hub', async () => {
  const f = await liveWorld();
  f.container.dataset.journeyV700View = 'hub';
  f.postMessage.mockImplementationOnce(() => { throw new Error('Receiver unavailable'); });
  expect(await f.runtime.presentHubFromWorld(2, f.owners.appZone.getPresentationEpoch())).toBe(false);
  expect(f.owners.createFeedback).not.toHaveBeenCalled();
  expect(await f.runtime.request({ id: 2, destination: { kind: 'home' } })).toMatchObject({ kind: 'error', code: 'unsupported' });
});

test('explicit native return failure keeps the same-epoch canonical web Hub fallback instead of generic present retrying it', async () => {
  const f = await liveWorld();
  f.container.dataset.journeyV700View = 'hub';
  f.postMessage.mockImplementationOnce(() => { throw new Error('Receiver unavailable'); });
  expect(await f.runtime.presentHubFromWorld(2, f.owners.appZone.getPresentationEpoch())).toBe(false);
  f.postMessage.mockClear();
  await f.runtime.present('hub');
  expect(f.postMessage).not.toHaveBeenCalled();
  expect(f.owners.ui.hideHomepage).toHaveBeenCalledTimes(1);
  f.owners.appZone.markJourneyMenu('new-canonical-hub-owner');
  await f.runtime.present('hub');
  expect(f.postMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'present', route: 'hub' }));
});

test('deferred native Hub delivery validates the actual successful return epoch', async () => {
  const f = await liveWorld();
  const epoch = f.owners.appZone.getPresentationEpoch();
  expect(f.runtime.isNativeHubPresentationCurrent(epoch)).toBe(false);
  f.container.dataset.journeyV700View = 'hub';
  expect(await f.runtime.presentHubFromWorld(2, epoch)).toBe(true);
  expect(f.postMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'enter-hub', epoch }));
  expect(f.runtime.isNativeHubPresentationCurrent(epoch)).toBe(true);
  expect(f.runtime.isNativeHubPresentationCurrent(epoch - 1)).toBe(false);
});

test.each(['foreign-epoch', 'background', 'dispose', 'home'] as const)('deferred native Hub delivery is invalid after %s', async boundary => {
  const f = await liveWorld();
  f.container.dataset.journeyV700View = 'hub';
  const epoch = f.owners.appZone.getPresentationEpoch();
  expect(await f.runtime.presentHubFromWorld(2, epoch)).toBe(true);
  if (boundary === 'foreign-epoch') f.owners.appZone.markJourneyMenu('foreign');
  else if (boundary === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  else if (boundary === 'dispose') f.runtime.dispose();
  else await f.runtime.request({ id: 2, destination: { kind: 'home' } });
  expect(f.runtime.isNativeHubPresentationCurrent(epoch)).toBe(false);
});

test.each(['preparing', 'prepared', 'activating'] as const)('deferred native Hub delivery is invalid while a new World is %s', async phase => {
  const f = await liveWorld();
  f.container.dataset.journeyV700View = 'hub';
  expect(await f.runtime.presentHubFromWorld(2, f.owners.appZone.getPresentationEpoch())).toBe(true);
  const prepared = deferred<boolean>(), entered = deferred<boolean>();
  if (phase === 'preparing') (f.owners.journey.prepareNativeWorld as jest.Mock).mockReturnValueOnce(prepared.promise);
  const request = f.runtime.request({ id: 2, destination: { kind: 'world', worldId: 1 } });
  await flush();
  if (phase !== 'preparing') expect(await request).toMatchObject({ kind: 'ready' });
  let activation: Promise<boolean> | undefined;
  if (phase === 'activating') {
    (f.owners.journey.activatePreparedNativeWorld as jest.Mock).mockReturnValueOnce(entered.promise);
    activation = f.runtime.activateWorld(2);
    await flush();
  }
  // Check even the new current epoch: pending ownership alone must reject it.
  expect(f.runtime.isNativeHubPresentationCurrent(f.owners.appZone.getPresentationEpoch())).toBe(false);
  f.runtime.cancel();
  prepared.resolve(true);
  entered.resolve(true);
  await request;
  if (activation) expect(await activation).toBe(false);
});
