import { startJourneyAmbientCanvasRuntime } from '../journey-ambient-canvas-runtime';

describe('Journey ambient canvas runtime', () => {
  test('owns two bounded canvases, one ticker and complete suspend/dispose cleanup', () => {
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
    const visualAnchor = document.createElement('div');
    root.appendChild(visualAnchor);
    scrollRoot.appendChild(root);
    document.body.appendChild(scrollRoot);
    const callbacks = new Set<() => void>();
    const ticker = {
      time: 2,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };
    const render = jest.fn(() => 4);
    const heightBefore = root.style.height;
    const runtime = startJourneyAmbientCanvasRuntime({
      root,
      scrollRoot,
      ticker,
      sceneWidthPx: 390,
      sceneHeightPx: 1800,
      visibilityMarginPx: 180,
      behindBefore: visualAnchor,
      className: 'journey-test-ambient-canvas',
      observeVisibility: false,
      render,
    });

    const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>('.journey-test-ambient-canvas'));
    expect(canvases).toHaveLength(2);
    expect(canvases[0].nextElementSibling).toBe(visualAnchor);
    expect(canvases.every((canvas) => canvas.style.position === 'absolute')).toBe(true);
    expect(canvases.every((canvas) => canvas.style.contain === 'strict')).toBe(true);
    expect(canvases.every((canvas) => canvas.style.pointerEvents === 'none')).toBe(true);
    expect(canvases.every((canvas) => canvas.style.height === '960px')).toBe(true);
    expect(canvases.every((canvas) => canvas.height === 1920)).toBe(true);
    expect(root.style.height).toBe(heightBefore);
    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toEqual({
      disposed: false,
      canvasCount: 2,
      tickerCount: 1,
      visibleSpriteCount: 4,
      pixelRatio: 2,
      bitmapPixels: 390 * 2 * 960 * 2 * 2,
    });

    scrollRoot.scrollTop = 1000;
    scrollRoot.dispatchEvent(new Event('scroll'));
    expect(canvases[0].style.transform).toBe('translate3d(0,820px,0)');
    expect(canvases[1].style.transform).toBe(canvases[0].style.transform);
    expect(root.style.height).toBe(heightBefore);

    runtime.setSuspended(true);
    ticker.time += 1;
    callbacks.forEach((callback) => callback());
    expect(render).toHaveBeenCalledTimes(1);
    expect(canvases.every((canvas) => canvas.style.willChange === 'auto')).toBe(true);
    runtime.setSuspended(false);
    ticker.time += 0.05;
    callbacks.forEach((callback) => callback());
    expect(render).toHaveBeenCalledTimes(2);

    runtime.setSceneHeight(2000);
    expect(canvases.every((canvas) => canvas.style.height === '960px')).toBe(true);
    expect(root.style.height).toBe(heightBefore);
    runtime.dispose();
    runtime.dispose();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
    expect(root.querySelectorAll('.journey-test-ambient-canvas')).toHaveLength(0);
    expect(runtime.getSnapshot()).toMatchObject({
      disposed: true, canvasCount: 0, tickerCount: 0, bitmapPixels: 0,
    });
    scrollRoot.remove();
  });
});
