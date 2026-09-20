import fs from 'node:fs';
import ts from 'typescript';
import { gsap } from 'gsap';
import {
  beginJourneyReturnTransition,
  cancelJourneyReturnTransition,
  completeJourneyReturnTransition,
  getJourneyReturnRevealToken,
  markJourneyReturnResultExitComplete,
  prepareJourneyReturnBehindTerminalOverlay,
  scheduleJourneyReturnReveal,
} from '../journey-return-transition-trace';
import { JourneyWorldAnimationCoordinator } from '../journey-world-animation-coordinator';
import { getJourneyV700MotionProfile } from '../journey-v700-motion';
import { journeyBoardsManager } from '../journey-boards-manager';

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

  test('prepares ordinary Journey returns before result completion and drops replaced async preparation', async () => {
    const token = beginJourneyReturnTransition('clean-board', 22);
    prepareJourneyReturnBehindTerminalOverlay('clean-board', token);
    await flushImports();
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn)
      .toHaveBeenCalledWith('terminal-overlay:clean-board', token);
    expect(getJourneyReturnRevealToken()).toBeNull();
    const stale = beginJourneyReturnTransition('fail', 23);
    prepareJourneyReturnBehindTerminalOverlay('fail', stale);
    beginJourneyReturnTransition('clean-board', 24);
    await flushImports();
    expect(journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn).toHaveBeenCalledTimes(1);
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
  test.each([[false, false, 1], [false, true, 1], [true, false, 0]])(
    'prepares accepted Journey Exit once: arcade=%s interim=%s',
    (arcade, interim, calls) => {
      const source = fs.readFileSync('src/modules/clean-board-modal.ts', 'utf8');
      const prefix = source.split('addButtonPressHandling(secondaryBtn, async () => {')[1]
        .split('cleanupCelebrationParticlesImmediately();')[0];
      const compiled = ts.transpileModule(prefix, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText;
      const prepare = jest.fn();
      const activate = new Function('isArcadeHomeRun', 'isFromInterimBoard',
        'beginJourneyReturnTransition', 'prepareJourneyReturnBehindTerminalOverlay',
        'markJourneyGameOrigin', 'window', 'localStorage',
        `let journeyReturnTransitionId = null; const boardNumber = 22; ${compiled}`);
      activate(arcade, interim, () => 5, prepare, () => {}, window, localStorage);
      expect(prepare).toHaveBeenCalledTimes(calls as number);
      if (calls) expect(prepare).toHaveBeenCalledWith('clean-board', 5);
      ['__ccReturningFromInterimBoard', '__ccSuppressJourneyV700AutoWorldEnter',
        '__ccJourneyReturnBoardId', '__ccLastActiveJourneyBoardAreaId'].forEach((key) => {
        Reflect.deleteProperty(window, key);
        localStorage.removeItem(key);
      });
    },
  );
});
