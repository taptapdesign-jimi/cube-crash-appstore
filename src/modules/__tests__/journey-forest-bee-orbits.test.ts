import fs from 'node:fs';
import path from 'node:path';
import {
  createJourneyForestBeeFlightPlans,
  getJourneyForestBeeAssetForVelocity,
  startJourneyForestBeeOrbits,
} from '../journey-forest-bee-orbits';

describe('Journey Forest bee flight experiment', () => {
  test('maps every heading to its authored forward-facing sprite', () => {
    expect(getJourneyForestBeeAssetForVelocity(10, 0)).toBe('bee1');
    expect(getJourneyForestBeeAssetForVelocity(10, -10)).toBe('bee2');
    expect(getJourneyForestBeeAssetForVelocity(-10, 0)).toBe('bee3');
    expect(getJourneyForestBeeAssetForVelocity(-10, -8)).toBe('bee4');
    expect(getJourneyForestBeeAssetForVelocity(-2, -10)).toBe('bee5');
    expect(getJourneyForestBeeAssetForVelocity(5, 10)).toBe('bee6');
    expect(getJourneyForestBeeAssetForVelocity(-5, 10)).toBe('bee7');
    expect(getJourneyForestBeeAssetForVelocity(0, -10)).toBe('bee5');
    expect(getJourneyForestBeeAssetForVelocity(0, 10)).toBe('bee7');
    expect(getJourneyForestBeeAssetForVelocity(0, 0, 'bee4')).toBe('bee4');
  });

  test('starts ten independently spread gate bees behind Forest main without changing the population', () => {
    let sampleIndex = 0;
    const samples = [0.1, 0.8, 0.35, 0.65, 0.2, 0.9, 0.45, 0.7];
    const plans = createJourneyForestBeeFlightPlans(() => samples[sampleIndex++ % samples.length]);

    expect(plans).toHaveLength(19);
    expect(Array.from({ length: 7 }, (_, unitIndex) => plans.filter((_, index) => index % 7 === unitIndex).length))
      .toEqual([3, 3, 3, 3, 3, 2, 2]);
    expect(new Set(plans.map((plan) => plan.scale))).toEqual(new Set([0.65, 0.7, 0.8, 0.9, 1]));
    const gatePlans = plans.filter((plan) => plan.edgeRoute === 'forest-gate');
    expect(gatePlans).toHaveLength(10);
    expect(gatePlans.filter((plan) => plan.gateSide === -1)).toHaveLength(5);
    expect(gatePlans.filter((plan) => plan.gateSide === 1)).toHaveLength(5);
    expect(new Set(gatePlans.map((plan) => Number(plan.gatePassageFraction.toFixed(3)))).size).toBe(10);
    expect(gatePlans.every((plan) => plan.gatePassageFraction >= 0.12 && plan.gatePassageFraction <= 0.88)).toBe(true);
    expect(gatePlans.map((plan) => plan.gateRouteOrdinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    plans.forEach((plan) => {
      expect(plan.points).toHaveLength(16);
      if (plan.edgeRoute === 'forest-gate') {
        expect(plan.durationSeconds).toBeGreaterThanOrEqual(5.5 * 0.84);
        expect(plan.durationSeconds).toBeLessThanOrEqual(5.5 * 1.16);
        expect(plan.phase).toBe('entry');
        expect(plan.elapsedSeconds).toBe(-(plan.gateRouteOrdinal * 1.05));
        const routeX = Array.from({ length: 8 }, (_, pointIndex) => plan.points[pointIndex * 2]);
        const expectedDirection = plan.gateSide === -1 ? 1 : -1;
        routeX.slice(1, 6).forEach((x, pointIndex) => {
          expect((x - routeX[pointIndex]) * expectedDirection).toBeGreaterThan(0);
        });
      } else {
        expect(plan.durationSeconds).toBe(7.5);
        expect(plan.phase).toBe('roam');
        expect(plan.points[0]).toBe(plan.points[14]);
        expect(plan.points[1]).toBe(plan.points[15]);
        expect(plan.points[0]).toBeGreaterThanOrEqual(20);
        expect(plan.points[0]).toBeLessThanOrEqual(370);
      }
    });
  });

  test('keeps nineteen logical bees pooled with two fast-fade image layers and one ticker', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const callbacks = new Set<() => void>();
    const ticker = {
      time: 5,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };
    const controller = startJourneyForestBeeOrbits({
      root,
      contentTopPx: 120,
      leftGutterPx: 24,
      ticker,
      random: () => 0.5,
      observeVisibility: false,
    });

    expect(root.querySelectorAll('.journey-forest-bee-orbit')).toHaveLength(19);
    expect(root.querySelectorAll('.journey-forest-bee-orbit img')).toHaveLength(38);
    expect(new Set(
      Array.from(root.querySelectorAll<HTMLElement>('.journey-forest-bee-orbit'))
        .map((bee) => Number(bee.dataset.forestBeeScale)),
    )).toEqual(new Set([0.65, 0.7, 0.8, 0.9, 1]));
    expect(root.querySelectorAll('[data-forest-bee-edge-route="forest-gate"]')).toHaveLength(10);
    expect(controller.getSnapshot()).toEqual({
      disposed: false,
      beeCount: 19,
      imageLayerCount: 38,
      tickerCount: 1,
      visibleBeeCount: 10,
      gateBeeCount: 10,
      gateEntryCount: 10,
      gateExitCount: 0,
      gateGeometrySource: 'fallback',
      gateCenterX: 183,
      gateCenterY: 72.5,
    });
    expect(root.querySelector<HTMLImageElement>('.journey-forest-bee-orbit img')?.style.transition)
      .toBe('opacity 80ms cubic-bezier(0.2, 0.7, 0.2, 1)');
    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(Array.from(root.querySelectorAll<HTMLElement>('[data-forest-bee-edge-route="forest-gate"]'))
      .every((bee) => bee.dataset.forestBeeDepth === 'behind-forest-main' && bee.style.zIndex === '0')).toBe(true);
    const sideBees = Array.from(root.querySelectorAll<HTMLElement>('[data-forest-bee-edge-route="side"]'));
    expect(sideBees.some((bee) => bee.dataset.forestBeeDepth === 'front' && bee.style.zIndex === '4')).toBe(true);
    expect(sideBees.some((bee) => bee.dataset.forestBeeDepth === 'behind-card' && bee.style.zIndex === '2')).toBe(true);
    expect(sideBees.some((bee) => bee.dataset.forestBeeDepth === 'behind-unit' && bee.style.zIndex === '0')).toBe(true);

    for (let frame = 0; frame < 170; frame += 1) {
      ticker.time += 0.1;
      callbacks.forEach((callback) => callback());
    }
    expect(controller.getSnapshot()).toMatchObject({
      gateBeeCount: 10,
      gateEntryCount: 0,
    });
    const arrivedGateBees = Array.from(
      root.querySelectorAll<HTMLElement>('[data-forest-bee-edge-route="forest-gate"]'),
    );
    expect(arrivedGateBees.every((bee) => ['front', 'behind-card', 'behind-unit']
      .includes(bee.dataset.forestBeeDepth || ''))).toBe(true);
    expect(new Set(arrivedGateBees.map((bee) => bee.dataset.forestBeeDepth)).size).toBe(3);

    for (let frame = 0; frame < 300; frame += 1) {
      ticker.time += 0.1;
      callbacks.forEach((callback) => callback());
    }
    expect(root.querySelectorAll('.journey-forest-bee-orbit')).toHaveLength(19);
    expect(root.querySelectorAll('.journey-forest-bee-orbit img')).toHaveLength(38);

    controller.dispose();
    controller.dispose();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(root.querySelectorAll('.journey-forest-bee-orbit')).toHaveLength(0);
    root.remove();
  });

  test('anchors the gate to the rendered Forest main rect instead of raw map coordinates', () => {
    const root = document.createElement('div');
    const forestMain = document.createElement('img');
    forestMain.className = 'journey-forest-main-art';
    root.appendChild(forestMain);
    document.body.appendChild(root);
    jest.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 390,
      height: 760,
    } as DOMRect);
    jest.spyOn(forestMain, 'getBoundingClientRect').mockReturnValue({
      left: 50,
      top: 200,
      width: 390,
      height: 350,
    } as DOMRect);
    const ticker = { time: 0, add: jest.fn(), remove: jest.fn() };
    const controller = startJourneyForestBeeOrbits({
      root,
      contentTopPx: 120,
      leftGutterPx: 24,
      ticker,
      random: () => 0.5,
      observeVisibility: false,
    });

    const snapshot = controller.getSnapshot();
    expect(snapshot.gateGeometrySource).toBe('dom');
    expect(snapshot.gateCenterX).toBeCloseTo((247 * 390) / window.innerWidth, 4);
    expect(snapshot.gateCenterY).toBeCloseTo((132.5 * 390) / window.innerWidth, 4);

    controller.dispose();
    root.remove();
  });

  test('advances offscreen pooled bees without painting them until their scroll band is visible', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const scrollRoot = document.createElement('div');
    Object.defineProperties(scrollRoot, {
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    scrollRoot.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 400,
      width: 390, height: 400, toJSON: () => ({}),
    });
    const root = document.createElement('div');
    root.getBoundingClientRect = () => ({
      x: 0, y: -scrollRoot.scrollTop, left: 0, top: -scrollRoot.scrollTop,
      right: 390, bottom: 1400 - scrollRoot.scrollTop,
      width: 390, height: 1400, toJSON: () => ({}),
    });
    scrollRoot.appendChild(root);
    document.body.appendChild(scrollRoot);
    const callbacks = new Set<() => void>();
    const ticker = {
      time: 2,
      add: (callback: () => void) => { callbacks.add(callback); },
      remove: (callback: () => void) => { callbacks.delete(callback); },
    };
    const controller = startJourneyForestBeeOrbits({
      root,
      contentTopPx: 0,
      leftGutterPx: 0,
      scrollRoot,
      ticker,
      random: () => 0.5,
      observeVisibility: false,
    });
    const lowerBee = root.querySelector<HTMLElement>('.journey-forest-bee-orbit-12')!;
    expect(lowerBee.style.visibility).toBe('hidden');
    const offscreenTransform = lowerBee.style.transform;
    ticker.time += 0.05;
    callbacks.forEach((callback) => callback());
    expect(lowerBee.style.transform).toBe(offscreenTransform);

    scrollRoot.scrollTop = 600;
    ticker.time += 0.05;
    callbacks.forEach((callback) => callback());
    expect(lowerBee.style.visibility).toBe('visible');
    expect(lowerBee.style.transform).not.toBe(offscreenTransform);
    expect(lowerBee.style.willChange).toBe('transform');

    controller.dispose();
    scrollRoot.remove();
  });

  test('puts gate bees behind the complete Forest main stacking context', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/journey-forest-bee-orbits.ts'),
      'utf8',
    );
    expect(source).toContain("type ForestBeeDepth = 'front' | 'behind-card' | 'behind-unit' | 'behind-forest-main'");
    expect(source).toContain("depth === 'front' ? '4' : depth === 'behind-card' ? '2' : '0'");
    expect(source).toContain('FOREST_BEE_MIN_ONSCREEN_SECONDS = 30');
    expect(source).not.toContain('bee.element.style.opacity =');
    expect(source).toContain('FOREST_BEE_DIRECTION_STABILITY_SECONDS = 0.05');
    expect(source).toContain('const cyclic = plan.phase === \'roam\'');
    expect(source).toContain('scaleX(${scaleX}) scaleY(${scaleY})');
    expect(source).toContain('bee.plan.elapsedSeconds - bee.plan.durationSeconds');
    expect(source).toContain('// Change card depth only after the bee has completed its off-screen exit.');
    expect(source).not.toContain("depthWave > 0.2");
    expect(source).not.toContain("depthWave < -0.2");
    expect(source).toContain('FOREST_BEE_ROAM_RANGE_MULTIPLIER = 1.5');
    expect(source).toContain('FOREST_BEE_DEPTH_SCALES');
    expect(source).toContain('const ownsVerticalSweep = index % 3 === 0');
    expect(source).toContain("edgeRoute: isGateRoute ? 'forest-gate' : 'side'");
    expect(source).toContain('const FOREST_GATE_BEE_COUNT = 10');
    expect(source).toContain("bee.plan.phase === 'entry' && enteredOpening");
    expect(source).toContain("bee.plan.phase === 'exit' && progress >= 0.3 && exitingOpening");
    expect(source).toContain('const entryStartX = entrySide === -1 ? -36 : FOREST_DESIGN_WIDTH + 36');
    expect(source).toContain('const approachOffsetY = -40 + (sample(random) * 90)');
    expect(source).toContain('const entryStartY = clamp(passageY + approachOffsetY, 20, 135)');
    expect(source).toContain('centeredGatePoint(entryStartX, entryStartY)');
    expect(source).toContain('const travelDirection = entrySide === -1 ? 1 : -1');
    expect(source).toContain('gatePassageFraction: 0.12 + ((((gateOrdinal * 0.61803398875) % 1)) * 0.76)');
    expect(source).toContain('const nearPassageX = entrySide === -1 ? gate.passageLeftX : gate.passageRightX');
    expect(source).toContain('const farPassageX = entrySide === -1 ? gate.passageRightX : gate.passageLeftX');
    expect(source).toContain('interface ForestBeeFlightContinuity');
    expect(source).toContain('bouncePhase: bee.plan.bouncePhase');
    expect(source).toContain('tangentX: endX - beforeEndX');
    expect(source).toContain('centeredGatePoint(entryEndX, entryEndY)');
    expect(source).toContain('? 0.5 + (0.5 * clamp(progress / 0.5, 0, 1))');
    expect(source).toContain('plan.elapsedSeconds = -(gateOrdinal * 1.05)');
    expect(source).toContain('nextLayer.onload = promoteLoadedAsset');
    expect(source).toContain('Keep the current painted sprite visible until this direction is decoded.');
    expect(source).toContain(".journey-forest-main-art:not(.journey-beach-main-art):not(.journey-robo-main-art)");
    expect(source).toContain("gateGeometrySource: gateGeometry.source");
    expect(source).toContain('is x=159..207 and y=60..85');
    expect(source).toContain('shorten its usable width by exactly 8%');
    expect(source).toContain('getLaneCenterY(index) + (centered(random) * 108 * 1.5)');
    expect(source).toContain('function chooseRoamDepth(index: number, random: () => number)');
    expect(source).toContain('const beeHalfSize = (plan.width * plan.scale) / 2');
    expect(source).toContain("const gatePassageCenter = plan.phase === 'exit' ? 0.36");
  });

  test('is Forest-only and tied to settled World enter plus every cleanup boundary', () => {
    const managerSource = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    expect(managerSource).toContain('if (worldId !== 1 || this.journeyV700Phase !== \'idle\') return;');
    expect(managerSource).toContain('this.startForestBeeOrbits(container, worldId);');
    expect(managerSource).toContain("this.stopForestBeeOrbits('world-exit');");
    expect(managerSource).toContain("this.stopForestBeeOrbits('render-replaced');");
    expect(managerSource).toContain("this.stopForestBeeOrbits('manager-cleanup');");
    expect(managerSource).toContain("cloudContainer.className = 'journey-cloud-container'");
    expect(managerSource).toContain("bgContainer.querySelectorAll<HTMLElement>('.journey-forest-cloud-art')");
    expect(managerSource).toContain("cloudContainer.style.zIndex = '0'");
  });
});
