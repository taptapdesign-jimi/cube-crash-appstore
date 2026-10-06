import { installNativeHomeHubRuntime, notifyNativeHomeHubPresentation, type NativeHomeHubRuntimeHost, type NativeHomeHubRuntimeOwners } from '../native-home-hub-runtime';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function fixture() {
  document.body.innerHTML = '<section id="home"></section><section id="journey-screen"><div id="journey-boards-container" data-journey-v700-view="hub"></div></section>';
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  let zone = 'home', epoch = 0, slide = 0;
  const postMessage = jest.fn();
  const feedbacks: Array<ReturnType<NativeHomeHubRuntimeOwners['createFeedback']>> = [];
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
    slider: { getCurrentSlide: () => slide, setSlideInstant: jest.fn(index => { slide = index; }), syncHiddenSlideState: jest.fn(index => { slide = index; }) },
    ui: { showHomepageQuietly: jest.fn(), hideHomepage: jest.fn(), showCollectiblesScreen: jest.fn(async () => {}), activateNativeHomepageAction: jest.fn(async () => true) },
    journey: {
      getBoardById: jest.fn(id => ({ unlocked: id <= 4, interim: id === 4 || id === 11 })),
      suspendForHomepage: jest.fn(), prepareFirstPlayTutorialHubReturn: jest.fn(),
      waitForJourneyV700HubPresentation: jest.fn(async () => true), waitForJourneyV700HubEnterCompletion: jest.fn(async () => {}),
      activateNativeHubWorld: jest.fn(() => true),
    },
    finalizeHome: jest.fn(),
    cancelHomeEnter: jest.fn(), hideHomeNavigation: jest.fn(),
    isFirstPlayTutorialForced: jest.fn(() => false),
    createFeedback: jest.fn(() => {
      const feedback = { pressCTA: jest.fn(() => true), pressTab: jest.fn(() => true), pressSwipe: jest.fn(() => true),
        pressBack: jest.fn(() => true), homeMotion: jest.fn(() => true), hubAmbience: jest.fn(() => true), hubExit: jest.fn(() => true),
        stop: jest.fn(), releaseToWeb: jest.fn(), dispose: jest.fn() };
      feedbacks.push(feedback); return feedback;
    }),
  };
  const load = jest.fn(async () => owners);
  return { host, owners, load, postMessage, feedbacks };
}
afterEach(() => { document.body.replaceChildren(); });

test('disabled or absent native receiver imports no canonical owners and installs nothing', async () => {
  const f = fixture();
  f.host.__jimiNativeHomeHubEnabled = false;
  expect(await installNativeHomeHubRuntime(f.host, f.load)).toBeNull();
  f.host.__jimiNativeHomeHubEnabled = true;
  delete f.host.webkit;
  expect(await installNativeHomeHubRuntime(f.host, f.load)).toBeNull();
  expect(f.load).not.toHaveBeenCalled();
  expect(f.host.__jimiNativeHomeHub).toBeUndefined();
});

test('deduplicates installation and projects only canonical complete/interim counts', async () => {
  const f = fixture();
  const first = installNativeHomeHubRuntime(f.host, f.load);
  expect(installNativeHomeHubRuntime(f.host, f.load)).toBe(first);
  const runtime = (await first)!;
  expect(f.host.__jimiNativeHomeHubRuntime).toBe(runtime);
  document.getElementById('journey-boards-container')!.dataset.journeyV700WorldId = '3';
  expect(runtime.snapshot()).toMatchObject({ kind: 'snapshot', snapshot: { homeSlide: 0, activeWorldId: 2, worlds: [
    { worldId: 1, completed: 3, hasInterimCard: true }, { worldId: 3, completed: 0, hasInterimCard: false }, { worldId: 2, completed: 0, hasInterimCard: true },
  ] } });
  expect(f.owners.journey.getBoardById).toHaveBeenCalledTimes(30);
  (f.owners.journey.getBoardById as jest.Mock).mockReturnValue(undefined);
  expect(runtime.snapshot()).toMatchObject({ snapshot: { worlds: expect.arrayContaining([expect.objectContaining({ completed: null })]) } });
  runtime.dispose();
  expect(f.host.__jimiNativeHomeHubRuntime).toBeUndefined();
  expect(f.host.__jimiNativeHomeHub).toBeUndefined();
});

test.each(['arcade', 'settings'] as const)('web-home %s is a ready SOURCE and invokes canonical CTA exactly once only after native activation', async action => {
  const f = fixture();
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  expect(await runtime.request({ id: 1, destination: { kind: 'web-home', action } })).toEqual({ kind: 'ready', requestId: 1, destination: { kind: 'web-home', action } });
  expect(f.owners.ui.activateNativeHomepageAction).not.toHaveBeenCalled();
  expect(f.owners.slider.getCurrentSlide()).toBe(action === 'arcade' ? 1 : 2);
  expect(await runtime.activateSource(2)).toBe(false);
  expect(await runtime.activateSource(1)).toBe(true);
  expect(await runtime.activateSource(1)).toBe(false);
  expect(f.owners.ui.activateNativeHomepageAction).toHaveBeenCalledTimes(1);
  expect(f.owners.ui.activateNativeHomepageAction).toHaveBeenCalledWith(action);
  expect(runtime.selectSlide(0)).toBe(false);
  runtime.dispose();
});

test('web-hub waits for real Hub owner, then delegates selected World only after source activation', async () => {
  const f = fixture();
  const gate = deferred<void>();
  (f.owners.journey.waitForJourneyV700HubEnterCompletion as jest.Mock).mockReturnValueOnce(gate.promise);
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  const result = runtime.request({ id: 1, destination: { kind: 'web-hub', worldId: 3 } });
  for (let index = 0; index < 8; index++) await Promise.resolve();
  expect(f.postMessage).not.toHaveBeenCalled();
  expect(f.owners.journey.activateNativeHubWorld).not.toHaveBeenCalled();
  gate.resolve();
  expect(await result).toMatchObject({ kind: 'ready', destination: { kind: 'web-hub', worldId: 3 } });
  expect(await runtime.activateSource(1)).toBe(true);
  expect(f.owners.journey.activateNativeHubWorld).toHaveBeenCalledWith(3);
  runtime.dispose();
});

test.each(['cancel', 'background', 'replace'] as const)('source cannot activate after %s; late work cannot emit ready', async mode => {
  const f = fixture();
  const gate = deferred<void>();
  (f.owners.appZone.showHomepageShell as jest.Mock).mockImplementationOnce(() => {
    f.owners.appZone.markHomeMenu('prepare'); return gate.promise;
  });
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  const result = runtime.request({ id: 1, destination: { kind: 'web-home', action: 'arcade' } });
  if (mode === 'cancel') runtime.cancel();
  else if (mode === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  else f.owners.appZone.markJourneyMenu('foreign');
  gate.resolve();
  expect(await result).toMatchObject({ kind: 'error' });
  expect(await runtime.activateSource(1)).toBe(false);
  expect(f.owners.ui.activateNativeHomepageAction).not.toHaveBeenCalled();
  runtime.dispose();
});

test('native routes/slides do not activate gameplay; only explicit current presentation can re-adopt after web handoff', async () => {
  const f = fixture();
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  expect(runtime.selectSlide(2)).toBe(true);
  expect(f.owners.slider.syncHiddenSlideState).toHaveBeenCalledWith(2);
  expect(runtime.selectSlide(3)).toBe(false);
  await runtime.request({ id: 1, destination: { kind: 'hub' } });
  expect(f.owners.ui.hideHomepage).toHaveBeenCalledTimes(1);
  expect(f.owners.journey.activateNativeHubWorld).not.toHaveBeenCalled();
  await runtime.request({ id: 2, destination: { kind: 'web-home', action: 'settings' } });
  await notifyNativeHomeHubPresentation('home', f.host); // Preparing source must not re-adopt.
  expect(f.postMessage.mock.calls.some(([event]) => event.kind === 'present')).toBe(false);
  await runtime.activateSource(2);
  await notifyNativeHomeHubPresentation('home', f.host);
  expect(f.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'present', route: 'home' }));
  expect(runtime.selectSlide(0)).toBe(true);
  runtime.dispose();
});

test('absent World delegate is unsupported, and hidden prepared source never produces ready', async () => {
  const f = fixture();
  delete f.owners.journey.activateNativeHubWorld;
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  expect(await runtime.request({ id: 1, destination: { kind: 'web-hub', worldId: 1 } })).toMatchObject({ code: 'unsupported' });
  document.getElementById('home')!.hidden = true;
  expect(await runtime.request({ id: 2, destination: { kind: 'web-home', action: 'arcade' } })).toMatchObject({ kind: 'error' });
  expect(await runtime.activateSource(2)).toBe(false);
  runtime.dispose();
});

test('initial native Home waits for the canonical hidden-Home cleanup receipt, not merely a snapshot', async () => {
  const f = fixture();
  const cleanup = deferred<void>();
  (f.owners.ui.hideHomepage as jest.Mock).mockImplementationOnce(() => {
    document.getElementById('home')!.hidden = true;
    return cleanup.promise;
  });
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  runtime.snapshot();
  expect(f.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'snapshot' }));
  const result = runtime.request({ id: 1, destination: { kind: 'home' } });
  expect(f.owners.cancelHomeEnter).toHaveBeenCalledWith('native-home-quiesce');
  expect(f.owners.hideHomeNavigation).toHaveBeenCalledWith('native-home-quiesce');
  await Promise.resolve();
  expect(f.postMessage.mock.calls.some(([event]) => event.kind === 'ready')).toBe(false);
  cleanup.resolve();
  expect(await result).toEqual({ kind: 'ready', requestId: 1, destination: { kind: 'home' } });
  expect(document.getElementById('home')!.hidden).toBe(true);
  runtime.dispose();
});

test('a cancelled preparation finishing late cannot clear a newer source suppression/lease', async () => {
  const f = fixture();
  const old = deferred<void>();
  (f.owners.appZone.showHomepageShell as jest.Mock).mockImplementationOnce(() => {
    f.owners.appZone.markHomeMenu('old'); return old.promise;
  });
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  const first = runtime.request({ id: 1, destination: { kind: 'web-home', action: 'arcade' } });
  runtime.cancel();
  await first;
  await runtime.request({ id: 2, destination: { kind: 'web-home', action: 'settings' } });
  old.resolve();
  for (let index = 0; index < 8; index++) await Promise.resolve();
  await runtime.present('home');
  expect(f.postMessage.mock.calls.some(([event]) => event.kind === 'present')).toBe(false);
  expect(await runtime.activateSource(2)).toBe(true);
  expect(f.owners.ui.activateNativeHomepageAction).toHaveBeenCalledWith('settings');
  runtime.dispose();
});

test.each(['false', 'reject', 'foreign-reject'] as const)('failed source action %s re-adopts only its still-current visible source', async mode => {
  const f = fixture();
  (f.owners.ui.activateNativeHomepageAction as jest.Mock).mockImplementationOnce(async () => {
    if (mode === 'foreign-reject') f.owners.appZone.markJourneyMenu('another-route');
    if (mode !== 'false') throw new Error('action failed');
    return false;
  });
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  await runtime.request({ id: 1, destination: { kind: 'web-home', action: 'arcade' } });
  expect(await runtime.activateSource(1)).toBe(false);
  const presentations = f.postMessage.mock.calls.filter(([event]) => event.kind === 'present');
  expect(presentations).toHaveLength(mode === 'foreign-reject' ? 0 : 1);
  expect(await runtime.activateSource(1)).toBe(false);
  runtime.dispose();
});

test.each(['home', 'hub'] as const)('completed %s re-adoption suspends web idle and waits for cleanup before presenting native', async route => {
  const f = fixture();
  if (route === 'hub') f.owners.appZone.markJourneyMenu('completed-hub');
  const cleanup = deferred<void>();
  (f.owners.ui.hideHomepage as jest.Mock).mockImplementationOnce(() => {
    document.getElementById('home')!.hidden = true;
    return cleanup.promise;
  });
  (f.owners.journey.suspendForHomepage as jest.Mock).mockImplementation(() => {
    document.getElementById('journey-boards-container')!.hidden = true;
  });
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  const presentation = runtime.present(route);
  expect(f.owners.journey.suspendForHomepage).toHaveBeenCalledTimes(1);
  expect(f.owners.hideHomeNavigation).toHaveBeenCalledTimes(1);
  expect(document.getElementById('journey-boards-container')!.hidden).toBe(true);
  await runtime.present(route); // Reentrant completed receipt does not acquire another cleanup.
  expect(f.owners.ui.hideHomepage).toHaveBeenCalledTimes(1);
  expect(f.postMessage).not.toHaveBeenCalled();
  cleanup.resolve();
  await presentation;
  expect(f.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'present', route }));
  expect(document.getElementById('home')!.hidden).toBe(true);
  runtime.dispose();
});

test.each(['cancel', 'dispose', 'background', 'route', 'root-replaced'] as const)('late re-adoption after %s cannot publish a stale source', async boundary => {
  const f = fixture();
  const cleanup = deferred<void>();
  (f.owners.ui.hideHomepage as jest.Mock).mockReturnValueOnce(cleanup.promise);
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  const presentation = runtime.present('home');
  if (boundary === 'cancel') runtime.cancel();
  if (boundary === 'dispose') runtime.dispose();
  if (boundary === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  if (boundary === 'route') f.owners.appZone.markJourneyMenu('foreign');
  if (boundary === 'root-replaced') document.getElementById('home')!.replaceWith(Object.assign(document.createElement('section'), { id: 'home' }));
  cleanup.resolve();
  await presentation;
  expect(f.postMessage).not.toHaveBeenCalled();
  runtime.dispose();
});

test('an old completed presentation cannot clear a new prepared source lease', async () => {
  const f = fixture();
  const oldCleanup = deferred<void>();
  (f.owners.ui.hideHomepage as jest.Mock).mockReturnValueOnce(oldCleanup.promise);
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  const oldPresentation = runtime.present('home');
  await runtime.request({ id: 1, destination: { kind: 'web-home', action: 'settings' } });
  oldCleanup.resolve();
  await oldPresentation;
  expect(f.postMessage.mock.calls.some(([event]) => event.kind === 'present')).toBe(false);
  expect(await runtime.activateSource(1)).toBe(true);
  expect(f.owners.ui.activateNativeHomepageAction).toHaveBeenCalledWith('settings');
  runtime.dispose();
});

test('first-play Journey uses canonical policy and CTA source; native Hub cannot bypass the tutorial', async () => {
  const f = fixture();
  (f.owners.isFirstPlayTutorialForced as jest.Mock).mockReturnValue(true);
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  expect(runtime.snapshot()).toMatchObject({ snapshot: { journeyRequiresTutorial: true } });
  expect(runtime.selectSlide(0)).toBe(false);
  expect(await runtime.request({ id: 1, destination: { kind: 'hub' } })).toMatchObject({ code: 'unsupported' });
  expect(await runtime.request({ id: 2, destination: { kind: 'web-hub', worldId: 1 } })).toMatchObject({ code: 'unsupported' });
  expect(await runtime.request({ id: 3, destination: { kind: 'web-home', action: 'journey' } })).toMatchObject({ kind: 'ready', destination: { kind: 'web-home', action: 'journey' } });
  expect(f.owners.slider.getCurrentSlide()).toBe(0);
  expect(await runtime.activateSource(3)).toBe(true);
  expect(f.owners.ui.activateNativeHomepageAction).toHaveBeenCalledWith('journey');
  runtime.dispose();
});

test('feedback is opt-in and admitted only after quiescence; busy receipts are consumed without replay', async () => {
  const f = fixture();
  const cleanup = deferred<void>();
  (f.owners.ui.hideHomepage as jest.Mock).mockReturnValueOnce(cleanup.promise);
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  expect(f.owners.createFeedback).not.toHaveBeenCalled();
  expect(runtime.nativeFeedback({ id: 1, kind: 'cta', policy: 'native-only' })).toBe(false);
  const entering = runtime.request({ id: 1, destination: { kind: 'home' } });
  expect(runtime.nativeFeedback({ id: 2, kind: 'home-enter', durationSeconds: 0.56 })).toBe(false);
  expect(runtime.resumeFeedback()).toBe(false);
  cleanup.resolve();
  expect(await entering).toMatchObject({ kind: 'ready' });
  expect(f.owners.createFeedback).toHaveBeenCalledTimes(1);
  expect(runtime.nativeFeedback({ id: 2, kind: 'home-enter', durationSeconds: 0.56 })).toBe(false);
  expect(runtime.nativeFeedback({ id: 3, kind: 'home-enter', durationSeconds: 0.56 })).toBe(true);
  expect(f.feedbacks[0].homeMotion).toHaveBeenCalledWith(3, 'enter', 0.56);
  runtime.dispose();
});

test('validated semantic receipts map once to authored feedback and never reset event IDs across route leases', async () => {
  const f = fixture();
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  await runtime.request({ id: 1, destination: { kind: 'home' } });
  expect(runtime.nativeFeedback(null)).toBe(false);
  expect(runtime.nativeFeedback({ id: NaN, kind: 'back' })).toBe(false);
  expect(runtime.nativeFeedback({ id: 1, kind: 'cta', policy: 'invented' })).toBe(false);
  expect(runtime.nativeFeedback({ id: 1, kind: 'home-exit', durationSeconds: Infinity })).toBe(false);
  expect(runtime.nativeFeedback({ id: 1, kind: 'home-exit', durationSeconds: 0 })).toBe(false);
  expect(runtime.nativeFeedback({ id: 1, kind: 'cta', policy: 'web-home-source' })).toBe(true);
  expect(runtime.nativeFeedback({ id: 2, kind: 'tab', policy: 'native-only' })).toBe(true);
  expect(runtime.nativeFeedback({ id: 3, kind: 'swipe' })).toBe(true);
  expect(f.feedbacks[0].pressCTA).toHaveBeenCalledWith(1, 'web-home-source');
  expect(f.feedbacks[0].pressTab).toHaveBeenCalledWith(2, 'native-only');
  expect(f.feedbacks[0].pressSwipe).toHaveBeenCalledWith(3);
  await runtime.request({ id: 2, destination: { kind: 'hub' } });
  expect(f.feedbacks[0].stop).not.toHaveBeenCalled(); // Accepted CTA/Back may finish across a normal native route.
  expect(f.feedbacks).toHaveLength(1);
  // Outgoing Home collapse follows the Hub-ready receipt; it is still part of
  // the same native motion, not a claim that Home remains the logical route.
  expect(runtime.nativeFeedback({ id: 4, kind: 'home-exit', durationSeconds: 0.43 })).toBe(true);
  expect(runtime.nativeFeedback({ id: 5, kind: 'hub-ambience' })).toBe(true);
  expect(runtime.nativeFeedback({ id: 6, kind: 'back' })).toBe(true);
  expect(runtime.nativeFeedback({ id: 7, kind: 'hub-exit' })).toBe(true);
  expect(runtime.nativeFeedback({ id: 6, kind: 'back' })).toBe(false);
  expect(f.feedbacks[0].homeMotion).toHaveBeenCalledWith(4, 'exit', 0.43);
  expect(f.feedbacks[0].hubAmbience).toHaveBeenCalledWith(5);
  expect(f.feedbacks[0].pressBack).toHaveBeenCalledWith(6);
  expect(f.feedbacks[0].hubExit).toHaveBeenCalledWith(7);
  runtime.dispose();
});

test('web source relinquishes before canonical preparation and later stop cannot stop web voices', async () => {
  const f = fixture();
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  await runtime.request({ id: 1, destination: { kind: 'home' } });
  const old = f.feedbacks[0];
  (f.owners.appZone.showHomepageShell as jest.Mock).mockImplementationOnce(async () => {
    expect(old.releaseToWeb).toHaveBeenCalledTimes(1);
    f.owners.appZone.markHomeMenu('canonical-source');
  });
  await runtime.request({ id: 2, destination: { kind: 'web-home', action: 'settings' } });
  expect(runtime.nativeFeedback({ id: 1, kind: 'home-exit', durationSeconds: 0.43 })).toBe(false);
  expect(runtime.resumeFeedback()).toBe(false);
  runtime.suspendFeedback();
  expect(await runtime.activateSource(2)).toBe(true);
  expect(runtime.resumeFeedback()).toBe(false);
  runtime.dispose();
  expect(old.stop).not.toHaveBeenCalled();
});

test('suspend/cancel preserve only stable native admission; resume never plays and stale epochs stay silent', async () => {
  const f = fixture();
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  await runtime.request({ id: 1, destination: { kind: 'home' } });
  runtime.suspendFeedback(); runtime.cancel();
  expect(f.feedbacks[0].stop).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  expect(runtime.resumeFeedback()).toBe(false);
  expect(runtime.nativeFeedback({ id: 1, kind: 'back' })).toBe(false);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  expect(runtime.resumeFeedback()).toBe(true);
  expect(f.feedbacks).toHaveLength(2);
  expect(f.feedbacks[1].homeMotion).not.toHaveBeenCalled();
  expect(runtime.nativeFeedback({ id: 1, kind: 'back' })).toBe(false);
  expect(runtime.nativeFeedback({ id: 2, kind: 'back' })).toBe(true);
  f.owners.appZone.markJourneyMenu('foreign');
  expect(runtime.nativeFeedback({ id: 3, kind: 'back' })).toBe(false);
  expect(runtime.resumeFeedback()).toBe(false);
  runtime.dispose();
  expect(f.feedbacks[1].stop).toHaveBeenCalledTimes(1);
  expect(runtime.resumeFeedback()).toBe(false);
});

test('cancelled quiesce cannot allocate a feedback lease after newer native admission', async () => {
  const f = fixture();
  const cleanup = deferred<void>();
  (f.owners.ui.hideHomepage as jest.Mock).mockReturnValueOnce(cleanup.promise);
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  const cancelled = runtime.request({ id: 1, destination: { kind: 'home' } });
  runtime.cancel();
  await runtime.request({ id: 2, destination: { kind: 'hub' } });
  const current = f.feedbacks[0];
  cleanup.resolve();
  expect(await cancelled).toMatchObject({ kind: 'error' });
  for (let index = 0; index < 5; index++) await Promise.resolve();
  expect(f.feedbacks).toHaveLength(1);
  expect(current.stop).not.toHaveBeenCalled();
  expect(runtime.nativeFeedback({ id: 1, kind: 'hub-ambience' })).toBe(true);
  runtime.dispose();
});
