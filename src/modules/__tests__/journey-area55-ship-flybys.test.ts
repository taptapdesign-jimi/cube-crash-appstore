import fs from 'node:fs';
import path from 'node:path';
import {
  advanceJourneyArea55ShipRotation,
  advanceJourneyArea55ShipScale,
  clampJourneyArea55ShipRotation,
  getJourneyArea55ShipSize,
  resolveJourneyArea55ShipCanvasGeometry,
  resolveJourneyArea55ShipRuntimeProfile,
  resolveJourneyArea55ShipTargetRotation,
  startJourneyArea55ShipFlybys,
} from '../journey-area55-ship-flybys';

describe('Journey Area 55 pooled ship flybys', () => {
  test('holds one scale for at least three seconds before a short smooth change', () => {
    const scale = {
      scaleWave: 0.25,
      scaleFromWave: 0.25,
      scaleTargetWave: 0.25,
      scaleHoldSeconds: 3,
      scaleTransitionSeconds: 0.45,
    };
    const random = jest.fn()
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.5);

    advanceJourneyArea55ShipScale(scale, 2.99, random);
    expect(scale.scaleWave).toBe(0.25);
    expect(random).not.toHaveBeenCalled();

    advanceJourneyArea55ShipScale(scale, 0.21, random);
    expect(scale.scaleWave).toBeGreaterThan(0.25);
    expect(scale.scaleWave).toBeLessThan(0.75);
    expect(random).toHaveBeenCalledTimes(1);

    advanceJourneyArea55ShipScale(scale, 0.25, random);
    expect(scale.scaleWave).toBe(0.75);
    expect(scale.scaleHoldSeconds).toBe(3.75);
    expect(random).toHaveBeenCalledTimes(2);
  });

  test('halves scale and clamps every bank to twenty degrees', () => {
    expect(getJourneyArea55ShipSize(55, 0)).toBe(50);
    expect(getJourneyArea55ShipSize(62.5, 0.5)).toBe(62.5);
    expect(getJourneyArea55ShipSize(69.5, 1)).toBe(75);
    expect(clampJourneyArea55ShipRotation(Math.PI / 2)).toBeCloseTo(20 * Math.PI / 180, 10);
    expect(clampJourneyArea55ShipRotation(-Math.PI / 2)).toBeCloseTo(-20 * Math.PI / 180, 10);
  });

  test('uses the same continuous bank for leftward and rightward path slopes', () => {
    const rightward = resolveJourneyArea55ShipTargetRotation(4, 0.5, 0.25, 0.4);
    const leftward = resolveJourneyArea55ShipTargetRotation(-4, 0.5, 0.25, 0.4);
    const rightwardDescending = resolveJourneyArea55ShipTargetRotation(4, -0.5, 0.25, 0.4);
    const leftwardDescending = resolveJourneyArea55ShipTargetRotation(-4, -0.5, 0.25, 0.4);

    expect(leftward).toBeCloseTo(rightward, 10);
    expect(leftwardDescending).toBeCloseTo(rightwardDescending, 10);
  });

  test('crosses from positive to negative bank over visible intermediate degrees', () => {
    const degrees = (radians: number): number => radians * 180 / Math.PI;
    const target = -20 * Math.PI / 180;
    const samples: number[] = [];
    let rotation = 20 * Math.PI / 180;

    for (let frame = 0; frame < 20; frame += 1) {
      rotation = advanceJourneyArea55ShipRotation(rotation, target, 1 / 30);
      samples.push(degrees(rotation));
    }

    expect(samples[0]).toBeCloseTo(17, 8);
    expect(samples[0]).toBeGreaterThan(0);
    expect(samples.some((sample) => sample > -1 && sample < 1)).toBe(true);
    expect(samples[samples.length - 1]).toBeLessThan(-18);
    samples.forEach((sample, index) => {
      if (index === 0) return;
      expect(Math.abs(sample - samples[index - 1])).toBeLessThanOrEqual(3.000000001);
    });
  });

  test('keeps the reduced mobile ship budget while painting flybys at 60 FPS', () => {
    expect(resolveJourneyArea55ShipRuntimeProfile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)'))
      .toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 60, maxShipCount: 2 });
    expect(resolveJourneyArea55ShipRuntimeProfile('Mozilla/5.0 (Linux; Android 15)'))
      .toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 60, maxShipCount: 2 });
  });

  test('uses the physical scroll viewport instead of applying the 24px Journey gutter twice', () => {
    const scrollRoot = document.createElement('div');
    Object.defineProperty(scrollRoot, 'clientWidth', { configurable: true, value: 390 });
    scrollRoot.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 600,
      width: 390, height: 600, toJSON: () => ({}),
    });
    const root = document.createElement('div');
    root.getBoundingClientRect = () => ({
      x: 0, y: 20, left: 0, top: 20, right: 390, bottom: 5220,
      width: 390, height: 5200, toJSON: () => ({}),
    });

    expect(resolveJourneyArea55ShipCanvasGeometry(root, scrollRoot, 390, 24)).toEqual({
      left: 0,
      width: 390,
    });
  });

  test('pools exactly four cross-screen ships above craters but below cards in alternating lanes', () => {
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 390 },
      innerHeight: { configurable: true, value: 844 },
      devicePixelRatio: { configurable: true, value: 3 },
    });
    const scrollRoot = document.createElement('div');
    Object.defineProperties(scrollRoot, {
      clientHeight: { configurable: true, value: 600 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    scrollRoot.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 600,
      width: 390, height: 600, toJSON: () => ({}),
    });
    const root = document.createElement('div');
    root.style.height = '5200px';
    root.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 5200,
      width: 390, height: 5200, toJSON: () => ({}),
    });
    const clouds = document.createElement('div');
    clouds.className = 'journey-cloud-container';
    const background = document.createElement('div');
    background.className = 'journey-bg-container';
    background.style.left = '-24px';
    background.style.width = '390px';
    const decor = document.createElement('div');
    decor.className = 'journey-decor-container';
    decor.style.zIndex = '2';
    const cards = document.createElement('div');
    cards.className = 'journey-cards-container';
    cards.style.zIndex = '3';
    root.append(clouds, background, decor, cards);
    const addArt = (className: string, areaId: string, top: number): void => {
      const art = document.createElement('img');
      art.className = className;
      art.dataset.journeyAreaId = areaId;
      art.getBoundingClientRect = () => ({
        x: 95, y: top, left: 95, top, right: 295, bottom: top + 200,
        width: 200, height: 200, toJSON: () => ({}),
      });
      root.appendChild(art);
    };
    addArt('journey-robo-main-art', 'robo-main', 3166);
    for (let boardId = 21; boardId <= 30; boardId += 1) {
      addArt('journey-robo-island-art', `board-${boardId}`, 3532 + (boardId - 21) * 124);
    }
    scrollRoot.appendChild(root);
    document.body.appendChild(scrollRoot);
    const callbacks = new Set<() => void>();
    const ticker = {
      time: 10,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };
    const controller = startJourneyArea55ShipFlybys({
      root, scrollRoot, ticker, random: () => 0.75, observeVisibility: false,
      runtimeProfile: resolveJourneyArea55ShipRuntimeProfile('iPhone'),
    });

    expect(controller.getSnapshot()).toMatchObject({
      disposed: false,
      shipCount: 2,
      behindShipCount: 0,
      frontShipCount: 2,
      minShipSizePx: 50,
      maxShipSizePx: 75,
      canvasCount: 2,
      tickerCount: 1,
      domImageCount: 0,
      renderer: 'canvas',
      asset: './assets/journey assets/robo/ship1@2x.png',
      maxRotationDegrees: 20,
      maxFramesPerSecond: 60,
    });
    const canvases = root.querySelectorAll('.journey-area55-ship-canvas');
    expect(canvases).toHaveLength(2);
    expect((canvases[0] as HTMLCanvasElement).style.left).toBe('0px');
    expect((canvases[0] as HTMLCanvasElement).style.width).toBe('390px');
    expect(canvases[0]?.nextElementSibling).toBe(clouds);
    expect((canvases[1] as HTMLCanvasElement).style.zIndex).toBe('2');
    expect(decor.compareDocumentPosition(canvases[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(Number((canvases[1] as HTMLCanvasElement).style.zIndex)).toBeLessThan(Number(cards.style.zIndex));
    expect(root.querySelectorAll('.journey-area55-ship')).toHaveLength(0);
    expect(ticker.add).toHaveBeenCalledTimes(1);

    controller.setSuspended(true);
    controller.dispose();
    controller.dispose();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
    expect(root.querySelectorAll('.journey-area55-ship-canvas')).toHaveLength(0);
    expect(controller.getSnapshot()).toMatchObject({ disposed: true, shipCount: 0, canvasCount: 0, tickerCount: 0 });
    scrollRoot.remove();
  });

  test('uses only ship1, full-screen eased paths and every manager boundary', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'assets/journey assets/robo/ship1@2x.png'))).toBe(true);
    const flybySource = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/journey-area55-ship-flybys.ts'), 'utf8');
    expect(flybySource).toContain("const SHIP_ASSET = './assets/journey assets/robo/ship1@2x.png'");
    expect(flybySource).not.toContain('ship2@2x.png');
    expect(flybySource).toContain('const SHIP_COUNT = 4');
    expect(flybySource).toContain("depth: 'front'");
    expect(flybySource).toContain('frontZIndex: 2');
    expect(flybySource).toContain("lane: index % 2 === 0 ? 'upper' : 'lower'");
    expect(flybySource).toContain("ship.lane === 'upper' ? 0.12 : 0.62");
    expect(flybySource).not.toContain('drawTrail');
    expect(flybySource).not.toContain('TRAIL_COLOR');
    expect(flybySource).toContain('const eased = progress * progress * (3 - 2 * progress)');
    expect(flybySource).toContain('const MIN_SCALE_HOLD_SECONDS = 3');
    expect(flybySource).toContain('advanceJourneyArea55ShipRotation(ship.rotation, targetRotation, frame.deltaSeconds)');
    expect(flybySource).not.toContain('Math.atan2(velocityY, velocityX)');
    expect(flybySource).not.toContain('progress * Math.PI * 6');
    expect(flybySource).toContain('ship.startX = ship.direction === 1 ? -overshoot : layerWidth + overshoot');
    expect(flybySource).toContain('ship.endX = ship.direction === 1 ? layerWidth + overshoot : -overshoot');
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'), 'utf8');
    expect(source).toContain("if (worldId !== 3 || this.journeyV700Phase !== 'idle') return;");
    expect(source).toContain("this.stopArea55ShipFlybys('render-replaced')");
    expect(source).toContain("this.stopArea55ShipFlybys('world-exit')");
    expect(source).toContain("this.stopArea55ShipFlybys('manager-cleanup')");
    expect(source).toContain('this.startArea55ShipFlybys(container, worldId)');
    expect(source).toContain('[this.forestBeeOrbits, this.beachBubbleDrift, this.area55ShipFlybys]');
  });
});
