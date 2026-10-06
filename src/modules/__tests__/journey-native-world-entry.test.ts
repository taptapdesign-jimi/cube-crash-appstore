import fs from 'node:fs';
import ts from 'typescript';
import { JourneyStageController } from '../journey-stage-controller';
import { JourneyRouteTransitionCoordinator } from '../journey-route-transition-coordinator';

// Execute the actual manager methods without booting the unrelated game
// singleton. The existing stage/coordinator and DOM commit remain real.
const source = ts.createSourceFile('manager.ts', fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const methods = new Map<string, ts.MethodDeclaration>();
function visit(node: ts.Node) { if (ts.isMethodDeclaration(node)) methods.set(node.name.getText(source), node); ts.forEachChild(node, visit); }
visit(source);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(hasHub = false) {
  document.body.innerHTML = `<section id="journey-screen" hidden><header class="collectibles-header"></header><div class="collectibles-scrollable"><div id="journey-boards-container" data-journey-v700-view="hub">${hasHub ? '<div class="journey-v700-hub"></div>' : ''}</div></div></section>`;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const screen = document.getElementById('journey-screen')!;
  const container = document.getElementById('journey-boards-container')!;
  let epoch = 1, zone = 'journey';
  const stops = { audio: jest.fn(), forest: jest.fn(), units: jest.fn() };
  const releases = [jest.fn(), jest.fn(), jest.fn()];
  const coordinator = new JourneyRouteTransitionCoordinator({
    acquireCriticalLease: () => releases[0], acquireAudioWorkingSet: () => releases[1],
    acquirePresentationLease: () => releases[2], publishAppZone: next => { zone = next; epoch++; },
  });
  const enter = deferred<void>();
  const owner: any = {
    nativeWorldPreparation: null, renderLifecycleGeneration: 1, renderDisposed: true,
    journeyStageController: new JourneyStageController(), journeyV700View: 'hub', journeyV700Phase: 'hidden',
    journeyWorldRuntime: { deactivate: jest.fn() }, journeyHubRuntime: { deactivate: jest.fn() },
    journeyWorldAnimation: { stop: jest.fn() },
    beginRenderLifecycle: jest.fn(function(this: any) { this.renderDisposed = false; return ++this.renderLifecycleGeneration; }),
    cancelJourneyV700HubEnter: jest.fn(), cancelJourneyWorldPrepaint: jest.fn(function(this: any) { this.journeyWorldPrepaintStage = null; }),
    updateJourneyV700Nav: jest.fn(), installJourneyScreenElasticOverscroll: jest.fn(), cleanupJourneyScreenElasticOverscroll: jest.fn(),
    cleanupJourneyAreaIdleAnimations: jest.fn(), cancelAllRAFs: jest.fn(), cancelAllTimeouts: jest.fn(),
    releaseJourneyMainCloudComposites: jest.fn(), retireJourneyBoardOwnersBeforeDomReplace: jest.fn(),
    trackTimeout: jest.fn(), trackRAF: jest.fn(), setupIdleInteractionListeners: jest.fn(),
    getJourneyV700NavTargets: () => [screen.querySelector('header')],
    setJourneyV700View: jest.fn(function(this: any, view: string, id: number) { this.journeyV700View = view; this.journeyV700WorldId = id; }),
    playJourneyV700NavEnter: jest.fn(),
    playJourneyV700WorldEnter: jest.fn(function(this: any) { this.journeyV700Phase = 'entering'; return enter.promise; }),
    playJourneyV700HubEnter: jest.fn(), renderBoards: jest.fn(),
  };
  const prepareGate = deferred<boolean>();
  let gatePreparation = false;
  owner.prepareJourneyWorldPrepaint = jest.fn(async (_container: HTMLElement, worldId: number) => {
    const host = document.createElement('div');
    const root = document.createElement('div');
    const art = document.createElement('img');
    art.style.opacity = '0'; root.append(art); host.append(root);
    owner.journeyWorldPrepaintStage = { worldId, host, root, ready: true,
      preparedEnter: { worldId, targets: [art], units: [{ id: 'main', targets: [art] }] } };
    return gatePreparation ? prepareGate.promise : true;
  });
  const scope = {
    appZoneManager: { getCurrentZone: () => zone, getPresentationEpoch: () => epoch,
      isPresentationCurrent: (candidate: number, expected: string) => candidate === epoch && zone === expected },
    journeyRouteTransitionCoordinator: coordinator,
    releaseJourneyViewportParking: jest.fn(), cancelJourneyHubScrollableEnter: jest.fn(),
    prepareJourneyViewportScreenEnter: jest.fn(() => { screen.hidden = false; screen.style.opacity = '0'; screen.style.visibility = 'hidden'; }),
    emitIOSNativeDiagnostic: jest.fn(), areDetailedRuntimeDiagnosticsEnabled: () => false,
    gsap: { killTweensOf: jest.fn() }, logger: { warn: jest.fn() },
    stopJourneyForestAmbientSounds: stops.forest, stopJourneyWorldsHubSound: stops.audio, stopJourneyUnitMotionSounds: stops.units,
    reduceJourneyWorldsSoundForWorld: jest.fn(), preloadJourneyForestAmbientSounds: jest.fn(),
  };
  for (const name of ['isNativeWorldPreparationCurrent', 'prepareNativeWorld', 'activatePreparedNativeWorld', 'cancelNativeWorldPreparation', 'commitJourneyWorldPrepaint']) {
    const method = methods.get(name)!;
    const asynchronous = method.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
    const code = ts.transpileModule(`${asynchronous}function run(${method.parameters.map(parameter => parameter.getText(source)).join(',')}) ${method.body!.getText(source)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    owner[name] = new Function('scope', `with(scope){${code}; return run;}`)(scope).bind(owner);
  }
  return { owner, screen, container, coordinator, scope, releases, stops,
    deferPrepare: () => { gatePreparation = true; return prepareGate; },
    foreign: () => { zone = 'settings'; epoch++; },
    completeEnter: () => { owner.journeyV700Phase = 'idle'; enter.resolve(); },
  };
}
afterEach(() => { document.body.replaceChildren(); jest.restoreAllMocks(); });

test.each([1, 2, 3] as const)('World %i prepares exact hidden nodes without building or animating a web Hub', async worldId => {
  const f = fixture();
  const signal = new AbortController().signal;
  expect(await f.owner.prepareNativeWorld(worldId, signal)).toBe(true);
  expect(f.owner.prepareJourneyWorldPrepaint).toHaveBeenCalledWith(f.container, worldId);
  expect(f.container.dataset.journeyV700WorldId).toBe(String(worldId));
  expect(f.container.querySelector('img')?.style.opacity).toBe('0');
  expect(f.screen.style.opacity).toBe('0'); expect(f.screen.inert).toBe(true);
  expect(f.owner.renderBoards).not.toHaveBeenCalled();
  expect(f.owner.playJourneyV700HubEnter).not.toHaveBeenCalled();
  expect(f.owner.playJourneyV700WorldEnter).not.toHaveBeenCalled();
  expect(f.owner.setJourneyV700View).not.toHaveBeenCalled();
  expect(f.scope.reduceJourneyWorldsSoundForWorld).not.toHaveBeenCalled();
  expect(f.scope.preloadJourneyForestAmbientSounds).not.toHaveBeenCalled();
  expect(f.owner.journeyStageController.hasRetained({ view: 'hub' })).toBe(false); // Never cache empty native Hub as web Hub.
  f.owner.cancelNativeWorldPreparation();
});

test.each([1, 2, 3] as const)('accepted World %i activation transfers the existing Hub audio once and warms only Forest', async worldId => {
  const f = fixture();
  await f.owner.prepareNativeWorld(worldId, new AbortController().signal);
  expect(await f.owner.activatePreparedNativeWorld(worldId === 1 ? 2 : 1)).toBe(false);
  expect(f.scope.reduceJourneyWorldsSoundForWorld).not.toHaveBeenCalled();
  const activating = f.owner.activatePreparedNativeWorld(worldId);
  expect(f.scope.reduceJourneyWorldsSoundForWorld).toHaveBeenCalledTimes(1);
  expect(f.scope.preloadJourneyForestAmbientSounds).toHaveBeenCalledTimes(worldId === 1 ? 1 : 0);
  expect(f.scope.reduceJourneyWorldsSoundForWorld.mock.invocationCallOrder[0])
    .toBeLessThan(f.owner.playJourneyV700WorldEnter.mock.invocationCallOrder[0]);
  expect(await f.owner.activatePreparedNativeWorld(worldId)).toBe(false);
  f.completeEnter(); expect(await activating).toBe(true);
  expect(await f.owner.activatePreparedNativeWorld(worldId)).toBe(false);
  expect(f.scope.reduceJourneyWorldsSoundForWorld).toHaveBeenCalledTimes(1);
  expect(f.scope.preloadJourneyForestAmbientSounds).toHaveBeenCalledTimes(worldId === 1 ? 1 : 0);
});

test('activation is exact, once-only and unlocks only the real completed canonical enter', async () => {
  const f = fixture(true);
  f.screen.inert = true; // Previous hidden-screen policy cannot strand the new World.
  await f.owner.prepareNativeWorld(2, new AbortController().signal);
  const art = f.container.firstElementChild;
  expect(await f.owner.activatePreparedNativeWorld(1)).toBe(false);
  const activating = f.owner.activatePreparedNativeWorld(2);
  expect(f.screen.style.opacity).toBe('1'); expect(f.screen.inert).toBe(true);
  expect(f.owner.playJourneyV700WorldEnter).toHaveBeenCalledWith(f.container, 2, { source: 'native-hub-world-open', lastBoardId: 0, waitForImages: false });
  expect(await f.owner.activatePreparedNativeWorld(2)).toBe(false);
  expect(f.container.firstElementChild).toBe(art);
  f.completeEnter();
  expect(await activating).toBe(true);
  expect(f.screen.inert).toBe(false);
  expect(f.screen.querySelector<HTMLElement>('.collectibles-scrollable')!.style.pointerEvents).toBe('auto');
  expect(f.owner.playJourneyV700NavEnter).toHaveBeenCalledTimes(1);
  expect(f.coordinator.getSnapshot().active).toBe(false);
  f.releases.forEach(release => expect(release).toHaveBeenCalledTimes(1));
  expect(await f.owner.activatePreparedNativeWorld(2)).toBe(false);
});

test('abort before readiness retires current hidden work and late completion cannot activate', async () => {
  const f = fixture(); const gate = f.deferPrepare(); const abort = new AbortController();
  const preparing = f.owner.prepareNativeWorld(2, abort.signal);
  abort.abort(); gate.resolve(true);
  expect(await preparing).toBe(false);
  expect(await f.owner.activatePreparedNativeWorld(2)).toBe(false);
  expect(f.screen.hidden).toBe(true);
  expect(f.owner.journeyWorldAnimation.stop).toHaveBeenCalledTimes(1);
  expect(f.coordinator.getSnapshot().active).toBe(false);
});

test('late cancelled A cannot hide or retire prepared B', async () => {
  const f = fixture(); const gate = f.deferPrepare(); const abort = new AbortController();
  const a = f.owner.prepareNativeWorld(1, abort.signal);
  f.owner.cancelNativeWorldPreparation();
  (f.owner.prepareJourneyWorldPrepaint as jest.Mock).mockImplementationOnce(async () => {
    const host = document.createElement('div'), root = document.createElement('div'), art = document.createElement('img'); root.append(art); host.append(root);
    f.owner.journeyWorldPrepaintStage = { worldId: 2, ready: true, host, root, preparedEnter: { worldId: 2, targets: [art], units: [] } }; return true;
  });
  expect(await f.owner.prepareNativeWorld(2, new AbortController().signal)).toBe(true);
  const b = f.owner.nativeWorldPreparation;
  abort.abort(); gate.resolve(true);
  expect(await a).toBe(false);
  expect(f.owner.nativeWorldPreparation).toBe(b);
  expect(f.container.dataset.journeyV700WorldId).toBe('2');
  expect(f.screen.hidden).toBe(false);
  f.owner.cancelNativeWorldPreparation();
});

test('foreign epoch cancellation never hides or stops the newer route and never republishes Journey', async () => {
  const f = fixture();
  await f.owner.prepareNativeWorld(3, new AbortController().signal);
  f.foreign(); f.screen.style.opacity = '0.8'; f.screen.hidden = false;
  f.owner.cancelNativeWorldPreparation();
  expect(f.scope.appZoneManager.getCurrentZone()).toBe('settings');
  expect(f.screen.style.opacity).toBe('0.8'); expect(f.screen.hidden).toBe(false);
  expect(f.owner.journeyWorldAnimation.stop).not.toHaveBeenCalled();
  expect(f.coordinator.getSnapshot().active).toBe(false);
});

test.each(['background', 'root-replaced', 'view-replaced'] as const)('%s before activation fails closed', async reason => {
  const f = fixture();
  await f.owner.prepareNativeWorld(2, new AbortController().signal);
  if (reason === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  else if (reason === 'root-replaced') f.container.replaceWith(Object.assign(document.createElement('div'), { id: 'journey-boards-container' }));
  else f.container.dataset.journeyV700WorldId = '3';
  expect(await f.owner.activatePreparedNativeWorld(2)).toBe(false);
  expect(f.owner.playJourneyV700WorldEnter).not.toHaveBeenCalled();
  expect(f.scope.reduceJourneyWorldsSoundForWorld).not.toHaveBeenCalled();
  expect(f.scope.preloadJourneyForestAmbientSounds).not.toHaveBeenCalled();
  f.owner.cancelNativeWorldPreparation();
});
