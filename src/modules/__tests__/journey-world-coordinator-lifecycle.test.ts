import { gsap } from 'gsap';
import {
  JourneyWorldAnimationCoordinator,
  type JourneyWorldAnimationUnit,
} from '../journey-world-animation-coordinator';

describe('Journey World coordinator replacement ownership', () => {
  let coordinator: JourneyWorldAnimationCoordinator;
  let first: JourneyWorldAnimationUnit;
  let second: JourneyWorldAnimationUnit;
  const timeline = () => (coordinator as unknown as {
    activeTimeline: gsap.core.Timeline;
  }).activeTimeline;

  beforeEach(() => {
    gsap.ticker.sleep();
    jest.spyOn(gsap.ticker, 'add').mockImplementation((callback) => callback);
    jest.spyOn(gsap.ticker, 'remove').mockImplementation(() => {});
    const makeUnit = (id: string) => {
      const target = document.createElement('div');
      document.body.append(target);
      return { id, targets: [target], clouds: [] };
    };
    first = makeUnit('board-7');
    second = makeUnit('board-8');
    coordinator = new JourneyWorldAnimationCoordinator();
  });

  afterEach(() => {
    coordinator.stop(true);
    first.targets[0].remove();
    second.targets[0].remove();
    gsap.ticker.sleep();
  });

  test('an interrupted enter cannot settle the replacement before its Unit handoff', async () => {
    const retired = coordinator.enter([first], false);
    timeline().pause().progress(0.1);
    const current = coordinator.enter([second], false);
    const currentTimeline = timeline().pause();
    await retired;

    expect(coordinator.getPhase()).toBe('entering');
    currentTimeline.progress(1);
    await current;
    expect(coordinator.getPhase()).toBe('idle');
    expect(second.targets[0]).toHaveClass('journey-world-idle-active');
    expect(first.targets[0]).not.toHaveClass('journey-world-idle-active');
  });

  test.each([true, false])('cloud reset is consumed once when prepared=%s', async cloudsPrimed => {
    const cloud = document.createElement('div');
    first.targets[0].append(cloud);
    first.clouds = [cloud];
    gsap.set(cloud, { x: cloudsPrimed ? 0 : 12 });
    const set = jest.spyOn(gsap, 'set');
    const entered = coordinator.enter([first], false, { targetsPrimed: true, cloudsPrimed });
    timeline().pause();
    const cloudResets = set.mock.calls.filter(([targets, vars]) =>
      Array.isArray(targets) && targets.includes(cloud) && vars.x === 0);
    expect(cloudResets).toHaveLength(cloudsPrimed ? 0 : 1);
    expect(gsap.getProperty(cloud, 'x')).toBe(0);
    coordinator.stop(true);
    await entered;
    set.mockRestore();
  });

  test.each(['enter', 'exit'] as const)('an empty %s still retires the prior Unit ticker', async (operation) => {
    const entered = coordinator.enter([first], false);
    timeline().pause().progress(1);
    await entered;
    expect(first.targets[0]).toHaveClass('journey-world-idle-active');
    const removeCalls = jest.mocked(gsap.ticker.remove).mock.calls.length;

    await coordinator[operation]([], false);

    expect(first.targets[0]).not.toHaveClass('journey-world-idle-active');
    expect(jest.mocked(gsap.ticker.remove).mock.calls.length).toBeGreaterThan(removeCalls);
    expect(coordinator.getPhase()).toBe(operation === 'enter' ? 'idle' : 'hidden');
  });

  test('exit retires every Unit and nested card in one global sweep without killing unrelated motion', async () => {
    const card = document.createElement('div');
    card.className = 'journey-board-card';
    first.targets[0].className = 'journey-board-card-wrapper';
    first.targets[0].append(card);
    const unrelated = { value: 0 };
    const unrelatedTween = gsap.to(unrelated, { value: 1, duration: 10, paused: true });
    gsap.to(card, { scale: 1.1, duration: 10, paused: true });
    const kill = jest.spyOn(gsap, 'killTweensOf');
    const exited = coordinator.exit([first, second], false);
    const currentTimeline = timeline().pause();
    expect(kill).toHaveBeenCalledTimes(1);
    expect(new Set(kill.mock.calls[0][0] as HTMLElement[])).toEqual(new Set([
      first.targets[0], second.targets[0], card,
    ]));
    expect(unrelatedTween.parent).not.toBeNull();
    currentTimeline.progress(1);
    await exited;
    expect(first.targets[0].style.visibility).toBe('hidden');
    expect(second.targets[0].style.visibility).toBe('hidden');
    expect(card).not.toHaveClass('journey-card-tapping');
    unrelatedTween.kill();
    kill.mockRestore();
  });

  test('enter snapshots the shared viewport once and retires offscreen targets as one batch', async () => {
    const root = document.createElement('div');
    root.className = 'collectibles-scrollable';
    document.body.append(root);
    root.append(first.targets[0], second.targets[0]);
    const rect = jest.spyOn(root, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 844, height: 844 } as DOMRect);
    jest.spyOn(first.targets[0], 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 200, width: 100, height: 100 } as DOMRect);
    jest.spyOn(second.targets[0], 'getBoundingClientRect').mockReturnValue({ top: 2000, bottom: 2100, width: 100, height: 100 } as DOMRect);
    const originalObserver = window.IntersectionObserver;
    window.IntersectionObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })) as unknown as typeof IntersectionObserver;
    const kill = jest.spyOn(gsap, 'killTweensOf');
    const entered = coordinator.enter([first, second], false, { targetsPrimed: true });
    timeline().pause();
    expect(rect).toHaveBeenCalledTimes(1);
    expect(kill).toHaveBeenCalledTimes(1);
    expect(kill).toHaveBeenCalledWith(second.targets);
    expect(second.targets[0].style.opacity).toBe('1');
    coordinator.stop(true);
    await entered;
    window.IntersectionObserver = originalObserver;
    root.remove();
    kill.mockRestore();
  });

  test('a runtime suspension published before enter survives replacement cleanup and per-Unit handoff', async () => {
    coordinator.setIdlePaintSuspended(true);
    const entered = coordinator.enter([first], false);
    timeline().pause().progress(1);
    await entered;
    expect(first.targets[0]).not.toHaveClass('journey-world-idle-active');
    expect(gsap.ticker.add).not.toHaveBeenCalled();
    coordinator.setIdlePaintSuspended(false);
    expect(first.targets[0]).toHaveClass('journey-world-idle-active');
    expect(gsap.ticker.add).toHaveBeenCalledTimes(1);
  });
});
