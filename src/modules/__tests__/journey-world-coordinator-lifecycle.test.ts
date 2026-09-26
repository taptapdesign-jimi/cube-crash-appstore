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
