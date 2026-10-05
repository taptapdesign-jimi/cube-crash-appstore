import { gsap } from 'gsap';
import { getJourneyV700EnterOffsets, getJourneyV700MotionProfile } from '../journey-v700-motion';
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

  test.each(['entering', 'exiting', 'idle'] as const)('park retires %s and keeps final poses without starting motion', async phase => {
    const root = first.targets[0];
    root.className = 'journey-scene-unit';
    const cloud = document.createElement('div');
    root.append(cloud);
    first.clouds = [cloud];
    let pending = coordinator.enter([first], false);
    timeline().pause().progress(phase === 'entering' ? 0.2 : 1);
    if (phase !== 'entering') await pending;
    if (phase === 'exiting') {
      pending = coordinator.exit([first], false);
      timeline().pause().progress(0.2);
    }
    gsap.set(cloud, { x: 12 });
    const addCount = jest.mocked(gsap.ticker.add).mock.calls.length;
    const to = jest.spyOn(gsap, 'to');

    coordinator.park([first]);
    await pending;

    expect(coordinator.getPhase()).toBe('hidden');
    expect(timeline()).toBeNull();
    expect(root).not.toHaveClass('journey-world-idle-active');
    expect(root.style.visibility).toBe('visible');
    expect(root.style.opacity).toBe('1');
    expect(root.style.pointerEvents).toBe('none');
    expect(gsap.getProperty(root, 'y')).toBe(0);
    expect(gsap.getProperty(root, 'scale')).toBe(1);
    expect(gsap.getProperty(cloud, 'x')).toBe(0);
    expect(gsap.ticker.add).toHaveBeenCalledTimes(addCount);
    expect(to).not.toHaveBeenCalled();
    to.mockRestore();
  });

  test('parking an empty surface still retires the previous idle owner', async () => {
    const entered = coordinator.enter([first], false);
    timeline().pause().progress(1);
    await entered;
    expect(first.targets[0]).toHaveClass('journey-world-idle-active');
    coordinator.park([]);
    expect(coordinator.getPhase()).toBe('hidden');
    expect(first.targets[0]).not.toHaveClass('journey-world-idle-active');
    expect(timeline()).toBeNull();
  });

  test('a structural scene enters and exits without owning its card or scenery transforms twice', async () => {
    const root = first.targets[0];
    root.className = 'journey-scene-unit';
    root.innerHTML = '<div class="journey-board-card-wrapper" style="transform:rotate(5deg)"><div class="journey-board-card"></div></div><img style="opacity:0.8">';
    const wrapper = root.querySelector<HTMLElement>('.journey-board-card-wrapper')!;
    const image = root.querySelector('img')!;
    const entered = coordinator.enter([first], false);
    timeline().pause().progress(1);
    await entered;
    expect(root.style.pointerEvents).toBe('none');
    expect(wrapper.style.transform).toBe('rotate(5deg)');
    expect(image.style.opacity).toBe('0.8');
    const exited = coordinator.exit([first], false);
    const card = wrapper.querySelector('.journey-board-card')!;
    const cardExit = timeline().pause().getChildren(true, true, false).find(tween =>
      (tween as gsap.core.Tween).targets().includes(card));
    expect(cardExit?.duration()).toBe(0.4);
    expect(cardExit?.vars.ease).toBe('back.in(1.7)');
    timeline().pause().progress(1);
    await exited;
    expect(root.style.visibility).toBe('hidden');
    expect(wrapper.style.transform).toBe('rotate(5deg)');
    expect(image.style.opacity).toBe('0.8');
    const reopened = coordinator.enter([first], false);
    timeline().pause().progress(1);
    await reopened;
    expect(wrapper.style.visibility).not.toBe('hidden');
    expect(wrapper.style.opacity).not.toBe('0');
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

  test('a child interruption after a foreground receipt and large frame jump atomically settles the complete exit', async () => {
    const exited = coordinator.exit([first, second], false);
    const currentTimeline = timeline().pause();
    const frameJumpSeconds = Math.min(0.424, currentTimeline.duration() * 0.5);
    currentTimeline.time(frameJumpSeconds, false);
    window.dispatchEvent(new CustomEvent('cc:native-audio-active', {
      detail: { reason: 'app-active' },
    }));

    const interruptedChild = currentTimeline
      .getChildren(true, true, false)
      .find((child) => typeof child.eventCallback('onInterrupt') === 'function');
    expect(interruptedChild).toBeDefined();
    interruptedChild!.kill();
    await exited;

    expect(coordinator.getPhase()).toBe('hidden');
    expect(first.targets[0].style.visibility).toBe('hidden');
    expect(second.targets[0].style.visibility).toBe('hidden');
  });

  test('stop settles the owned exit even when GSAP drops the master onInterrupt callback', async () => {
    const exited = coordinator.exit([first, second], false);
    const currentTimeline = timeline().pause().time(0.388, false);
    currentTimeline.eventCallback('onInterrupt', null);

    coordinator.stop(true);
    await exited;

    expect(coordinator.getPhase()).toBe('hidden');
    expect(first.targets[0].style.visibility).toBe('hidden');
    expect(second.targets[0].style.visibility).toBe('hidden');
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

  test.each([true, false])('primed visible Units keep full-World slots and terminal-relative spacing with main visible=%s', async (mainVisible) => {
    const root = document.createElement('div');
    root.className = 'collectibles-scrollable';
    document.body.append(root);
    jest.spyOn(root, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 844, height: 844 } as DOMRect);
    const units: JourneyWorldAnimationUnit[] = ['robo-main', ...Array.from({ length: 10 }, (_, index) => `board-${21 + index}`)]
      .map((id, index) => {
        const target = document.createElement('div');
        root.append(target);
        const visible = index === 0 ? mainVisible : index <= 3;
        jest.spyOn(target, 'getBoundingClientRect').mockReturnValue({
          top: visible ? 100 : 2000, bottom: visible ? 200 : 2100, width: 100, height: 100,
        } as DOMRect);
        return { id, targets: [target], clouds: [], ...(index === 2 ? { enterDelayOffset: 0.24 } : {}) };
      });
    const previousObserver = window.IntersectionObserver;
    window.IntersectionObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })) as unknown as typeof IntersectionObserver;
    const expected = getJourneyV700EnterOffsets(units, false);
    const readStarts = () => new Map(timeline().pause().getChildren(false, true, false).map((tween) => [
      (tween as gsap.core.Tween).targets()[0] as HTMLElement,
      { start: tween.startTime(), duration: tween.duration() },
    ]));
    try {
      const cold = coordinator.enter(units, false, { targetsPrimed: true, cloudsPrimed: true });
      const coldStarts = readStarts();
      expect(coldStarts.size).toBe(mainVisible ? 4 : 3);
      units.forEach((unit, index) => {
        const entry = coldStarts.get(unit.targets[0]);
        if (entry) expect(entry.start).toBeCloseTo(getJourneyV700MotionProfile(false).enter.baseDelay + expected[index]);
      });
      coordinator.stop();
      await cold;
      const immediate = coordinator.enter(units, false, { targetsPrimed: true, cloudsPrimed: true, immediateFirstUnit: true });
      const returnStarts = readStarts();
      const firstColdStart = Math.min(...Array.from(coldStarts.values(), ({ start }) => start));
      expect(Math.min(...Array.from(returnStarts.values(), ({ start }) => start))).toBe(0);
      coldStarts.forEach((entry, target) => {
        expect(returnStarts.get(target)?.start).toBeCloseTo(entry.start - firstColdStart);
        expect(returnStarts.get(target)?.duration).toBe(entry.duration);
      });
      coordinator.stop();
      await immediate;
    } finally {
      coordinator.stop(true);
      window.IntersectionObserver = previousObserver;
      root.remove();
    }
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
