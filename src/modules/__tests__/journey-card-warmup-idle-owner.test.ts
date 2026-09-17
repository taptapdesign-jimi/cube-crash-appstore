import fs from 'node:fs';
import ts from 'typescript';
const file = ts.createSourceFile('journey.ts', fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const methods = new Map<string, ts.MethodDeclaration>();
let enterContinuation!: ts.ArrowFunction;
function visit(node: ts.Node) {
  if (ts.isMethodDeclaration(node)) methods.set(node.name.getText(file), node);
  if (ts.isCallExpression(node) && node.expression.getText(file) === 'imageReadiness.then' && ts.isArrowFunction(node.arguments[0])) enterContinuation = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(file);
const compile = (code: string) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture() {
  const root = document.createElement('div'); document.body.appendChild(root);
  const overlay = jest.fn(async () => {}), reminder = jest.fn(async () => {});
  const scope = { preloadJourneyCardOverlayAssets: overlay, preloadJourneyCardReturnReminderAssets: reminder };
  const owner: any = { renderDisposed: false, renderLifecycleGeneration: 1, journeyV700WorldMotionEpoch: 2,
    journeyAreaIdlePausedForInteraction: false, journeyWorldRuntime: { getSnapshot: () => ({ state: 'idle' }) },
    journeyV700CloseQueuedDuringEnter: false, journeyV700Phase: 'idle', journeyV700View: 'world', journeyV700WorldId: 1,
    _activeTimeouts: new Set(), _activeTimeoutCancellationHandlers: new Map() };
  for (const name of ['trackTimeout', 'clearTrackedTimeout', 'scheduleJourneyCardAssetWarmup']) {
    const node = methods.get(name)!;
    const fn = compile(`function run(${node.parameters.map(p => p.getText(file)).join(',')}) ${node.body!.getText(file)}`);
    owner[name] = new Function('scope', `with(scope){${fn};return run;}`)(scope).bind(owner);
  }
  const cancel = () => {
    owner.renderDisposed = true;
    owner._activeTimeouts.forEach((id: number) => clearTimeout(id));
    owner._activeTimeoutCancellationHandlers.forEach((fn: () => void) => fn());
    owner._activeTimeouts.clear(); owner._activeTimeoutCancellationHandlers.clear();
  };
  return { root, owner, overlay, reminder, cancel };
}
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); document.body.innerHTML = ''; delete (window as any).requestIdleCallback; delete (window as any).cancelIdleCallback; });

test('actual owner defers optional loads to idle and warms exactly once', () => {
  const f = fixture(); let idle!: () => void;
  window.requestIdleCallback = jest.fn((fn: any) => { idle = fn; return 7; });
  window.cancelIdleCallback = jest.fn();
  f.owner.scheduleJourneyCardAssetWarmup(f.root, 1, 2);
  expect(f.overlay).not.toHaveBeenCalled(); jest.advanceTimersByTime(120);
  expect(f.overlay).not.toHaveBeenCalled(); idle();
  expect(f.overlay).toHaveBeenCalledTimes(1); expect(f.reminder).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000); idle(); expect(f.overlay).toHaveBeenCalledTimes(1);
  expect(f.owner._activeTimeouts.size).toBe(0);
});

test.each(['generation', 'motion', 'phase', 'world', 'view', 'detached', 'disposed'])('stale %s owner never starts optional decoding', (reason) => {
  const f = fixture(); f.owner.scheduleJourneyCardAssetWarmup(f.root, 1, 2);
  jest.advanceTimersByTime(120);
  if (reason === 'generation') f.owner.renderLifecycleGeneration++;
  if (reason === 'motion') f.owner.journeyV700WorldMotionEpoch++;
  if (reason === 'phase') f.owner.journeyV700Phase = 'exiting';
  if (reason === 'world') f.owner.journeyV700WorldId = 2;
  if (reason === 'view') f.owner.journeyV700View = 'hub';
  if (reason === 'detached') f.root.remove();
  if (reason === 'disposed') f.cancel();
  jest.advanceTimersByTime(1000); expect(f.overlay).not.toHaveBeenCalled(); expect(f.reminder).not.toHaveBeenCalled();
});

test.each(['modal', 'scrolling', 'settling', 'interaction-paused'])('pending idle callback does not preload during %s', (state) => {
  const f = fixture(); let idle!: () => void;
  window.requestIdleCallback = jest.fn((fn: any) => { idle = fn; return 8; });
  window.cancelIdleCallback = jest.fn();
  f.owner.scheduleJourneyCardAssetWarmup(f.root, 1, 2);
  jest.advanceTimersByTime(120);
  if (state === 'interaction-paused') f.owner.journeyAreaIdlePausedForInteraction = true;
  else f.owner.journeyWorldRuntime.getSnapshot = () => ({ state });
  idle(); jest.advanceTimersByTime(1000);
  expect(f.overlay).not.toHaveBeenCalled(); expect(f.reminder).not.toHaveBeenCalled();
});

test('render cancellation retires idle callback and a late callback cannot warm', () => {
  const f = fixture(); let idle!: () => void;
  window.requestIdleCallback = jest.fn((fn: any) => { idle = fn; return 9; }); window.cancelIdleCallback = jest.fn();
  f.owner.scheduleJourneyCardAssetWarmup(f.root, 1, 2); jest.advanceTimersByTime(120); f.cancel(); idle();
  expect(window.cancelIdleCallback).toHaveBeenCalledWith(9); expect(f.overlay).not.toHaveBeenCalled();
});

test('without idle callbacks a bounded tracked fallback warms the current owner', () => {
  const f = fixture(); f.owner.scheduleJourneyCardAssetWarmup(f.root, 1, 2); jest.advanceTimersByTime(620);
  expect(f.overlay).toHaveBeenCalledTimes(1); expect(f.reminder).toHaveBeenCalledTimes(1);
});

test.each([false, true])('actual World enter continuation schedules warmup only after current successful cascade; cancel=%s', async (cancel) => {
  const f = fixture(); f.owner.journeyV700Phase = 'entering';
  let done!: () => void; const entered = new Promise<void>(resolve => { done = resolve; });
  f.owner.journeyWorldAnimation = { enter: () => entered };
  f.owner.journeyWorldRuntime = { endTransition() {} };
  f.owner.scheduleJourneyCardAssetWarmup = jest.fn();
  const owner = new Proxy(f.owner, { get: (o, k) => k in o ? o[k] : () => {} });
  const data: any = { container: f.root, worldId: 1, motionEpoch: 2, source: 'hub-world-open', images: [], units: [], allTargets: [], reducedMotion: false, targetsPrimed: true,
    transitionPerformance: { phase: (_: string, fn: () => unknown) => fn() }, finishWorldEnterAudit() {}, emitIOSNativeDiagnostic() {}, markIOSJourneyRouteAudit() {}, markIOSJourneyTransitionAudit() {} };
  const run = new Function('scope', `with(scope){${compile(`const callback = ${enterContinuation.getText(file)};`)} return callback;}`).call(owner, data);
  const pending = run(); await Promise.resolve(); expect(f.owner.scheduleJourneyCardAssetWarmup).not.toHaveBeenCalled();
  if (cancel) f.owner.journeyV700WorldMotionEpoch++;
  done(); await pending;
  expect(f.owner.scheduleJourneyCardAssetWarmup).toHaveBeenCalledTimes(cancel ? 0 : 1);
});
