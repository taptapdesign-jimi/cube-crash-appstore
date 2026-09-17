/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { STATE } from '../app-state';
import {
  acquireAnimatedSpecialArtworkFinaleDepth,
  acquireAnimatedSpecialArtworkLayer,
  getAnimatedSpecialArtworkLayerStats,
  getAnimatedSpecialArtworkCarrierForegroundRoot,
  getAnimatedSpecialArtworkSpawnedDieForegroundRoot,
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

  test('steady layer frames do not rewrite identical CSS and still publish visibility/depth changes', () => {
    const lease = acquireAnimatedSpecialArtworkLayer(jest.fn())!;
    releases.push(lease.release);
    getAnimatedSpecialArtworkCarrierForegroundRoot();
    getAnimatedSpecialArtworkSpawnedDieForegroundRoot();
    lease.requestSync();
    const observer = new MutationObserver(() => {});
    observer.observe(lease.root.parentElement!, { attributes: true, subtree: true, attributeFilter: ['style'] });
    try {
      for (let i = 0; i < 60; i++) lease.requestSync();
      expect(observer.takeRecords()).toHaveLength(0);
      const releaseDepth = acquireAnimatedSpecialArtworkFinaleDepth();
      releases.push(releaseDepth);
      expect(lease.root.style.zIndex).toBe('0');
      expect(observer.takeRecords().length).toBeGreaterThan(0);
      const canvas = STATE.app!.canvas as HTMLCanvasElement;
      canvas.style.display = 'none'; lease.requestSync();
      expect(lease.root.style.display).toBe('none');
      canvas.style.display = ''; lease.requestSync();
      expect(lease.root.style.display).toBe('');
      expect(lease.root.style.visibility).toBe('visible');
    } finally { observer.disconnect(); }
  });

  test('Fish-like pinned owners share one style read per frame and keep immediate depth and reparenting', () => {
    const wrappers = [document.createElement('div'), document.createElement('div')];
    const owners = wrappers.map((wrapper) => jest.fn(() => {
      setAnimatedSpecialArtworkPinnedForeground(wrapper, true);
      // Match the real owner ordering: pin first, then update its artwork pose.
      wrapper.style.transform = 'translateX(7px)';
    }));
    const leases = owners.map((owner) => acquireAnimatedSpecialArtworkLayer(owner)!);
    leases.forEach((lease) => releases.push(lease.release));
    leases[0].requestSync();
    const pinnedRoot = wrappers[0].parentElement!;
    expect(wrappers[1].parentElement).toBe(pinnedRoot);
    expect(pinnedRoot.style.zIndex).toBe('12');
    const computedStyle = jest.spyOn(window, 'getComputedStyle');
    owners.forEach((owner) => owner.mockClear());
    for (let frame = 0; frame < 10; frame++) leases[0].requestSync();
    expect(computedStyle).toHaveBeenCalledTimes(10);
    owners.forEach((owner) => expect(owner).toHaveBeenCalledTimes(10));

    const releaseFinale = acquireAnimatedSpecialArtworkFinaleDepth();
    releases.push(releaseFinale);
    expect(pinnedRoot.style.zIndex).toBe('0');
    releaseFinale();
    expect(pinnedRoot.style.zIndex).toBe('12');

    const canvas = STATE.app!.canvas as HTMLCanvasElement;
    const nextHost = document.createElement('div');
    document.body.append(nextHost);
    nextHost.append(canvas);
    canvas.style.zIndex = '50';
    // A standalone call must immediately repair attachment and depth, without
    // waiting for the next shared frame.
    setAnimatedSpecialArtworkPinnedForeground(wrappers[0], true);
    expect(pinnedRoot.parentElement).toBe(nextHost);
    expect(pinnedRoot.style.zIndex).toBe('52');
    expect(wrappers[1].parentElement).toBe(pinnedRoot);
    computedStyle.mockClear();
    leases[0].requestSync();
    expect(computedStyle).toHaveBeenCalledTimes(1);
    owners.forEach((owner) => expect(owner).toHaveBeenCalledTimes(11));
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

  test('keeps only the spawned die above the backpack/crate and hides both with the canvas', () => {
    const artworkLease = acquireAnimatedSpecialArtworkLayer(jest.fn());
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);
    const carrierRoot = getAnimatedSpecialArtworkCarrierForegroundRoot();
    const spawnedDieRoot = getAnimatedSpecialArtworkSpawnedDieForegroundRoot();
    expect(carrierRoot).not.toBeNull();
    expect(spawnedDieRoot).not.toBeNull();
    if (!carrierRoot || !spawnedDieRoot) return;
    const carrier = document.createElement('img');
    const spawnedDie = document.createElement('img');
    carrierRoot.appendChild(carrier);
    spawnedDieRoot.appendChild(spawnedDie);
    artworkLease.requestSync();
    expect(Number(carrierRoot.style.zIndex)).toBeGreaterThan(1);
    expect(Number(carrierRoot.style.zIndex)).toBeGreaterThan(Number(artworkLease.root.style.zIndex));
    expect(Number(spawnedDieRoot.style.zIndex)).toBeGreaterThan(Number(carrierRoot.style.zIndex));

    const canvas = STATE.app?.canvas as HTMLCanvasElement;
    canvas.style.display = 'none';
    artworkLease.requestSync();
    expect(carrierRoot.style.visibility).toBe('hidden');
    expect(spawnedDieRoot.style.visibility).toBe('hidden');

    canvas.style.display = '';
    artworkLease.requestSync();
    expect(carrierRoot.style.visibility).toBe('visible');
    expect(spawnedDieRoot.style.visibility).toBe('visible');
    artworkLease.release();
    expect(carrierRoot.isConnected).toBe(false);
    expect(spawnedDieRoot.isConnected).toBe(false);
  });

  test('keeps Ball above board ghosts during a sibling finale while ordinary pinned artwork yields', () => {
    const artworkLease = acquireAnimatedSpecialArtworkLayer(jest.fn());
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);

    const pinned = document.createElement('div');
    const ordinaryPinned = document.createElement('div');
    const dragged = document.createElement('div');
    artworkLease.root.append(pinned, ordinaryPinned, dragged);
    setAnimatedSpecialArtworkPinnedForeground(pinned, true, { preserveDuringFinale: true });
    setAnimatedSpecialArtworkPinnedForeground(ordinaryPinned, true);
    setAnimatedSpecialArtworkDragging(dragged, true);

    const canvas = STATE.app?.canvas as HTMLCanvasElement;
    const canvasZ = Number(getComputedStyle(canvas).zIndex || '1');
    expect(pinned.parentElement?.className)
      .toBe('animated-special-artwork-finale-persistent-foreground-layer');
    expect(Number(pinned.parentElement?.style.zIndex)).toBeGreaterThan(canvasZ);
    expect(Number(pinned.parentElement?.style.zIndex))
      .toBeGreaterThan(Number(dragged.parentElement?.style.zIndex));

    const releaseFinale = acquireAnimatedSpecialArtworkFinaleDepth();
    releases.push(releaseFinale);
    expect(Number(pinned.parentElement?.style.zIndex)).toBeGreaterThan(canvasZ);
    expect(Number(ordinaryPinned.parentElement?.style.zIndex)).toBeLessThan(canvasZ);

    releaseFinale();
    expect(Number(pinned.parentElement?.style.zIndex)).toBeGreaterThan(canvasZ);
    setAnimatedSpecialArtworkPinnedForeground(pinned, false);
    setAnimatedSpecialArtworkPinnedForeground(ordinaryPinned, false);
    setAnimatedSpecialArtworkDragging(dragged, false);
  });

  test('hides idle, dragged, and pinned SVG roots when the Pixi canvas stops painting', () => {
    const artworkLease = acquireAnimatedSpecialArtworkLayer(jest.fn());
    expect(artworkLease).not.toBeNull();
    if (!artworkLease) return;
    releases.push(artworkLease.release);
    const draggedSvg = document.createElement('div');
    const pinnedSvg = document.createElement('div');
    const persistentPinnedSvg = document.createElement('div');
    artworkLease.root.appendChild(draggedSvg);
    artworkLease.root.appendChild(pinnedSvg);
    artworkLease.root.appendChild(persistentPinnedSvg);
    setAnimatedSpecialArtworkDragging(draggedSvg, true);
    setAnimatedSpecialArtworkPinnedForeground(pinnedSvg, true);
    setAnimatedSpecialArtworkPinnedForeground(
      persistentPinnedSvg,
      true,
      { preserveDuringFinale: true },
    );
    const dragRoot = draggedSvg.parentElement as HTMLDivElement;
    const pinnedRoot = pinnedSvg.parentElement as HTMLDivElement;
    const persistentPinnedRoot = persistentPinnedSvg.parentElement as HTMLDivElement;

    const canvas = STATE.app?.canvas as HTMLCanvasElement;
    canvas.style.display = 'none';
    artworkLease.requestSync();

    expect(artworkLease.root.style.visibility).toBe('hidden');
    expect(dragRoot.style.visibility).toBe('hidden');
    expect(pinnedRoot.style.visibility).toBe('hidden');
    expect(persistentPinnedRoot.style.visibility).toBe('hidden');
    setAnimatedSpecialArtworkPinnedForeground(pinnedSvg, false);
    setAnimatedSpecialArtworkPinnedForeground(persistentPinnedSvg, false);
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
