import { JourneyHubRuntimeScheduler } from '../journey-hub-runtime-scheduler';
import { JourneyWorldRuntimeScheduler } from '../journey-world-runtime-scheduler';

describe('Journey screen background ownership', () => {
  let hidden = false;
  const worlds: JourneyWorldRuntimeScheduler[] = [];
  const hubs: JourneyHubRuntimeScheduler[] = [];
  const world = () => {
    const owner = new JourneyWorldRuntimeScheduler();
    worlds.push(owner);
    return owner;
  };
  const hub = (factory: ConstructorParameters<typeof JourneyHubRuntimeScheduler>[0] = null) => {
    const owner = new JourneyHubRuntimeScheduler(factory);
    hubs.push(owner);
    const element = document.createElement('div');
    element.innerHTML = [1, 2].map(id => `<button class="journey-v700-world-card" data-world-id="${id}"></button><img class="journey-v700-world-cloud" data-world-id="${id}">`).join('');
    return { owner, element };
  };
  const visibility = (nextHidden: boolean) => {
    hidden = nextHidden;
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    hidden = false;
    jest.useFakeTimers();
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  });

  afterEach(() => {
    worlds.splice(0).forEach(owner => owner.dispose());
    hubs.splice(0).forEach(owner => owner.deactivate());
    jest.useRealTimers();
  });

  test.each([1, 2, 3])('World %i suspends all paint policies and preserves the logical modal/transition owner', (id) => {
    const owner = world();
    const scrollRoot = document.createElement('div');
    owner.activate(id, scrollRoot);
    visibility(true);
    expect(owner.getSnapshot()).toMatchObject({ state: 'background', worldId: id, paintSuspended: true, ambientSuspended: true, ambientScrollBoosted: false });
    scrollRoot.dispatchEvent(new Event('scroll'));
    jest.advanceTimersByTime(500);
    expect(owner.getSnapshot().state).toBe('background');
    owner.openModal();
    visibility(false);
    expect(owner.getSnapshot().state).toBe('modal');
    owner.closeModal();
    owner.beginTransition();
    visibility(true);
    visibility(false);
    expect(owner.getSnapshot().state).toBe('transition');
    owner.endTransition();
    expect(owner.getSnapshot().state).toBe('idle');
  });

  test('pagehide suspends despite stale visible state, and route teardown prevents pageshow resurrection', () => {
    const owner = world();
    owner.activate(1, null);
    window.dispatchEvent(new Event('pagehide'));
    expect(owner.getSnapshot().state).toBe('background');
    window.dispatchEvent(new Event('pageshow'));
    expect(owner.getSnapshot().state).toBe('idle');
    owner.deactivate();
    window.dispatchEvent(new Event('pageshow'));
    expect(owner.getSnapshot()).toMatchObject({ state: 'inactive', worldId: null });
  });

  test('activation while hidden never publishes an idle frame', () => {
    hidden = true;
    const owner = world();
    const states: string[] = [];
    owner.subscribe(snapshot => states.push(snapshot.state));
    owner.activate(3, null, 'transition');
    owner.endTransition();
    expect(states).toEqual(['inactive', 'background']);
    visibility(false);
    expect(states).toEqual(['inactive', 'background', 'idle']);
  });

  test('only the native active receipt overrides stale hidden; pagehide and route disposal remain authoritative', () => {
    hidden = true;
    const worldOwner = world();
    const { owner, element } = hub();
    worldOwner.activate(1, null);
    owner.activate(element, null, [1]);
    window.dispatchEvent(new Event('pageshow'));
    expect(worldOwner.getSnapshot().state).toBe('background');
    expect(owner.getActiveWorldIds()).toEqual([]);
    window.dispatchEvent(new Event('cc:native-audio-active'));
    expect(worldOwner.getSnapshot().state).toBe('idle');
    expect(owner.getActiveWorldIds()).toEqual([1]);
    window.dispatchEvent(new Event('pagehide'));
    expect(worldOwner.getSnapshot().state).toBe('background');
    expect(owner.getActiveWorldIds()).toEqual([]);
    worldOwner.deactivate();
    owner.deactivate();
    window.dispatchEvent(new Event('cc:native-audio-active'));
    expect(worldOwner.getSnapshot().state).toBe('inactive');
    expect(element).toHaveClass('journey-v700-runtime-suspended');
  });

  test('Hub background and route cleanup pause CSS owners without losing its visible World budget', () => {
    const { owner, element } = hub();
    owner.activate(element, null, [2]);
    expect(owner.getActiveWorldIds()).toEqual([2]);
    visibility(true);
    expect(owner.getActiveWorldIds()).toEqual([]);
    expect(element).toHaveClass('journey-v700-runtime-suspended');
    visibility(false);
    expect(owner.getActiveWorldIds()).toEqual([2]);
    expect(element).not.toHaveClass('journey-v700-runtime-suspended');
    owner.deactivate();
    window.dispatchEvent(new Event('pageshow'));
    expect(element).toHaveClass('journey-v700-runtime-suspended');
    expect(element.querySelectorAll('.journey-v700-runtime-active')).toHaveLength(0);
  });

  test('queued old Hub observer records cannot activate a replacement World or its clouds', () => {
    const callbacks: IntersectionObserverCallback[] = [];
    const { owner, element } = hub((callback) => {
      callbacks.push(callback);
      return { observe: jest.fn(), disconnect: jest.fn() } as unknown as IntersectionObserver;
    });
    owner.activate(element, null, [1]);
    owner.activate(element, null, [2]);
    callbacks[0]([{ target: element.querySelector('[data-world-id="1"]'), isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(owner.getActiveWorldIds()).toEqual([2]);
    expect(element.querySelector('[data-world-id="1"].journey-v700-world-cloud')).not.toHaveClass('journey-v700-runtime-active');
    expect(element.querySelector('[data-world-id="2"].journey-v700-world-cloud')).toHaveClass('journey-v700-runtime-active');
  });

  test('page lifecycle listeners return to baseline after repeated World and Hub replacement', () => {
    const documentAdd = jest.spyOn(document, 'addEventListener');
    const documentRemove = jest.spyOn(document, 'removeEventListener');
    const windowAdd = jest.spyOn(window, 'addEventListener');
    const windowRemove = jest.spyOn(window, 'removeEventListener');
    const worldOwner = world();
    const { owner, element } = hub();
    for (let cycle = 0; cycle < 20; cycle++) {
      worldOwner.activate((cycle % 3) + 1, null);
      owner.prepareForTransition(element);
      owner.activate(element, null, [1]);
    }
    worldOwner.deactivate();
    owner.deactivate();
    for (const [add, remove, types] of [
      [documentAdd, documentRemove, ['visibilitychange']],
      [windowAdd, windowRemove, ['pagehide', 'pageshow', 'cc:native-audio-active']],
    ] as const) {
      add.mock.calls.filter(([type]) => types.some(wanted => wanted === type)).forEach(([type, listener]) => {
        expect(remove.mock.calls.some(([removedType, removedListener]) => removedType === type && removedListener === listener)).toBe(true);
      });
    }
    expect(jest.getTimerCount()).toBe(0);
  });
});
