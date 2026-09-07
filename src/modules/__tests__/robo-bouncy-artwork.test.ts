/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import {
  destroyRoboBouncyArtworkRuntime,
  getRoboBouncyDisplayGeometry,
  getRoboBouncyRuntimeStats,
  isRoboBouncyTile,
  ROBO_BOUNCY_DISPLAY_SIZE,
  ROBO_BOUNCY_REST_ART,
  ROBO_BOUNCY_SVG_URL,
  setRoboBouncyArtworkDragging,
  startRoboBouncyArtwork,
  stopRoboBouncyArtwork,
} from '../robo-bouncy-artwork';

function makeTile(variant = 'robo-cube') {
  const base = new Sprite(Texture.WHITE);
  const rotG = new Container();
  rotG.addChild(base);
  return {
    tile: {
      special: 'wild-juice',
      _ccSpecialDiceVariant: variant,
      destroyed: false,
      zIndex: 7,
      base,
      rotG,
    } as any,
    base,
  };
}

describe('Robo Cube animated SVG board artwork', () => {
  beforeEach(() => {
    const host = document.createElement('div');
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 390,
      bottom: 844,
      width: 390,
      height: 844,
      toJSON: () => ({}),
    });
    document.body.appendChild(host);
    STATE.app = {
      canvas,
      renderer: { screen: { width: 390, height: 844 } },
      ticker: { add: jest.fn(), remove: jest.fn() },
    } as any;
  });

  afterEach(() => {
    destroyRoboBouncyArtworkRuntime();
    STATE.app = null;
    document.body.replaceChildren();
  });

  test('maps the authored 256px resting Robo pose to the existing 128px footprint', () => {
    const geometry = getRoboBouncyDisplayGeometry();
    expect(geometry.restingArtworkWidth).toBeCloseTo(ROBO_BOUNCY_DISPLAY_SIZE, 8);
    expect(geometry.restingArtworkHeight).toBeCloseTo(ROBO_BOUNCY_DISPLAY_SIZE, 8);
    expect(ROBO_BOUNCY_REST_ART).toEqual({ centerX: 195, centerY: 239, size: 256 });
    expect(geometry.width).toBeCloseTo(195, 8);
    expect(geometry.height).toBeCloseTo(220, 8);
    expect(geometry.anchorX).toBe(0.5);
    expect(geometry.anchorY).toBeCloseTo(239 / 440, 8);
  });

  test('uses the supplied self-contained 2.4-second Robo animation without active content', () => {
    const svg = fs.readFileSync(
      path.resolve(process.cwd(), 'assets/shop/robo/robo-bouncy.svg'),
      'utf8',
    );
    const animateCount = svg.match(/<animate(?=\s)/g)?.length ?? 0;
    const animateTransformCount = svg.match(/<animateTransform(?=\s)/g)?.length ?? 0;

    expect(Buffer.byteLength(svg, 'utf8')).toBeLessThanOrEqual(850_000);
    expect(svg).toContain('viewBox="0 0 390 440"');
    expect(svg).toContain('dur="2.4s"');
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).toContain('calcMode="discrete"');
    expect(svg.match(/<image(?=\s)/g)).toHaveLength(14);
    expect(animateCount).toBe(15);
    expect(animateTransformCount).toBe(4);
    expect(svg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
  });

  test('owns only the exact Robo Cube registry variant', () => {
    expect(isRoboBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'robo-cube' })).toBe(true);
    expect(isRoboBouncyTile({ special: 'wild-juice' })).toBe(false);
    expect(isRoboBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'mushroom' })).toBe(false);
    expect(isRoboBouncyTile({ special: 'wild' })).toBe(false);
  });

  test('deduplicates ownership, keeps PNG until load, swaps to PNG during drag, and cleans up', () => {
    const { tile, base } = makeTile();
    const first = startRoboBouncyArtwork(tile);
    const second = startRoboBouncyArtwork(tile);

    expect(first).toBe(second);
    expect(base.renderable).toBe(true);
    expect(getRoboBouncyRuntimeStats()).toMatchObject({
      controllers: 1,
      ready: 0,
      runtimeAttached: true,
      overlayAttached: true,
    });

    (first as any).image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect((first as any).wrapper.style.visibility).toBe('visible');
    expect(getRoboBouncyRuntimeStats().ready).toBe(1);

    expect(setRoboBouncyArtworkDragging(tile, true)).toBe(true);
    expect((first as any).wrapper.style.visibility).toBe('hidden');
    expect(base.renderable).toBe(true);

    expect(setRoboBouncyArtworkDragging(tile, false)).toBe(true);
    expect((first as any).wrapper.style.visibility).toBe('visible');
    expect(base.renderable).toBe(false);

    stopRoboBouncyArtwork(tile);
    expect(base.renderable).toBe(true);
    expect(tile._ccRoboBouncyArtwork).toBeUndefined();
    expect(getRoboBouncyRuntimeStats()).toEqual({
      controllers: 0,
      ready: 0,
      runtimeAttached: false,
      overlayAttached: false,
    });
  });

  test('leaves the canonical static PNG visible when the SVG cannot load', () => {
    const { tile, base } = makeTile();
    const controller = startRoboBouncyArtwork(tile);

    (controller as any).image.onerror(new Event('error'));

    expect(base.renderable).toBe(true);
    expect((controller as any).ready).toBe(false);
    expect((controller as any).wrapper.style.visibility).toBe('hidden');
  });

  test('cannot resurrect a disposed owner from a late SVG load callback', () => {
    const { tile, base } = makeTile();
    const controller = startRoboBouncyArtwork(tile);
    const lateLoad = (controller as any).image.onload as (event: Event) => void;

    stopRoboBouncyArtwork(tile);
    lateLoad(new Event('load'));

    expect(base.renderable).toBe(true);
    expect(tile._ccRoboBouncyArtwork).toBeUndefined();
    expect(getRoboBouncyRuntimeStats().controllers).toBe(0);
  });

  test('gives simultaneous Robo tiles separate SVG clocks and cancels their phase leases', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    try {
      const first = startRoboBouncyArtwork(makeTile().tile);
      const second = startRoboBouncyArtwork(makeTile().tile);

      expect((first as any).phaseLease.phaseSlot).toBe(0);
      expect((first as any).image.getAttribute('src')).toBe(ROBO_BOUNCY_SVG_URL);
      expect((second as any).phaseLease.phaseSlot).toBe(1);
      expect((second as any).phaseLease.delayMs).toBe(200);
      expect((second as any).image.getAttribute('src')).toBeNull();

      jest.advanceTimersByTime(200);
      expect((second as any).image.getAttribute('src')).toBe(
        `${ROBO_BOUNCY_SVG_URL}?cc-svg-phase=1`,
      );

      destroyRoboBouncyArtworkRuntime();
      expect(getRoboBouncyRuntimeStats().controllers).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
