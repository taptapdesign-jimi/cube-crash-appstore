import fs from 'node:fs';
import ts from 'typescript';
import gsap from 'gsap';
const file = ts.createSourceFile('journey.ts', fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const methods = new Map<string, ts.MethodDeclaration>();
function visit(node: ts.Node) { if (ts.isMethodDeclaration(node)) methods.set(node.name.getText(file), node); ts.forEachChild(node, visit); }
visit(file);
function fixture(detailed = false) {
  document.body.innerHTML = '<div id="container"><div id="outgoing" class="journey-board-card-wrapper" data-journey-area-id="board-1"><i></i></div><div id="stage"><div id="prepared"><div class="journey-cards-container"><div class="journey-board-card-wrapper" data-journey-area-id="board-2"><span id="incoming" class="journey-area-idle-target journey-robo-alien-beam-art" style="opacity:0.8"></span></div><img></div></div></div></div>';
  const container = document.getElementById('container')!;
  const host = document.getElementById('stage')!;
  const root = document.getElementById('prepared')!;
  const incoming = document.getElementById('incoming')!;
  const outgoing = document.getElementById('outgoing')!;
  const owner: any = { journeyWorldPrepaintStage: { ready: true, worldId: 1, host, root },
    journeyAreaIdleTicker: () => {}, journeyAreaIdleEntries: [{}], journeyAreaIdleEntryByVisibilityTarget: new Map(),
    journeyAreaIdleVisibilityObserver: { disconnect: jest.fn() }, beginRenderLifecycle: jest.fn(), cancelJourneyV700HubEnter: jest.fn(),
    trackTimeout: jest.fn(), trackRAF: jest.fn(), primeJourneyV700WorldEnter: jest.fn() };
  const scope = { gsap, logger: { info() {}, warn() {} }, setJourneyAlienBeamIdleReady: jest.fn(), emitIOSNativeDiagnostic: jest.fn(), areDetailedRuntimeDiagnosticsEnabled: () => detailed };
  for (const name of ['isJourneyCardTapExitProtectedTarget', 'cleanupJourneyAreaIdleAnimations', 'retireJourneyBoardOwnersBeforeDomReplace', 'commitJourneyWorldPrepaint']) {
    const node = methods.get(name)!;
    const body = ts.transpileModule(`function run(${node.parameters.map(p => p.getText(file)).join(',')}) ${node.body!.getText(file)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    owner[name] = new Function('scope', `with(scope){${body};return run;}`)(scope).bind(owner);
  }
  jest.spyOn(owner, 'cleanupJourneyAreaIdleAnimations');
  return { container, host, root, incoming, outgoing, owner, scope };
}
afterEach(() => { gsap.globalTimeline.clear(); document.body.innerHTML = ''; jest.restoreAllMocks(); });

test('actual World commit retires outgoing GSAP owners once while preserving incoming nodes and their owners', () => {
  const f = fixture();
  const outgoingChild = f.outgoing.firstElementChild!;
  const oldTween = gsap.to([f.outgoing, outgoingChild], { opacity: 0, duration: 10, paused: true }).progress(0.2);
  const incomingTween = gsap.to([f.incoming, f.incoming.parentElement!], { opacity: 0, duration: 10, paused: true }).progress(0.2);
  const incomingWalk = jest.spyOn(f.root, 'querySelectorAll');
  expect(f.owner.commitJourneyWorldPrepaint(f.container, 1)).toBe(true);
  expect(gsap.getTweensOf(f.outgoing)).not.toContain(oldTween);
  expect(gsap.getTweensOf(outgoingChild)).not.toContain(oldTween);
  expect(gsap.getTweensOf(f.incoming)).toContain(incomingTween);
  expect(gsap.getTweensOf(f.incoming.parentElement!)).toContain(incomingTween);
  expect(f.owner.cleanupJourneyAreaIdleAnimations).toHaveBeenCalledTimes(1);
  expect(f.owner.cleanupJourneyAreaIdleAnimations).toHaveBeenCalledWith(false, f.host);
  expect(incomingWalk).not.toHaveBeenCalled();
  expect(f.scope.setJourneyAlienBeamIdleReady).not.toHaveBeenCalled();
  expect(f.owner.journeyAreaIdleTicker).toBeNull();
  expect(f.owner.journeyAreaIdleVisibilityObserver).toBeNull();
  expect(f.owner.journeyAreaIdleEntries).toEqual([]);
  expect(f.incoming.isConnected).toBe(true); expect(f.host.isConnected).toBe(false); expect(f.outgoing.isConnected).toBe(false);
  expect(f.owner.primeJourneyV700WorldEnter).toHaveBeenCalledWith(f.container, 1, { source: 'hub-world-prepaint-commit', lastBoardId: 0 });
  expect(f.owner.journeyWorldPrepaintStage).toBeNull();
});

test('ordinary full replacement still retires every child owner', () => {
  const f = fixture(); const tween = gsap.to(f.incoming, { opacity: 0, duration: 10, paused: true }).progress(0.2);
  f.owner.retireJourneyBoardOwnersBeforeDomReplace(f.container);
  expect(gsap.getTweensOf(f.incoming)).not.toContain(tween);
  expect(f.owner.cleanupJourneyAreaIdleAnimations).toHaveBeenCalledTimes(1);
});

test('explicit detailed commit retains incoming subtree counts', () => {
  const f = fixture(true); const read = jest.spyOn(f.root, 'querySelectorAll');
  f.owner.commitJourneyWorldPrepaint(f.container, 1);
  expect(read.mock.calls.map(([selector]) => selector)).toEqual(['*', 'img']);
  expect(f.scope.emitIOSNativeDiagnostic).toHaveBeenCalledWith('world-prepaint-committed', expect.objectContaining({ childCount: 4, imageCount: 1 }));
});

test.each(['not-ready', 'wrong-world', 'detached'])('rejected %s stage cannot retire live owners', (reason) => {
  const f = fixture();
  if (reason === 'not-ready') f.owner.journeyWorldPrepaintStage.ready = false;
  if (reason === 'wrong-world') f.owner.journeyWorldPrepaintStage.worldId = 2;
  if (reason === 'detached') f.host.remove();
  expect(f.owner.commitJourneyWorldPrepaint(f.container, 1)).toBe(false);
  expect(f.owner.cleanupJourneyAreaIdleAnimations).not.toHaveBeenCalled();
  expect(f.owner.beginRenderLifecycle).not.toHaveBeenCalled();
  expect(f.outgoing.isConnected).toBe(true);
});
