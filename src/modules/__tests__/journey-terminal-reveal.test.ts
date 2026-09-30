import fs from 'node:fs';
import ts from 'typescript';
import { gsap } from 'gsap';
import {
  beginJourneyReturnTransition,
  cancelJourneyReturnTransition,
  completeJourneyReturnTransition,
  getJourneyReturnRevealToken,
  markJourneyReturnResultExitComplete,
  cancelJourneyReturnPrewarm,
  prewarmJourneyReturnBeforeTerminalExit,
  prepareJourneyReturnBehindTerminalOverlay,
  measureJourneyReturnPreparationPhase,
  finishJourneyReturnCtaSetup,
  scheduleJourneyReturnReveal,
} from '../journey-return-transition-trace';
import { JourneyWorldAnimationCoordinator } from '../journey-world-animation-coordinator';
import { getJourneyV700MotionProfile } from '../journey-v700-motion';
import { journeyBoardsManager } from '../journey-boards-manager';
import type { JourneyTerminalPreparationPerformance } from '../journey-terminal-preparation-performance';

jest.mock('../journey-boards-manager', () => ({
  journeyBoardsManager: {
    prepareJourneyV700WorldEnterFromReturn: jest.fn(),
    cancelPreparedJourneyV700WorldEnter: jest.fn(),
  },
}));

const flushImports = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('terminal-owned Journey reveal', () => {
  afterEach(() => {
    completeJourneyReturnTransition();
  });

  test.each(['clean-board', 'fail'] as const)('%s releases both reveal boundaries only after its visual exit completes', (source) => {
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

  test('prepares ordinary Journey returns before result completion and drops replaced async preparation', async () => {
    const token = beginJourneyReturnTransition('clean-board', 22);
    prepareJourneyReturnBehindTerminalOverlay('clean-board', token);
    await flushImports();
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn)
      .toHaveBeenCalledWith('terminal-overlay:clean-board', token, null);
    expect(getJourneyReturnRevealToken()).toBeNull();
    const stale = beginJourneyReturnTransition('fail', 23);
    prepareJourneyReturnBehindTerminalOverlay('fail', stale);
    beginJourneyReturnTransition('clean-board', 24);
    await flushImports();
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).toHaveBeenCalledTimes(1);
  });

  test('settled-result prewarm builds cold World DOM without acquiring the visible paint lease', async () => {
    jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).mockReturnValueOnce(true);
    await expect(prewarmJourneyReturnBeforeTerminalExit('clean-board', 22)).resolves.toBe(true);
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).toHaveBeenCalledWith(
      'terminal-settled:clean-board',
      expect.any(Number),
      null,
      { warmPaint: false },
    );
    const prepareCalls = jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).mock.calls;
    const prewarmOwnerToken = prepareCalls[prepareCalls.length - 1]?.[1] as number;
    expect(prewarmOwnerToken).toBeLessThan(0);

    cancelJourneyReturnPrewarm('test-cleanup');
    await flushImports();
    expect(journeyBoardsManager.cancelPreparedJourneyV700WorldEnter)
      .toHaveBeenCalledWith(prewarmOwnerToken, 'test-cleanup');
  });

  test('accepted transition abort retires both its token and its adopted prewarm plan', async () => {
    jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).mockReturnValueOnce(true);
    await prewarmJourneyReturnBeforeTerminalExit('clean-board', 22);
    const prepareCalls = jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).mock.calls;
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
    let preparation: JourneyTerminalPreparationPerformance | null = null;
    jest.mocked(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).mockImplementation((_source, _id, capture) => {
      preparation = capture;
      capture?.phase('prime', () => { now += 40; });
      return true;
    });
    try {
      const token = beginJourneyReturnTransition('clean-board', 25);
      prepareJourneyReturnBehindTerminalOverlay('clean-board', token);
      expect(measureJourneyReturnPreparationPhase(token, 'star-exit-setup', () => { now += 9; return 42; })).toBe(42);
      finishJourneyReturnCtaSetup(token);
      await flushImports();
      preparation!.finish('painted');
      const records = postMessage.mock.calls.filter(([entry]) => entry.message.startsWith('[CC_JOURNEY_RETURN_PREP]'));
      expect(records).toHaveLength(1);
      const record = JSON.parse(records[0][0].message.split('summary ')[1]);
      expect(record.phases).toEqual([
        { name: 'module-requested', atMs: 0, durationMs: 0 },
        { name: 'star-exit-setup', atMs: 0, durationMs: 9 },
        { name: 'cta-synchronous', atMs: 0, durationMs: 9 },
        { name: 'module-ready', atMs: 9, durationMs: 0 },
        { name: 'prime', atMs: 9, durationMs: 40 },
        { name: 'prepare-synchronous', atMs: 9, durationMs: 40 },
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
        expect.objectContaining({ transitionId: old, reason: 'replaced' }),
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
describe('primed terminal World shell', () => {
  test.each([false, true])('immediate reveal %s leaves Unit start state untouched', async (immediate) => {
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
      animateJourneyContent: false,
      revealPrimedWorldImmediately: immediate,
    });
    expect(screen.style.opacity).toBe(immediate ? '1' : '0');
    expect(screen.style.pointerEvents).toBe('none');
    expect(unit.style.opacity).toBe('0');
    expect(unit.style.transform).toBe('scale(0.65)');
    expect(tweens[0].duration).toBe(immediate ? 0 : 0.24);
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

  test('prewarms only the non-Arcade secondary CTA after its authored entrance', () => {
    const source = fs.readFileSync('src/modules/clean-board-modal.ts', 'utf8');
    const animateSource = source.split('const animateButtonIn = (button: HTMLButtonElement) => {')[1]
      .split('const buttonExitDurationMs')[0];
    expect(animateSource).toContain('button === secondaryBtn && !isArcadeHomeRun');
    expect(animateSource.indexOf('await prewarmJourneyReturnBeforeTerminalExit'))
      .toBeGreaterThan(animateSource.indexOf('void enterPromise.then'));
    expect(animateSource).toContain("prewarmJourneyReturnBeforeTerminalExit('clean-board', boardNumber)");
  });
});
