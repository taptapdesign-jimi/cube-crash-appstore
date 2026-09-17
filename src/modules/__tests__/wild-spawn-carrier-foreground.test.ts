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

  test('keeps the same-source flight image aligned when the cold Barrel texture replaces the TNT fallback', () => {
    const sprite = {
      destroyed: false, parent: { visible: true, parent: null },
      texture: { width: 119, height: 119 },
      worldTransform: { a: 160.2 / 119, b: 0, c: 0, d: 207.9 / 119, tx: 100, ty: 200 },
      anchor: { x: 0.5, y: 221 / 351 }, alpha: 1, visible: true, renderable: true,
    };
    const source = './assets/shop/barell/barell-static.png';
    const foreground = createSpawnedDieForeground(sprite, source);
    const image = mockSpawnedDieRoot.querySelector('img')!;
    Object.defineProperty(image, 'complete', { get: () => true });
    Object.defineProperty(image, 'naturalWidth', { get: () => 270 });
    Object.defineProperty(image, 'naturalHeight', { get: () => 351 });
    image.onload?.(new Event('load'));
    // Pixi's separate decode resolves after the DOM image. Skinning preserves
    // the authored display dimensions by changing the sprite's local scale.
    sprite.texture = { width: 270, height: 351 };
    sprite.worldTransform.a = 160.2 / 270;
    sprite.worldTransform.d = 207.9 / 351;
    foreground.setFrame(source);
    expect(parseFloat(image.style.width) * sprite.worldTransform.a).toBeCloseTo(160.2);
    expect(parseFloat(image.style.height) * sprite.worldTransform.d).toBeCloseTo(207.9);
    const matrix = image.style.transform.slice(7, -1).split(',').map(Number);
    expect(matrix[4]).toBeCloseTo(100 - 160.2 * 0.5);
    expect(matrix[5]).toBeCloseTo(200 - 207.9 * 221 / 351);
    expect(mockSpawnedDieRoot.querySelector('img')).toBe(image);
    expect(sprite.renderable).toBe(false);
    foreground.release();
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

  test.each([false, true])('retires only after an onscreen replacement paint (idle ready=%s)', (idleReady) => {
    const stage = { visible: true, parent: null };
    const sprite = {
      destroyed: false, parent: stage, visible: true, renderable: true, alpha: 1,
      texture: { width: 128, height: 128 }, anchor: { x: 0.5, y: 0.5 },
      worldTransform: { a: 1, b: 0, c: 0, d: 1, tx: 100, ty: 200 },
    };
    const makeRunner = (method: string) => {
      const owners = new Set<any>();
      return { add: (owner: any) => owners.add(owner), remove: (owner: any) => owners.delete(owner),
        emit: (options?: any) => Array.from(owners).forEach((owner) => owner[method](options)), owners };
    };
    const renderer = { view: { renderTarget: {} }, runners: {
      prerender: makeRunner('prerender'), postrender: makeRunner('postrender'), destroy: makeRunner('destroy'),
    } };
    const foreground = createSpawnedDieForeground(sprite, 'die.png');
    const image = mockSpawnedDieRoot.querySelector('img')!;
    Object.defineProperty(image, 'complete', { get: () => true });
    Object.defineProperty(image, 'naturalWidth', { get: () => 128 });
    image.onload?.(new Event('load'));
    const completed = jest.fn();
    const startIdle = jest.fn(() => {
      expect(sprite.renderable).toBe(true);
      if (idleReady) sprite.renderable = false;
    });
    foreground.handoffToCanvas(renderer, startIdle, completed);
    expect(startIdle).toHaveBeenCalledTimes(1);
    expect(image.isConnected).toBe(true);
    expect(sprite.renderable).toBe(!idleReady);
    // A late image callback/overlay sync must not reclaim base renderability.
    image.onload?.(new Event('load'));
    expect(sprite.renderable).toBe(!idleReady);
    // A postrender from the already running frame, or an offscreen texture
    // render, cannot stand in for the replacement's next onscreen paint.
    const paint = { container: stage, target: renderer.view.renderTarget };
    renderer.runners.postrender.emit(paint);
    const offscreen = { container: stage, target: {} };
    renderer.runners.prerender.emit(offscreen); renderer.runners.postrender.emit(offscreen);
    expect(image.isConnected).toBe(true);
    renderer.runners.prerender.emit(paint);
    expect(image.isConnected).toBe(true);
    renderer.runners.postrender.emit(paint);
    expect(image.isConnected).toBe(false);
    expect(sprite.renderable).toBe(!idleReady);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(renderer.runners.prerender.owners.size).toBe(0);
    expect(renderer.runners.postrender.owners.size).toBe(0);
    expect(renderer.runners.destroy.owners.size).toBe(0);
  });

  test('canceling a pending handoff removes its render observer and cannot restore over the idle owner', () => {
    const sprite = { destroyed: false, renderable: true, texture: {}, parent: {} };
    const runner = () => ({ add: jest.fn(), remove: jest.fn() });
    const renderer = { runners: { prerender: runner(), postrender: runner(), destroy: runner() } };
    const foreground = createSpawnedDieForeground(sprite, 'die.png');
    const completed = jest.fn();
    foreground.handoffToCanvas(renderer, () => { sprite.renderable = false; }, completed);
    foreground.release(); foreground.release();
    expect(mockSpawnedDieRoot.childElementCount).toBe(0);
    expect(renderer.runners.prerender.remove).toHaveBeenCalledTimes(1);
    expect(renderer.runners.postrender.remove).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(sprite.renderable).toBe(false);
  });


  test('renderer destruction releases a handoff even when no further frame can paint', () => {
    const observers = new Map<string, any>();
    const runner = (name: string) => ({
      add: (owner: any) => observers.set(name, owner),
      remove: () => observers.delete(name),
    });
    const renderer = { runners: { prerender: runner('pre'), postrender: runner('post'), destroy: runner('destroy') } };
    const sprite = { destroyed: false, renderable: true, texture: {}, parent: {} };
    const foreground = createSpawnedDieForeground(sprite, 'die.png');
    const done = jest.fn();
    foreground.handoffToCanvas(renderer, () => {}, done);
    observers.get('destroy').destroy();
    expect(mockSpawnedDieRoot.childElementCount).toBe(0);
    expect(observers.size).toBe(0);
    expect(done).toHaveBeenCalledTimes(1);
  });

});
