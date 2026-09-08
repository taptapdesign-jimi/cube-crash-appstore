/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import {
  destroyFlowerBouncyArtworkRuntime,
  getFlowerBouncyDisplayGeometry,
  getFlowerBouncyRuntimeStats,
  isFlowerBouncyTile,
  FLOWER_BOUNCY_CYCLE_MS,
  FLOWER_BOUNCY_DISPLAY_SIZE,
  FLOWER_BOUNCY_REST_ART,
  FLOWER_BOUNCY_SVG_URL,
  FLOWER_BOUNCY_VIEWBOX,
  startFlowerBouncyArtwork,
  stopFlowerBouncyArtwork,
} from '../flower-bouncy-artwork';
import {
  setSpecialDiceIdleDragging,
  startSpecialDiceIdleMotion,
  stopSpecialDiceIdleMotion,
} from '../special-dice-idle';

function makeTile(variant = 'flower') {
  const base = new Sprite(Texture.WHITE);
  const rotG = new Container();
  rotG.addChild(base);
  return {
    tile: {
      special: 'wild-tnt',
      _ccSpecialDiceVariant: variant,
      destroyed: false,
      zIndex: 7,
      base,
      rotG,
    } as any,
    base,
  };
}

describe('Flower animated SVG board artwork', () => {
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
    destroyFlowerBouncyArtworkRuntime();
    STATE.app = null;
    document.body.replaceChildren();
  });

  test('maps the original 128px die canvas to the existing 128px board footprint', () => {
    const geometry = getFlowerBouncyDisplayGeometry();
    expect(FLOWER_BOUNCY_VIEWBOX).toEqual({ x: 0, y: 0, width: 160, height: 160 });
    expect(FLOWER_BOUNCY_REST_ART).toEqual({ centerX: 79.33, centerY: 74.78, size: 108.36 });
    expect(geometry.restingArtworkWidth).toBe(FLOWER_BOUNCY_DISPLAY_SIZE);
    expect(geometry.restingArtworkHeight).toBe(FLOWER_BOUNCY_DISPLAY_SIZE);
    expect(geometry.width).toBeCloseTo(188.9996, 4);
    expect(geometry.height).toBeCloseTo(188.9996, 4);
    expect(geometry.anchorX).toBeCloseTo(79.33 / 160, 8);
    expect(geometry.anchorY).toBeCloseTo(74.78 / 160, 8);
  });

  test('uses the supplied self-contained 1.6-second Flower animation', () => {
    const svg = fs.readFileSync(
      path.resolve(process.cwd(), 'assets/shop/bush/flower.svg'),
      'utf8',
    );
    const animateCount = svg.match(/<animate(?=\s)/g)?.length ?? 0;
    const animateTransformCount = svg.match(/<animateTransform(?=\s)/g)?.length ?? 0;

    expect(Buffer.byteLength(svg, 'utf8')).toBeLessThanOrEqual(800_000);
    expect(svg).toContain('viewBox="0 0 160 160"');
    expect(svg).toContain('dur="1.6s"');
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).toContain('calcMode="spline"');
    expect(svg.match(/<image(?=\s)/g)).toHaveLength(1);
    expect(animateCount).toBe(0);
    expect(animateTransformCount).toBe(3);
    expect(svg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
  });

  test('owns only the exact Flower registry variant', () => {
    expect(isFlowerBouncyTile({ special: 'wild-tnt', _ccSpecialDiceVariant: 'flower' })).toBe(true);
    expect(isFlowerBouncyTile({ special: 'wild-tnt' })).toBe(false);
    expect(isFlowerBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'robo-cube' })).toBe(false);
    expect(isFlowerBouncyTile({ special: 'wild-tnt', _ccSpecialDiceVariant: 'beach-ball' })).toBe(false);
  });

  test('keeps PNG until load, paints pollen above SVG, restores Pixi pollen for drag, and cleans up', () => {
    const { tile, base } = makeTile();
    const pollen = {
      destroyed: false,
      renderable: true,
      visible: true,
      alpha: 0.72,
      x: 4,
      y: -6,
      rotation: 0,
      scale: { x: 1, y: 1 },
      _ccFlowerPollenPaint: {
        kind: 'ellipse',
        color: 0xFFF16B,
        fillAlpha: 0.8,
        width: 5,
        height: 2,
      },
    } as any;
    tile._flowerPollenParticles = new Set([pollen]);
    startSpecialDiceIdleMotion(tile);
    const first = tile._ccFlowerBouncyArtwork;
    startSpecialDiceIdleMotion(tile);

    expect(tile._ccFlowerBouncyArtwork).toBe(first);
    expect(base.renderable).toBe(true);

    first.image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect(first.wrapper.style.visibility).toBe('visible');
    expect(first.image.style.zIndex).toBe('1');
    expect(first.pollenLayer.style.zIndex).toBe('2');
    expect(first.pollenLayer.style.visibility).toBe('visible');
    expect(first.pollenNodes.get(pollen)?.querySelector('ellipse')).toBeTruthy();
    expect(pollen.renderable).toBe(false);
    const pollenMatrix = first.pollenNodes.get(pollen)?.style.transform
      .slice('matrix('.length, -1)
      .split(',')
      .map((value: string) => Number(value.trim()));
    const geometry = getFlowerBouncyDisplayGeometry();
    expect(pollenMatrix?.[4]).toBeCloseTo((geometry.width * geometry.anchorX) + pollen.x, 8);
    expect(pollenMatrix?.[5]).toBeCloseTo((geometry.height * geometry.anchorY) + pollen.y, 8);

    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    expect(first.wrapper.style.visibility).toBe('hidden');
    expect(base.renderable).toBe(true);
    expect(first.pollenLayer.style.visibility).toBe('hidden');
    expect(first.pollenNodes.size).toBe(0);
    expect(pollen.renderable).toBe(true);

    expect(setSpecialDiceIdleDragging(tile, false)).toBe(true);
    expect(tile._ccFlowerBouncyArtwork).toBe(first);
    expect(first.wrapper.style.visibility).toBe('visible');
    expect(base.renderable).toBe(false);
    expect(first.pollenLayer.style.visibility).toBe('visible');
    expect(pollen.renderable).toBe(false);

    stopSpecialDiceIdleMotion(tile);
    expect(base.renderable).toBe(true);
    expect(pollen.renderable).toBe(true);
    expect(tile._ccFlowerBouncyArtwork).toBeUndefined();
    expect(getFlowerBouncyRuntimeStats()).toEqual({
      controllers: 0,
      ready: 0,
      runtimeAttached: false,
      overlayAttached: false,
    });
  });

  test('leaves the canonical Flower PNG visible after an SVG load failure', () => {
    const { tile, base } = makeTile();
    const controller = startFlowerBouncyArtwork(tile);

    (controller as any).image.onerror(new Event('error'));

    expect(base.renderable).toBe(true);
    expect((controller as any).ready).toBe(false);
    expect((controller as any).wrapper.style.visibility).toBe('hidden');
  });

  test('cannot resurrect a disposed owner from a late load callback', () => {
    const { tile, base } = makeTile();
    const controller = startFlowerBouncyArtwork(tile);
    const lateLoad = (controller as any).image.onload as (event: Event) => void;

    stopFlowerBouncyArtwork(tile);
    lateLoad(new Event('load'));

    expect(base.renderable).toBe(true);
    expect(tile._ccFlowerBouncyArtwork).toBeUndefined();
    expect(getFlowerBouncyRuntimeStats().controllers).toBe(0);
  });

  test('starts concurrent Flower copies on separate clocks and cancels pending starts', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    try {
      const first = startFlowerBouncyArtwork(makeTile().tile);
      const second = startFlowerBouncyArtwork(makeTile().tile);

      expect((first as any).phaseLease.phaseSlot).toBe(0);
      expect((first as any).image.getAttribute('src')).toBe(FLOWER_BOUNCY_SVG_URL);
      expect((second as any).phaseLease.phaseSlot).toBe(1);
      expect((second as any).phaseLease.delayMs).toBe(135);
      expect((second as any).image.getAttribute('src')).toBeNull();

      jest.advanceTimersByTime(135);
      expect((second as any).image.getAttribute('src')).toBe(
        `${FLOWER_BOUNCY_SVG_URL}?cc-svg-phase=1`,
      );
      expect(FLOWER_BOUNCY_CYCLE_MS).toBe(1600);

      destroyFlowerBouncyArtworkRuntime();
      expect(getFlowerBouncyRuntimeStats().controllers).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
