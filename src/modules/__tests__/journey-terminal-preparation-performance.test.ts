import fs from 'node:fs';
import ts from 'typescript';
import { prepareJourneyWorldTransforms } from '../journey-world-transform-preparation';
import { beginScreenPreparation } from '../../utils/screen-presentation';
import { beginJourneyTerminalPreparationPerformance, type JourneyTerminalPreparationPerformance } from '../journey-terminal-preparation-performance';
import {
  getJourneyBoardCardBaseRotationDegrees,
  getJourneyBoardCardBaseScale,
  getJourneyBoardCardBaseTransform,
  rememberJourneyBoardCardBaseTransform,
} from '../journey-card-base-transform';

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
    return {
      owner,
      screen,
      finishImages,
      prepare: (
        capture: JourneyTerminalPreparationPerformance | null,
        options: { warmPaint?: boolean } = {},
      ) => owner.prepareJourneyV700WorldEnterFromReturn('terminal-overlay:clean-board', 7, capture, options),
    };
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

  test('settled-result cold prewarm builds and primes without a paint-warm lease', () => {
    const f = managerFixture(true);
    const presentationBefore = {
      hidden: f.screen.hidden,
      className: f.screen.className,
      style: f.screen.getAttribute('style'),
    };
    expect(f.prepare(null, { warmPaint: false })).toBe(true);
    expect(f.owner.renderBoards).toHaveBeenCalledTimes(1);
    expect(f.owner.journeyReturnPaintWarmLease).toBeNull();
    expect(f.owner.waitForTrackedFrames).not.toHaveBeenCalled();
    expect({
      hidden: f.screen.hidden,
      className: f.screen.className,
      style: f.screen.getAttribute('style'),
    }).toEqual(presentationBefore);
  });

  test('reveal transform preparation batches all GSAP retirement and one RAF per World', () => {
    document.body.innerHTML = `
      <div class="journey-cards-container">
        <div class="journey-board-card-wrapper" style="transform:translateX(-50%) rotate(-2deg) scale(1)">
          <div class="journey-board-card"></div>
        </div>
        <div class="journey-board-card-wrapper" style="transform:rotate(3deg) scale(1)">
          <div class="journey-board-card"></div>
        </div>
        <div id="protected" class="journey-board-card-wrapper" style="transform:rotate(1deg) scale(1)">
          <div class="journey-board-card"></div>
        </div>
      </div>`;
    (document.getElementById('protected') as any).__ccJourneyToGameExitTween = true;
    const method = methods.get('prepareJourneyBoardCardTransformsForReveal')!;
    const code = ts.transpileModule(
      `function run(${method.parameters.map(parameter => parameter.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    const gsapBatch = { killTweensOf: jest.fn(), set: jest.fn() };
    const trackRAF = jest.fn();
    const owner: any = {
      getJourneyBoardCardVisualTarget: (wrapper: HTMLElement) =>
        wrapper.querySelector('.journey-board-card') as HTMLElement,
      isJourneyCardTapExitProtectedTarget: () => false,
      restoreJourneyBoardCardWrapperVisibility: jest.fn(),
      restoreJourneyBoardCardVisualTarget: jest.fn(),
      trackRAF,
    };
    owner.prepare = new Function(
      'gsap',
      'logger',
      'getJourneyBoardCardBaseRotationDegrees',
      'getJourneyBoardCardBaseScale',
      'getJourneyBoardCardBaseTransform',
      'rememberJourneyBoardCardBaseTransform',
      `${code}; return run;`,
    )(
      gsapBatch,
      { info: jest.fn(), warn: jest.fn() },
      getJourneyBoardCardBaseRotationDegrees,
      getJourneyBoardCardBaseScale,
      getJourneyBoardCardBaseTransform,
      rememberJourneyBoardCardBaseTransform,
    ).bind(owner);

    owner.prepare('test');

    expect(gsapBatch.killTweensOf).toHaveBeenCalledTimes(1);
    expect(gsapBatch.killTweensOf.mock.calls[0][0]).toHaveLength(4);
    expect(gsapBatch.set).toHaveBeenCalledTimes(3);
    expect(trackRAF).toHaveBeenCalledTimes(1);
    expect(owner.restoreJourneyBoardCardWrapperVisibility).not.toHaveBeenCalled();
    expect(owner.restoreJourneyBoardCardVisualTarget).not.toHaveBeenCalled();
  });

  test('terminal prewarm builds detached board Units across owned presentation turns before one commit', () => {
    const prepareMethod = methods.get('prepareJourneyV700WorldEnterFromReturnIncrementally')!;
    const prepareSource = prepareMethod.getText(parsed);
    const turnSource = methods.get('waitForJourneyPreparationTurn')!.getText(parsed);
    const renderSource = methods.get('renderJourneyWorldIncrementally')!.getText(parsed);
    const primeSource = methods.get('primeJourneyV700WorldEnterIncrementally')!.getText(parsed);
    const cancelSource = methods.get('cancelPreparedJourneyV700WorldEnter')!.getText(parsed);

    expect(turnSource).toContain('await this.waitForTrackedFrames(1)');
    expect(turnSource).toContain('this.trackTimeout(');
    expect(turnSource).toContain('() => finish(false)');
    expect(prepareSource).toContain('const stageRoot = document.createElement');
    expect(prepareSource).toContain('await this.renderJourneyWorldIncrementally(');
    expect(renderSource).toContain('await this.waitForJourneyPreparationTurn(isCurrent)');
    expect(renderSource).toContain('boardIds: new Set(boardId === null ? [] : [boardId])');
    expect(renderSource).toContain('this.applyJourneyV700WorldScope(chunkRoot, worldId, { prepaint: true })');
    expect(renderSource).not.toContain('prepareJourneyBoardCardTransformsForReveal');
    expect(renderSource).toContain('this.mergeJourneyTerminalReturnChunk(stageRoot, chunkRoot)');
    expect(prepareSource).toContain('container.replaceChildren(...Array.from(stageRoot.children))');
    expect(prepareSource.indexOf('this.primeJourneyV700WorldEnterIncrementally('))
      .toBeLessThan(prepareSource.indexOf('container.replaceChildren('));
    expect(primeSource).toContain('await prepareJourneyWorldTransforms(');
    expect(primeSource).toContain('waitForTurn: () => this.waitForJourneyPreparationTurn(isCurrent)');
    expect(cancelSource).toContain('this.journeyTerminalReturnBuild.cancelled = true');
    expect(cancelSource).toContain('this.journeyTerminalReturnBuild = null');
  });

  test.each([
    { worldId: 1, mainAreaId: 'forest-main', start: 1, end: 10 },
    { worldId: 2, mainAreaId: 'beach-main', start: 11, end: 20 },
    { worldId: 3, mainAreaId: 'robo-main', start: 21, end: 30 },
  ])('detached World $worldId uses the real Unit selectors before atomic commit', ({ worldId, mainAreaId, start, end }) => {
    const root = document.createElement('div');
    const main = document.createElement('div');
    main.dataset.journeyAreaId = mainAreaId;
    root.append(main);
    for (let boardId = start; boardId <= end; boardId += 1) {
      const area = document.createElement('div');
      area.dataset.journeyAreaId = `board-${boardId}`;
      const wrapper = document.createElement('div');
      wrapper.className = 'journey-board-card-wrapper';
      wrapper.dataset.boardId = String(boardId);
      const card = document.createElement('div');
      card.className = 'journey-board-card';
      card.dataset.boardId = String(boardId);
      wrapper.append(card);
      root.append(area, wrapper);
    }
    expect(root.isConnected).toBe(false);

    const owner: any = {
      getJourneyWorldRange: () => ({ start, end }),
    };
    for (const name of [
      'getJourneyV700WorldTargets',
      'isJourneyV700TargetOwnedByRoot',
      'getJourneyV700BoardIdForTarget',
      'getJourneyV700VisibleBoardAreaTargets',
      'getJourneyV700WorldTargetGroups',
      'getJourneyV700AnimationUnits',
    ]) {
      const method = methods.get(name)!;
      const code = ts.transpileModule(
        `function run(${method.parameters.map(parameter => parameter.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
        { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
      ).outputText;
      owner[name] = new Function(`${code}; return run;`)().bind(owner);
    }

    const units = owner.getJourneyV700AnimationUnits(root, worldId);
    expect(units).toHaveLength(11);
    expect(units[0].id).toBe(mainAreaId);
    expect(units.slice(1).map((unit: { targets: HTMLElement[] }) => unit.targets.length))
      .toEqual(Array(10).fill(2));
    expect(units.flatMap((unit: { targets: HTMLElement[] }) => unit.targets))
      .toHaveLength(21);

    const foreign = document.createElement('div');
    expect(owner.isJourneyV700TargetOwnedByRoot(root, foreign)).toBe(false);
  });

  test.each([1, 2, 3])('World %s builds only one authored Unit per turn and cancellation stops remaining work', async (worldId) => {
    let current = true;
    let turn = 0;
    const calls: { turn: number; main: boolean; boards: number[] }[] = [];
    const owner: any = {
      getJourneyWorldRange: () => ({ start: 1, end: 10 }),
      waitForJourneyPreparationTurn: async (isCurrent: () => boolean) => {
        turn += 1;
        return isCurrent();
      },
      renderBoardsFixed: (_root: HTMLElement, options: any) => {
        calls.push({ turn, main: options.includeMain, boards: [...options.boardIds] });
        if (calls.length === 4) current = false;
      },
      applyJourneyV700WorldScope: jest.fn(),
      mergeJourneyTerminalReturnChunk: jest.fn(),
    };
    const method = methods.get('renderJourneyWorldIncrementally')!;
    const code = ts.transpileModule(`async function run(${method.parameters.map(p => p.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const run = new Function(`${code}; return run;`)().bind(owner);
    await expect(run(document.createElement('div'), worldId, () => current)).resolves.toBe(false);
    expect(calls).toEqual([
      { turn: 1, main: true, boards: [] },
      { turn: 2, main: false, boards: [1] },
      { turn: 3, main: false, boards: [2] },
      { turn: 4, main: false, boards: [3] },
    ]);
    expect(owner.mergeJourneyTerminalReturnChunk).toHaveBeenCalledTimes(4);
  });

  test('large Unit priming yields after measured work and publishes no plan after cancellation', async () => {
    let current = true;
    const targets = Array.from({ length: 20 }, () => document.createElement('div'));
    const set = jest.fn(() => { now += 3; });
    const owner: any = {
      renderLifecycleGeneration: 3,
      getLastActiveJourneyBoardAreaId: () => 22,
      getJourneyV700AnimationUnits: () => [{ id: 'large', targets, clouds: [] }],
      cleanupJourneyAreaIdleAnimations: jest.fn(),
      waitForJourneyPreparationTurn: jest.fn(async (isCurrent: () => boolean) => {
        if (set.mock.calls.length >= 6) current = false;
        return isCurrent();
      }),
      logJourneyV700Flow: jest.fn(),
    };
    const method = methods.get('primeJourneyV700WorldEnterIncrementally')!;
    const code = ts.transpileModule(`async function run(${method.parameters.map(p => p.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const run = new Function('gsap', 'getJourneyV700MotionProfile', 'setJourneyAlienBeamIdleReady', 'restoreJourneyAreaTransformOrigin', 'prepareJourneyWorldTransforms',
      `${code}; return run;`)({ set }, () => ({ enter: { y: 30, scale: 0.65 } }), jest.fn(), jest.fn(), prepareJourneyWorldTransforms).bind(owner);
    const durations: number[] = [];
    await expect(run(document.createElement('div'), 3, 7, 'test', () => current, durations)).resolves.toBeNull();
    expect(set).toHaveBeenCalledTimes(6);
    expect(durations).toEqual([6, 6, 6]); // 4ms budget plus one indivisible 3ms operation.
    expect(owner.waitForJourneyPreparationTurn).toHaveBeenCalledTimes(4);
    expect(owner.journeyV700PreparedWorldEnter).toBeUndefined();
  });

  test('pressure retires optional ownership but preserves accepted return construction', () => {
    document.body.innerHTML = '<section id="journey-screen" hidden><div id="journey-boards-container"><i></i></div></section>';
    const method = methods.get('cancelOptionalJourneyTerminalReturnPreparation')!;
    const code = ts.transpileModule(`function run(${method.parameters.map(p => p.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const run = new Function('emitIOSNativeDiagnostic', `${code}; return run;`)(jest.fn());
    const optional = { ownerToken: -7, cancelled: false };
    const owner: any = { journeyTerminalReturnBuild: optional, journeyV700PreparedWorldEnter: { ownerToken: -7, worldId: 3 } };
    run.call(owner, 'memory-warning');
    expect(optional.cancelled).toBe(true);
    expect(owner.journeyTerminalReturnBuild).toBeNull();
    expect(owner.journeyV700PreparedWorldEnter).toBeNull();
    expect(document.getElementById('journey-boards-container')!.childElementCount).toBe(0);
    const required = { ownerToken: 8, cancelled: false };
    owner.journeyTerminalReturnBuild = required;
    run.call(owner, 'second-memory-warning');
    expect(owner.journeyTerminalReturnBuild).toBe(required);
    expect(required.cancelled).toBe(false);
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
