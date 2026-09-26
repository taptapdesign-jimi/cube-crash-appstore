import fs from 'node:fs';
import ts from 'typescript';
import { beginScreenPreparation } from '../../utils/screen-presentation';
import { beginJourneyTerminalPreparationPerformance, type JourneyTerminalPreparationPerformance } from '../journey-terminal-preparation-performance';

const parsed = ts.createSourceFile('journey.ts', fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const methods = new Map<string, ts.MethodDeclaration>();
const visit = (node: ts.Node): void => {
  if (ts.isMethodDeclaration(node)) methods.set(node.name.getText(parsed), node);
  ts.forEachChild(node, visit);
};
visit(parsed);

describe('terminal Journey preparation phase diagnostics', () => {
  let now: number;
  let postMessage: jest.Mock;
  beforeEach(() => {
    jest.useFakeTimers();
    now = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    postMessage = jest.fn();
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    (window as any).__ccPerformanceDiagnostics = true;
  });
  afterEach(() => {
    jest.clearAllTimers(); jest.useRealTimers();
    document.body.innerHTML = '';
    delete (window as any).webkit;
    delete (window as any).__ccPerformanceDiagnostics;
  });
  const summary = (index = 0) => JSON.parse(postMessage.mock.calls[index][0].message.split('summary ')[1]);
  const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };

  function managerFixture(cold: boolean) {
    document.body.innerHTML = '<section id="journey-screen" hidden class="hidden"><div id="journey-boards-container"></div></section>';
    const container = document.getElementById('journey-boards-container')!;
    const screen = document.getElementById('journey-screen')!;
    const mount = () => { container.innerHTML = '<div id="unit"><img src="art.png"></div>'; };
    if (!cold) mount();
    let finishImages!: () => void;
    const imagesReady = new Promise<void>(resolve => { finishImages = resolve; });
    const owner: any = {
      renderDisposed: false,
      renderLifecycleGeneration: 1,
      journeyV700WorldId: 3,
      journeyV700View: 'world',
      journeyV700PreparedWorldEnter: null,
      journeyReturnPaintWarmLease: null,
      logJourneyV700Flow: jest.fn(),
      getJourneyV700AnimationUnits: () => container.firstElementChild ? [{ targets: [container.firstElementChild] }] : [],
      renderBoards: jest.fn(() => { now += 40; mount(); }),
      prepareJourneyBoardCardTransformsForReveal: jest.fn(() => { now += 3; }),
      reconcileMountedJourneyWorldCardUnits: jest.fn(() => { now += 4; }),
      getLastActiveJourneyBoardAreaId: () => 25,
      primeJourneyV700WorldEnter: (_container: HTMLElement, worldId: number, options: { ownerToken: number }) => {
        now += 5;
        owner.journeyV700PreparedWorldEnter = { worldId, renderGeneration: 1, ownerToken: options.ownerToken, targets: [container.firstElementChild], units: [{}] };
      },
      waitForTrackedFrames: jest.fn(async () => { now += 16; return true; }),
      resumeForVisibleWorldReturn: jest.fn(),
    };
    for (const name of ['prepareJourneyV700WorldEnterFromReturn', 'startJourneyReturnPaintWarm', 'releaseJourneyReturnPaintWarmLease']) {
      const method = methods.get(name)!;
      const code = ts.transpileModule(`function run(${method.parameters.map(parameter => parameter.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
        { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      owner[name] = new Function('beginScreenPreparation', 'emitIOSNativeDiagnostic', 'waitForImageReady',
        `${code}; return run;`)(beginScreenPreparation, jest.fn(), () => { now += 2; return imagesReady; }).bind(owner);
    }
    jest.spyOn(screen, 'getBoundingClientRect').mockImplementation(() => { now += 7; return {} as DOMRect; });
    jest.spyOn(container, 'getBoundingClientRect').mockImplementation(() => { now += 11; return {} as DOMRect; });
    return { owner, screen, finishImages, prepare: (capture: JourneyTerminalPreparationPerformance | null) => owner.prepareJourneyV700WorldEnterFromReturn('terminal-overlay:clean-board', 7, capture) };
  }

  test('disabled diagnostics preserve real preparation without adding timers or logs', async () => {
    (window as any).__ccPerformanceDiagnostics = false;
    const capture = beginJourneyTerminalPreparationPerformance(7, 'clean-board', 25);
    expect(capture).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    const f = managerFixture(true);
    expect(f.prepare(capture)).toBe(true);
    f.finishImages(); await flush();
    expect(f.owner.journeyReturnPaintWarmLease.ready).toBe(true);
    expect(f.owner.waitForTrackedFrames).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
    expect(postMessage).not.toHaveBeenCalled();
    f.owner.releaseJourneyReturnPaintWarmLease(7, 'test', true);
  });

  test.each([true, false])('actual owner separates synchronous setup from image wait/layout/paint (cold=%s)', async cold => {
    const capture = beginJourneyTerminalPreparationPerformance(7, 'clean-board', 25)!;
    const f = managerFixture(cold);
    expect(f.prepare(capture)).toBe(true);
    capture.mark('prepare-returned');
    expect(postMessage).not.toHaveBeenCalled();
    now += 200;
    f.finishImages(); await flush();
    expect(postMessage).toHaveBeenCalledTimes(1);
    const record = summary();
    expect(record).toMatchObject({ transitionId: 7, boardId: 25, worldId: 3, cold, existingUnits: cold ? 0 : 1, imageCount: 1, targetCount: 1, reason: 'painted' });
    const durations = Object.fromEntries(record.phases.map((phase: { name: string; durationMs: number }) => [phase.name, phase.durationMs]));
    expect(durations).toMatchObject({ 'transform-reset': 3, reconcile: 4, prime: 5, 'image-dispatch': 2, 'warm-dispatch': 2, 'image-ready': 202, 'forced-layout': 18, 'paint-frame-1': 16, 'paint-frame-2': 16, 'paint-frame-3': 16 });
    expect(durations['cold-render']).toBe(cold ? 40 : undefined);
    expect(f.owner.renderBoards).toHaveBeenCalledTimes(cold ? 1 : 0);
    expect(jest.getTimerCount()).toBe(0);
    f.owner.releaseJourneyReturnPaintWarmLease(7, 'visible-enter-promoted', false);
    capture.finish('duplicate');
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  test('release during image wait reports once and late completion cannot append or paint', async () => {
    const capture = beginJourneyTerminalPreparationPerformance(7, 'clean-board', 25)!;
    const f = managerFixture(true);
    f.prepare(capture);
    f.owner.releaseJourneyReturnPaintWarmLease(7, 'cancelled', true);
    expect(summary().reason).toBe('released:cancelled');
    expect(f.screen.hidden).toBe(true);
    const emitted = postMessage.mock.calls[0][0].message;
    f.finishImages(); await flush();
    expect(f.owner.waitForTrackedFrames).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0].message).toBe(emitted);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('bounded capture expires once; measured exceptions preserve original behavior', () => {
    const capture = beginJourneyTerminalPreparationPerformance(7, 'fail', 25)!;
    expect(() => capture.phase('throws', () => { now += 5; throw new Error('original'); })).toThrow('original');
    for (let i = 0; i < 80; i++) capture.mark(`phase-${i}`);
    jest.advanceTimersByTime(5000);
    expect(summary()).toMatchObject({ reason: 'timeout' });
    expect(summary().phases).toHaveLength(32);
    capture.finish('late'); capture.mark('late');
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
