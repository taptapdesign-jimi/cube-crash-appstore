/** @jest-environment jsdom */

jest.mock('../drag-core.js', () => ({
  getOriginalGsapTo: () => jest.fn(() => ({ kill: jest.fn() })),
  getOriginalGsapTimeline: () => jest.fn(() => ({ kill: jest.fn() })),
}));

import { journeyBoardsManager } from '../journey-boards-manager';
import { JourneyStageController } from '../journey-stage-controller';
import { gsap } from 'gsap';

describe('Journey manager persistent-stage integration', () => {
  test('repeated warm Hub/World swaps preserve nodes and reject detached real handlers', () => {
    document.body.innerHTML = `
      <section id="journey-screen">
        <div class="collectibles-scrollable">
          <div id="journey-boards-container"></div>
        </div>
      </section>`;

    const manager = journeyBoardsManager as any;
    const originalController = manager.journeyStageController;
    const originalOpenWorld = manager.openJourneyV700World;
    const originalCancelWorldPrepaint = manager.cancelJourneyWorldPrepaint;
    const originalWorldPrepaintStage = manager.journeyWorldPrepaintStage;
    const originalView = manager.journeyV700View;
    const originalWorldId = manager.journeyV700WorldId;
    const controller = new JourneyStageController();
    const openWorld = jest.fn();
    const cancelWorldPrepaint = jest.fn();

    try {
      manager.journeyStageController = controller;
      manager.openJourneyV700World = openWorld;
      manager.cancelJourneyWorldPrepaint = cancelWorldPrepaint;
      manager.journeyWorldPrepaintStage = { worldId: 1 };
      manager.journeyV700View = 'hub';
      manager.journeyV700WorldId = null;

      const container = document.getElementById('journey-boards-container') as HTMLElement;
      manager.renderJourneyV700Hub(container, { prepaint: true });
      const hub = container.querySelector<HTMLElement>(':scope > .journey-v700-hub')!;
      const hubButton = hub.querySelector<HTMLButtonElement>('.journey-v700-world-card[data-world-id="1"]')!;

      // This fixture exercises the post-reveal handler identity. Production
      // enables Hub buttons only after the complete resident set is ready.
      hubButton.disabled = false;
      hubButton.removeAttribute('aria-disabled');

      // Prove this is the manager's live closure before retaining the same node.
      hubButton.click();
      expect(openWorld).toHaveBeenCalledTimes(1);

      const board = manager.boards.find((candidate: { id: number }) => candidate.id === 1);
      const world = document.createElement('section');
      world.className = 'journey-stage-test-world';
      const worldCardWrapper = manager.createBoardCardFixed(board, 0) as HTMLElement;
      const worldCard = worldCardWrapper.querySelector<HTMLElement>('.journey-board-card')!;
      // The live handler returns immediately after its guard and duplicate-open check.
      (worldCard as any)._openingDetail = true;
      world.appendChild(worldCardWrapper);

      const detachedWorldOwner = document.createElement('div');
      detachedWorldOwner.dataset.journeyV700View = 'world';
      detachedWorldOwner.dataset.journeyV700WorldId = '1';
      detachedWorldOwner.style.height = '2180px';
      controller.retainNodes({ view: 'world', worldId: 1 }, [world], detachedWorldOwner);

      for (let cycle = 0; cycle < 20; cycle += 1) {
        const toWorld = controller.beginTransition(
          { view: 'hub' },
          { view: 'world', worldId: 1 },
        );
        expect(controller.commitRetainedSwap(toWorld, container, { view: 'hub' })).toMatchObject({
          committed: true,
        });
        expect(container.firstElementChild).toBe(world);
        expect(hub.isConnected).toBe(false);
        expect(controller.getRetainedDescriptors()).toEqual([{ view: 'hub' }]);

        // A queued click belonging to the detached Hub must not call navigation.
        hubButton.click();
        expect(openWorld).toHaveBeenCalledTimes(cycle + 1);
        const staleHubMove = new Event('touchmove', { bubbles: true, cancelable: true });
        Object.defineProperty(staleHubMove, 'touches', {
          value: [{ clientX: 4, clientY: 7 }],
        });
        hubButton.dispatchEvent(staleHubMove);
        expect(cancelWorldPrepaint).not.toHaveBeenCalled();

        const liveWorldClick = new MouseEvent('click', { bubbles: true, cancelable: true });
        const liveWorldPreventDefault = jest.spyOn(liveWorldClick, 'preventDefault');
        worldCard.dispatchEvent(liveWorldClick);
        expect(liveWorldClick.defaultPrevented).toBe(true);
        expect(liveWorldPreventDefault).toHaveBeenCalledTimes(1);

        const toHub = controller.beginTransition(
          { view: 'world', worldId: 1 },
          { view: 'hub' },
        );
        expect(controller.commitRetainedSwap(toHub, container, { view: 'world', worldId: 1 }))
          .toMatchObject({ committed: true });
        expect(container.firstElementChild).toBe(hub);
        expect(world.isConnected).toBe(false);
        expect(controller.getRetainedDescriptors()).toEqual([{ view: 'world', worldId: 1 }]);

        // The same real World card closure is now stale and must not consume the event.
        const staleWorldClick = new MouseEvent('click', { bubbles: true, cancelable: true });
        const staleWorldPreventDefault = jest.spyOn(staleWorldClick, 'preventDefault');
        worldCard.dispatchEvent(staleWorldClick);
        expect(staleWorldClick.defaultPrevented).toBe(false);
        expect(staleWorldPreventDefault).not.toHaveBeenCalled();

        // Reusing the node must not rebind another copy of the live manager handler.
        (hubButton as any).__ccJourneyV700LastTap = 0;
        hubButton.click();
        expect(openWorld).toHaveBeenCalledTimes(cycle + 2);
      }

      expect(container.querySelector(':scope > .journey-v700-hub')).toBe(hub);
      expect(controller.getRetainedDescriptors()).toHaveLength(1);
    } finally {
      controller.dispose();
      manager.journeyStageController = originalController;
      manager.openJourneyV700World = originalOpenWorld;
      manager.cancelJourneyWorldPrepaint = originalCancelWorldPrepaint;
      manager.journeyWorldPrepaintStage = originalWorldPrepaintStage;
      manager.journeyV700View = originalView;
      manager.journeyV700WorldId = originalWorldId;
      document.body.replaceChildren();
    }
  });

  test('manager warm commits retire outgoing animation owners and rebind World input once', () => {
    document.body.innerHTML = `
      <section id="journey-screen">
        <div class="collectibles-scrollable">
          <div id="journey-boards-container" data-journey-v700-view="hub">
            <section class="journey-v700-hub"><div class="hub-child"></div></section>
          </div>
        </div>
      </section>`;

    const manager = journeyBoardsManager as any;
    const container = document.getElementById('journey-boards-container') as HTMLElement;
    const hub = container.firstElementChild as HTMLElement;
    const hubChild = hub.firstElementChild as HTMLElement;
    const world = document.createElement('section');
    world.className = 'journey-stage-test-world';
    const worldChild = document.createElement('div');
    worldChild.className = 'world-child';
    world.appendChild(worldChild);
    const detachedOwner = document.createElement('div');
    detachedOwner.dataset.journeyV700View = 'world';
    detachedOwner.dataset.journeyV700WorldId = '1';

    const controller = new JourneyStageController();
    controller.retainNodes({ view: 'world', worldId: 1 }, [world], detachedOwner);

    const methodNames = [
      'journeyStageController',
      'journeyHubRuntime',
      'journeyWorldRuntime',
      'journeyWorldAnimation',
      'cancelAllRAFs',
      'cancelAllTimeouts',
      'stopForestBeeOrbits',
      'stopBeachBubbleDrift',
      'stopArea55ShipFlybys',
      'cancelJourneyWorldPrepaint',
      'cancelJourneyHubPrepaint',
      'cancelJourneyV700HubEnter',
      'releaseJourneyMainCloudComposites',
      'reconcileMountedJourneyWorldCardUnits',
      'installInterimAreaHitTargets',
      'setupIdleInteractionListeners',
      'trackTimeout',
      'trackRAF',
      'refreshJourneyV700HubProgress',
      'setJourneyV700View',
      'updateJourneyV700Nav',
      'resetJourneyV700HubScrollToTop',
      'installJourneyScreenElasticOverscroll',
      'playJourneyV700HubEnter',
      'journeyV700View',
      'journeyV700WorldId',
      'journeyV700Phase',
      'journeyV700PreparedWorldEnter',
      'renderDisposed',
      'renderLifecycleGeneration',
      'journeyGameplaySuspension',
    ] as const;
    const originals = new Map(methodNames.map((name) => [name, manager[name]]));
    const hubRuntimeDeactivate = jest.fn();
    const worldRuntimeDeactivate = jest.fn();
    const setupIdleInteractionListeners = jest.fn();

    try {
      manager.journeyStageController = controller;
      manager.journeyHubRuntime = { deactivate: hubRuntimeDeactivate };
      manager.journeyWorldRuntime = { deactivate: worldRuntimeDeactivate };
      manager.journeyWorldAnimation = { stop: jest.fn() };
      manager.cancelAllRAFs = jest.fn();
      manager.cancelAllTimeouts = jest.fn();
      manager.stopForestBeeOrbits = jest.fn();
      manager.stopBeachBubbleDrift = jest.fn();
      manager.stopArea55ShipFlybys = jest.fn();
      manager.cancelJourneyWorldPrepaint = jest.fn();
      manager.cancelJourneyHubPrepaint = jest.fn();
      manager.cancelJourneyV700HubEnter = jest.fn();
      manager.releaseJourneyMainCloudComposites = jest.fn();
      manager.reconcileMountedJourneyWorldCardUnits = jest.fn(() => []);
      manager.installInterimAreaHitTargets = jest.fn();
      manager.setupIdleInteractionListeners = setupIdleInteractionListeners;
      manager.trackTimeout = jest.fn((callback: () => void) => { callback(); return 1; });
      manager.trackRAF = jest.fn((callback: FrameRequestCallback) => { callback(0); return 1; });
      manager.refreshJourneyV700HubProgress = jest.fn();
      manager.setJourneyV700View = jest.fn();
      manager.updateJourneyV700Nav = jest.fn();
      manager.resetJourneyV700HubScrollToTop = jest.fn();
      manager.installJourneyScreenElasticOverscroll = jest.fn();
      manager.playJourneyV700HubEnter = jest.fn();
      manager.journeyV700View = 'hub';
      manager.journeyV700WorldId = null;
      manager.renderDisposed = false;
      manager.journeyGameplaySuspension = null;

      gsap.to([hub, hubChild], { x: 20, duration: 10 });
      expect(gsap.getTweensOf([hub, hubChild]).length).toBeGreaterThan(0);

      const toWorld = controller.beginTransition({ view: 'hub' }, { view: 'world', worldId: 1 });
      expect(manager.commitRetainedJourneyWorld(container, 1, toWorld)).toBe(true);
      expect(container.firstElementChild).toBe(world);
      expect(gsap.getTweensOf([hub, hubChild])).toHaveLength(0);
      expect(hubRuntimeDeactivate).toHaveBeenCalledTimes(1);
      expect(setupIdleInteractionListeners).toHaveBeenCalledTimes(1);

      manager.journeyV700View = 'world';
      manager.journeyV700WorldId = 1;
      gsap.to([world, worldChild], { x: 20, duration: 10 });
      expect(gsap.getTweensOf([world, worldChild]).length).toBeGreaterThan(0);

      const toHub = controller.beginTransition({ view: 'world', worldId: 1 }, { view: 'hub' });
      expect(manager.commitRetainedJourneyHub(container, 1, toHub)).toBe(true);
      expect(container.firstElementChild).toBe(hub);
      expect(gsap.getTweensOf([world, worldChild])).toHaveLength(0);
      expect(worldRuntimeDeactivate).toHaveBeenCalledTimes(1);
      expect(setupIdleInteractionListeners).toHaveBeenCalledTimes(1);
      expect(controller.getRetainedDescriptors()).toEqual([{ view: 'world', worldId: 1 }]);
    } finally {
      gsap.killTweensOf([hub, hubChild, world, worldChild]);
      controller.dispose();
      originals.forEach((value, name) => { manager[name] = value; });
      document.body.replaceChildren();
    }
  });
});
