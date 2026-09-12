import { JourneyHubRuntimeScheduler } from '../journey-hub-runtime-scheduler';

describe('Journey Hub runtime scheduler', () => {
  test('keeps fallback idle active when IntersectionObserver is unavailable', () => {
    const hub = document.createElement('div');
    hub.innerHTML = `
      <button class="journey-v700-world-card" data-world-id="1"></button>
      <img class="journey-v700-world-cloud" data-world-id="1">`;

    new JourneyHubRuntimeScheduler(null).activate(hub, null);

    expect(hub.querySelector('.journey-v700-world-card')).toHaveClass('journey-v700-runtime-active');
    expect(hub.querySelector('.journey-v700-world-cloud')).toHaveClass('journey-v700-runtime-active');
  });

  test('activates only the observed World and its owned clouds near viewport', () => {
    let callback: IntersectionObserverCallback | null = null;
    const observe = jest.fn();
    const disconnect = jest.fn();
    const factory = jest.fn((nextCallback: IntersectionObserverCallback) => {
      callback = nextCallback;
      return { observe, disconnect } as unknown as IntersectionObserver;
    });
    const hub = document.createElement('div');
    hub.innerHTML = `
      <button class="journey-v700-world-card" data-world-id="1"></button>
      <button class="journey-v700-world-card" data-world-id="2"></button>
      <img class="journey-v700-world-cloud" data-world-id="1">
      <img class="journey-v700-world-cloud" data-world-id="2">`;
    const cards = Array.from(hub.querySelectorAll<HTMLElement>('.journey-v700-world-card'));
    const scheduler = new JourneyHubRuntimeScheduler(factory);

    scheduler.activate(hub, null);
    callback?.([
      { target: cards[0], isIntersecting: false } as unknown as IntersectionObserverEntry,
      { target: cards[1], isIntersecting: true } as unknown as IntersectionObserverEntry,
    ], {} as IntersectionObserver);

    expect(observe).toHaveBeenCalledTimes(2);
    expect(cards[0]).not.toHaveClass('journey-v700-runtime-active');
    expect(cards[1]).toHaveClass('journey-v700-runtime-active');
    expect(hub.querySelector('[data-world-id="1"].journey-v700-world-cloud'))
      .not.toHaveClass('journey-v700-runtime-active');
    expect(hub.querySelector('[data-world-id="2"].journey-v700-world-cloud'))
      .toHaveClass('journey-v700-runtime-active');

    scheduler.deactivate();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  test.each([8, 13])('never activates more than the two-World budget across 20 cycles (%i Worlds)', (count) => {
    const hub = document.createElement('div');
    hub.innerHTML = Array.from({ length: count }, (_, index) => `
      <button class="journey-v700-world-card" data-world-id="${index + 1}"></button>
      <img class="journey-v700-world-cloud" data-world-id="${index + 1}">`).join('');
    const scheduler = new JourneyHubRuntimeScheduler(null);

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const anchor = (cycle % count) + 1;
      const neighbour = anchor < count ? anchor + 1 : anchor - 1;
      scheduler.activate(hub, null, [anchor, neighbour]);
      expect(scheduler.getActiveWorldIds()).toHaveLength(2);
      expect(hub.querySelectorAll('.journey-v700-world-cloud.journey-v700-runtime-active')).toHaveLength(2);
      scheduler.deactivate();
      expect(scheduler.getActiveWorldIds()).toHaveLength(0);
    }
  });
});
