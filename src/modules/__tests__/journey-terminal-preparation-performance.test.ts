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
    for (const name of ['prepareJourneyV700WorldEnterFromReturn', 'adoptPreparedJourneyV700WorldEnter', 'waitForPreparedJourneyV700WorldEnter', 'cancelPreparedJourneyV700WorldEnter']) {
      const method = methods.get(name)!;
      const asyncPrefix = method.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
      const code = ts.transpileModule(`${asyncPrefix}function run(${method.parameters.map(parameter => parameter.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
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

  test.each([true, false])('prepares hidden World without image or paint barriers (cold=%s)', async cold => {
    const capture = beginJourneyTerminalPreparationPerformance(7, 'clean-board', 25)!;
    const f = managerFixture(cold);
    const before = f.screen.firstElementChild?.firstElementChild;
    expect(f.prepare(capture)).toBe(true);
    expect(f.owner.renderBoards).toHaveBeenCalledTimes(cold ? 1 : 0);
    expect(f.screen.hidden).toBe(true);
    expect(f.screen.className).toBe('hidden');
    expect(f.screen.getAttribute('style')).toBeNull();
    if (!cold) expect(f.screen.firstElementChild?.firstElementChild).toBe(before);
    expect(f.owner.waitForTrackedFrames).not.toHaveBeenCalled();
    expect(f.screen.getBoundingClientRect).not.toHaveBeenCalled();
    expect(await f.owner.waitForPreparedJourneyV700WorldEnter(7)).toBe(true);
    expect(summary()).toMatchObject({ transitionId: 7, worldId: 3, cold, reason: 'prepared' });
    const names = summary().phases.map((phase: { name: string }) => phase.name);
    expect(names).not.toContain('image-dispatch');
    expect(names).not.toContain('paint-frame-1');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('reuses and adopts prepared identities; an old token cannot clear its successor', async () => {
    const f = managerFixture(false);
    expect(f.prepare(null)).toBe(true);
    const targets = f.owner.journeyV700PreparedWorldEnter.targets;
    expect(f.prepare(null)).toBe(true);
    expect(f.owner.reconcileMountedJourneyWorldCardUnits).toHaveBeenCalledTimes(1);
    expect(f.owner.adoptPreparedJourneyV700WorldEnter(7, 8)).toBe(true);
    f.owner.cancelPreparedJourneyV700WorldEnter(7, 'stale');
    expect(f.owner.journeyV700PreparedWorldEnter.targets).toBe(targets);
    expect(await f.owner.waitForPreparedJourneyV700WorldEnter(7)).toBe(false);
    expect(await f.owner.waitForPreparedJourneyV700WorldEnter(8)).toBe(true);
    targets[0].remove();
    expect(await f.owner.waitForPreparedJourneyV700WorldEnter(8)).toBe(false);
  });

  test('disabled diagnostics add no timers or native records', () => {
    (window as any).__ccPerformanceDiagnostics = false;
    const f = managerFixture(false);
    expect(f.prepare(beginJourneyTerminalPreparationPerformance(7, 'clean-board', 25))).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    expect(postMessage).not.toHaveBeenCalled();
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
    expect(prepareSource).toContain('if (canReuseRetainedSurface)');
    expect(prepareSource).toContain('this.reconcileMountedJourneyWorldCardUnits(container, worldId');
    expect(prepareSource).toContain('reusedRetainedSurface: true');
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

  test('warm gameplay return primes the retained World and replacement cannot publish a stale plan', async () => {
    document.body.innerHTML = `
      <section id="journey-screen" hidden class="hidden">
        <div id="journey-boards-container" data-journey-v700-view="world" data-journey-v700-world-id="1">
          <div id="world-main" data-journey-area-id="forest-main"></div>
          <div class="journey-cards-container">
            ${Array.from({ length: 10 }, (_, index) => (
              `<div id="unit-${index + 1}" data-journey-area-id="board-${index + 1}"></div>`
            )).join('')}
          </div>
        </div>
      </section>`;
    const container = document.getElementById('journey-boards-container') as HTMLElement;
    const main = document.getElementById('world-main');
    const unchangedUnit = document.getElementById('unit-3');
    const replacedUnit = document.getElementById('unit-4');
    let releaseFirstPrime!: () => void;
    const firstPrimeGate = new Promise<void>((resolve) => { releaseFirstPrime = resolve; });
    const renderJourneyWorldIncrementally = jest.fn(async () => true);
    const owner: any = {
      journeyTerminalReturnBuild: null,
      journeyV700PreparedWorldEnter: null,
      journeyGameplaySuspension: { surface: container },
      renderDisposed: true,
      renderLifecycleGeneration: 4,
      journeyV700WorldId: 1,
      journeyV700View: 'world',
      container: null,
      resumeForVisibleWorldReturn: jest.fn(function (this: any) {
        if (!this.renderDisposed) return;
        this.journeyGameplaySuspension = null;
        this.renderDisposed = false;
        this.renderLifecycleGeneration += 1;
      }),
      getJourneyWorldRange: () => ({ start: 1, end: 10 }),
      getJourneyV700AnimationUnits: () => Array.from(
        container.querySelectorAll<HTMLElement>('[data-journey-area-id]'),
      ).map((target) => ({ id: target.id, targets: [target], clouds: [] })),
      reconcileMountedJourneyWorldCardUnits: jest.fn((_container: HTMLElement, _worldId: number, reason: string) => {
        if (!reason.includes('first')) return [];
        const current = document.getElementById('unit-4');
        if (!current || current !== replacedUnit) return [];
        const replacement = current.cloneNode(false) as HTMLElement;
        replacement.id = 'unit-4-reconciled';
        current.replaceWith(replacement);
        return [4];
      }),
      getLastActiveJourneyBoardAreaId: () => 0,
      restoreJourneyRetainedReturnCardVisuals: jest.fn(() => true),
      primeJourneyV700WorldEnterIncrementally: jest.fn(async (
        _container: HTMLElement,
        worldId: number,
        ownerToken: number,
      ) => {
        if (ownerToken === -1) await firstPrimeGate;
        const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-journey-area-id]'));
        return {
          worldId,
          renderGeneration: owner.renderLifecycleGeneration,
          ownerToken,
          units: targets.map((target) => ({ id: target.id, targets: [target], clouds: [] })),
          targets,
          cloudsPrimed: true,
        };
      }),
      renderJourneyWorldIncrementally,
      updateJourneyV700Nav: jest.fn(),
      installJourneyScreenElasticOverscroll: jest.fn(),
      installInterimAreaHitTargets: jest.fn(),
      canReuseJourneyInterimHitTargets: jest.fn(() => false),
      trackRAF: jest.fn(),
      setupIdleInteractionListeners: jest.fn(),
      retireJourneyBoardOwnersBeforeDomReplace: jest.fn(),
      logJourneyV700Flow: jest.fn(),
    };
    const bind = (name: string) => {
      const method = methods.get(name)!;
      const code = ts.transpileModule(
        `function run(${method.parameters.map(parameter => parameter.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
        { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
      ).outputText;
      return new Function('emitIOSNativeDiagnostic', 'beginTransitionPerformance', `${code}; return run;`)(
        jest.fn(), () => ({ phase: (_name: string, work: () => unknown) => work(), finish: jest.fn() }),
      ).bind(owner);
    };
    owner.isJourneyTerminalReturnBuildCurrent = bind('isJourneyTerminalReturnBuildCurrent');
    owner.prepareJourneyV700WorldEnterFromReturnIncrementally = bind(
      'prepareJourneyV700WorldEnterFromReturnIncrementally',
    );
    owner.playJourneyV700WorldEnterFromReturn = bind('playJourneyV700WorldEnterFromReturn');
    owner.cancelPreparedJourneyV700WorldEnter = bind('cancelPreparedJourneyV700WorldEnter');
    owner.releaseJourneyReturnPaintWarmLease = jest.fn();
    owner.playJourneyV700WorldEnter = jest.fn(async () => { owner.journeyV700Phase = 'idle'; });
    owner.suspendForGameplay = jest.fn(function (this: any) { this.renderDisposed = true; });

    const first = owner.prepareJourneyV700WorldEnterFromReturnIncrementally('first-return', -1);
    const replacement = owner.prepareJourneyV700WorldEnterFromReturnIncrementally('replacement-return', -2);
    await expect(replacement).resolves.toBe(true);
    releaseFirstPrime();
    await expect(first).resolves.toBe(false);

    expect(renderJourneyWorldIncrementally).not.toHaveBeenCalled();
    expect(document.getElementById('world-main')).toBe(main);
    expect(document.getElementById('unit-3')).toBe(unchangedUnit);
    expect(document.getElementById('unit-4')).toBeNull();
    expect(document.getElementById('unit-4-reconciled')).not.toBe(replacedUnit);
    expect(owner.journeyV700PreparedWorldEnter).toMatchObject({
      ownerToken: -2,
      reusedRetainedSurface: true,
    });
    expect(owner.trackRAF).not.toHaveBeenCalled();
    owner.playJourneyV700WorldEnterFromReturn('game-return-test', { ownerToken: -2 });
    owner.trackRAF.mock.calls.forEach(([callback]: [() => void]) => callback());
    expect(owner.installInterimAreaHitTargets).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(owner.installInterimAreaHitTargets).toHaveBeenCalledTimes(1);
    expect(owner.setupIdleInteractionListeners).toHaveBeenCalledTimes(1);

    owner.cancelPreparedJourneyV700WorldEnter(-1, 'stale-owner');
    expect(owner.journeyV700PreparedWorldEnter.ownerToken).toBe(-2);
    owner.cancelPreparedJourneyV700WorldEnter(-2, 'replacement-cancelled');
    expect(owner.journeyV700PreparedWorldEnter).toBeNull();
    expect(owner.suspendForGameplay).toHaveBeenCalledTimes(1);
  });

  test('incremental retained Beach return normalizes all ten cards before Unit priming', async () => {
    document.body.innerHTML = `
      <section id="journey-screen" hidden class="hidden">
        <div id="journey-boards-container" data-journey-v700-view="world" data-journey-v700-world-id="2">
          <div id="beach-main" data-journey-area-id="beach-main"></div>
          <div class="journey-cards-container">
            ${Array.from({ length: 10 }, (_, index) => {
              const boardId = index + 11;
              return `<div class="journey-board-card-wrapper" data-board-id="${boardId}" data-journey-area-id="board-${boardId}" style="pointer-events:none;transition:none;will-change:transform">
                <div class="journey-board-card unlocked journey-card-tapping" data-board-id="${boardId}" style="transform:scale(0);opacity:0;visibility:hidden;pointer-events:none;transition:none!important;will-change:transform">
                  <img data-card-art="${boardId}" src="forest-${boardId}.png"><svg data-card-svg="${boardId}"><path d="M0 0"></path></svg>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </section>`;
    const container = document.getElementById('journey-boards-container') as HTMLElement;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.journey-board-card'));
    const wrappers = Array.from(container.querySelectorAll<HTMLElement>('.journey-board-card-wrapper'));
    const imageNodes = cards.map((card) => card.querySelector('img'));
    const svgNodes = cards.map((card) => card.querySelector('svg'));
    wrappers.forEach((wrapper, index) => {
      (wrapper as any).__ccJourneyCardTapExitActive = index % 2 === 0;
      (wrapper as any).__ccJourneyToGameExitTween = index % 2 === 1;
    });
    const callOrder: string[] = [];
    const owner: any = {
      journeyTerminalReturnBuild: null,
      journeyV700PreparedWorldEnter: null,
      journeyGameplaySuspension: { surface: container },
      renderDisposed: false,
      renderLifecycleGeneration: 9,
      journeyV700WorldId: 2,
      journeyV700View: 'world',
      container: null,
      resumeForVisibleWorldReturn: jest.fn(),
      getJourneyWorldRange: () => ({ start: 11, end: 20 }),
      getJourneyV700AnimationUnits: () => Array.from(
        container.querySelectorAll<HTMLElement>('[data-journey-area-id]'),
      ).map((target) => ({ id: target.dataset.journeyAreaId, targets: [target], clouds: [] })),
      reconcileMountedJourneyWorldCardUnits: jest.fn(() => {
        callOrder.push('reconcile');
        return [];
      }),
      getLastActiveJourneyBoardAreaId: jest.fn(() => 1),
      isJourneyV700TargetOwnedByRoot: (root: HTMLElement, target: HTMLElement) => root.contains(target),
      isJourneyCardTapExitProtectedTarget: () => false,
      getJourneyBoardCardVisualTarget: (wrapper: HTMLElement) => (
        wrapper.querySelector<HTMLElement>('.journey-board-card') || wrapper
      ),
      primeJourneyV700WorldEnterIncrementally: jest.fn(async (
        _container: HTMLElement,
        worldId: number,
        ownerToken: number,
      ) => {
        callOrder.push('prime-units');
        const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-journey-area-id]'));
        return {
          worldId,
          renderGeneration: owner.renderLifecycleGeneration,
          ownerToken,
          units: targets.map((target) => ({ id: target.dataset.journeyAreaId, targets: [target], clouds: [] })),
          targets,
          cloudsPrimed: true,
        };
      }),
      renderJourneyWorldIncrementally: jest.fn(async () => true),
      updateJourneyV700Nav: jest.fn(),
      installJourneyScreenElasticOverscroll: jest.fn(),
      installInterimAreaHitTargets: jest.fn(),
      trackRAF: jest.fn(),
      setupIdleInteractionListeners: jest.fn(),
      retireJourneyBoardOwnersBeforeDomReplace: jest.fn(),
      logJourneyV700Flow: jest.fn(),
    };
    const bind = (name: string) => {
      const method = methods.get(name)!;
      const code = ts.transpileModule(
        `function run(${method.parameters.map(parameter => parameter.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
        { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
      ).outputText;
      return new Function('emitIOSNativeDiagnostic', `${code}; return run;`)(jest.fn()).bind(owner);
    };
    owner.isJourneyTerminalReturnBuildCurrent = bind('isJourneyTerminalReturnBuildCurrent');
    const restoreMethod = methods.get('restoreJourneyBoardCardVisualTarget')!;
    const restoreCode = ts.transpileModule(
      `function run(${restoreMethod.parameters.map(parameter => parameter.getText(parsed)).join(',')}) ${restoreMethod.body!.getText(parsed)}`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    const restoreJourneyBoardCardVisualTarget = new Function(
      'gsap',
      'restoreJourneyBoardCardBaseTransform',
      `${restoreCode}; return run;`,
    )(
      {
        killTweensOf: jest.fn(),
        set: jest.fn((target: HTMLElement, vars: { clearProps?: string }) => {
          vars.clearProps?.split(',').forEach((property) => target.style.removeProperty(property));
        }),
      },
      jest.fn(),
    ).bind(owner);
    owner.restoreJourneyBoardCardVisualTarget = jest.fn((wrapper: HTMLElement) => {
      restoreJourneyBoardCardVisualTarget(wrapper);
    });
    owner.restoreJourneyRetainedReturnCardVisuals = jest.fn((...args: unknown[]) => {
      callOrder.push('normalize-all-cards');
      return bind('restoreJourneyRetainedReturnCardVisuals')(...args);
    });
    owner.prepareJourneyV700WorldEnterFromReturnIncrementally = bind(
      'prepareJourneyV700WorldEnterFromReturnIncrementally',
    );

    await expect(owner.prepareJourneyV700WorldEnterFromReturnIncrementally(
      'terminal-settled:clean-board',
      -7,
    )).resolves.toBe(true);

    expect(owner.restoreJourneyBoardCardVisualTarget).toHaveBeenCalledTimes(10);
    expect(owner.getLastActiveJourneyBoardAreaId).not.toHaveBeenCalled();
    cards.forEach((card, index) => {
      const wrapper = wrappers[index];
      expect(container.querySelector(`.journey-board-card-wrapper[data-board-id="${index + 11}"]`)).toBe(wrapper);
      expect(card.style.transform).toBe('');
      expect(card.style.opacity).toBe('');
      expect(card.style.visibility).toBe('');
      expect(card.style.pointerEvents).toBe('');
      expect(card.style.transition).toBe('');
      expect(card.style.willChange).toBe('');
      expect(card.classList.contains('journey-card-tapping')).toBe(false);
      expect(wrapper.style.pointerEvents).toBe('');
      expect(wrapper.style.transition).toBe('');
      expect(wrapper.style.willChange).toBe('');
      expect((wrapper as any).__ccJourneyCardTapExitActive).toBeUndefined();
      expect((wrapper as any).__ccJourneyToGameExitTween).toBeUndefined();
      expect(card.querySelector('img')).toBe(imageNodes[index]);
      expect(card.querySelector('svg')).toBe(svgNodes[index]);
    });
    expect(callOrder).toEqual(['reconcile', 'normalize-all-cards', 'prime-units']);
    expect(owner.journeyV700PreparedWorldEnter).toMatchObject({
      ownerToken: -7,
      worldId: 2,
      reusedRetainedSurface: true,
    });

    const normalizeSource = methods.get('restoreJourneyRetainedReturnCardVisuals')!.getText(parsed);
    expect(normalizeSource).not.toMatch(/getComputedStyle|getBoundingClientRect|offset(?:Width|Height)|client(?:Width|Height)/);

    const staleCard = cards[0];
    const staleWrapper = wrappers[0];
    staleCard.style.opacity = '0';
    staleWrapper.style.pointerEvents = 'none';
    (staleWrapper as any).__ccJourneyCardTapExitActive = true;
    const guardedNormalize = bind('restoreJourneyRetainedReturnCardVisuals');
    expect(guardedNormalize(container, 2, () => false)).toBe(false);
    expect(staleCard.style.opacity).toBe('0');
    expect(staleWrapper.style.pointerEvents).toBe('none');
    expect((staleWrapper as any).__ccJourneyCardTapExitActive).toBe(true);
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
      owner[name] = new Function('getJourneySceneUnit', `${code}; return run;`)(
        require('../journey-unit-scene').getJourneySceneUnit,
      ).bind(owner);
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
    expect(owner.waitForJourneyPreparationTurn).toHaveBeenCalledTimes(3);
    expect(owner.journeyV700PreparedWorldEnter).toBeUndefined();
  });

  function deferredPoseFixture(parked = true, retained = true) {
    document.body.innerHTML = '<section id="journey-screen"><div id="journey-boards-container" data-journey-v700-view="world" data-journey-v700-world-id="2"><div id="unit"><i id="cloud"></i></div></div></section>';
    const screen = document.getElementById('journey-screen')!;
    const container = document.getElementById('journey-boards-container')!;
    const target = document.getElementById('unit')!;
    const cloud = document.getElementById('cloud')!;
    const isParked = jest.fn(() => parked);
    const set = jest.fn((targets: HTMLElement | HTMLElement[], vars: { opacity?: number }) => {
      for (const element of Array.isArray(targets) ? targets : [targets]) {
        if (vars.opacity !== undefined) element.style.opacity = String(vars.opacity);
      }
    });
    const owner: any = {
      container,
      renderDisposed: false,
      renderLifecycleGeneration: 3,
      journeyTerminalReturnBuild: { ownerToken: 7, reusedRetainedSurface: retained },
      getLastActiveJourneyBoardAreaId: () => 11,
      getJourneyV700AnimationUnits: () => [{ id: 'board-11', targets: [target], clouds: [cloud] }],
      cleanupJourneyAreaIdleAnimations: jest.fn(),
      waitForJourneyPreparationTurn: jest.fn(async () => true),
      logJourneyV700Flow: jest.fn(),
    };
    const bind = (name: string, asyncMethod = false) => {
      const method = methods.get(name)!;
      const code = ts.transpileModule(`${asyncMethod ? 'async ' : ''}function run(${method.parameters.map(p => p.getText(parsed)).join(',')}) ${method.body!.getText(parsed)}`,
        { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      return new Function('gsap', 'getJourneyV700MotionProfile', 'setJourneyAlienBeamIdleReady', 'restoreJourneyAreaTransformOrigin', 'prepareJourneyWorldTransforms', 'isJourneyViewportParked',
        `${code}; return run;`)({ set }, () => ({ enter: { y: 30, scale: 0.65 } }), jest.fn(), jest.fn(), prepareJourneyWorldTransforms, isParked).bind(owner);
    };
    const prime = bind('primeJourneyV700WorldEnterIncrementally', true);
    const commit = bind('commitPreparedJourneyWorldEnterPose');
    const prepare = async () => {
      const plan = await prime(container, 2, 7, 'deferred-test', () => true, []);
      owner.journeyV700PreparedWorldEnter = plan;
      return plan;
    };
    return { screen, container, target, cloud, owner, set, isParked, prepare, commit };
  }

  test('retained parked artwork stays settled until the exact covered handoff commits cached enter poses once', async () => {
    const f = deferredPoseFixture();
    const plan = await f.prepare();
    expect(plan.enterPoseDeferred).toBe(true);
    expect(f.target.style.opacity).toBe('1');
    expect(f.set).toHaveBeenCalledWith(f.target, expect.objectContaining({ y: 0, scale: 1 }));
    expect(f.set).toHaveBeenCalledWith(f.cloud, { x: 0, force3D: false, overwrite: true });
    f.set.mockClear();
    const query = jest.spyOn(f.container, 'querySelectorAll').mockImplementation(() => { throw new Error('no discovery at handoff'); });
    const rect = jest.spyOn(f.target, 'getBoundingClientRect').mockImplementation(() => { throw new Error('no geometry at handoff'); });
    expect(f.commit(7)).toBe(true);
    expect(f.set).toHaveBeenCalledWith(plan.targets, expect.objectContaining({ y: 30, scale: 0.65, opacity: 0 }));
    expect(f.target.style.opacity).toBe('0');
    expect(plan.enterPoseDeferred).toBe(false);
    expect(plan.deferredEnterPose).toBeUndefined();
    expect(f.commit(7)).toBe(true);
    expect(f.set).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
    expect(rect).not.toHaveBeenCalled();
    expect(f.owner.waitForJourneyPreparationTurn).not.toHaveBeenCalled();
  });

  test.each([[false, true], [true, false]])('unparked or nonretained preparation keeps the existing hidden enter pose (%s/%s)', async (parked, retained) => {
    const f = deferredPoseFixture(parked, retained);
    const plan = await f.prepare();
    expect(plan.enterPoseDeferred).toBe(false);
    expect(f.target.style.opacity).toBe('0');
    expect(f.set).toHaveBeenCalledWith(f.target, expect.objectContaining({ y: 30, scale: 0.65 }));
    f.set.mockClear();
    expect(f.commit(7)).toBe(true);
    expect(f.set).not.toHaveBeenCalled();
  });

  test.each(['token', 'generation', 'disposed', 'container', 'target', 'lease', 'world'])('rejects stale deferred-pose ownership: %s', async (stale) => {
    const f = deferredPoseFixture();
    const plan = await f.prepare();
    f.set.mockClear();
    if (stale === 'generation') f.owner.renderLifecycleGeneration++;
    if (stale === 'disposed') f.owner.renderDisposed = true;
    if (stale === 'container') f.owner.container = document.createElement('div');
    if (stale === 'target') document.body.append(f.target);
    if (stale === 'lease') f.isParked.mockReturnValue(false);
    if (stale === 'world') f.container.dataset.journeyV700WorldId = '3';
    expect(f.commit(stale === 'token' ? 8 : 7)).toBe(false);
    expect(f.set).not.toHaveBeenCalled();
    expect(plan.enterPoseDeferred).toBe(true);
  });

  test('a failed enter-pose write cannot claim the retained targets are primed', async () => {
    const f = deferredPoseFixture();
    const plan = await f.prepare();
    f.set.mockImplementation(() => { throw new Error('pose failure'); });
    expect(f.commit(7)).toBe(false);
    expect(plan.enterPoseDeferred).toBe(true);
    expect(plan.deferredEnterPose).toBeDefined();
  });

  test.each([true, false, 'throws'])('current deferred-pose failure invalidates only its own plan and uses canonical recovery (%s)', (result) => {
    const method = methods.get('recoverPreparedJourneyWorldEnterPose')!;
    const code = ts.transpileModule(`function run(ownerToken) ${method.body!.getText(parsed)}`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const recover = new Function('getJourneyReturnTransitionToken', `${code}; return run;`)(() => 7);
    const oldBuild = { ownerToken: 7, cancelled: false };
    const replacement = { ownerToken: 7, enterPoseDeferred: false };
    const owner: any = {
      journeyV700PreparedWorldEnter: { ownerToken: 7, enterPoseDeferred: true },
      journeyTerminalReturnBuild: oldBuild,
      prepareJourneyV700WorldEnterFromReturn: jest.fn(() => {
        expect(owner.journeyV700PreparedWorldEnter).toBeNull();
        expect(owner.journeyTerminalReturnBuild).toBeNull();
        expect(oldBuild.cancelled).toBe(true);
        if (result === 'throws') throw new Error('recovery failed');
        if (result) owner.journeyV700PreparedWorldEnter = replacement;
        return result;
      }),
    };
    expect(recover.call(owner, 7)).toBe(result === true);
    expect(owner.prepareJourneyV700WorldEnterFromReturn).toHaveBeenCalledWith('deferred-pose-recovery', 7);
    expect(owner.journeyV700PreparedWorldEnter).toBe(result === true ? replacement : null);
  });

  test.each(['route', 'plan', 'build'])('stale deferred recovery cannot mutate another %s owner', (stale) => {
    const method = methods.get('recoverPreparedJourneyWorldEnterPose')!;
    const code = ts.transpileModule(`function run(ownerToken) ${method.body!.getText(parsed)}`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const recover = new Function('getJourneyReturnTransitionToken', `${code}; return run;`)(() => stale === 'route' ? 8 : 7);
    const plan = { ownerToken: stale === 'plan' ? 8 : 7, enterPoseDeferred: true };
    const build = { ownerToken: stale === 'build' ? 8 : 7, cancelled: false };
    const owner = { journeyV700PreparedWorldEnter: plan, journeyTerminalReturnBuild: build, prepareJourneyV700WorldEnterFromReturn: jest.fn() };
    expect(recover.call(owner, 7)).toBe(false);
    expect(owner.journeyV700PreparedWorldEnter).toBe(plan);
    expect(owner.journeyTerminalReturnBuild).toBe(build);
    expect(build.cancelled).toBe(false);
    expect(owner.prepareJourneyV700WorldEnterFromReturn).not.toHaveBeenCalled();
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

  test.each([false, true])('pressure preserves the parked World when optional preparation is ready=%s', ready => {
    document.body.innerHTML = '<section id="journey-screen" hidden><div id="journey-boards-container"><i></i></div></section>';
    const container = document.getElementById('journey-boards-container')!;
    const child = container.firstElementChild;
    const method = methods.get('cancelOptionalJourneyTerminalReturnPreparation')!;
    const code = ts.transpileModule(`function run(reason) ${method.body!.getText(parsed)}`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const run = new Function('emitIOSNativeDiagnostic', `${code}; return run;`)(jest.fn());
    const owner: any = {
      journeyTerminalReturnBuild: { ownerToken: -7, worldId: 3, reusedRetainedSurface: true },
      journeyV700PreparedWorldEnter: ready ? { ownerToken: -7, worldId: 3, reusedRetainedSurface: true } : null,
      suspendForGameplay: jest.fn(),
    };
    run.call(owner, 'memory-warning');
    expect(container.firstElementChild).toBe(child);
    expect(owner.journeyV700PreparedWorldEnter).toBeNull();
    expect(owner.journeyTerminalReturnBuild).toBeNull();
    expect(owner.suspendForGameplay).toHaveBeenCalledTimes(1);
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
