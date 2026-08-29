import fs from 'node:fs';
import path from 'node:path';
import {
  createJourneyForestBeeFlightPlans,
  getJourneyForestBeeAssetForVelocity,
  resolveJourneyForestBeeRuntimeProfile,
  startJourneyForestBeeOrbits,
} from '../journey-forest-bee-orbits';

describe('Journey Forest bee canvas flights', () => {
  test('maps every heading to its authored forward-facing sprite', () => {
    expect(getJourneyForestBeeAssetForVelocity(10, 0)).toBe('bee1');
    expect(getJourneyForestBeeAssetForVelocity(10, -10)).toBe('bee2');
    expect(getJourneyForestBeeAssetForVelocity(-10, 0)).toBe('bee3');
    expect(getJourneyForestBeeAssetForVelocity(-10, -8)).toBe('bee4');
    expect(getJourneyForestBeeAssetForVelocity(-2, -10)).toBe('bee5');
    expect(getJourneyForestBeeAssetForVelocity(5, 10)).toBe('bee6');
    expect(getJourneyForestBeeAssetForVelocity(-5, 10)).toBe('bee7');
    expect(getJourneyForestBeeAssetForVelocity(0, 0, 'bee4')).toBe('bee4');
  });

  test('keeps the existing Unit and Forest Main bees', () => {
    let sampleIndex = 0;
    const samples = [0.1, 0.8, 0.35, 0.65, 0.2, 0.9, 0.45, 0.7];
    const plans = createJourneyForestBeeFlightPlans(() => samples[sampleIndex++ % samples.length]);
    expect(plans).toHaveLength(18);
    expect(Array.from({ length: 10 }, (_, unitIndex) => plans.filter((plan) => plan.unitIndex === unitIndex).length))
      .toEqual([1, 1, 2, 1, 2, 2, 1, 2, 1, 1]);
    Array.from({ length: 10 }, (_, unitIndex) => unitIndex).forEach((unitIndex) => {
      const initialUnitBees = plans.filter((plan) => plan.unitIndex === unitIndex);
      expect(initialUnitBees.some((plan) => plan.phase === 'roam' && plan.elapsedSeconds >= 0)).toBe(true);
    });
    const mainPlans = plans.filter((plan) => plan.unitIndex === -1);
    expect(mainPlans).toHaveLength(4);
    expect(mainPlans.every((plan) => plan.phase === 'roam' && plan.elapsedSeconds >= 0)).toBe(true);
    expect(new Set(mainPlans.map((plan) => plan.scale))).toHaveProperty('size', 4);
    mainPlans.forEach((plan) => {
      const ys = Array.from(plan.points).filter((_, pointIndex) => pointIndex % 2 === 1);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(118);
      expect(Math.max(...ys)).toBeLessThanOrEqual(262);
    });
    expect(new Set(plans.map((plan) => plan.scale))).toEqual(new Set([0.65, 0.7, 0.8, 0.9, 1]));
    const gatePlans = plans.filter((plan) => plan.edgeRoute === 'forest-gate');
    expect(gatePlans).toHaveLength(10);
    expect(gatePlans.filter((plan) => plan.gateSide === -1)).toHaveLength(5);
    expect(gatePlans.filter((plan) => plan.gateSide === 1)).toHaveLength(5);
    expect(gatePlans.map((plan) => plan.gateRouteOrdinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    gatePlans.forEach((plan) => {
      expect(plan.points).toHaveLength(16);
      expect(plan.phase).toBe('roam');
      expect(plan.elapsedSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  test('uses the thermal Forest profile on iPhone, iPad and Android while preserving desktop', () => {
    expect(resolveJourneyForestBeeRuntimeProfile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)'))
      .toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 30, maxBeeCount: 10 });
    expect(resolveJourneyForestBeeRuntimeProfile('Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X)'))
      .toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 30, maxBeeCount: 10 });
    expect(resolveJourneyForestBeeRuntimeProfile('Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro)'))
      .toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 30, maxBeeCount: 10 });
    expect(resolveJourneyForestBeeRuntimeProfile(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5,
    )).toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 30, maxBeeCount: 10 });
    expect(resolveJourneyForestBeeRuntimeProfile('Mozilla/5.0 (Macintosh; Intel Mac OS X)'))
      .toEqual({ visibilityMarginPx: 180, pixelRatioCap: 2, maxFramesPerSecond: 0, maxBeeCount: 0 });
  });

  test('paints eighteen logical bees through two viewport canvases, one ticker and zero sprite DOM nodes', () => {
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 390 },
      innerHeight: { configurable: true, value: 844 },
      devicePixelRatio: { configurable: true, value: 3 },
    });
    const root = document.createElement('div');
    root.style.height = '1400px';
    const clouds = document.createElement('div');
    clouds.className = 'journey-cloud-container';
    root.appendChild(clouds);
    const background = document.createElement('div');
    background.className = 'journey-bg-container';
    root.appendChild(background);
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

    const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>('.journey-forest-bee-canvas'));
    expect(canvases).toHaveLength(2);
    expect(root.querySelectorAll('.journey-forest-bee-orbit')).toHaveLength(0);
    expect(root.querySelectorAll('.journey-forest-bee-orbit img')).toHaveLength(0);
    expect(clouds.nextElementSibling).toBe(canvases[0]);
    expect(canvases[0].nextElementSibling).toBe(background);
    expect(canvases[0].style.zIndex).toBe('1');
    expect(root.lastElementChild).toBe(canvases[1]);
    expect(canvases.every((canvas) => canvas.style.height === '1204px')).toBe(true);
    expect(canvases.every((canvas) => canvas.height === 2408)).toBe(true);
    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(canvases.every((canvas) => canvas.style.opacity === '0')).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      disposed: false,
      beeCount: 18,
      mainBeeCount: 4,
      imageLayerCount: 0,
      tickerCount: 1,
      gateBeeCount: 10,
      gateEntryCount: 0,
      gateExitCount: 0,
      gateGeometrySource: 'fallback',
      gateCenterX: 183,
      gateCenterY: 72.5,
      renderer: 'canvas',
      canvasCount: 2,
      domImageCount: 0,
      pixelRatio: 2,
      maxFramesPerSecond: 0,
      visibilityMarginPx: 180,
    });

    controller.setSuspended(true);
    ticker.time += 0.5;
    callbacks.forEach((callback) => callback());
    expect(canvases.every((canvas) => canvas.style.willChange === 'auto')).toBe(true);
    controller.setSuspended(false);
    for (let frame = 0; frame < 320; frame += 1) {
      ticker.time += 0.1;
      callbacks.forEach((callback) => callback());
    }
    expect(controller.getSnapshot()).toMatchObject({ gateBeeCount: 10, gateEntryCount: 0 });
    expect(root.querySelectorAll('.journey-forest-bee-canvas')).toHaveLength(2);

    controller.dispose();
    controller.dispose();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
    expect(root.querySelectorAll('.journey-forest-bee-canvas')).toHaveLength(0);
    expect(controller.getSnapshot()).toMatchObject({
      disposed: true, beeCount: 0, tickerCount: 0, canvasCount: 0,
    });
    root.remove();
  });

  test('anchors the gate to the rendered Forest main rect instead of raw map coordinates', () => {
    const root = document.createElement('div');
    const forestMain = document.createElement('img');
    forestMain.className = 'journey-forest-main-art';
    root.appendChild(forestMain);
    document.body.appendChild(root);
    jest.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      left: 10, top: 20, width: 390, height: 760,
    } as DOMRect);
    jest.spyOn(forestMain, 'getBoundingClientRect').mockReturnValue({
      left: 50, top: 200, width: 390, height: 350,
    } as DOMRect);
    const ticker = { time: 0, add: jest.fn(), remove: jest.fn() };
    const controller = startJourneyForestBeeOrbits({
      root, contentTopPx: 120, leftGutterPx: 24, ticker, random: () => 0.5,
      observeVisibility: false,
    });
    expect(controller.getSnapshot()).toMatchObject({
      gateGeometrySource: 'dom',
      gateCenterX: (247 * 390) / window.innerWidth,
      gateCenterY: (132.5 * 390) / window.innerWidth,
    });
    controller.dispose();
    root.remove();
  });

  test('keeps one bee per Unit through lower-resolution canvases under the mobile MVP profile', () => {
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 390 },
      innerHeight: { configurable: true, value: 844 },
      devicePixelRatio: { configurable: true, value: 3 },
    });
    const root = document.createElement('div');
    root.style.height = '1400px';
    document.body.appendChild(root);
    const callbacks = new Set<() => void>();
    const ticker = {
      time: 4,
      add: (callback: () => void) => callbacks.add(callback),
      remove: (callback: () => void) => callbacks.delete(callback),
    };
    const controller = startJourneyForestBeeOrbits({
      root,
      contentTopPx: 120,
      leftGutterPx: 24,
      ticker,
      random: () => 0.5,
      observeVisibility: false,
      runtimeProfile: resolveJourneyForestBeeRuntimeProfile('iPhone'),
    });

    expect(controller.getSnapshot()).toMatchObject({
      beeCount: 10,
      canvasCount: 2,
      tickerCount: 1,
      pixelRatio: 1.25,
      bitmapPixels: 488 * 1255 * 2,
      maxFramesPerSecond: 30,
      visibilityMarginPx: 80,
    });
    const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>('.journey-forest-bee-canvas'));
    expect(canvases).toHaveLength(2);
    expect(canvases.every((canvas) => canvas.style.height === '1004px')).toBe(true);
    expect(canvases.every((canvas) => canvas.width === 488 && canvas.height === 1255)).toBe(true);
    controller.setScrollCadenceBoosted(true);
    expect(controller.getSnapshot()).toMatchObject({ maxFramesPerSecond: 60 });
    controller.setScrollCadenceBoosted(false);
    expect(controller.getSnapshot()).toMatchObject({ maxFramesPerSecond: 30 });

    controller.dispose();
    expect(callbacks.size).toBe(0);
    root.remove();
  });

  test('moves only the two bounded canvas layers with native scroll', () => {
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
    root.style.height = '1400px';
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
      add: (callback: () => void) => callbacks.add(callback),
      remove: (callback: () => void) => callbacks.delete(callback),
    };
    const controller = startJourneyForestBeeOrbits({
      root, contentTopPx: 0, leftGutterPx: 0, scrollRoot, ticker,
      random: () => 0.5, observeVisibility: false,
    });
    const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>('.journey-forest-bee-canvas'));
    const initialTransform = canvases[0].style.transform;
    scrollRoot.scrollTop = 600;
    scrollRoot.dispatchEvent(new Event('scroll'));
    expect(canvases[0].style.transform).toBe(initialTransform);
    ticker.time += 1 / 30;
    callbacks.forEach((callback) => callback());
    expect(canvases[0].style.transform).not.toBe(initialTransform);
    expect(canvases[0].style.transform).toBe(canvases[1].style.transform);
    expect(canvases.every((canvas) => canvas.style.height === '760px')).toBe(true);
    controller.dispose();
    scrollRoot.remove();
  });

  test('retains route continuity while replacing per-sprite DOM compositing', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/journey-forest-bee-orbits.ts'),
      'utf8',
    );
    expect(source).toContain("type ForestBeeDepth = 'front' | 'behind-forest-main'");
    expect(source).toContain("type ForestBeeEdgeRoute = 'side' | 'forest-gate'");
    expect(source).not.toContain("'behind-card'");
    expect(source).not.toContain("'behind-unit'");
    expect(source).toContain('FOREST_BEE_MIN_ONSCREEN_SECONDS = 30');
    expect(source).toContain('FOREST_BEE_ROAM_SECONDS = 11');
    expect(source).toContain('FOREST_BEE_EDGE_SECONDS = 7.8');
    expect(source).toContain('FOREST_BEE_BOUNCE_GAIN = 1.125');
    expect(source).toContain('FOREST_BEE_DIRECTION_STABILITY_SECONDS = 0.05');
    expect(source).toContain('FOREST_BEE_DIRECTION_FADE_SECONDS = 0.08');
    expect(source).toContain('startJourneyAmbientCanvasRuntime({');
    expect(source).toContain("className: 'journey-forest-bee-canvas'");
    expect(source).toContain('runtime.fadeIn(360)');
    expect(source).toContain("const context = bee.depth === 'front' ? frame.front : frame.behind");
    expect(source).toContain('behindBefore: backgroundLayer');
    expect(source).toContain('behindZIndex: 1');
    expect(source).not.toContain("document.createElement('div')");
    expect(source).not.toContain('bee.element.style.transform');
    expect(source).toContain('bee.plan.elapsedSeconds - bee.plan.durationSeconds');
    expect(source).toContain('tangentX: endX - beforeEndX');
    expect(source).toContain("bee.plan.phase === 'entry' && enteredOpening");
  });

  test('is Forest-only and tied to settled World enter plus every cleanup boundary', () => {
    const managerSource = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    expect(managerSource).toContain("if (worldId !== 1 || this.journeyV700Phase !== 'idle') return;");
    expect(managerSource).toContain("this.stopForestBeeOrbits('render-replaced')");
    expect(managerSource).toContain("this.stopForestBeeOrbits('world-exit')");
    expect(managerSource).toContain('this.forestBeeOrbits.fadeOutAndDispose(220)');
    expect(managerSource).toContain("this.stopForestBeeOrbits('manager-cleanup')");
    expect(managerSource).toContain('ambientOwner.setSuspended(snapshot.ambientSuspended)');
  });
});
