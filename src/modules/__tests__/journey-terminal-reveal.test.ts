import fs from 'node:fs';
import ts from 'typescript';
import { gsap } from 'gsap';
import {
  beginJourneyReturnTransition,
  cancelJourneyReturnTransition,
  completeJourneyReturnTransition,
  getJourneyReturnRevealToken,
  getJourneyReturnTransitionToken,
  markJourneyReturnDestinationVisibleReady,
  markJourneyReturnResultExitComplete,
  cancelJourneyReturnPrewarm,
  prewarmJourneyReturnBeforeTerminalExit,
  prepareJourneyReturnBehindTerminalOverlay,
  measureJourneyReturnPreparationPhase,
  finishJourneyReturnCtaSetup,
  scheduleJourneyReturnReveal,
  transferJourneyReturnStaticCover,
  waitForJourneyReturnDestination,
} from '../journey-return-transition-trace';
import { JourneyWorldAnimationCoordinator } from '../journey-world-animation-coordinator';
import { getJourneyV700MotionProfile } from '../journey-v700-motion';
import { journeyBoardsManager } from '../journey-boards-manager';

jest.mock('../journey-boards-manager', () => ({
  journeyBoardsManager: {
    prepareJourneyV700WorldEnterFromReturn: jest.fn(),
    prepareJourneyV700WorldEnterFromReturnIncrementally: jest.fn(),
    adoptPreparedJourneyV700WorldEnter: jest.fn(),
    waitForPreparedJourneyV700WorldEnter: jest.fn(),
    cancelPreparedJourneyV700WorldEnter: jest.fn(),
  },
}));

const flushImports = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('terminal-owned Journey reveal', () => {
  beforeEach(() => {
    jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally).mockResolvedValue(true);
    jest.mocked(journeyBoardsManager.adoptPreparedJourneyV700WorldEnter).mockReturnValue(false);
    jest.mocked(journeyBoardsManager.waitForPreparedJourneyV700WorldEnter).mockResolvedValue(true);
  });

  afterEach(() => {
    completeJourneyReturnTransition();
  });

  test.each(['clean-board', 'fail', 'exit-game'] as const)('%s releases both reveal boundaries only after its visual exit completes', (source) => {
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const token = beginJourneyReturnTransition(source, 22);
    expect(getJourneyReturnRevealToken()).toBeNull();
    markJourneyReturnResultExitComplete(token);
    expect(getJourneyReturnRevealToken()).toBe(token);
    const paint = jest.fn();
    scheduleJourneyReturnReveal(token, () => true, () => {
      scheduleJourneyReturnReveal(token, () => true, paint);
    });
    expect(paint).toHaveBeenCalledTimes(1);
    expect(raf).not.toHaveBeenCalled();
  });

  test('transferred terminal paper releases one queued reveal only after the prepared Journey commit', async () => {
    jest.useFakeTimers();
    let frame: FrameRequestCallback = () => {};
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    const token = beginJourneyReturnTransition('clean-board', 22);
    const cover = document.createElement('div');
    document.body.append(cover);
    const reveal = jest.fn();

    expect(getJourneyReturnTransitionToken()).toBe(token);
    expect(transferJourneyReturnStaticCover(token, cover, 140)).toBe(true);
    scheduleJourneyReturnReveal(token, () => true, reveal);
    expect(reveal).not.toHaveBeenCalled();
    expect(cover.isConnected).toBe(true);

    markJourneyReturnDestinationVisibleReady(token);
    await flushImports();
    expect(reveal).not.toHaveBeenCalled();
    frame(16);
    expect(cover.style.opacity).toBe('0');
    jest.advanceTimersByTime(139);
    expect(reveal).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(cover.isConnected).toBe(false);
    expect(getJourneyReturnRevealToken()).toBe(token);
    expect(reveal).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('cancelled transferred cover cannot reveal or outlive its transition', () => {
    jest.useFakeTimers();
    jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const token = beginJourneyReturnTransition('clean-board', 22);
    const cover = document.createElement('div');
    document.body.append(cover);
    const reveal = jest.fn();
    transferJourneyReturnStaticCover(token, cover, 140);
    scheduleJourneyReturnReveal(token, () => true, reveal);

    cancelJourneyReturnTransition(token, 'test-cancel-cover');
    jest.runOnlyPendingTimers();

    expect(cover.isConnected).toBe(false);
    expect(reveal).not.toHaveBeenCalled();
    expect(getJourneyReturnTransitionToken()).toBeNull();
    jest.useRealTimers();
  });

  test('cold entry retains its paint boundary and retired presentation cannot reveal', () => {
    let frame: FrameRequestCallback = () => {};
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    const paint = jest.fn();
    let current = true;
    scheduleJourneyReturnReveal(null, () => current, paint);
    expect(paint).not.toHaveBeenCalled();
    current = false;
    frame(16);
    expect(paint).not.toHaveBeenCalled();
    scheduleJourneyReturnReveal(null, () => true, paint);
    frame(32);
    expect(paint).toHaveBeenCalledTimes(1);
  });

  test('cold reveal preserves its paint boundary and rechecks ownership', () => {
    const frames: FrameRequestCallback[] = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.push(callback);
      return frames.length;
    });
    const paint = jest.fn();
    scheduleJourneyReturnReveal(null, () => true, () => {
      scheduleJourneyReturnReveal(null, () => true, paint);
    });
    expect(paint).not.toHaveBeenCalled();
    frames[0](16);
    expect(paint).not.toHaveBeenCalled();
    frames[1](32);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(2);
    scheduleJourneyReturnReveal(null, () => false, paint);
    frames[2](48);
    expect(paint).toHaveBeenCalledTimes(1);
  });

  test('same-turn commit still cannot bypass the terminal exit owner', async () => {
    const token = beginJourneyReturnTransition('fail', 11);
    const paint = jest.fn();
    scheduleJourneyReturnReveal(token, () => true, paint);
    expect(paint).not.toHaveBeenCalled();
    markJourneyReturnResultExitComplete(token);
    expect(paint).toHaveBeenCalledTimes(1);
    cancelJourneyReturnTransition(token, 'test-complete');
    await flushImports();
  });

  test('a replaced or cancelled result cannot release a newer return', async () => {
    const oldToken = beginJourneyReturnTransition('clean-board', 22);
    const token = beginJourneyReturnTransition('fail', 23);
    markJourneyReturnResultExitComplete(oldToken);
    expect(getJourneyReturnRevealToken()).toBeNull();
    markJourneyReturnResultExitComplete(token);
    const paint = jest.fn();
    scheduleJourneyReturnReveal(oldToken, () => true, paint);
    scheduleJourneyReturnReveal(token, () => false, paint);
    expect(paint).not.toHaveBeenCalled();
    cancelJourneyReturnTransition(token, 'test-navigation');
    scheduleJourneyReturnReveal(token, () => true, paint);
    expect(paint).not.toHaveBeenCalled();
    await flushImports();
  });

  test('a late World completion cannot clear a newer terminal return', () => {
    const oldToken = beginJourneyReturnTransition('clean-board', 22);
    const currentToken = beginJourneyReturnTransition('fail', 23);
    markJourneyReturnResultExitComplete(currentToken);

    completeJourneyReturnTransition({ source: 'late-old-enter' }, oldToken);
    expect(getJourneyReturnRevealToken()).toBe(currentToken);

    completeJourneyReturnTransition({ source: 'ordinary-world-enter' }, null);
    expect(getJourneyReturnRevealToken()).toBe(currentToken);

    completeJourneyReturnTransition({ source: 'current-enter' }, currentToken);
    expect(getJourneyReturnRevealToken()).toBeNull();
  });

  test('cold return joins the bounded builder and drops replaced async preparation', async () => {
    const token = beginJourneyReturnTransition('clean-board', 22);
    prepareJourneyReturnBehindTerminalOverlay('clean-board', token);
    await flushImports();
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).not.toHaveBeenCalled();
    markJourneyReturnResultExitComplete(token);
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally)
      .toHaveBeenCalledWith('terminal-overlay:clean-board', token);
    await expect(waitForJourneyReturnDestination(token)).resolves.toBe(true);
    expect(getJourneyReturnRevealToken()).toBe(token);
    const stale = beginJourneyReturnTransition('fail', 23);
    prepareJourneyReturnBehindTerminalOverlay('fail', stale);
    beginJourneyReturnTransition('clean-board', 24);
    await flushImports();
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).not.toHaveBeenCalled();
  });

  test('runs a late-imported cold fallback immediately when visual Exit already completed', async () => {
    const token = beginJourneyReturnTransition('fail', 22);
    prepareJourneyReturnBehindTerminalOverlay('fail', token);
    markJourneyReturnResultExitComplete(token);
    await flushImports();

    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally)
      .toHaveBeenCalledWith('terminal-overlay:fail', token);
  });

  test('pressure-cancelled prewarm uses a required bounded build; reveal readiness waits for it', async () => {
    await prewarmJourneyReturnBeforeTerminalExit('clean-board', 22);
    jest.mocked(journeyBoardsManager.waitForPreparedJourneyV700WorldEnter).mockResolvedValueOnce(false);
    let finish!: (ready: boolean) => void;
    jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally)
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const token = beginJourneyReturnTransition('clean-board', 22);
    prepareJourneyReturnBehindTerminalOverlay('clean-board', token);
    await flushImports();
    markJourneyReturnResultExitComplete(token);
    let revealed = false;
    const ready = waitForJourneyReturnDestination(token).then(value => { revealed = value; });
    await flushImports();
    expect(revealed).toBe(false);
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).not.toHaveBeenCalled();
    finish(true);
    await ready;
    expect(revealed).toBe(true);
  });

  test('late preparation completion cannot release a replaced route', async () => {
    let finish!: (ready: boolean) => void;
    jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally)
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const token = beginJourneyReturnTransition('clean-board', 22);
    prepareJourneyReturnBehindTerminalOverlay('clean-board', token);
    await flushImports();
    const ready = waitForJourneyReturnDestination(token);
    cancelJourneyReturnTransition(token, 'navigation');
    finish(true);
    await expect(ready).resolves.toBe(false);
  });

  test('settled-result prewarm prepares reusable World metadata without hidden painting', async () => {
    await expect(prewarmJourneyReturnBeforeTerminalExit('clean-board', 22)).resolves.toBe(true);
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally).toHaveBeenCalledWith(
      'terminal-settled:clean-board',
      expect.any(Number),
    );
    const prepareCalls = jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally).mock.calls;
    const prewarmOwnerToken = prepareCalls[prepareCalls.length - 1]?.[1] as number;
    expect(prewarmOwnerToken).toBeLessThan(0);

    cancelJourneyReturnPrewarm('test-cleanup');
    await flushImports();
    expect(journeyBoardsManager.cancelPreparedJourneyV700WorldEnter)
      .toHaveBeenCalledWith(prewarmOwnerToken, 'test-cleanup');
  });

  test('accepted transition abort retires both its token and its adopted prewarm plan', async () => {
    await prewarmJourneyReturnBeforeTerminalExit('clean-board', 22);
    const prepareCalls = jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally).mock.calls;
    const prewarmOwnerToken = prepareCalls[prepareCalls.length - 1]?.[1] as number;
    const transitionToken = beginJourneyReturnTransition('clean-board', 22);

    cancelJourneyReturnTransition(transitionToken, 'test-abort-before-adoption');
    await flushImports();

    expect(journeyBoardsManager.cancelPreparedJourneyV700WorldEnter)
      .toHaveBeenCalledWith(transitionToken, 'test-abort-before-adoption');
    expect(journeyBoardsManager.cancelPreparedJourneyV700WorldEnter)
      .toHaveBeenCalledWith(prewarmOwnerToken, 'test-abort-before-adoption');
  });

  test('opt-in CTA and module phases share one bounded return record', async () => {
    jest.useFakeTimers();
    let now = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    const postMessage = jest.fn();
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    (window as any).__ccPerformanceDiagnostics = true;
    jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally).mockImplementation(async () => {
      now += 40;
      return true;
    });
    try {
      const token = beginJourneyReturnTransition('clean-board', 25);
      prepareJourneyReturnBehindTerminalOverlay('clean-board', token);
      expect(measureJourneyReturnPreparationPhase(token, 'star-exit-setup', () => { now += 9; return 42; })).toBe(42);
      finishJourneyReturnCtaSetup(token);
      await flushImports();
      markJourneyReturnResultExitComplete(token);
      await waitForJourneyReturnDestination(token);
      completeJourneyReturnTransition();
      const records = postMessage.mock.calls.filter(([entry]) => entry.message.startsWith('[CC_JOURNEY_RETURN_PREP]'));
      expect(records).toHaveLength(1);
      const record = JSON.parse(records[0][0].message.split('summary ')[1]);
      expect(record.phases).toEqual([
        { name: 'module-requested', atMs: 0, durationMs: 0 },
        { name: 'star-exit-setup', atMs: 0, durationMs: 9 },
        { name: 'cta-synchronous', atMs: 0, durationMs: 9 },
        { name: 'module-ready', atMs: 9, durationMs: 0 },
        { name: 'prepare-returned', atMs: 49, durationMs: 0 },
      ]);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      completeJourneyReturnTransition();
      delete (window as any).__ccPerformanceDiagnostics;
      delete (window as any).webkit;
      jest.clearAllTimers(); jest.useRealTimers();
    }
  });

  test('accepted Exit adopts the fully prepared surface without rerendering or re-priming it', async () => {
    await prewarmJourneyReturnBeforeTerminalExit('clean-board', 22);
    const prewarmCalls = jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally).mock.calls;
    const prewarmOwnerToken = prewarmCalls[prewarmCalls.length - 1]?.[1] as number;
    jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).mockClear();
    jest.mocked(journeyBoardsManager.adoptPreparedJourneyV700WorldEnter).mockReturnValueOnce(true);

    const token = beginJourneyReturnTransition('clean-board', 22);
    prepareJourneyReturnBehindTerminalOverlay('clean-board', token);
    await flushImports();

    expect(journeyBoardsManager.adoptPreparedJourneyV700WorldEnter)
      .toHaveBeenCalledWith(prewarmOwnerToken, token, null);
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).not.toHaveBeenCalled();
  });

  test('prepared return needs no second paint pass before result release', async () => {
    await prewarmJourneyReturnBeforeTerminalExit('clean-board', 22);
    const prewarmCalls = jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally).mock.calls;
    const prewarmOwnerToken = prewarmCalls[prewarmCalls.length - 1]?.[1] as number;
    jest.mocked(journeyBoardsManager.adoptPreparedJourneyV700WorldEnter).mockReturnValueOnce(true);

    const token = beginJourneyReturnTransition('clean-board', 22);
    prepareJourneyReturnBehindTerminalOverlay('clean-board', token);
    await flushImports();
    await expect(waitForJourneyReturnDestination(token)).resolves.toBe(true);

    expect(journeyBoardsManager.adoptPreparedJourneyV700WorldEnter)
      .toHaveBeenCalledWith(prewarmOwnerToken, token, null);
    expect(getJourneyReturnRevealToken()).toBeNull();
    markJourneyReturnResultExitComplete(token);
    expect(getJourneyReturnRevealToken()).toBe(token);
  });

  test('tutorial Hub completion retires its token before the next manual game exit', async () => {
    const tutorial = beginJourneyReturnTransition('exit-game', 1);
    markJourneyReturnResultExitComplete(tutorial);
    completeJourneyReturnTransition({ destination: 'hub' }, tutorial);
    expect(getJourneyReturnTransitionToken()).toBeNull();
    const next = beginJourneyReturnTransition('exit-game', 11);
    prepareJourneyReturnBehindTerminalOverlay('exit-game', next);
    await flushImports();
    await expect(waitForJourneyReturnDestination(next)).resolves.toBe(true);
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally)
      .toHaveBeenLastCalledWith('terminal-overlay:exit-game', next);
    completeJourneyReturnTransition({ destination: 'hub' }, tutorial);
    expect(getJourneyReturnTransitionToken()).toBe(next);
    const source = fs.readFileSync('src/collectibles-manager.ts', 'utf8');
    const complete = source.split("journeyEnterPerformance.finish('visible-enter-complete');")[1]
      .split('visibleEnterLease.settle();')[0];
    expect(complete).toContain('!shouldUseV700WorldReturnEnter && pendingTerminalReturnToken !== null');
    expect(complete).toContain("completeJourneyReturnTransition({ destination: 'hub' }, pendingTerminalReturnToken)");
  });

  test('parking releases under the terminal cover before publishing a committed destination', () => {
    const source = fs.readFileSync('src/collectibles-manager.ts', 'utf8');
    const release = source.indexOf('releaseJourneyViewportParking(screen as HTMLElement, true)');
    const commit = source.indexOf('const committed = commitPreparedJourneyViewportBehindTerminalCover()');
    const receipt = source.indexOf('if (committed) markJourneyReturnDestinationVisibleReady(terminalReturnToken)');
    expect(release).toBeGreaterThan(0);
    expect(commit).toBeGreaterThan(release);
    expect(receipt).toBeGreaterThan(commit);
  });

  test('late destination preparation never extends a settled terminal cover', async () => {
    let finish!: (ready: boolean) => void;
    jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally)
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const token = beginJourneyReturnTransition('fail', 23);
    prepareJourneyReturnBehindTerminalOverlay('fail', token);
    await flushImports();

    markJourneyReturnResultExitComplete(token);
    expect(getJourneyReturnRevealToken()).toBe(token);
    finish(true);
    await expect(waitForJourneyReturnDestination(token)).resolves.toBe(true);
  });

  test('replacement and cancellation close only their own diagnostic captures', async () => {
    jest.useFakeTimers();
    const postMessage = jest.fn();
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
    (window as any).__ccPerformanceDiagnostics = true;
    try {
      const old = beginJourneyReturnTransition('clean-board', 25);
      prepareJourneyReturnBehindTerminalOverlay('clean-board', old);
      const current = beginJourneyReturnTransition('fail', 26);
      cancelJourneyReturnTransition(old, 'stale');
      expect(jest.getTimerCount()).toBe(1);
      cancelJourneyReturnTransition(current, 'navigation');
      await flushImports();
      const records = postMessage.mock.calls.filter(([entry]) => entry.message.startsWith('[CC_JOURNEY_RETURN_PREP]'))
        .map(([entry]) => JSON.parse(entry.message.split('summary ')[1]));
      expect(records).toEqual([
        expect.objectContaining({ transitionId: old, reason: 'cancelled:replaced' }),
        expect.objectContaining({ transitionId: current, reason: 'cancelled:navigation' }),
      ]);
      expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      completeJourneyReturnTransition();
      delete (window as any).__ccPerformanceDiagnostics;
      delete (window as any).webkit;
      jest.clearAllTimers(); jest.useRealTimers();
    }
  });
});

describe('real Journey Unit timeline after terminal exit', () => {
  test.each([false, true])('removes only empty lead-in, with reduced motion %s', async (reduced) => {
    const coordinator = new JourneyWorldAnimationCoordinator();
    const targets = [document.createElement('div'), document.createElement('div')];
    targets.forEach((target) => document.body.append(target));
    const units = targets.map((target, index) => ({
      id: index === 0 ? 'robo-main' : 'area-22', targets: [target], clouds: [],
      enterDelayOffset: index === 0 ? 0.02 : 0.12,
    }));
    const owner = coordinator as unknown as { activeTimeline: gsap.core.Timeline };
    const normal = coordinator.enter(units, reduced);
    const normalTimeline = owner.activeTimeline;
    normalTimeline.pause();
    const normalTweens = normalTimeline.getChildren(false, true, false);
    const baseline = normalTweens.map((tween) => ({ start: tween.startTime(), duration: tween.duration() }));
    expect(baseline[0].start).toBeCloseTo(getJourneyV700MotionProfile(reduced).enter.baseDelay + 0.02);
    coordinator.stop();
    await normal;
    const immediate = coordinator.enter(units, reduced, { immediateFirstUnit: true });
    owner.activeTimeline.pause();
    const tweens = owner.activeTimeline.getChildren(false, true, false);
    expect(tweens[0].startTime()).toBe(0);
    expect(tweens[1].startTime()).toBeCloseTo(0.1);
    expect(tweens.map((tween) => tween.duration())).toEqual(baseline.map((tween) => tween.duration));
    expect(tweens[1].startTime() - tweens[0].startTime()).toBeCloseTo(baseline[1].start - baseline[0].start);
    coordinator.stop();
    await immediate;
    targets.forEach((target) => target.remove());
  });
});

// Execute the real viewport owner with only its tween scheduler injected.
// This verifies shell visibility independently of the Unit's zero-opacity prime.
describe('primed Journey shell', () => {
  test.each([false, true])('content animation %s preserves the primed-return shell policy and Unit start state', async (animateContent) => {
    const source = ts.createSourceFile('collectibles-animations.ts',
      fs.readFileSync('src/ui/collectibles-animations.ts', 'utf8'), ts.ScriptTarget.Latest, true);
    const owner = source.statements.find((node) => ts.isFunctionDeclaration(node)
      && node.name?.text === 'animateJourneyViewportScreenEnter')!;
    const compiled = ts.transpileModule(owner.getText(source), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const tweens: gsap.TweenVars[] = [];
    const animate = new Function('gsap', 'window', 'trackTween',
      'prepareJourneyViewportScreenEnter', 'selectJourneyViewportEnterTargets',
      `${compiled}; return animateJourneyViewportScreenEnter;`)(
      gsap, window, (_target: unknown, vars: gsap.TweenVars) => tweens.push(vars),
      () => {}, () => [],
    ) as (screen: HTMLElement, header: null, scrollable: null,
      options: { animateJourneyContent: boolean; revealPrimedWorldImmediately: boolean }) => Promise<void>;
    const screen = document.createElement('section');
    const unit = document.createElement('div');
    unit.style.opacity = '0';
    unit.style.transform = 'scale(0.65)';
    screen.append(unit);
    document.body.append(screen);
    const pending = animate(screen, null, null, {
      animateJourneyContent: animateContent,
      revealPrimedWorldImmediately: !animateContent,
    });
    expect(screen.style.opacity).toBe(animateContent ? '0' : '1');
    expect(screen.style.pointerEvents).toBe('none');
    expect(unit.style.opacity).toBe('0');
    expect(unit.style.transform).toBe('scale(0.65)');
    expect(tweens).toHaveLength(1);
    expect(tweens[0].duration).toBe(animateContent ? 0.24 : 0);
    tweens.forEach((vars) => vars.onComplete?.());
    await pending;
    expect(screen.style.pointerEvents).toBe('');
    screen.remove();
  });
});

describe('Clean Board Exit preparation routing', () => {
  test('arms CTA, board and modal exits synchronously before deferred Journey preparation', () => {
    const source = fs.readFileSync('src/modules/clean-board-modal.ts', 'utf8');
    const handler = source.split('addButtonPressHandling(secondaryBtn, async () => {')[1]
      .split('// 🔥 EXIT FIX: Clear board save state')[0];
    const ctaIndex = handler.indexOf('const ctaExitPromise = exitCtaPair(secondaryBtn, primaryBtn);');
    const boardIndex = handler.indexOf('(window as any).animateBoardExit()');
    const modalFrameIndex = handler.indexOf('trackAnimationFrame(() => {', boardIndex);
    const prepareIndex = handler.indexOf("prepareJourneyReturnBehindTerminalOverlay('clean-board'");

    expect(ctaIndex).toBeGreaterThan(-1);
    expect(boardIndex).toBeGreaterThan(ctaIndex);
    expect(modalFrameIndex).toBeGreaterThan(boardIndex);
    expect(prepareIndex).toBeGreaterThan(modalFrameIndex);
    const executablePrefix = handler.slice(0, prepareIndex).replace(/\/\/.*$/gm, '');
    expect(executablePrefix).not.toMatch(/\bawait\s+/);
    expect(handler.slice(modalFrameIndex, prepareIndex).match(/trackAnimationFrame\(\(\) => \{/g))
      .toHaveLength(2);
  });

  test('prepares every Journey destination after bonus counting without disabling Exit', () => {
    const source = fs.readFileSync('src/modules/clean-board-modal.ts', 'utf8');
    const animateSource = source.split('const animateButtonIn = (button: HTMLButtonElement) => {')[1]
      .split('const buttonExitDurationMs')[0];
    const countingPrewarm = source.split('// Journey owns this preparation')[1]
      .split('// 🎯 SEQUENCE 3: Combo Bonus pop-in')[0];

    expect(countingPrewarm).toContain("prewarmJourneyReturnBeforeTerminalExit('clean-board', boardNumber)");
    expect(countingPrewarm).toContain('JOURNEY_RETURN_PREWARM_AFTER_COUNTERS_MS');
    expect(countingPrewarm.match(/trackAnimationFrame\(\(\) => \{/g)).toHaveLength(2);
    expect(source).toContain('const JOURNEY_RETURN_PREWARM_AFTER_COUNTERS_MS = 6150;');
    expect(source).not.toContain("celebrationTheme !== 'area55'");
    expect(animateSource).not.toContain('button.disabled = true');
    expect(animateSource).not.toContain("button.setAttribute('aria-busy'");
  });

  test('keeps live celebration pixels advancing while the prepared return is adopted', () => {
    const source = fs.readFileSync('src/modules/clean-board-modal.ts', 'utf8');
    const handler = source.split('addButtonPressHandling(secondaryBtn, async () => {')[1]
      .split('// 🔥 EXIT FIX: Clear board save state')[0];
    expect(handler).toContain('beginCelebrationParticleExit();');
    expect(handler).toContain("prepareJourneyReturnBehindTerminalOverlay('clean-board'");
  });

  test('terminal exits do not schedule a second connected full-alpha paint pass', () => {
    for (const file of ['clean-board-modal', 'board-fail-modal']) {
      const source = fs.readFileSync('src/modules/' + file + '.ts', 'utf8');
      expect(source).not.toContain('warmJourneyReturnBehindSettledTerminal');
      expect(source).toContain('markJourneyReturnResultExitComplete(');
    }
    expect(fs.readFileSync('src/modules/clean-board-modal.ts', 'utf8')).toContain('transferJourneyReturnStaticCover(');
  });
});
