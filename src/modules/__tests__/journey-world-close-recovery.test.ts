import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { JourneyStageController } from '../journey-stage-controller';
import {
  acquireForegroundResourceCriticalLease,
  getForegroundResourceCoordinatorSnapshot,
  resetForegroundResourceCoordinator,
} from '../foreground-resource-coordinator';

// Execute the real manager method with boundary dependencies replaced. Avoid
// booting the app singleton; failures are injected at its actual async seams.
const source = fs.readFileSync(path.resolve(__dirname, '../journey-boards-manager.ts'), 'utf8');
const method = source.slice(source.indexOf('  private closeJourneyV700World(): void {'), source.indexOf('  private markJourneyDevBoardRefresh('));
const js = ts.transpileModule(`class CloseProbe { ${method} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const noop = () => {};
let presentationEpoch = 1;
let currentZone = 'journey';
const routeCoordinator = {
  begin: jest.fn(() => ({})), claimTimeline: jest.fn(() => true),
  complete: jest.fn(() => true), interrupt: jest.fn(() => true),
  holdPresentationLeasesUntil: jest.fn(() => true),
};
const Probe = new Function(
  'stopJourneyForestAmbientSounds', 'getJourneyCardOverlayReturnBoardId',
  'cancelJourneyCardOverlayReturn', 'emitIOSNativeDiagnostic',
  'startIOSJourneyWorldEnterAudit', 'areContinuousRuntimeDiagnosticsEnabled',
  'markIOSJourneyTransitionAudit', 'markIOSJourneyRouteAudit', 'areDetailedRuntimeDiagnosticsEnabled',
  'acquireForegroundResourceCriticalLease', 'journeyRouteTransitionCoordinator', 'appZoneManager', 'prepareJourneyViewportScreenEnter',
  `${js}; return CloseProbe;`,
)(noop, () => null, noop, noop, () => noop, () => false, noop, noop, () => false,
  acquireForegroundResourceCriticalLease, routeCoordinator, {
    getPresentationEpoch: () => presentationEpoch,
    isPresentationCurrent: (epoch, zone) => epoch === presentationEpoch && zone === currentZone,
  }, noop);

function fixture(worldId: number) {
  document.body.innerHTML = '<section id="journey-screen"><header class="collectibles-header"></header><div class="collectibles-scrollable"><div id="journey-boards-container"></div></div></section>';
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  presentationEpoch = 1; currentZone = 'journey';
  const container = document.getElementById('journey-boards-container') as HTMLElement & { __ccJourneyV700Closing?: boolean };
  const owner = new Probe();
  let complete: () => Promise<void> = async () => {};
  Object.assign(owner, {
    journeyV700View: 'world', journeyV700WorldId: worldId, journeyV700Phase: 'idle', renderDisposed: false,
    renderLifecycleGeneration: 0,
    journeyStageController: new JourneyStageController(),
    logJourneyV700Flow: jest.fn(), journeyWorldAnimation: { stop: jest.fn() },
    prepareJourneyHubPrepaint: jest.fn(async () => true),
    playJourneyV700NavExit: jest.fn(async () => {}),
    playJourneyV700WorldExit: jest.fn((_container, callback) => { complete = callback; }),
    waitForTrackedFrames: jest.fn(async () => true),
    commitJourneyHubPrepaint: jest.fn(async () => false),
    commitRetainedJourneyHub: jest.fn(() => false),
    waitForJourneyV700HubEnterCompletion: jest.fn(() => Promise.resolve()),
    cancelJourneyHubPrepaint: jest.fn(),
    setJourneyV700View: jest.fn((view) => { owner.journeyV700View = view; }),
    updateJourneyV700Nav: jest.fn(), renderBoards: jest.fn(), playJourneyV700NavEnter: jest.fn(),
    playJourneyV700WorldEnter: jest.fn(() => Promise.resolve()),
    trackTimeout: jest.fn(),
    resumeHubForVisibleEnter: jest.fn(() => { owner.renderDisposed = false; }),
    installJourneyScreenElasticOverscroll: jest.fn(), playJourneyV700HubEnter: jest.fn(),
  });
  return { owner, container, complete: () => complete() };
}

describe('World X failure ownership', () => {
  afterEach(() => {
    const snapshot = getForegroundResourceCoordinatorSnapshot();
    resetForegroundResourceCoordinator();
    document.body.innerHTML = '';
    delete (window as any).__jimiNativeHomeHubRuntime;
    jest.clearAllMocks();
    expect(snapshot.criticalDepth).toBe(0);
  });
  test.each([1, 2, 3])('World %i releases X and restores World on synchronous preparation failure', (world) => {
    const { owner, container } = fixture(world);
    owner.prepareJourneyHubPrepaint.mockImplementation(() => { throw new Error('prepare'); });
    expect(() => owner.closeJourneyV700World()).not.toThrow();
    expect(container.__ccJourneyV700Closing).toBe(false);
    expect(owner.journeyV700View).toBe('world');
    expect(owner.playJourneyV700WorldEnter).toHaveBeenCalledTimes(1);
    expect(owner.renderBoards).not.toHaveBeenCalled();
  });
  test.each(['prepareJourneyHubPrepaint', 'playJourneyV700NavExit', 'waitForTrackedFrames'])('handles rejected %s without leaving a closing lock', async (boundary) => {
    const { owner, container, complete } = fixture(1);
    owner[boundary].mockRejectedValue(new Error(boundary));
    owner.closeJourneyV700World();
    await complete();
    expect(container.__ccJourneyV700Closing).toBe(false);
    expect(owner.playJourneyV700WorldEnter).toHaveBeenCalledTimes(1);
    expect(owner.renderBoards).not.toHaveBeenCalled();
    expect(owner.commitJourneyHubPrepaint).not.toHaveBeenCalled();
  });
  test('a retired World cannot commit over its replacement', async () => {
    const { owner, container, complete } = fixture(1);
    owner.closeJourneyV700World();
    owner.journeyV700WorldId = 2;
    await complete();
    expect(owner.commitJourneyHubPrepaint).not.toHaveBeenCalled();
    expect(owner.renderBoards).not.toHaveBeenCalled();
    expect(container.__ccJourneyV700Closing).toBe(false);
  });
  test('normal and duplicate completion produce one handoff', async () => {
    const { owner, container, complete } = fixture(1);
    owner.closeJourneyV700World();
    await complete();
    await complete();
    expect(owner.commitJourneyHubPrepaint).toHaveBeenCalledTimes(1);
    expect(owner.playJourneyV700WorldEnter).toHaveBeenCalledTimes(1);
    expect(owner.renderBoards).not.toHaveBeenCalled();
    expect(container.__ccJourneyV700Closing).toBe(false);
  });
  test('a rerender of the same World invalidates its earlier close', async () => {
    const { owner, complete } = fixture(1);
    owner.closeJourneyV700World();
    owner.renderLifecycleGeneration++;
    await complete();
    expect(owner.renderBoards).not.toHaveBeenCalled();
    expect(owner.commitJourneyHubPrepaint).not.toHaveBeenCalled();
  });
  test('an old completion cannot release a newer close token', async () => {
    const { owner, container, complete } = fixture(1);
    owner.closeJourneyV700World();
    (container as any).__ccJourneyV700CloseToken = Symbol('new-close');
    await complete();
    expect(container.__ccJourneyV700Closing).toBe(true);
    expect(owner.renderBoards).not.toHaveBeenCalled();
  });
  test('pressure in the last zero-pose frame prepares a cold Hub before handoff', async () => {
    const { owner, container, complete } = fixture(1);
    const hub = document.createElement('div');
    owner.journeyStageController.retainNodes({ view: 'hub' }, [hub], container);
    owner.waitForTrackedFrames.mockImplementation(async () => {
      owner.journeyStageController.clearRetained();
      return true;
    });
    owner.commitJourneyHubPrepaint.mockResolvedValue(true);

    owner.closeJourneyV700World();
    expect(owner.prepareJourneyHubPrepaint).not.toHaveBeenCalled();
    await complete();

    expect(owner.prepareJourneyHubPrepaint).toHaveBeenCalledTimes(1);
    expect(owner.commitJourneyHubPrepaint).toHaveBeenCalledTimes(1);
    expect(owner.renderBoards).not.toHaveBeenCalled();
    expect(container.__ccJourneyV700Closing).toBe(false);
  });

  test.each([1, 2, 3])('native World %i return completes old token before presentation and never plays web Hub/nav enter', async worldId => {
    const f = fixture(worldId);
    f.owner.commitJourneyHubPrepaint.mockImplementation(async (_container, _token, _world, options) => {
      expect(options).toEqual({ nativePresentation: true });
      f.owner.journeyV700View = 'hub'; f.container.dataset.journeyV700View = 'hub';
      f.container.innerHTML = '<div class="journey-v700-hub"></div>'; return true;
    });
    const present = jest.fn(async (id, epoch) => {
      expect(id).toBe(worldId); expect(epoch).toBe(presentationEpoch);
      expect(routeCoordinator.complete).toHaveBeenCalledTimes(1);
      expect(f.container.__ccJourneyV700Closing).toBe(false);
      return true;
    });
    (window as any).__jimiNativeHomeHubRuntime = { canPresentHubFromWorld: () => true, presentHubFromWorld: present };
    f.owner.closeJourneyV700World(); await f.complete(); await f.complete();
    expect(present).toHaveBeenCalledTimes(1);
    expect(f.owner.playJourneyV700HubEnter).not.toHaveBeenCalled();
    expect(f.owner.playJourneyV700NavEnter).not.toHaveBeenCalled();
    expect(f.owner.trackTimeout).not.toHaveBeenCalled();
    expect(routeCoordinator.interrupt).not.toHaveBeenCalled();
  });

  test('native handoff gates hidden Hub input throughout a deferred receiver and retains the gate after admission', async () => {
    const f = fixture(2); const screen = document.getElementById('journey-screen')!;
    let finish!: (value: boolean) => void;
    const pending = new Promise<boolean>(resolve => { finish = resolve; });
    f.owner.commitJourneyHubPrepaint.mockImplementation(async () => {
      f.owner.journeyV700View = 'hub'; f.container.dataset.journeyV700View = 'hub';
      f.container.innerHTML = '<div class="journey-v700-hub"><button>World</button></div>'; return true;
    });
    let received!: () => void;
    const receipt = new Promise<void>(resolve => { received = resolve; });
    (window as any).__jimiNativeHomeHubRuntime = {
      canPresentHubFromWorld: () => true,
      presentHubFromWorld: () => { expect(screen.inert).toBe(true); received(); return pending; },
    };
    f.owner.closeJourneyV700World(); const closing = f.complete();
    await receipt;
    expect(screen.inert).toBe(true);
    expect(f.owner.playJourneyV700HubEnter).not.toHaveBeenCalled();
    finish(true); await closing;
    expect(screen.inert).toBe(true);
    expect(f.owner.playJourneyV700NavEnter).not.toHaveBeenCalled();
  });

  test.each(['false-after-suspend', 'reject', 'foreign', 'background', 'root-replaced'] as const)('native presentation %s falls back only for the exact current Hub', async mode => {
    const f = fixture(2); const screen = document.getElementById('journey-screen')!;
    f.owner.commitJourneyHubPrepaint.mockImplementation(async () => {
      f.owner.journeyV700View = 'hub'; f.container.dataset.journeyV700View = 'hub';
      f.container.innerHTML = '<div class="journey-v700-hub"></div>'; return true;
    });
    (window as any).__jimiNativeHomeHubRuntime = {
      canPresentHubFromWorld: () => true,
      presentHubFromWorld: async () => {
        f.owner.renderDisposed = true; f.owner.renderLifecycleGeneration++;
        f.container.hidden = true; f.container.inert = true; screen.inert = true;
        screen.style.opacity = '0';
        if (mode === 'reject') throw new Error('native receiver');
        if (mode === 'foreign') { presentationEpoch++; currentZone = 'settings'; }
        if (mode === 'background') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        if (mode === 'root-replaced') f.container.querySelector('.journey-v700-hub')!.replaceWith(document.createElement('div'));
        return false;
      },
    };
    f.owner.closeJourneyV700World(); await f.complete();
    const recover = mode === 'false-after-suspend' || mode === 'reject';
    expect(f.owner.playJourneyV700HubEnter).toHaveBeenCalledTimes(recover ? 1 : 0);
    expect(f.owner.playJourneyV700NavEnter).toHaveBeenCalledTimes(recover ? 1 : 0);
    expect(f.owner.trackTimeout).not.toHaveBeenCalled();
    expect(f.container.__ccJourneyV700Closing).toBe(false);
    if (recover) {
      expect(screen.style.opacity).toBe('1'); expect(screen.inert).toBe(false);
      expect(f.container.hidden).toBe(false); expect(f.container.inert).toBe(false);
      expect(f.owner.resumeHubForVisibleEnter).toHaveBeenCalledTimes(1);
    }
  });
});
