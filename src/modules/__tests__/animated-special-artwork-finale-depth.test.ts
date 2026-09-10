/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { STATE } from '../app-state';
import {
  acquireAnimatedSpecialArtworkFinaleDepth,
  acquireAnimatedSpecialArtworkLayer,
  doesAnimatedSpecialArtworkOverlapGameplayDrag,
  getAnimatedSpecialArtworkLayerStats,
  installAnimatedSpecialArtworkOverlapFootprint,
  setAnimatedSpecialArtworkDragging,
  setAnimatedSpecialArtworkOccluded,
  setAnimatedSpecialArtworkPinnedForeground,
} from '../animated-special-artwork-layer';
import { acquireGameplayDragForeground } from '../gameplay-drag-foreground-owner';

describe('animated special artwork merge-6 depth ownership', () => {
  const releases: Array<() => void> = [];

  beforeEach(() => {
    const host = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.zIndex = '1';
    host.appendChild(canvas);
    document.body.appendChild(host);
    STATE.app = {
      canvas,
      renderer: { screen: { width: 390, height: 844 } },
      ticker: { add: jest.fn(), remove: jest.fn() },
    } as any;
  });

  afterEach(() => {
    while (releases.length) {
      try { releases.pop()?.(); } catch {}
    }
    STATE.app = null;
    document.body.replaceChildren();
  });

  test('reference-counts overlapping finales and restores SVG dice above Pixi afterward', () => {
    const artworkLease = acquireAnimatedSpecialArtworkLayer(jest.fn());
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);
    artworkLease.requestSync();
    expect(artworkLease.root.style.zIndex).toBe('11');

    const releaseFirstFinale = acquireAnimatedSpecialArtworkFinaleDepth();
    const releaseSecondFinale = acquireAnimatedSpecialArtworkFinaleDepth();
    releases.push(releaseFirstFinale, releaseSecondFinale);
    expect(artworkLease.root.style.zIndex).toBe('0');

    releaseFirstFinale();
    expect(artworkLease.root.style.zIndex).toBe('0');
    releaseSecondFinale();
    expect(artworkLease.root.style.zIndex).toBe('11');

    artworkLease.release();
    expect(getAnimatedSpecialArtworkLayerStats()).toEqual({
      owners: 0,
      tickerAttached: false,
      overlayAttached: false,
    });
  });

  test('applies finale depth when the finale starts before an SVG owner attaches', () => {
    const releaseFinale = acquireAnimatedSpecialArtworkFinaleDepth();
    releases.push(releaseFinale);
    const artworkLease = acquireAnimatedSpecialArtworkLayer(jest.fn());
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);

    expect(artworkLease.root.style.zIndex).toBe('0');
    releaseFinale();
    expect(artworkLease.root.style.zIndex).toBe('11');
  });

  test('keeps idle SVG animation live during drag while preserving the dragged SVG portal', () => {
    const frameOwner = jest.fn();
    const artworkLease = acquireAnimatedSpecialArtworkLayer(frameOwner);
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);

    const idleSvg = document.createElement('div');
    const draggedSvg = document.createElement('div');
    artworkLease.root.append(idleSvg, draggedSvg);

    const releaseDragForeground = acquireGameplayDragForeground();
    releases.push(releaseDragForeground);
    expect(frameOwner).toHaveBeenLastCalledWith(expect.objectContaining({ gameplayDragActive: true }));
    const canvas = STATE.app?.canvas as HTMLCanvasElement;
    const idleLayerZ = Number(artworkLease.root.style.zIndex);
    const canvasZ = Number(getComputedStyle(canvas).zIndex || '1');
    expect(idleLayerZ).toBeGreaterThan(canvasZ);
    expect(idleSvg.parentElement).toBe(artworkLease.root);

    setAnimatedSpecialArtworkDragging(draggedSvg, true);
    expect(draggedSvg.parentElement).not.toBe(artworkLease.root);
    expect(Number(draggedSvg.parentElement?.style.zIndex)).toBeGreaterThan(canvasZ);

    setAnimatedSpecialArtworkDragging(draggedSvg, false);
    expect(draggedSvg.parentElement).toBe(artworkLease.root);
    releaseDragForeground();
    expect(frameOwner).toHaveBeenLastCalledWith(expect.objectContaining({ gameplayDragActive: false }));
    expect(Number(artworkLease.root.style.zIndex)).toBeGreaterThan(canvasZ);
  });

  test('moves an occluded live SVG below the canvas without replacing its DOM owner', () => {
    const artworkLease = acquireAnimatedSpecialArtworkLayer(jest.fn());
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);

    const wrapper = document.createElement('div');
    const image = document.createElement('img');
    image.src = './assets/shop/juice/juice-bounce.svg?cc-svg-phase=4';
    wrapper.appendChild(image);
    artworkLease.root.appendChild(wrapper);

    setAnimatedSpecialArtworkOccluded(wrapper, true);
    const canvas = STATE.app?.canvas as HTMLCanvasElement;
    expect(wrapper.parentElement?.className).toBe('animated-special-artwork-occluded-layer');
    expect(Number((wrapper.parentElement as HTMLElement).style.zIndex))
      .toBeLessThan(Number(getComputedStyle(canvas).zIndex || '1'));
    expect(wrapper.firstElementChild).toBe(image);
    expect(image.getAttribute('src')).toBe('./assets/shop/juice/juice-bounce.svg?cc-svg-phase=4');

    setAnimatedSpecialArtworkOccluded(wrapper, false);
    expect(wrapper.parentElement).toBe(artworkLease.root);
    expect(wrapper.firstElementChild).toBe(image);
    expect(image.getAttribute('src')).toBe('./assets/shop/juice/juice-bounce.svg?cc-svg-phase=4');
  });

  test('pins Ball-style idle artwork above Pixi and the active SVG drag without crossing a finale', () => {
    const artworkLease = acquireAnimatedSpecialArtworkLayer(jest.fn());
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);

    const pinned = document.createElement('div');
    const dragged = document.createElement('div');
    artworkLease.root.append(pinned, dragged);
    setAnimatedSpecialArtworkPinnedForeground(pinned, true);
    setAnimatedSpecialArtworkDragging(dragged, true);

    const canvas = STATE.app?.canvas as HTMLCanvasElement;
    const canvasZ = Number(getComputedStyle(canvas).zIndex || '1');
    expect(pinned.parentElement?.className)
      .toBe('animated-special-artwork-pinned-foreground-layer');
    expect(Number(pinned.parentElement?.style.zIndex)).toBeGreaterThan(canvasZ);
    expect(Number(pinned.parentElement?.style.zIndex))
      .toBeGreaterThan(Number(dragged.parentElement?.style.zIndex));

    const releaseFinale = acquireAnimatedSpecialArtworkFinaleDepth();
    releases.push(releaseFinale);
    expect(Number(pinned.parentElement?.style.zIndex)).toBeLessThan(canvasZ);

    releaseFinale();
    expect(Number(pinned.parentElement?.style.zIndex)).toBeGreaterThan(canvasZ);
    setAnimatedSpecialArtworkPinnedForeground(pinned, false);
    setAnimatedSpecialArtworkDragging(dragged, false);
  });

  test('hides idle, dragged, and pinned SVG roots when the Pixi canvas stops painting', () => {
    const artworkLease = acquireAnimatedSpecialArtworkLayer(jest.fn());
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);
    const draggedSvg = document.createElement('div');
    const pinnedSvg = document.createElement('div');
    artworkLease.root.appendChild(draggedSvg);
    artworkLease.root.appendChild(pinnedSvg);
    setAnimatedSpecialArtworkDragging(draggedSvg, true);
    setAnimatedSpecialArtworkPinnedForeground(pinnedSvg, true);
    const dragRoot = draggedSvg.parentElement as HTMLDivElement;
    const pinnedRoot = pinnedSvg.parentElement as HTMLDivElement;

    const canvas = STATE.app?.canvas as HTMLCanvasElement;
    canvas.style.display = 'none';
    artworkLease.requestSync();

    expect(artworkLease.root.style.visibility).toBe('hidden');
    expect(dragRoot.style.visibility).toBe('hidden');
    expect(pinnedRoot.style.visibility).toBe('hidden');
    setAnimatedSpecialArtworkPinnedForeground(pinnedSvg, false);
    setAnimatedSpecialArtworkDragging(draggedSvg, false);
  });

  test('keeps a live dragged SVG above the canvas even if a stale finale lease overlaps', () => {
    const artworkLease = acquireAnimatedSpecialArtworkLayer(jest.fn());
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);
    const draggedSvg = document.createElement('div');
    artworkLease.root.appendChild(draggedSvg);

    const releaseFinale = acquireAnimatedSpecialArtworkFinaleDepth();
    const releaseDrag = acquireGameplayDragForeground();
    releases.push(releaseFinale, releaseDrag);
    setAnimatedSpecialArtworkDragging(draggedSvg, true);

    const canvas = STATE.app?.canvas as HTMLCanvasElement;
    expect(Number(draggedSvg.parentElement?.style.zIndex))
      .toBeGreaterThan(Number(getComputedStyle(canvas).zIndex || '1'));
    setAnimatedSpecialArtworkDragging(draggedSvg, false);
  });

  test('ignores transparent SVG stage margins and falls back only on visible-die overlap', () => {
    const wrapper = document.createElement('div');
    const footprint = installAnimatedSpecialArtworkOverlapFootprint(wrapper, {
      left: 100,
      top: 100,
      width: 128,
      height: 128,
    });
    jest.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 340,
      bottom: 380,
      width: 340,
      height: 380,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    jest.spyOn(footprint, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      right: 228,
      bottom: 228,
      width: 128,
      height: 128,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });

    expect(doesAnimatedSpecialArtworkOverlapGameplayDrag(wrapper, {
      x: 250,
      y: 120,
      width: 128,
      height: 128,
    })).toBe(false);
    expect(doesAnimatedSpecialArtworkOverlapGameplayDrag(wrapper, {
      x: 227,
      y: 120,
      width: 128,
      height: 128,
    })).toBe(true);
    expect(doesAnimatedSpecialArtworkOverlapGameplayDrag(wrapper, {
      x: 228,
      y: 120,
      width: 128,
      height: 128,
    })).toBe(false);
  });

  test('connects the shared depth lease to all four merge-6 finale families', () => {
    const read = (relativePath: string) => fs.readFileSync(
      path.resolve(process.cwd(), relativePath),
      'utf8',
    );
    const tnt = read('src/modules/tnt-animation.ts');
    const juice = read('src/modules/wild-juice-bubbles-explosion.ts');
    const splash = read('src/modules/splash-text-overlay.ts');

    expect(tnt).toContain('releaseTntFinaleDepth = acquireAnimatedSpecialArtworkFinaleDepth()');
    expect(juice).toContain('releaseExplosionFinaleDepth = acquireAnimatedSpecialArtworkFinaleDepth()');
    expect(splash).toContain('releaseMagneticFinaleDepth = acquireAnimatedSpecialArtworkFinaleDepth()');
    expect(splash).toContain('releaseSparkleFinaleDepth = acquireAnimatedSpecialArtworkFinaleDepth()');
    expect(tnt).toContain('releaseTntFinaleDepth?.()');
    expect(juice).toContain('releaseExplosionFinaleDepth?.()');
    expect(splash).toContain('releaseMagneticFinaleDepth?.()');
    expect(splash).toContain('releaseSparkleFinaleDepth?.()');
  });
});
