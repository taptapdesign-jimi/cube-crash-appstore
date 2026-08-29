import fs from 'node:fs';
import path from 'node:path';
import {
  createBeachBubbleRiseDuration,
  getBeachBubbleOpacity,
  getBeachBubbleSizeScale,
  getBeachBubbleVerticalBounds,
  resolveJourneyBeachBubbleRuntimeProfile,
  startJourneyBeachBubbleDrift,
} from '../journey-beach-bubble-drift';

describe('Journey Beach ambient Bottle bubbles', () => {
  test('preserves timing, size, opacity and full-screen rise contracts', () => {
    expect(createBeachBubbleRiseDuration(844, 0)).toBeCloseTo(1.45 * 1.84, 8);
    expect(createBeachBubbleRiseDuration(844, 1)).toBeCloseTo(1.9 * 1.84, 8);
    expect(createBeachBubbleRiseDuration(1688, 0.5)).toBeCloseTo(1.675 * 1.84 * 2, 8);
    expect(Array.from({ length: 10 }, (_, index) => getBeachBubbleSizeScale(index)))
      .toEqual([2, 2.5, 3, 3.5, 4, 2, 2.5, 3, 3.5, 4]);
    expect(Array.from({ length: 10 }, (_, index) => getBeachBubbleOpacity(index)))
      .toEqual([0.2, 0.3, 0.4, 0.5, 0.6, 0.2, 0.3, 0.4, 0.5, 0.6]);
    expect(getBeachBubbleVerticalBounds(600, 40)).toEqual({ startY: 600, endY: -54 });
  });

  test('uses the thermal bubble profile on iPhone, iPad and Android while preserving desktop', () => {
    expect(resolveJourneyBeachBubbleRuntimeProfile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)'))
      .toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 60, maxBubbleCount: 10 });
    expect(resolveJourneyBeachBubbleRuntimeProfile('Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X)'))
      .toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 60, maxBubbleCount: 10 });
    expect(resolveJourneyBeachBubbleRuntimeProfile('Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro)'))
      .toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 60, maxBubbleCount: 10 });
    expect(resolveJourneyBeachBubbleRuntimeProfile(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5,
    )).toEqual({ visibilityMarginPx: 80, pixelRatioCap: 1.25, maxFramesPerSecond: 60, maxBubbleCount: 10 });
    expect(resolveJourneyBeachBubbleRuntimeProfile('Mozilla/5.0 (Macintosh; Intel Mac OS X)'))
      .toEqual({ visibilityMarginPx: 180, pixelRatioCap: 2, maxFramesPerSecond: 0, maxBubbleCount: 0 });
  });

  test('renders eighteen pooled logical bubbles through two viewport canvases and zero sprite DOM nodes', () => {
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
    root.style.height = '1440px';
    root.getBoundingClientRect = () => ({
      x: 0, y: -scrollRoot.scrollTop, left: 0, top: -scrollRoot.scrollTop,
      right: 390, bottom: 1440 - scrollRoot.scrollTop,
      width: 390, height: 1440, toJSON: () => ({}),
    });
    const clouds = document.createElement('div');
    clouds.className = 'journey-cloud-container';
    const background = document.createElement('div');
    background.className = 'journey-bg-container';
    background.style.left = '-24px';
    background.style.top = '138px';
    background.style.width = '390px';
    background.style.height = '760px';
    root.append(clouds, background);
    const artTopByBoard = new Map<number, number>();
    for (let boardId = 11; boardId <= 20; boardId += 1) {
      const art = document.createElement('img');
      art.className = 'journey-beach-island-art';
      art.dataset.journeyAreaId = `board-${boardId}`;
      const artTop = 138 + 366 + ((boardId - 11) * 124);
      artTopByBoard.set(boardId, artTop);
      art.getBoundingClientRect = () => {
        const top = artTopByBoard.get(boardId) ?? artTop;
        return {
          x: 50, y: top - scrollRoot.scrollTop, left: 50, top: top - scrollRoot.scrollTop,
          right: 250, bottom: top + 200 - scrollRoot.scrollTop,
          width: 200, height: 200, toJSON: () => ({}),
        };
      };
      root.appendChild(art);
    }
    const cards = document.createElement('div');
    cards.className = 'journey-cards-container';
    cards.style.zIndex = '3';
    root.appendChild(cards);
    scrollRoot.appendChild(root);
    document.body.appendChild(scrollRoot);
    const callbacks = new Set<() => void>();
    const ticker = {
      time: 10,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };
    let sampleIndex = 0;
    const samples = [0.05, 0.42, 0.86, 0.2, 0.65, 0.95, 0.32, 0.72];
    const heightBefore = root.style.height;
    const controller = startJourneyBeachBubbleDrift({
      root,
      scrollRoot,
      leftGutterPx: 24,
      ticker,
      random: () => samples[sampleIndex++ % samples.length],
      observeVisibility: false,
    });

    const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>('.journey-beach-bubble-canvas'));
    expect(canvases).toHaveLength(2);
    expect(root.querySelectorAll('.journey-beach-drift-bubble')).toHaveLength(0);
    expect(root.querySelectorAll('.journey-beach-bubble-layer')).toHaveLength(0);
    expect(canvases[0].dataset.journeyAmbientCanvasDepth).toBe('behind');
    expect(canvases[1].dataset.journeyAmbientCanvasDepth).toBe('front');
    expect(canvases[0].nextElementSibling).toBe(clouds);
    expect(root.lastElementChild).toBe(canvases[1]);
    expect(canvases.every((canvas) => canvas.style.height === '960px')).toBe(true);
    expect(canvases.every((canvas) => canvas.height === 1920)).toBe(true);
    expect(root.style.height).toBe(heightBefore);
    expect(ticker.add).toHaveBeenCalledTimes(1);

    const snapshot = controller.getSnapshot();
    expect(snapshot).toMatchObject({
      disposed: false,
      bubbleCount: 18,
      layerCount: 2,
      tickerCount: 1,
      renderer: 'canvas',
      domImageCount: 0,
      activeBubbleCount: 7,
      maxOpacity: 0.6,
      pixelRatio: 2,
      maxFramesPerSecond: 0,
      visibilityMarginPx: 180,
    });
    expect(snapshot.emitterBoardIds).toEqual([11, 13, 14, 16, 17, 19, 20]);
    expect(snapshot.behindBubbleCount).toBeGreaterThanOrEqual(7);
    expect(snapshot.emitterAnchors.find((anchor) => anchor.boardId === 11))
      .toEqual({ boardId: 11, x: 174, y: 604 });
    expect(snapshot.emitterAnchors.find((anchor) => anchor.boardId === 20)?.y).toBe(1720);

    const initialTransform = canvases[0].style.transform;
    scrollRoot.scrollTop = 900;
    scrollRoot.dispatchEvent(new Event('scroll'));
    expect(canvases[0].style.transform).toBe(initialTransform);
    ticker.time += 1 / 30;
    callbacks.forEach((callback) => callback());
    expect(canvases[0].style.transform).not.toBe(initialTransform);
    expect(canvases[0].style.transform).toBe(canvases[1].style.transform);

    controller.setSuspended(true);
    ticker.time += 0.5;
    callbacks.forEach((callback) => callback());
    expect(canvases.every((canvas) => canvas.style.willChange === 'auto')).toBe(true);
    controller.setSuspended(false);
    ticker.time += 0.05;
    callbacks.forEach((callback) => callback());
    expect(canvases.every((canvas) => canvas.style.willChange === 'transform')).toBe(true);

    artTopByBoard.set(11, (artTopByBoard.get(11) ?? 0) + 50);
    window.dispatchEvent(new Event('resize'));
    for (let frame = 0; frame < 240; frame += 1) {
      ticker.time += 0.05;
      callbacks.forEach((callback) => callback());
    }
    expect(controller.getSnapshot().emitterAnchors.find((anchor) => anchor.boardId === 11)?.y)
      .toBe(654);
    expect(root.style.height).toBe(heightBefore);

    controller.dispose();
    controller.dispose();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
    expect(root.querySelectorAll('.journey-beach-bubble-canvas')).toHaveLength(0);
    expect(controller.getSnapshot()).toMatchObject({
      disposed: true, bubbleCount: 0, layerCount: 0, tickerCount: 0,
    });
    scrollRoot.remove();
  });

  test('keeps ten bubbles and both lower-resolution canvases under the mobile MVP profile', () => {
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
    const root = document.createElement('div');
    root.style.height = '1440px';
    scrollRoot.appendChild(root);
    document.body.appendChild(scrollRoot);
    const callbacks = new Set<() => void>();
    const ticker = {
      time: 5,
      add: (callback: () => void) => callbacks.add(callback),
      remove: (callback: () => void) => callbacks.delete(callback),
    };
    const controller = startJourneyBeachBubbleDrift({
      root,
      scrollRoot,
      ticker,
      random: () => 0.5,
      observeVisibility: false,
      runtimeProfile: resolveJourneyBeachBubbleRuntimeProfile('iPhone'),
    });

    expect(controller.getSnapshot()).toMatchObject({
      bubbleCount: 10,
      layerCount: 2,
      tickerCount: 1,
      pixelRatio: 1.25,
      bitmapPixels: 488 * 950 * 2,
      maxFramesPerSecond: 60,
      visibilityMarginPx: 80,
    });
    const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>('.journey-beach-bubble-canvas'));
    expect(canvases).toHaveLength(2);
    expect(canvases.every((canvas) => canvas.style.height === '760px')).toBe(true);
    expect(canvases.every((canvas) => canvas.width === 488 && canvas.height === 950)).toBe(true);

    controller.dispose();
    expect(callbacks.size).toBe(0);
    expect(root.querySelectorAll('.journey-beach-bubble-canvas')).toHaveLength(0);
    scrollRoot.remove();
  });

  test('manager starts bubbles only for idle Beach and stops them at every owner boundary', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    expect(source).toContain("if (worldId !== 2 || this.journeyV700Phase !== 'idle') return;");
    expect(source).toContain("this.stopBeachBubbleDrift('render-replaced')");
    expect(source).toContain("this.stopBeachBubbleDrift('world-exit')");
    expect(source).toContain("this.stopBeachBubbleDrift('manager-cleanup')");
    expect(source).toContain('ambientOwner.setSuspended(snapshot.ambientSuspended)');
  });
});
