import { AnimationManager } from '../animation-manager.js';

describe('AnimationManager external timeline ownership', () => {
  test('explicit kill releases an infinite timeline from manager ownership', () => {
    const callbacks = new Map<string, unknown>();
    const timeline = {
      eventCallback: jest.fn((name: string, callback?: unknown) => {
        if (callback !== undefined) callbacks.set(name, callback);
        return callbacks.get(name) ?? null;
      }),
      kill: jest.fn(),
    } as any;
    const manager = new AnimationManager();

    manager.trackExternalTimeline(timeline);
    expect(manager.getStats().activeTimelines).toBe(1);

    manager.killExternalTimeline(timeline);
    expect(timeline.kill).toHaveBeenCalledTimes(1);
    expect(manager.getStats().activeTimelines).toBe(0);
  });

  test('explicit kill releases a delayed tween from manager ownership', () => {
    const callbacks = new Map<string, unknown>();
    const tween = {
      eventCallback: jest.fn((name: string, callback?: unknown) => {
        if (callback !== undefined) callbacks.set(name, callback);
        return callbacks.get(name) ?? null;
      }),
      kill: jest.fn(),
    } as any;
    const manager = new AnimationManager();

    manager.trackExternalTween(tween);
    expect(manager.getStats().activeTweens).toBe(1);

    manager.killExternalTween(tween);
    expect(tween.kill).toHaveBeenCalledTimes(1);
    expect(manager.getStats().activeTweens).toBe(0);
  });

  test('generic animation kill releases either tracked owner without double bookkeeping', () => {
    const callbacks = new Map<string, unknown>();
    const animation = {
      eventCallback: jest.fn((name: string, callback?: unknown) => {
        if (callback !== undefined) callbacks.set(name, callback);
        return callbacks.get(name) ?? null;
      }),
      kill: jest.fn(),
    } as any;
    const manager = new AnimationManager();

    manager.trackExternalTimeline(animation);
    manager.killExternalAnimation(animation);

    expect(animation.kill).toHaveBeenCalledTimes(1);
    expect(manager.getStats().activeTweens).toBe(0);
    expect(manager.getStats().activeTimelines).toBe(0);
  });

  test('killAll kills only manager-owned animations and leaves unrelated GSAP work alone', () => {
    const makeAnimation = () => {
      const callbacks = new Map<string, unknown>();
      return {
        eventCallback: jest.fn((name: string, callback?: unknown) => {
          if (callback !== undefined) callbacks.set(name, callback);
          return callbacks.get(name) ?? null;
        }),
        kill: jest.fn(),
      } as any;
    };
    const ownedTween = makeAnimation();
    const ownedTimeline = makeAnimation();
    const unrelatedAnimation = makeAnimation();
    const manager = new AnimationManager();

    manager.trackExternalTween(ownedTween);
    manager.trackExternalTimeline(ownedTimeline);
    manager.killAll();

    expect(ownedTween.kill).toHaveBeenCalledTimes(1);
    expect(ownedTimeline.kill).toHaveBeenCalledTimes(1);
    expect(unrelatedAnimation.kill).not.toHaveBeenCalled();
    expect(manager.getStats()).toEqual({
      animations: 0,
      timelines: 0,
      activeTweens: 0,
      activeTimelines: 0,
    });
  });
});
