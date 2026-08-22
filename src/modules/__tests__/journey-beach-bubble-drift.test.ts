import fs from 'node:fs';
import path from 'node:path';
import {
  createBeachBubbleRiseDuration,
  getBeachBubbleOpacity,
  getBeachBubbleSizeScale,
  getBeachBubbleVerticalBounds,
  startJourneyBeachBubbleDrift,
} from '../journey-beach-bubble-drift';

describe('Journey Beach ambient Bottle bubbles', () => {
  test('adds another gentle slowdown to the previous 60-percent-slower Bottle timing', () => {
    expect(createBeachBubbleRiseDuration(844, 0)).toBeCloseTo(1.45 * 1.84, 8);
    expect(createBeachBubbleRiseDuration(844, 1)).toBeCloseTo(1.9 * 1.84, 8);
    expect(createBeachBubbleRiseDuration(1688, 0.5)).toBeCloseTo(1.675 * 1.84 * 2, 8);
  });

  test('doubles the complete prior size mix while preserving intermediate variation', () => {
    expect(Array.from({ length: 10 }, (_, index) => getBeachBubbleSizeScale(index)))
      .toEqual([2, 2.5, 3, 3.5, 4, 2, 2.5, 3, 3.5, 4]);
  });

  test('guarantees a soft opacity mix with a strict 60-percent maximum', () => {
    expect(Array.from({ length: 10 }, (_, index) => getBeachBubbleOpacity(index)))
      .toEqual([0.2, 0.3, 0.4, 0.5, 0.6, 0.2, 0.3, 0.4, 0.5, 0.6]);
  });

  test('travels from its exact Unit-centre emitter to fully above the screen', () => {
    expect(getBeachBubbleVerticalBounds(600, 40)).toEqual({
      startY: 600,
      endY: -54,
    });
  });

  test('owns eighteen clipped bubbles from the seven selected Beach Unit centres', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const root = document.createElement('div');
    root.style.height = '1440px';
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
      const unitArt = document.createElement('img');
      unitArt.className = 'journey-beach-island-art';
      unitArt.dataset.journeyAreaId = `board-${boardId}`;
      const unitIndex = boardId - 11;
      const artTop = 138 + 366 + unitIndex * 124;
      artTopByBoard.set(boardId, artTop);
      unitArt.getBoundingClientRect = () => ({
        x: 50,
        y: artTopByBoard.get(boardId) || artTop,
        left: 50,
        top: artTopByBoard.get(boardId) || artTop,
        right: 250,
        bottom: (artTopByBoard.get(boardId) || artTop) + 200,
        width: 200,
        height: 200,
        toJSON: () => ({}),
      });
      root.appendChild(unitArt);
    }
    const cards = document.createElement('div');
    cards.className = 'journey-cards-container';
    cards.style.zIndex = '3';
    root.appendChild(cards);
    document.body.appendChild(root);
    const callbacks = new Set<() => void>();
    const ticker = {
      time: 10,
      add: jest.fn((callback: () => void) => callbacks.add(callback)),
      remove: jest.fn((callback: () => void) => callbacks.delete(callback)),
    };
    let sampleIndex = 0;
    const samples = [0.05, 0.42, 0.86, 0.2, 0.65, 0.95, 0.32, 0.72];
    const random = () => samples[sampleIndex++ % samples.length];
    const heightBefore = root.style.height;

    const controller = startJourneyBeachBubbleDrift({
      root,
      leftGutterPx: 24,
      ticker,
      random,
      observeVisibility: false,
    });

    const layers = Array.from(root.querySelectorAll<HTMLElement>('.journey-beach-bubble-layer'));
    expect(layers).toHaveLength(4);
    expect(layers.every((layer) => layer.style.overflow === 'hidden')).toBe(true);
    expect(layers.every((layer) => layer.style.top === '0px')).toBe(true);
    expect(layers.every((layer) => layer.style.height === '1820px')).toBe(true);
    expect(layers.every((layer) => layer.style.left === '-24px')).toBe(true);
    expect(root.firstElementChild).toBe(layers[0]);
    expect(layers[1].nextElementSibling).toBe(background);
    expect(layers[2].nextElementSibling).toBe(cards);
    expect(layers[2].style.zIndex).toBe('2');
    expect(cards.style.zIndex).toBe('3');
    expect(root.lastElementChild).toBe(layers[3]);
    expect(root.querySelectorAll('.journey-beach-drift-bubble')).toHaveLength(18);
    expect(new Set(Array.from(root.querySelectorAll<HTMLElement>('.journey-beach-drift-bubble'))
      .map((bubble) => bubble.dataset.beachBubbleEmitterBoard)))
      .toEqual(new Set(['11', '13', '14', '16', '17', '19', '20']));
    expect(Array.from(root.querySelectorAll<HTMLElement>(
      '.journey-beach-drift-bubble[data-beach-bubble-emitter-board="11"]',
    )).every((bubble) => (
      bubble.dataset.beachBubbleEmitterX === '174'
      && bubble.dataset.beachBubbleEmitterY === '604'
    ))).toBe(true);
    expect(Array.from(root.querySelectorAll<HTMLElement>(
      '.journey-beach-drift-bubble[data-beach-bubble-emitter-board="20"]',
    )).every((bubble) => Number(bubble.dataset.beachBubbleEmitterY) === 1720)).toBe(true);
    expect(new Set(Array.from(root.querySelectorAll<HTMLElement>('.journey-beach-drift-bubble'))
      .map((bubble) => Number(bubble.dataset.beachBubbleOpacity))))
      .toEqual(new Set([0.2, 0.3, 0.4, 0.5, 0.6]));
    expect(Math.max(...Array.from(root.querySelectorAll<HTMLElement>('.journey-beach-drift-bubble'))
      .map((bubble) => Number(bubble.dataset.beachBubbleOpacity)))).toBe(0.6);
    expect(new Set(layers.map((layer) => layer.querySelectorAll('img').length)).size)
      .toBeGreaterThan(1);
    const immediateBubbles = Array.from(root.querySelectorAll<HTMLImageElement>(
      '.journey-beach-drift-bubble',
    )).filter((bubble) => Number(bubble.style.opacity) > 0);
    expect(immediateBubbles).toHaveLength(7);
    expect(immediateBubbles.every((bubble) => (
      bubble.parentElement?.classList.contains('journey-beach-bubble-layer--birth')
      && Number(bubble.style.opacity) === Number(bubble.dataset.beachBubbleOpacity)
    ))).toBe(true);
    expect(Array.from(root.querySelectorAll<HTMLImageElement>('.journey-beach-drift-bubble'))
      .every((bubble) => /bottle animation pack\/bubble[1-6]\.png$/
        .test(bubble.getAttribute('src') || ''))).toBe(true);
    expect(root.style.height).toBe(heightBefore);
    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({
      disposed: false,
      bubbleCount: 18,
      layerCount: 4,
      tickerCount: 1,
      visibleBubbleCount: 7,
    });
    expect(new Set(Array.from(root.querySelectorAll<HTMLImageElement>('.journey-beach-drift-bubble'))
      .filter((bubble) => Number(bubble.style.opacity) > 0)
      .map((bubble) => bubble.dataset.beachBubbleEmitterBoard)))
      .toEqual(new Set(['11', '13', '14', '16', '17', '19', '20']));

    const immediateUnitOne = Array.from(root.querySelectorAll<HTMLImageElement>(
      '.journey-beach-drift-bubble[data-beach-bubble-emitter-board="11"]',
    )).find((bubble) => Number(bubble.style.opacity) > 0)!;
    const initialY = Number(immediateUnitOne.style.transform.match(/,(-?[\d.]+)px,0\)$/)?.[1]);
    ticker.time += 0.05;
    callbacks.forEach((callback) => callback());
    const firstFrameY = Number(immediateUnitOne.style.transform.match(/,(-?[\d.]+)px,0\)$/)?.[1]);
    expect(initialY - firstFrameY).toBeGreaterThan(1);

    artTopByBoard.set(11, (artTopByBoard.get(11) || 0) + 50);

    for (let frame = 0; frame < 240; frame += 1) {
      ticker.time += 0.05;
      callbacks.forEach((callback) => callback());
    }
    const visible = Array.from(root.querySelectorAll<HTMLImageElement>('.journey-beach-drift-bubble'))
      .filter((bubble) => Number(bubble.style.opacity) > 0);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.some((bubble) => bubble.style.transform.includes('translate3d('))).toBe(true);
    expect(Array.from(root.querySelectorAll<HTMLElement>(
      '.journey-beach-drift-bubble[data-beach-bubble-emitter-board="11"]',
    )).every((bubble) => Number(bubble.dataset.beachBubbleEmitterY) === 654)).toBe(true);
    expect(root.style.height).toBe(heightBefore);

    controller.dispose();
    controller.dispose();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
    expect(root.querySelectorAll('.journey-beach-bubble-layer')).toHaveLength(0);
    expect(controller.getSnapshot()).toEqual({
      disposed: true,
      bubbleCount: 0,
      layerCount: 0,
      tickerCount: 0,
      visibleBubbleCount: 0,
    });
    root.remove();
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
    expect(source).not.toMatch(/BeachBird|beachBird|journey-beach-bird/);
  });

  test('keeps offscreen pooled bubbles on their timeline without per-frame compositor writes', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
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
    const background = document.createElement('div');
    background.className = 'journey-bg-container';
    background.style.height = '1440px';
    root.appendChild(background);
    for (let boardId = 11; boardId <= 20; boardId += 1) {
      const art = document.createElement('img');
      art.className = 'journey-beach-island-art';
      art.dataset.journeyAreaId = `board-${boardId}`;
      const top = 300 + ((boardId - 11) * 124);
      art.getBoundingClientRect = () => ({
        x: 50, y: top, left: 50, top, right: 250, bottom: top + 200,
        width: 200, height: 200, toJSON: () => ({}),
      });
      root.appendChild(art);
    }
    scrollRoot.appendChild(root);
    document.body.appendChild(scrollRoot);
    const callbacks = new Set<() => void>();
    const ticker = {
      time: 1,
      add: (callback: () => void) => { callbacks.add(callback); },
      remove: (callback: () => void) => { callbacks.delete(callback); },
    };
    const controller = startJourneyBeachBubbleDrift({
      root,
      scrollRoot,
      ticker,
      random: () => 0.5,
      observeVisibility: false,
    });
    const lowerBubble = root.querySelector<HTMLImageElement>(
      '.journey-beach-bubble-layer--birth .journey-beach-drift-bubble[data-beach-bubble-emitter-board="20"]',
    )!;
    const offscreenTransform = lowerBubble.style.transform;
    expect(lowerBubble.style.opacity).toBe('0');
    ticker.time += 0.05;
    callbacks.forEach((callback) => callback());
    expect(lowerBubble.style.transform).toBe(offscreenTransform);

    scrollRoot.scrollTop = 1100;
    scrollRoot.dispatchEvent(new Event('scroll'));
    ticker.time += 0.05;
    callbacks.forEach((callback) => callback());
    expect(lowerBubble.style.transform).not.toBe(offscreenTransform);
    expect(Number(lowerBubble.style.opacity)).toBeGreaterThan(0);

    controller.dispose();
    scrollRoot.remove();
  });
});
