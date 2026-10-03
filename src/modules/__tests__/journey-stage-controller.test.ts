/** @jest-environment jsdom */

import {
  isJourneyStageInteractionCurrent,
  JourneyStageController,
} from '../journey-stage-controller';

const createSurfaceNode = (name: string): HTMLElement => {
  const node = document.createElement('section');
  node.dataset.surfaceName = name;
  return node;
};

const setContainerSurface = (
  container: HTMLElement,
  node: HTMLElement,
  view: 'hub' | 'world',
  worldId?: number,
): void => {
  container.replaceChildren(node);
  container.dataset.journeyV700View = view;
  if (worldId) container.dataset.journeyV700WorldId = String(worldId);
  else delete container.dataset.journeyV700WorldId;
  container.style.height = view === 'hub' ? '100%' : '2180px';
  container.style.overflow = view === 'hub' ? 'visible' : 'hidden';
};

describe('JourneyStageController', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    container = document.createElement('div');
    container.id = 'journey-boards-container';
    document.body.appendChild(container);
  });

  test('reuses the exact Hub and World nodes for repeated warm swaps', () => {
    const controller = new JourneyStageController();
    const hub = createSurfaceNode('hub');
    const world = createSurfaceNode('world-1');
    setContainerSurface(container, hub, 'hub');

    controller.retainNodes({ view: 'hub' }, [hub], container);
    hub.remove();
    setContainerSurface(container, world, 'world', 1);

    const toHub = controller.beginTransition({ view: 'world', worldId: 1 }, { view: 'hub' });
    expect(controller.commitRetainedSwap(toHub, container, { view: 'world', worldId: 1 }).committed)
      .toBe(true);
    expect(container.firstElementChild).toBe(hub);
    expect(world.isConnected).toBe(false);

    const toWorld = controller.beginTransition({ view: 'hub' }, { view: 'world', worldId: 1 });
    expect(controller.commitRetainedSwap(toWorld, container, { view: 'hub' }).committed).toBe(true);
    expect(container.firstElementChild).toBe(world);
    expect(hub.isConnected).toBe(false);

    const secondToHub = controller.beginTransition({ view: 'world', worldId: 1 }, { view: 'hub' });
    expect(controller.commitRetainedSwap(secondToHub, container, { view: 'world', worldId: 1 }).committed)
      .toBe(true);
    expect(container.firstElementChild).toBe(hub);
    expect(controller.getRetainedDescriptors()).toEqual([{ view: 'world', worldId: 1 }]);
  });

  test('a replaced transition token cannot append its stale retained World', () => {
    const controller = new JourneyStageController();
    const hub = createSurfaceNode('hub');
    const worldA = createSurfaceNode('world-a');
    setContainerSurface(container, hub, 'hub');
    const detachedOwner = document.createElement('div');
    detachedOwner.dataset.journeyV700View = 'world';
    detachedOwner.dataset.journeyV700WorldId = '1';
    controller.retainNodes({ view: 'world', worldId: 1 }, [worldA], detachedOwner);

    const stale = controller.beginTransition({ view: 'hub' }, { view: 'world', worldId: 1 });
    controller.beginTransition({ view: 'hub' }, { view: 'world', worldId: 2 });

    expect(controller.commitRetainedSwap(stale, container, { view: 'hub' }).committed).toBe(false);
    expect(container.firstElementChild).toBe(hub);
    expect(worldA.isConnected).toBe(false);
  });

  test('retaining World B evicts World A and keeps the cache bounded', () => {
    const controller = new JourneyStageController();
    const detachedOwner = document.createElement('div');
    const worldA = createSurfaceNode('world-a');
    const worldB = createSurfaceNode('world-b');

    expect(controller.retainNodes({ view: 'world', worldId: 1 }, [worldA], detachedOwner)).toBeNull();
    expect(controller.retainNodes({ view: 'world', worldId: 2 }, [worldB], detachedOwner)).toEqual({
      view: 'world',
      worldId: 1,
    });
    expect(controller.hasRetained({ view: 'world', worldId: 1 })).toBe(false);
    expect(controller.hasRetained({ view: 'world', worldId: 2 })).toBe(true);
    expect(controller.getRetainedDescriptors()).toEqual([{ view: 'world', worldId: 2 }]);
    expect(worldA.isConnected).toBe(false);
  });

  test('re-retaining the same node identity never disposes the shared node', () => {
    const controller = new JourneyStageController();
    const hub = createSurfaceNode('hub');
    setContainerSurface(container, hub, 'hub');

    controller.retainNodes({ view: 'hub' }, [hub], container);
    controller.retainNodes({ view: 'hub' }, [hub], container);

    expect(hub.isConnected).toBe(true);
    expect(controller.hasRetained({ view: 'hub' })).toBe(true);
  });

  test('queued events from a detached prior surface fail the live-stage guard', () => {
    const controller = new JourneyStageController();
    const hub = createSurfaceNode('hub');
    const button = document.createElement('button');
    hub.appendChild(button);
    const world = createSurfaceNode('world');
    setContainerSurface(container, hub, 'hub');
    let accepted = 0;
    button.addEventListener('click', () => {
      if (isJourneyStageInteractionCurrent(button, { view: 'hub' })) accepted += 1;
    });

    button.click();
    expect(accepted).toBe(1);
    controller.retainNodes({ view: 'world', worldId: 1 }, [world], document.createElement('div'));
    const token = controller.beginTransition({ view: 'hub' }, { view: 'world', worldId: 1 });
    expect(controller.commitRetainedSwap(token, container, { view: 'hub' }).committed).toBe(true);
    expect(button.isConnected).toBe(false);

    button.click();
    expect(accepted).toBe(1);
  });

  test('restores the destination container identity state without a rebuild', () => {
    const controller = new JourneyStageController();
    const hub = createSurfaceNode('hub');
    const world = createSurfaceNode('world');
    setContainerSurface(container, hub, 'hub');
    controller.retainNodes({ view: 'hub' }, [hub], container);
    hub.remove();
    setContainerSurface(container, world, 'world', 3);

    const token = controller.beginTransition({ view: 'world', worldId: 3 }, { view: 'hub' });
    expect(controller.commitRetainedSwap(token, container, { view: 'world', worldId: 3 }).committed)
      .toBe(true);
    expect(container.dataset.journeyV700View).toBe('hub');
    expect(container.dataset.journeyV700WorldId).toBeUndefined();
    expect(container.style.height).toBe('100%');
    expect(container.style.overflow).toBe('visible');
  });

  test('dispose invalidates late completions and releases both retained slots', () => {
    const controller = new JourneyStageController();
    const world = createSurfaceNode('world');
    const owner = document.createElement('div');
    controller.retainNodes({ view: 'world', worldId: 1 }, [world], owner);
    const token = controller.beginTransition({ view: 'hub' }, { view: 'world', worldId: 1 });

    expect(controller.dispose()).toEqual([{ view: 'world', worldId: 1 }]);
    expect(controller.isCurrent(token)).toBe(false);
    expect(controller.getRetainedDescriptors()).toEqual([]);
  });

  test('memory-pressure eviction preserves the route token for a cold fallback', () => {
    const controller = new JourneyStageController();
    const world = createSurfaceNode('world');
    controller.retainNodes({ view: 'world', worldId: 1 }, [world], document.createElement('div'));
    const token = controller.beginTransition({ view: 'hub' }, { view: 'world', worldId: 1 });

    controller.clearRetained();

    expect(controller.isCurrent(token)).toBe(true);
    expect(controller.hasRetained({ view: 'world', worldId: 1 })).toBe(false);
    expect(controller.commitRetainedSwap(token, container, { view: 'hub' }).committed).toBe(false);
  });

  test('pressure can release the large World without evicting the bounded return Hub', () => {
    const controller = new JourneyStageController();
    const hubOwner = document.createElement('div');
    hubOwner.dataset.journeyV700View = 'hub';
    const hub = document.createElement('section');
    controller.retainNodes({ view: 'hub' }, [hub], hubOwner);

    const worldOwner = document.createElement('div');
    worldOwner.dataset.journeyV700View = 'world';
    worldOwner.dataset.journeyV700WorldId = '2';
    const world = document.createElement('section');
    controller.retainNodes({ view: 'world', worldId: 2 }, [world], worldOwner);

    expect(controller.clearRetainedWorld()).toEqual({ view: 'world', worldId: 2 });
    expect(world.isConnected).toBe(false);
    expect(controller.hasRetained({ view: 'world', worldId: 2 })).toBe(false);
    expect(controller.hasRetained({ view: 'hub' })).toBe(true);
    expect(controller.getRetainedDescriptors()).toEqual([{ view: 'hub' }]);

    expect(controller.clearRetainedWorld()).toBeNull();
    expect(controller.hasRetained({ view: 'hub' })).toBe(true);
    controller.dispose();
  });
});
