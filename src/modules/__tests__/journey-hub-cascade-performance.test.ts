/** @jest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { beginTransitionPerformance } from '../../utils/transition-performance';
import { emitNativeConsoleDiagnostic } from '../../utils/ios-native-diagnostic';

jest.mock('../../utils/runtime-diagnostics-policy', () => ({ arePerformanceDiagnosticsEnabled: () => true }));
jest.mock('../../utils/ios-native-diagnostic', () => ({ emitNativeConsoleDiagnostic: jest.fn() }));

const file = ts.createSourceFile('journey.ts', fs.readFileSync(path.join(__dirname, '../journey-boards-manager.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const methods = new Map<string, string>();
const visit = (node: ts.Node) => {
  if (ts.isMethodDeclaration(node) && ['playJourneyV700HubEnter', 'cancelJourneyV700HubEnter'].includes(node.name.getText(file))) {
    const param = node.parameters[0].name.getText(file);
    methods.set(node.name.getText(file), ts.transpileModule(`function run(${param}) ${node.body!.getText(file)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
  }
  ts.forEachChild(node, visit);
};
visit(file);
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }
async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function fixture(opacities = ['1', '0.65', '0.8']) {
  document.body.innerHTML = `<div id="journey-boards-container" data-journey-v700-view="hub"><div class="journey-v700-hub"><div class="journey-v700-hub-cloud-layer"></div>${opacities.map((opacity, i) => `<div class="journey-v700-world-card ${i ? 'is-locked' : ''}" data-world-id="${i + 1}" ${opacity ? `data-journey-hub-final-opacity="${opacity}"` : ''}><img></div>`).join('')}</div></div>`;
  const tweens: { target: HTMLElement; vars: any; kill: jest.Mock }[] = [];
  const ready = deferred();
  const computed = jest.fn(() => ({ opacity: '0.65' }));
  const scope: Record<string, any> = {
    beginTransitionPerformance, getComputedStyle: computed,
    getJourneyHubWorkingSet: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
    MOBILE_RUNTIME_PROFILE: { isMobileDevice: false },
    emitIOSNativeDiagnostic: jest.fn(), markIOSJourneyRouteAudit: jest.fn(),
    shouldIgnoreJourneyV700HubVisibleEnterRequest: () => false,
    playJourneyWorldsHubSound: jest.fn(),
    getJourneyV700MotionProfile: () => ({ enter: { y: 20, scale: 0.8, duration: 0.5, baseDelay: 0.1, ease: 'back.out' } }),
    getJourneyV700HubEnterStagger: () => 0.07,
    readyPromise: ready.promise,
    waitForImageReady: () => scope.readyPromise,
    gsap: { killTweensOf: jest.fn(), set: jest.fn() },
    trackTween: (target: HTMLElement, vars: any) => { const tween = { target, vars, kill: jest.fn() }; tweens.push(tween); return tween; },
  };
  const owner: Record<string, any> = {
    journeyV700HubEnterPerformance: null, journeyV700HubEnterEpoch: 0, journeyV700HubEnterTweens: [],
    journeyV700HubPresentationWaiters: new Set(), journeyV700Phase: 'prepared', journeyV700View: 'hub',
    journeyHubRuntime: { prepareForTransition: jest.fn(), activate: jest.fn() },
    logJourneyV700Flow: jest.fn(), emitJourneyV700HubGeometryDiagnostic: jest.fn(), trackRAF: jest.fn(),
  };
  for (const [name, body] of methods) owner[name] = new Function('scope', `with(scope){${body};return run;}`)(scope).bind(owner);
  return { scope, owner, tweens, ready, computed };
}
const summaries = () => (emitNativeConsoleDiagnostic as jest.Mock).mock.calls.map((call) => ({ name: call[1], ...call[2] }));
beforeEach(() => { jest.useFakeTimers(); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); document.body.innerHTML = ''; });

test('actual hub cascade span covers image wait, first visible tick and every target through idle handoff', async () => {
  const f = fixture(); f.owner.playJourneyV700HubEnter('homepage');
  jest.advanceTimersByTime(120);
  expect(summaries()).toEqual([]); expect(f.tweens).toHaveLength(0);
  f.ready.resolve(); await flush(); expect(f.tweens).toHaveLength(4);
  f.tweens[0].vars.onStart(); jest.advanceTimersByTime(100);
  expect(summaries()).toEqual([]);
  f.tweens.slice(0, -1).forEach((tween) => tween.vars.onComplete());
  expect(summaries()).toEqual([]);
  f.tweens[f.tweens.length - 1].vars.onComplete();
  expect(summaries()).toHaveLength(1);
  expect(summaries()[0]).toMatchObject({ name: 'journey-hub-cascade-homepage', reason: 'idle-handoff-complete', durationMs: 220 });
  expect(summaries()[0].phases.map((phase: any) => phase.name)).toEqual(['prepare-runtime', 'transforms-start', 'images-ready', 'first-visible-tween', 'last-target-complete']);
  expect(f.owner.journeyV700HubEnterPerformance).toBeNull();
  expect(f.owner.journeyHubRuntime.activate).toHaveBeenCalledTimes(1);
});

test('canceled image readiness cannot finish the newer span or create retired tweens', async () => {
  const f = fixture(); f.owner.playJourneyV700HubEnter('homepage');
  f.owner.cancelJourneyV700HubEnter('route-change');
  const next = deferred(); f.scope.readyPromise = next.promise;
  f.owner.playJourneyV700HubEnter('world-return');
  const nextSpan = f.owner.journeyV700HubEnterPerformance;
  f.ready.resolve(); await flush();
  expect(summaries()).toHaveLength(1); expect(summaries()[0].reason).toBe('route-change');
  expect(f.owner.journeyV700HubEnterPerformance).toBe(nextSpan); expect(f.tweens).toHaveLength(0);
  next.resolve(); await flush();
  f.tweens.forEach((tween) => tween.vars.onComplete());
  expect(summaries()).toHaveLength(2);
  expect(summaries()[1]).toMatchObject({ name: 'journey-hub-cascade-world-return', reason: 'idle-handoff-complete' });
});

test('canceled tween callbacks cannot finish a replacement enter span', async () => {
  const f = fixture(); f.owner.playJourneyV700HubEnter('homepage'); f.ready.resolve(); await flush();
  const old = [...f.tweens]; f.owner.cancelJourneyV700HubEnter('cancel-active');
  f.scope.readyPromise = new Promise<void>(() => {}); f.owner.playJourneyV700HubEnter('world-return');
  const nextSpan = f.owner.journeyV700HubEnterPerformance;
  old.forEach((tween) => { tween.vars.onStart(); tween.vars.onComplete(); expect(tween.kill).toHaveBeenCalledTimes(1); });
  expect(summaries()).toHaveLength(1); expect(f.owner.journeyV700HubEnterPerformance).toBe(nextSpan);
  f.owner.cancelJourneyV700HubEnter('cleanup');
});

test.each([true, false])('prepared opacity preserves target values while avoiding computed reads=%s', async (prepared) => {
  const f = fixture(prepared ? ['1', '0.65', '0.8'] : ['', '', '0.8']);
  f.owner.playJourneyV700HubEnter('homepage'); f.ready.resolve(); await flush();
  const cards = f.tweens.filter((tween) => tween.target.classList.contains('journey-v700-world-card'));
  expect(cards.map((tween) => tween.vars.opacity)).toEqual([1, 0.65, 0.8]);
  expect(f.computed).toHaveBeenCalledTimes(prepared ? 0 : 1);
  f.owner.cancelJourneyV700HubEnter('cleanup');
});
