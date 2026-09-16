/** @jest-environment jsdom */

import type { AnimatedSpecialArtworkFrame } from '../animated-special-artwork-layer';
import { createCarrierForeground, createSpawnedDieForeground } from '../wild-spawn-carrier-foreground';

let mockRoot: HTMLDivElement;
let mockSpawnedDieRoot: HTMLDivElement;
let mockFrame: AnimatedSpecialArtworkFrame;
let mockRelease: jest.Mock;

jest.mock('../animated-special-artwork-layer', () => ({
  acquireAnimatedSpecialArtworkLayer: (owner: (frame: AnimatedSpecialArtworkFrame) => void) => ({
    root: mockRoot,
    requestSync: () => owner(mockFrame),
    release: mockRelease,
  }),
  getAnimatedSpecialArtworkCarrierForegroundRoot: () => mockRoot,
  getAnimatedSpecialArtworkSpawnedDieForegroundRoot: () => mockSpawnedDieRoot,
}));

describe('wild spawn carrier foreground', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mockRoot = document.createElement('div');
    mockRoot.style.zIndex = '12003';
    mockSpawnedDieRoot = document.createElement('div');
    mockSpawnedDieRoot.style.zIndex = '12004';
    document.body.append(mockRoot, mockSpawnedDieRoot);
    mockRelease = jest.fn();
    const rect = { left: 0, top: 0, width: 390, height: 844 } as DOMRect;
    mockFrame = {
      canvasRect: rect,
      rootRect: rect,
      screenWidth: 390,
      screenHeight: 844,
      canvasOpacity: 1,
      gameplayDragActive: false,
      gameplayDragBounds: null,
    };
  });

  test('holds the last ready Ruksak frame in front while a later frame loads, then switches without a Pixi fallback flash', () => {
    const sprite = {
      destroyed: false,
      texture: { width: 379, height: 438 },
      worldTransform: { a: 1, b: 0, c: 0, d: 1, tx: 100, ty: 200 },
      anchor: { x: 0.5, y: 0.72 },
      alpha: 1,
      visible: true,
      renderable: true,
    };
    const sources = ['backpack-1.png', 'backpack-2.png', 'backpack-3.png'];
    const carrier = createCarrierForeground(sprite, sources);
    const images = Array.from(mockRoot.querySelectorAll('img'));
    expect(images.map((image) => image.getAttribute('src'))).toEqual(sources);
    const ready = new Set<string>();
    for (const image of images) {
      Object.defineProperty(image, 'complete', { configurable: true, get: () => ready.has(image.getAttribute('src') || '') });
      Object.defineProperty(image, 'naturalWidth', { configurable: true, get: () => ready.has(image.getAttribute('src') || '') ? 379 : 0 });
      Object.defineProperty(image, 'naturalHeight', { configurable: true, get: () => ready.has(image.getAttribute('src') || '') ? 438 : 0 });
    }

    ready.add(sources[0]);
    images[0].onload?.(new Event('load'));
    expect(images[0].style.visibility).toBe('visible');
    expect(sprite.renderable).toBe(false);

    carrier.setFrame(sources[1]);
    expect(images[0].style.visibility).toBe('visible');
    expect(images[1].style.visibility).toBe('hidden');
    expect(sprite.renderable).toBe(false);
    expect(images.map((image) => image.getAttribute('src'))).toEqual(sources);

    ready.add(sources[1]);
    images[1].onload?.(new Event('load'));
    expect(images[0].style.visibility).toBe('hidden');
    expect(images[1].style.visibility).toBe('visible');
    expect(sprite.renderable).toBe(false);

    carrier.setFrame(sources[2]);
    expect(images[1].style.visibility).toBe('visible');
    expect(sprite.renderable).toBe(false);
    carrier.release();
    expect(mockRoot.childElementCount).toBe(0);
    expect(sprite.renderable).toBe(true);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test('ports only the emitted die above the carrier and respects its parent visibility', () => {
    const parent = { visible: false, parent: null };
    const base = {
      destroyed: false,
      texture: { width: 128, height: 128 },
      worldTransform: { a: 0.75, b: 0, c: 0, d: 0.75, tx: 100, ty: 200 },
      worldAlpha: 0.5,
      parent,
      anchor: { x: 0.5, y: 0.5 },
      alpha: 1,
      visible: true,
      renderable: true,
    };
    const foreground = createSpawnedDieForeground(base, './assets/shop/bee/bee.png');
    const image = mockSpawnedDieRoot.querySelector<HTMLImageElement>('img');
    expect(image?.className).toBe('cc-wild-spawn-die-foreground');
    expect(Number(mockSpawnedDieRoot.style.zIndex)).toBeGreaterThan(Number(mockRoot.style.zIndex));
    expect(image?.getAttribute('src')).toBe('./assets/shop/bee/bee.png');
    if (!image) return;
    Object.defineProperty(image, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(image, 'naturalWidth', { configurable: true, get: () => 128 });
    image.onload?.(new Event('load'));
    expect(image.style.visibility).toBe('hidden');
    expect(base.renderable).toBe(false);

    parent.visible = true;
    foreground.setFrame('./assets/shop/bee/bee.png');
    expect(image.style.visibility).toBe('visible');
    expect(image.style.opacity).toBe('0.5');
    expect(image.style.transform).toBe('matrix(0.75, 0, 0, 0.75, 52, 152)');
    foreground.release();
    expect(base.renderable).toBe(true);
    expect(mockSpawnedDieRoot.childElementCount).toBe(0);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
