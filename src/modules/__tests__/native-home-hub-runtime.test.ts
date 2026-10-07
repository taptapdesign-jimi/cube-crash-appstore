import { beginJourneyReturnTransition, cancelJourneyReturnTransition, completeJourneyReturnTransition, getJourneyReturnTransitionToken, markJourneyReturnResultExitComplete, scheduleJourneyReturnReveal, transferJourneyReturnStaticCover } from '../journey-return-transition-trace';
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
  return { host, owners, load, postMessage, feedbacks, changeZone: (next: string) => { zone = next; epoch++; } };
}
afterEach(() => { document.body.replaceChildren(); });

async function parkedNativeReturnFixture(worldID:1|2|3=1) {
  const f=fixture();f.host.__jimiNativeForestEnabled=true;f.host.__jimiNativeWorldsEnabled=true;
  const boardID=(worldID-1)*10+1;
  const unit={id:`board-${boardID}`,boardID,frame:{x:0,y:0,width:90,height:133},islandArt:'original.png',locked:false,interim:true,completed:false,stars:0,number:'01',allowedActions:['continue'],stats:[{label:'High score',value:'100'}],parts:[]};
  f.owners.journey.prepareNativeForest=jest.fn(()=>true);
  f.owners.journey.readNativeForestSnapshot=jest.fn((requestID,routeGeneration,stateRevision)=>({version:1,requestID,routeGeneration,stateRevision,worldID,title:'World',contentHeight:1500,mainArt:'main.png',mainFrame:{x:0,y:0,width:390,height:300},mainParts:[],units:[unit],viewport:{width:390,height:844},cardBackArt:'back.png'}));
  f.owners.journey.launchNativeForestBoard=jest.fn(async()=>true);
  const runtime=(await installNativeHomeHubRuntime(f.host,f.load))!;
  const ready=await runtime.request({id:1,destination:{kind:'world',worldId:worldID}});if(ready.kind!=='ready')throw new Error('missing ready');
  await runtime.activateWorld(1);const identity=ready.worldSnapshot!;runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision);
  const admission=await runtime.requestNativeWorldAction({id:1,worldID,action:'continue',boardID,routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision});
  await runtime.commitNativeWorldLaunch(admission.launchToken!);
  f.owners.appZone.markJourneyMenu('terminal-return');
  const token=beginJourneyReturnTransition('clean-board',boardID);
  return {...f,runtime,identity,token,unit};
}

test.each([1,2,3] as const)('actual terminal cover for native World%i releases only after prepared ACK, without recovery timeout',async(worldID)=>{
  jest.useFakeTimers();const f=await parkedNativeReturnFixture(worldID);
  const cover=document.createElement('div');document.body.appendChild(cover);
  expect(transferJourneyReturnStaticCover(f.token,cover,140)).toBe(true);
  const reveal=jest.fn(()=>{void f.runtime.returnNativeForest();});
  scheduleJourneyReturnReveal(f.token,()=>true,reveal);
  expect(f.runtime.prepareNativeWorldReturn(f.token)).toBe(true);
  expect(f.runtime.prepareNativeWorldReturn(f.token)).toBe(true);
  const events=f.postMessage.mock.calls.map(([event])=>event);
  expect(events.filter(event=>event.kind==='prepare-world-return')).toHaveLength(1);
  expect(reveal).not.toHaveBeenCalled();expect(cover.isConnected).toBe(true);
  const prepared=events.find(event=>event.kind==='prepare-world-return')!.worldSnapshot;
  expect(prepared.worldID).toBe(worldID);
  expect(f.runtime.ackNativeWorldReturnPrepared(f.token,prepared.routeGeneration,prepared.stateRevision,worldID)).toBe(true);
  expect(f.runtime.ackNativeWorldReturnPrepared(f.token,prepared.routeGeneration,prepared.stateRevision,worldID)).toBe(false);
  expect(reveal).not.toHaveBeenCalled();await Promise.resolve();
  jest.advanceTimersByTime(200);await Promise.resolve();
  expect(cover.isConnected).toBe(false);expect(reveal).toHaveBeenCalledTimes(1);
  expect(f.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({kind:'enter-world',worldSnapshot:expect.objectContaining({worldID})}));
  expect(f.runtime.hasNativeWorldPresentationReady()).toBe(false);
  f.runtime.dispose();cancelJourneyReturnTransition(null,'test');jest.useRealTimers();
});

test.each(['stats','background','epoch','replacement','dispose'] as const)('native return preparation rejects %s callbacks without releasing real cover',async(mode)=>{
  const f=await parkedNativeReturnFixture();expect(f.runtime.prepareNativeWorldReturn(f.token)).toBe(true);
  const event=f.postMessage.mock.calls.map(([event])=>event).find(event=>event.kind==='prepare-world-return')!,snapshot=event.worldSnapshot;
  expect(f.runtime.ackNativeWorldReturnPrepared(f.token,snapshot.routeGeneration,snapshot.stateRevision,2)).toBe(false);
  if(mode==='stats')f.unit.stats[0].value='200';
  else if(mode==='background'){Object.defineProperty(document,'hidden',{configurable:true,value:true});f.runtime.suspendFeedback();}
  else if(mode==='epoch')f.owners.appZone.markJourneyMenu('replace-epoch');
  else if(mode==='replacement')beginJourneyReturnTransition('clean-board',2);
  else f.runtime.dispose();
  expect(f.runtime.ackNativeWorldReturnPrepared(f.token,snapshot.routeGeneration,snapshot.stateRevision,1)).toBe(false);
  expect(f.runtime.hasNativeWorldPresentationReady()).toBe(false);
  f.runtime.dispose();cancelJourneyReturnTransition(null,'test');
});

test('native Home readiness survives parked DOM but rejects another slide, epoch and disposal', async () => {
  const f = fixture();
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  expect(runtime.isHomePresentationCurrent(0)).toBe(false);
  await runtime.present('home');
  document.getElementById('home')!.hidden = true;
  expect(runtime.isHomePresentationCurrent(0)).toBe(true);
  expect(runtime.isHomePresentationCurrent(1)).toBe(false);
  f.owners.appZone.markHomeMenu('replacement');
  expect(runtime.isHomePresentationCurrent(0)).toBe(false);
  runtime.dispose();
  expect(runtime.isHomePresentationCurrent(0)).toBe(false);
});

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

test.each(['arcade', 'settings'] as const)('completed native %s exit transfers once through its exact source receipt', async action => {
  const f = fixture();
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  await runtime.request({ id: 1, destination: { kind: 'web-home', action } });
  expect(await runtime.activateSource(2, true)).toBe(false);
  expect(f.owners.ui.activateNativeHomepageAction).not.toHaveBeenCalled();
  expect(await runtime.activateSource(1, true)).toBe(true);
  expect(f.owners.ui.activateNativeHomepageAction).toHaveBeenCalledWith(action, true);
  expect(await runtime.activateSource(1, true)).toBe(false);
  expect(f.owners.ui.activateNativeHomepageAction).toHaveBeenCalledTimes(1);
  runtime.dispose();
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
  expect(await runtime.activateSource(3, true)).toBe(true);
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

test.each([1,2,3] as const)('opted native World %i uses logical owner and validates launch before canonical entry and result return', async(worldID)=>{
  const boardID=(worldID-1)*10+1;
  const f=fixture(); f.host.__jimiNativeForestEnabled=true;f.host.__jimiNativeWorldsEnabled=true;
  const unit={id:`board-${boardID}`,boardID,frame:{x:0,y:0,width:90,height:133},islandArt:'original.png',locked:false,interim:true,completed:false,stars:0,number:'01',allowedActions:['continue'],stats:[],parts:[]};
  f.owners.journey.prepareNativeForest=jest.fn(()=>true);
  f.owners.journey.retireNativeForest=jest.fn();
  f.owners.journey.readNativeForestSnapshot=jest.fn((requestID,routeGeneration,stateRevision)=>({version:1,requestID,routeGeneration,stateRevision,worldID,title:'Forest',contentHeight:1500,mainArt:'main.png',mainFrame:{x:0,y:0,width:390,height:300},mainParts:[],units:[unit],viewport:{width:390,height:844},cardBackArt:'back.png'}));
  f.owners.journey.launchNativeForestBoard=jest.fn(async()=>true);
  f.owners.journey.prepareNativeWorld=jest.fn(async()=>true);
  f.owners.journey.activatePreparedNativeWorld=jest.fn(async()=>true);
  const runtime=(await installNativeHomeHubRuntime(f.host,f.load))!;
  const ready=await runtime.request({id:1,destination:{kind:'world',worldId:worldID}});
  expect(ready.kind).toBe('ready');
  if(ready.kind!=='ready') throw new Error('missing ready');
  expect(ready.worldSnapshot?.worldID).toBe(worldID);
  expect(f.owners.journey.prepareNativeWorld).not.toHaveBeenCalled();
  expect(await runtime.activateWorld(1)).toBe(true);
  const identity=ready.worldSnapshot!;
  expect(runtime.hasNativeWorldPresentationReady()).toBe(false);
  expect(runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision)).toBe(true);
  f.owners.journey.readNextNativeForestBeePlans=jest.fn(()=>[]);
  expect(runtime.requestNativeForestBeePlans(identity.routeGeneration+1,identity.stateRevision)).toBeNull();
  expect(runtime.requestNativeForestBeePlans(identity.routeGeneration,identity.stateRevision)).toEqual(worldID===1?[]:null);
  expect(f.owners.journey.readNextNativeForestBeePlans).toHaveBeenCalledTimes(worldID===1?1:0);
  f.owners.journey.readNextNativeWorldAmbientPlans=jest.fn(()=>[]);
  const viewport={top:0,bottom:844};
  expect(runtime.requestNativeWorldAmbientPlans(identity.routeGeneration,identity.stateRevision,viewport,[0])).toEqual(worldID===1?null:[]);
  expect(runtime.requestNativeWorldAmbientPlans(identity.routeGeneration,identity.stateRevision,{top:0,bottom:Infinity},[0])).toBeNull();
  expect(runtime.requestNativeWorldAmbientPlans(identity.routeGeneration,identity.stateRevision,viewport,[0,0])).toBeNull();
  expect(runtime.requestNativeWorldAmbientPlans(identity.routeGeneration,identity.stateRevision,viewport,[8])).toBeNull();
  Object.defineProperty(f.host.document,'hidden',{configurable:true,value:true});
  expect(runtime.requestNativeForestBeePlans(identity.routeGeneration,identity.stateRevision)).toBeNull();
  Object.defineProperty(f.host.document,'hidden',{configurable:true,value:false});
  expect(runtime.requestNativeWorldAmbientPlans(identity.routeGeneration+1,identity.stateRevision,viewport,[0])).toBeNull();
  const request={id:1,worldID,action:'continue',boardID,routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision};
  const admitted=await runtime.requestNativeWorldAction(request);
  expect(admitted.accepted).toBe(true);
  expect(f.owners.journey.launchNativeForestBoard).not.toHaveBeenCalled();
  expect((await runtime.requestNativeWorldAction(request)).accepted).toBe(false);
  expect(await runtime.commitNativeWorldLaunch(admitted.launchToken!)).toBe(true);
  expect(runtime.requestNativeWorldAmbientPlans(identity.routeGeneration,identity.stateRevision,viewport,[0])).toBeNull();
  expect(runtime.requestNativeForestBeePlans(identity.routeGeneration,identity.stateRevision)).toBeNull();
  expect(f.owners.journey.readNextNativeForestBeePlans).toHaveBeenCalledTimes(worldID===1?1:0);
  expect(f.owners.journey.launchNativeForestBoard).toHaveBeenCalledTimes(1);
  expect(await runtime.commitNativeWorldLaunch(admitted.launchToken!)).toBe(false);
  expect(await runtime.returnNativeForest()).toBe(true);
  expect(f.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({kind:'enter-world'}));
  runtime.dispose(); runtime.dispose();
  expect(runtime.isNativeWorldPresentationCurrent(identity.routeGeneration,identity.stateRevision)).toBe(false);
});

test.each(['ack','background','dispose','stale'] as const)('native transition presentation %s controls original entry before launch completion',async(mode)=>{
  const f=fixture();f.host.__jimiNativeForestEnabled=true;
  const unit={id:'board-1',boardID:1,frame:{x:0,y:0,width:90,height:133},islandArt:'original.png',locked:false,interim:true,completed:false,stars:0,number:'01',allowedActions:['continue'],stats:[],parts:[]};
  f.owners.journey.prepareNativeForest=jest.fn(()=>true);
  f.owners.journey.readNativeForestSnapshot=jest.fn((requestID,routeGeneration,stateRevision)=>({version:1,requestID,routeGeneration,stateRevision,worldID:1,title:'Forest',contentHeight:1500,mainArt:'main.png',mainFrame:{x:0,y:0,width:390,height:300},mainParts:[],units:[unit],viewport:{width:390,height:844},cardBackArt:'back.png'}));
  const startGame=jest.fn();
  f.owners.journey.launchNativeForestBoard=jest.fn(async(_id,_action,ready)=>{
    if(!await ready!())return false;startGame();return true;
  });
  const runtime=(await installNativeHomeHubRuntime(f.host,f.load))!;
  const ready=await runtime.request({id:1,destination:{kind:'world',worldId:1}});if(ready.kind!=='ready')throw new Error('missing ready');
  await runtime.activateWorld(1);const identity=ready.worldSnapshot!;
  runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision);
  const admission=await runtime.requestNativeWorldAction({id:1,worldID:1,action:'continue',boardID:1,routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision});
  let settled=false;const commit=runtime.commitNativeWorldLaunch(admission.launchToken!).then(result=>{settled=true;return result;});
  await Promise.resolve();
  expect(f.postMessage).toHaveBeenLastCalledWith({kind:'gameplay-presentation-ready',launchToken:admission.launchToken,routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision});
  expect(settled).toBe(false);expect(startGame).not.toHaveBeenCalled();
  expect(runtime.ackNativeWorldTransitionPresentation('foreign-token')).toBe(false);
  if(mode==='background') {Object.defineProperty(document,'hidden',{configurable:true,value:true});runtime.suspendFeedback();}
  else if(mode==='dispose')runtime.dispose();
  else if(mode==='stale') {f.owners.appZone.markHomeMenu('stale-test');expect(runtime.ackNativeWorldTransitionPresentation(admission.launchToken!)).toBe(false);}
  else expect(runtime.ackNativeWorldTransitionPresentation(admission.launchToken!)).toBe(true);
  expect(await commit).toBe(mode==='ack');expect(startGame).toHaveBeenCalledTimes(mode==='ack'?1:0);
  expect(runtime.ackNativeWorldTransitionPresentation(admission.launchToken!)).toBe(false);
  runtime.dispose();
});

test('accepted native Back omits unchanged payload and clears admission while stale Back refreshes canonical state',async()=>{
  const f=fixture();f.host.__jimiNativeForestEnabled=true;
  const unit={id:'board-1',boardID:1,frame:{x:0,y:0,width:90,height:133},islandArt:'original.png',locked:false,interim:false,completed:true,stars:1,number:'01',allowedActions:['openCard','play'],stats:[{label:'High Score',value:'700'}],parts:[]};
  f.owners.journey.prepareNativeForest=jest.fn(()=>true);
  f.owners.journey.readNativeForestSnapshot=jest.fn((requestID,routeGeneration,stateRevision)=>({version:1,requestID,routeGeneration,stateRevision,worldID:1,title:'Forest',contentHeight:1500,mainArt:'main.png',mainFrame:{x:0,y:0,width:390,height:300},mainParts:[],units:[unit],viewport:{width:390,height:844},cardBackArt:'back.png'}));
  f.owners.journey.launchNativeForestBoard=jest.fn(async()=>true);
  const runtime=(await installNativeHomeHubRuntime(f.host,f.load))!;
  const ready=await runtime.request({id:1,destination:{kind:'world',worldId:1}});if(ready.kind!=='ready')throw new Error('missing ready');
  await runtime.activateWorld(1);const identity=ready.worldSnapshot!;
  runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision);
  const action=(id:number,name:string)=>({id,worldID:1,action:name,boardID:1,routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision});
  await runtime.requestNativeWorldAction(action(1,'openCard'));
  const launch=await runtime.requestNativeWorldAction(action(2,'play'));
  expect(launch.launchToken).toBeDefined();
  expect(await runtime.requestNativeWorldAction(action(3,'back'))).toEqual({accepted:true});
  expect(await runtime.commitNativeWorldLaunch(launch.launchToken!)).toBe(false);
  expect((await runtime.requestNativeWorldAction(action(4,'openCard'))).accepted).toBe(true);
  unit.stats[0].value='900';
  const stale=await runtime.requestNativeWorldAction(action(5,'back'));
  expect(stale).toMatchObject({accepted:false,code:'stale-request'});
  expect(stale.snapshot!.units[0].stats[0].value).toBe('900');
  expect(stale.snapshot!.stateRevision).toBeGreaterThan(identity.stateRevision);
  expect(f.owners.journey.launchNativeForestBoard).not.toHaveBeenCalled();
  runtime.dispose();
});

test('native regular card, launch cancellation, foreign epoch recovery and feedback receipts fail closed', async()=>{
  const f=fixture();f.host.__jimiNativeForestEnabled=true;
  const unit={id:'board-1',boardID:1,frame:{x:0,y:0,width:90,height:133},islandArt:'original.png',locked:false,interim:false,completed:true,stars:3,number:'01',allowedActions:['openCard','play'],stats:[],parts:[]};
  f.owners.journey.prepareNativeForest=jest.fn(()=>true);f.owners.journey.retireNativeForest=jest.fn();
  f.owners.journey.readNativeForestSnapshot=jest.fn((requestID,routeGeneration,stateRevision)=>({version:1,requestID,routeGeneration,stateRevision,worldID:1,title:'Forest',contentHeight:1500,mainArt:'main.png',mainFrame:{x:0,y:0,width:390,height:300},mainParts:[],units:[unit],viewport:{width:390,height:844},cardBackArt:'back.png'}));
  f.owners.journey.launchNativeForestBoard=jest.fn(async()=>true);
  const play=jest.fn(()=>true),stop=jest.fn();f.owners.createWorldFeedback=jest.fn(()=>({play,stop,releaseToWeb:jest.fn()}));
  const runtime=(await installNativeHomeHubRuntime(f.host,f.load))!;
  const ready=await runtime.request({id:1,destination:{kind:'world',worldId:1}});if(ready.kind!=='ready')throw new Error('missing ready');
  const identity=ready.worldSnapshot!;await runtime.activateWorld(1);
  const action=(id:number,name:string)=>({id,worldID:1,action:name,boardID:1,routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision});
  expect((await runtime.requestNativeWorldAction(action(1,'openCard'))).accepted).toBe(false);
  runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision);
  expect((await runtime.requestNativeWorldAction(action(2,'play'))).accepted).toBe(false);
  expect((await runtime.requestNativeWorldAction(action(3,'openCard'))).accepted).toBe(true);
  expect((await runtime.requestNativeWorldAction(action(4,'openCard'))).accepted).toBe(false);
  const launch=await runtime.requestNativeWorldAction(action(5,'play'));expect(launch.launchToken).toBeDefined();
  expect((await runtime.requestNativeWorldAction(action(6,'close'))).accepted).toBe(true);
  expect(await runtime.commitNativeWorldLaunch(launch.launchToken!)).toBe(false);
  const cue={id:1,worldID:1,kind:'card-manual-flip',boardID:1,routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision};
  expect(runtime.nativeWorldFeedback(cue)).toBe(true);expect(runtime.nativeWorldFeedback(cue)).toBe(false);
  Object.defineProperty(document,'hidden',{configurable:true,value:true});expect(runtime.nativeWorldFeedback({...cue,id:2})).toBe(false);
  Object.defineProperty(document,'hidden',{configurable:true,value:false});expect(runtime.nativeWorldFeedback({...cue,id:2})).toBe(false);
  const lateLaunch=deferred<boolean>();f.owners.journey.launchNativeForestBoard=jest.fn(()=>lateLaunch.promise);
  expect((await runtime.requestNativeWorldAction(action(7,'openCard'))).accepted).toBe(true);
  const lateAdmission=await runtime.requestNativeWorldAction(action(8,'play'));
  const inFlight=runtime.commitNativeWorldLaunch(lateAdmission.launchToken!);
  f.owners.appZone.markJourneyMenu('foreign-current-journey');lateLaunch.resolve(false);
  expect(await inFlight).toBe(false);expect(f.owners.createWorldFeedback).toHaveBeenCalledTimes(1);
  expect(runtime.recoverWorld(1)).toBe(false);expect(runtime.recoverNativeWorldLaunch()).toBeNull();
  expect(runtime.nativeWorldFeedback({...cue,id:3})).toBe(false);expect(play).toHaveBeenCalledTimes(1);runtime.dispose();
});

test('cancelled native regular Play recovery retires modal admission and unconsumed launch', async()=>{
  const f=fixture();f.host.__jimiNativeForestEnabled=true;
  const unit={id:'board-1',boardID:1,frame:{x:0,y:0,width:90,height:133},islandArt:'original.png',locked:false,interim:false,completed:true,stars:3,number:'01',allowedActions:['openCard','play'],stats:[],parts:[]};
  f.owners.journey.prepareNativeForest=()=>true;
  f.owners.journey.readNativeForestSnapshot=(requestID,routeGeneration,stateRevision)=>({version:1,requestID,routeGeneration,stateRevision,worldID:1,title:'Forest',contentHeight:1500,mainArt:'main.png',mainFrame:{x:0,y:0,width:390,height:300},mainParts:[],units:[unit],viewport:{width:390,height:844},cardBackArt:'back.png'});
  f.owners.journey.launchNativeForestBoard=jest.fn(async()=>true);
  const runtime=(await installNativeHomeHubRuntime(f.host,f.load))!;
  const ready=await runtime.request({id:1,destination:{kind:'world',worldId:1}});if(ready.kind!=='ready')throw new Error('missing ready');
  const identity=ready.worldSnapshot!;await runtime.activateWorld(1);
  runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision);
  const action=(id:number,name:string)=>({id,worldID:1,action:name,boardID:1,routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision});
  expect((await runtime.requestNativeWorldAction(action(1,'openCard'))).accepted).toBe(true);
  const launch=await runtime.requestNativeWorldAction(action(2,'play'));expect(launch.launchToken).toBeDefined();
  const recovered=runtime.recoverNativeWorldLaunch();expect(recovered).not.toBeNull();
  expect(runtime.hasNativeWorldPresentationReady()).toBe(false);
  runtime.commitNativeWorldPresentation(recovered!.routeGeneration,recovered!.stateRevision);
  expect((await runtime.requestNativeWorldAction(action(3,'openCard'))).accepted).toBe(true);
  expect(await runtime.commitNativeWorldLaunch(launch.launchToken!)).toBe(false);
  expect(f.owners.journey.launchNativeForestBoard).not.toHaveBeenCalled();
  runtime.dispose();
});

test.each(([1,2,3] as const).flatMap(worldID=>(['fail','clean-board','exit-game'] as const).map(source=>({worldID,source}))))('native $worldID $source return waits for canonical visual exit and actual native enter receipt', async({worldID,source})=>{
  const boardID=(worldID-1)*10+1;
  const f=fixture();f.host.__jimiNativeForestEnabled=true;f.host.__jimiNativeWorldsEnabled=true;
  const unit={enterDelayOffset:undefined as number|undefined,id:`board-${boardID}`,boardID,frame:{x:0,y:0,width:90,height:133},islandArt:'original.png',locked:false,interim:true,completed:false,stars:0,number:'01',allowedActions:['continue'],stats:[],parts:[]};
  f.owners.journey.prepareNativeForest=()=>true;f.owners.journey.retireNativeForest=jest.fn();
  f.owners.journey.readNativeForestSnapshot=(requestID,routeGeneration,stateRevision)=>({version:1,requestID,routeGeneration,stateRevision,worldID,title:'Forest',contentHeight:1500,mainArt:'main.png',mainFrame:{x:0,y:0,width:390,height:300},mainParts:[],units:[unit],viewport:{width:390,height:844},cardBackArt:'back.png'});
  f.owners.journey.launchNativeForestBoard=jest.fn(async()=>true);
  f.owners.journey.completeNativeForestPresentation=()=>{const token=getJourneyReturnTransitionToken();if(token!==null)completeJourneyReturnTransition({destination:'native-forest'},token);};
  const runtime=(await installNativeHomeHubRuntime(f.host,f.load))!;
  const ready=await runtime.request({id:1,destination:{kind:'world',worldId:worldID}});if(ready.kind!=='ready')throw new Error('missing ready');
  const identity=ready.worldSnapshot!;await runtime.activateWorld(1);runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision);
  const admitted=await runtime.requestNativeWorldAction({id:1,worldID,action:'continue',boardID,routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision});
  await runtime.commitNativeWorldLaunch(admitted.launchToken!);
  unit.enterDelayOffset=0.24;
  const token=beginJourneyReturnTransition(source,boardID);
  const reveal=jest.fn(()=>{void runtime.returnNativeForest();});
  scheduleJourneyReturnReveal(token,()=>true,reveal);
  expect(reveal).not.toHaveBeenCalled();
  expect(f.postMessage.mock.calls.some(([event])=>event.kind==='enter-world')).toBe(false);
  markJourneyReturnResultExitComplete(token);await Promise.resolve();
  expect(reveal).toHaveBeenCalledTimes(1);
  expect(f.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({kind:'enter-world'}));
  expect(getJourneyReturnTransitionToken()).toBe(token);
  expect(runtime.hasNativeWorldPresentationReady()).toBe(false);
  expect(runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision+99)).toBe(false);
  expect(getJourneyReturnTransitionToken()).toBe(token);
  expect(runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision)).toBe(true);
  expect(getJourneyReturnTransitionToken()).toBeNull();
  expect(runtime.commitNativeWorldPresentation(identity.routeGeneration,identity.stateRevision)).toBe(false);
  unit.enterDelayOffset=undefined;
  const back={id:2,worldID,action:'back',routeGeneration:identity.routeGeneration,stateRevision:identity.stateRevision};
  expect((await runtime.requestNativeWorldAction(back)).accepted).toBe(true);
  unit.allowedActions=[];
  expect(await runtime.requestNativeWorldAction({...back,id:3})).toMatchObject({accepted:false,code:'stale-request'});
  runtime.dispose();
});

test('retained Hub refreshes canonical completion projection before ready reveals the destination',async()=>{
  const f=fixture();
  const states=Array.from({length:30},(_,index)=>({unlocked:false,interim:index===0}));
  f.owners.journey.getBoardById=jest.fn(id=>states[id-1]);
  const runtime=(await installNativeHomeHubRuntime(f.host,f.load))!;
  runtime.snapshot();
  expect(f.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({kind:'snapshot',snapshot:expect.objectContaining({worlds:expect.arrayContaining([expect.objectContaining({worldId:1,completed:0})])})}));
  // Canonical progression owner has completed the run and exposed the next
  // interim. The adapter reads that owner rather than modifying its state.
  states[0].unlocked=true;states[0].interim=false;states[1].interim=true;
  f.postMessage.mockClear();
  expect(await runtime.request({id:1,destination:{kind:'hub'}})).toMatchObject({kind:'ready',destination:{kind:'hub'}});
  expect(f.postMessage.mock.calls.map(([event])=>event.kind)).toEqual(['snapshot','ready']);
  expect(f.postMessage.mock.calls[0][0]).toMatchObject({snapshot:{worlds:expect.arrayContaining([expect.objectContaining({worldId:1,completed:1,hasInterimCard:true})])}});
  expect(states[0]).toEqual({unlocked:true,interim:false});
  runtime.dispose();
});


test('native Settings prepares its canonical epoch without web source activation', async () => {
  const f = fixture();
  const preferences = {gameSoundsEnabled: true, musicEnabled: false, hapticsEnabled: true};
  f.owners.settings = { read: () => preferences, apply: jest.fn(() => true),
    enter: jest.fn(async () => { f.changeZone('settings'); }), openDeveloperTools: jest.fn(async () => true) };
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  expect((await runtime.request({id: 1, destination: {kind: 'settings'}})).kind).toBe('ready');
  expect(f.owners.ui.activateNativeHomepageAction).not.toHaveBeenCalled();
  expect(f.owners.appZone.showHomepageShell).not.toHaveBeenCalled();
  const epoch = f.owners.appZone.getPresentationEpoch();
  expect(runtime.isNativeSettingsPresentationCurrent(epoch)).toBe(true);
  expect(runtime.setNativeSetting('musicEnabled', true, epoch)?.presentationEpoch).toBe(epoch);
  expect(f.owners.settings.apply).toHaveBeenCalledWith('musicEnabled', true);
  f.changeZone('home');
  expect(runtime.setNativeSetting('musicEnabled', false, epoch)).toBeNull();
  expect(f.owners.settings.apply).toHaveBeenCalledTimes(1);
});

test.each(['cancel', 'replacement', 'background', 'dispose'])('native Settings %s rejects late preparation and every stale write', async reason => {
  const f = fixture();
  let resolve!: () => void;
  f.owners.settings = { read: () => ({gameSoundsEnabled: false, musicEnabled: true, hapticsEnabled: true}),
    apply: jest.fn(() => true), openDeveloperTools: jest.fn(async () => true),
    enter: jest.fn(() => { f.changeZone('settings'); return new Promise<void>(done => { resolve = done; }); }) };
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  const pending = runtime.request({id: 1, destination: {kind: 'settings'}});
  await Promise.resolve();
  const epoch = f.owners.appZone.getPresentationEpoch();
  if (reason === 'cancel') runtime.cancel();
  if (reason === 'dispose') runtime.dispose();
  if (reason === 'replacement') f.changeZone('home');
  if (reason === 'background') Object.defineProperty(f.host.document, 'hidden', { configurable: true, value: true });
  resolve();
  expect((await pending).kind).toBe('error');
  expect(runtime.setNativeSetting('gameSoundsEnabled', true, epoch)).toBeNull();
  expect(f.owners.settings.apply).not.toHaveBeenCalled();
  Object.defineProperty(f.host.document, 'hidden', { configurable: true, value: false });
});

test('native Settings rejects malformed and foreign-epoch toggle commands', async () => {
  const f = fixture();
  f.owners.settings = { read: () => ({gameSoundsEnabled: false, musicEnabled: true, hapticsEnabled: true}),
    apply: jest.fn(() => true), openDeveloperTools: jest.fn(async () => true), enter: jest.fn(async () => { f.changeZone('settings'); }) };
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  await runtime.request({id: 1, destination: {kind: 'settings'}});
  const epoch = f.owners.appZone.getPresentationEpoch();
  expect(runtime.setNativeSetting('otherSaveKey', true, epoch)).toBeNull();
  expect(runtime.setNativeSetting('musicEnabled', 'true', epoch)).toBeNull();
  expect(runtime.setNativeSetting('musicEnabled', true, epoch+1)).toBeNull();
  expect(f.owners.settings.apply).not.toHaveBeenCalled();
});


test('native Arcade launches once after native exit without preparing any web Homepage', async () => {
  const f = fixture();
  f.owners.ui.activateNativeArcadeGameplay = jest.fn(async () => true);
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  expect((await runtime.request({id: 1, destination: {kind: 'arcade'}})).kind).toBe('ready');
  expect(f.owners.appZone.showHomepageShell).not.toHaveBeenCalled();
  expect(f.owners.ui.activateNativeArcadeGameplay).not.toHaveBeenCalled();
  expect(f.owners.ui.activateNativeHomepageAction).not.toHaveBeenCalled();
  expect(await runtime.activateNativeArcade(2)).toBe(false);
  expect(await runtime.activateNativeArcade(1)).toBe(true);
  expect(await runtime.activateNativeArcade(1)).toBe(false);
  expect(f.owners.ui.activateNativeArcadeGameplay).toHaveBeenCalledTimes(1);
});

test.each(['cancel', 'replacement', 'background', 'dispose'])('native Arcade %s cannot launch a retired gameplay request', async reason => {
  const f = fixture();
  f.owners.ui.activateNativeArcadeGameplay = jest.fn(async () => true);
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  await runtime.request({id: 1, destination: {kind: 'arcade'}});
  if (reason === 'cancel') runtime.cancel();
  if (reason === 'dispose') runtime.dispose();
  if (reason === 'replacement') f.changeZone('settings');
  if (reason === 'background') Object.defineProperty(f.host.document, 'hidden', {configurable: true, value: true});
  expect(await runtime.activateNativeArcade(1)).toBe(false);
  expect(f.owners.ui.activateNativeArcadeGameplay).not.toHaveBeenCalled();
  Object.defineProperty(f.host.document, 'hidden', {configurable: true, value: false});
});

test('explicit DEV escape returns to native Settings and cannot be resurrected after cancellation', async () => {
  const f = fixture();
  const button = document.createElement('button'); button.id = 'settings-dev-open-btn'; document.body.appendChild(button);
  f.owners.settings = {read: () => ({gameSoundsEnabled:false,musicEnabled:true,hapticsEnabled:true}), apply: jest.fn(() => true),
    enter: jest.fn(async () => { f.changeZone('settings'); }), openDeveloperTools: jest.fn(async () => { f.changeZone('settings'); return true; })};
  const runtime = (await installNativeHomeHubRuntime(f.host,f.load))!;
  await runtime.request({id:1,destination:{kind:'settings'}});
  const epoch = f.owners.appZone.getPresentationEpoch();
  expect(await runtime.openNativeSettingsDeveloperTools(epoch)).toBe(true);
  expect(runtime.isNativeSettingsDeveloperToolsActive()).toBe(true);
  expect(runtime.setNativeSetting('musicEnabled',false,epoch)).toBeNull();
  expect(await runtime.returnNativeSettingsFromDeveloperTools()).toBe(true);
  expect(f.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({kind:'present',route:'settings'}));
  expect(runtime.isNativeSettingsPresentationCurrent(f.owners.appZone.getPresentationEpoch())).toBe(true);
  await runtime.openNativeSettingsDeveloperTools(f.owners.appZone.getPresentationEpoch());
  runtime.cancel();
  expect(await runtime.returnNativeSettingsFromDeveloperTools()).toBe(false);
  runtime.dispose();
});

test('Settings retains the outgoing Home cue lease and admits exactly one authored Back event', async () => {
  const f = fixture();
  f.owners.settings = {read: () => ({gameSoundsEnabled:true,musicEnabled:true,hapticsEnabled:true}),apply:jest.fn(()=>true),
    enter:jest.fn(async()=>{f.changeZone('settings');}),openDeveloperTools:jest.fn(async()=>true)};
  const runtime = (await installNativeHomeHubRuntime(f.host,f.load))!;
  await runtime.request({id:1,destination:{kind:'home'}});
  const lease = f.feedbacks[0];
  expect(runtime.nativeFeedback({id:1,kind:'home-exit',durationSeconds:0.7})).toBe(true);
  await runtime.request({id:2,destination:{kind:'settings'}});
  expect(lease.stop).not.toHaveBeenCalled();
  expect(runtime.nativeFeedback({id:2,kind:'back'})).toBe(true);
  expect(runtime.nativeFeedback({id:2,kind:'back'})).toBe(false);
  expect(lease.pressBack).toHaveBeenCalledTimes(1);
  runtime.dispose();
});


test.each([1, 2, 3] as const)('World %i native X returns to Hub before incoming presentation commit', async worldID => {
  const f = fixture();
  f.host.__jimiNativeForestEnabled = true; f.host.__jimiNativeWorldsEnabled = true;
  f.owners.journey.prepareNativeForest = jest.fn(() => true);
  f.owners.journey.retireNativeForest = jest.fn();
  f.owners.journey.readNativeForestSnapshot = jest.fn((requestID, routeGeneration, stateRevision) => ({
    version: 1, requestID, routeGeneration, stateRevision, worldID, title: 'World', contentHeight: 1500,
    mainArt: 'main.png', mainFrame: { x: 0, y: 0, width: 390, height: 300 }, mainParts: [], units: [],
    viewport: { width: 390, height: 844 }, cardBackArt: 'back.png',
  }));
  const runtime = (await installNativeHomeHubRuntime(f.host, f.load))!;
  const ready = await runtime.request({ id: 1, destination: { kind: 'world', worldId: worldID } });
  if (ready.kind !== 'ready') throw new Error('missing ready');
  expect(await runtime.activateWorld(1)).toBe(true);
  const identity = ready.worldSnapshot!;
  expect(runtime.hasNativeWorldPresentationReady()).toBe(false);
  const back = { id: 1, worldID, action: 'back', routeGeneration: identity.routeGeneration, stateRevision: identity.stateRevision };
  expect(await runtime.requestNativeWorldAction(back)).toEqual({ accepted: true });
  expect((await runtime.requestNativeWorldAction(back)).accepted).toBe(false);
  const hub = await runtime.request({ id: 2, destination: { kind: 'hub' } });
  expect(hub.kind).toBe('ready');
  expect(f.owners.journey.retireNativeForest).toHaveBeenCalled();
  expect(runtime.commitNativeWorldPresentation(identity.routeGeneration, identity.stateRevision)).toBe(false);
  expect(runtime.hasNativeWorldPresentationReady()).toBe(false);
  runtime.dispose();
});
