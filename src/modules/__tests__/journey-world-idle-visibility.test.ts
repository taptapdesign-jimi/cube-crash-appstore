import { gsap } from 'gsap';
import {
  JourneyWorldAnimationCoordinator,
  type JourneyWorldAnimationUnit,
} from '../journey-world-animation-coordinator';

describe('Journey main Unit painted visibility', () => {
  let coordinator: JourneyWorldAnimationCoordinator;
  let callback: IntersectionObserverCallback;
  let observer: IntersectionObserver;
  let originalObserver: typeof IntersectionObserver;
  let art: HTMLElement;
  let wrapper: HTMLElement;
  let clouds: HTMLElement[];
  let owner: {
    phase: string;
    idleTicker: (() => void) | null;
    lastSettledIdlePaintAt: number | null;
    startIdle(units: JourneyWorldAnimationUnit[], reduced: boolean): void;
  };
  let setters: Map<HTMLElement, jest.Mock>;

  const deliver = (targets: HTMLElement[], isIntersecting: boolean) => {
    callback(targets.map((target) => ({ target, isIntersecting } as unknown as IntersectionObserverEntry)), observer);
  };
  const paint = () => {
    owner.lastSettledIdlePaintAt = null;
    owner.idleTicker?.();
  };

  beforeEach(() => {
    originalObserver = window.IntersectionObserver;
    observer = {
      observe: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as IntersectionObserver;
    window.IntersectionObserver = jest.fn((nextCallback: IntersectionObserverCallback) => {
      callback = nextCallback;
      return observer;
    }) as unknown as typeof IntersectionObserver;
    jest.spyOn(gsap.ticker, 'add').mockImplementation((tick) => tick);
    jest.spyOn(gsap.ticker, 'remove').mockImplementation(() => {});
    setters = new Map();
    jest.spyOn(gsap, 'quickSetter').mockImplementation((target) => {
      const setter = jest.fn();
      setters.set(target as HTMLElement, setter);
      return setter;
    });
    art = document.createElement('img');
    wrapper = document.createElement('div');
    wrapper.className = 'journey-main-cloud-unit';
    wrapper.style.height = '100%';
    clouds = [document.createElement('img'), document.createElement('img')];
    clouds.forEach((cloud) => {
      cloud.className = 'journey-forest-cloud-art';
      wrapper.append(cloud);
    });
    document.body.append(art, wrapper);
    coordinator = new JourneyWorldAnimationCoordinator();
    owner = coordinator as unknown as typeof owner;
    owner.phase = 'idle';
    owner.startIdle([{ id: 'forest-main', targets: [art, wrapper], clouds }], false);
  });

  afterEach(() => {
    coordinator.stop();
    art.remove();
    wrapper.remove();
    window.IntersectionObserver = originalObserver;
  });

  it('observes actual art and cloud leaves while retaining the full-map motion wrapper', () => {
    expect(observer.observe).toHaveBeenCalledTimes(3);
    [art, ...clouds].forEach((target) => expect(observer.observe).toHaveBeenCalledWith(target));
    expect(observer.observe).not.toHaveBeenCalledWith(wrapper);
    paint();
    expect(setters.get(wrapper)).toHaveBeenCalledTimes(1);
    expect(wrapper.style.height).toBe('100%');
    expect(clouds.every((cloud) => cloud.parentElement === wrapper)).toBe(true);
  });

  it('stops every Unit transform when all painted leaves are offscreen despite its large wrapper', () => {
    deliver([art, ...clouds], false);
    // An intersecting structural box must never count as painted content.
    deliver([wrapper], true);
    paint();
    setters.forEach((setter) => expect(setter).not.toHaveBeenCalled());
  });

  it('keeps the complete Unit moving when only one cloud intersects and resumes after culling', () => {
    deliver([art, ...clouds], false);
    paint();
    deliver([clouds[1]], true);
    paint();
    setters.forEach((setter) => expect(setter).toHaveBeenCalledTimes(1));
  });

  it('does not prematurely cull while initial cloud visibility records are still pending', () => {
    deliver([art, clouds[0]], false);
    paint();
    setters.forEach((setter) => expect(setter).toHaveBeenCalledTimes(1));
    setters.forEach((setter) => setter.mockClear());
    deliver([clouds[1]], false);
    paint();
    setters.forEach((setter) => expect(setter).not.toHaveBeenCalled());
  });

  it('disconnects observation and removes the idle ticker on stop', () => {
    const tick = owner.idleTicker;
    coordinator.stop();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(gsap.ticker.remove).toHaveBeenCalledWith(tick);
    expect(owner.idleTicker).toBeNull();
    // A queued observer delivery cannot revive a disposed owner.
    deliver(clouds, true);
    expect(owner.idleTicker).toBeNull();
    setters.forEach((setter) => expect(setter).not.toHaveBeenCalled());
  });
});
