/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import animationManager from '../animation-manager';
import {
  destroyMushroomBouncyArtworkRuntime,
  getMushroomBouncyDisplayGeometry,
  getMushroomBouncyRuntimeStats,
  isMushroomBouncyTile,
  MUSHROOM_BOUNCY_CYCLE_MS,
  MUSHROOM_BOUNCY_DISPLAY_SIZE,
  MUSHROOM_BOUNCY_REST_ART,
  MUSHROOM_BOUNCY_SVG_URL,
  MUSHROOM_BOUNCY_VIEWBOX,
  startMushroomBouncyArtwork,
  stopMushroomBouncyArtwork,
} from '../mushroom-bouncy-artwork';
import {
  setSpecialDiceIdleDragging,
  startSpecialDiceIdleMotion,
  stopSpecialDiceIdleMotion,
} from '../special-dice-idle';

function makeTile(variant = 'mushroom') {
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

describe('Mushroom animated SVG board artwork', () => {
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
    destroyMushroomBouncyArtworkRuntime();
    STATE.app = null;
    document.body.replaceChildren();
  });

  test('maps the original 128px die canvas to the existing 128px board footprint', () => {
    const geometry = getMushroomBouncyDisplayGeometry();
    expect(MUSHROOM_BOUNCY_VIEWBOX).toEqual({ x: -26, y: -34, width: 180, height: 180 });
    expect(MUSHROOM_BOUNCY_REST_ART).toEqual({ centerX: 64, centerY: 64, size: 128 });
    expect(geometry.restingArtworkWidth).toBe(MUSHROOM_BOUNCY_DISPLAY_SIZE);
    expect(geometry.restingArtworkHeight).toBe(MUSHROOM_BOUNCY_DISPLAY_SIZE);
    expect(geometry.width).toBe(180);
    expect(geometry.height).toBe(180);
    expect(geometry.anchorX).toBe(0.5);
    expect(geometry.anchorY).toBeCloseTo(98 / 180, 8);
  });

  test('uses the supplied self-contained two-second Mushroom animation', () => {
    const svg = fs.readFileSync(
      path.resolve(process.cwd(), 'assets/shop/mushroom/mushroom.svg'),
      'utf8',
    );
    const animateCount = svg.match(/<animate(?=\s)/g)?.length ?? 0;
    const animateTransformCount = svg.match(/<animateTransform(?=\s)/g)?.length ?? 0;

    expect(Buffer.byteLength(svg, 'utf8')).toBeLessThanOrEqual(750_000);
    expect(svg).toContain('viewBox="-26 -34 180 180"');
    expect(svg).toContain('dur="2s"');
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).toContain('calcMode="spline"');
    expect(svg.match(/<image(?=\s)/g)).toHaveLength(2);
    expect(animateCount).toBe(10);
    expect(animateTransformCount).toBe(34);
    expect(svg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
  });

  test('owns only the exact Mushroom registry variant', () => {
    expect(isMushroomBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'mushroom' })).toBe(true);
    expect(isMushroomBouncyTile({ special: 'wild-juice' })).toBe(false);
    expect(isMushroomBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'robo-cube' })).toBe(false);
    expect(isMushroomBouncyTile({ special: 'wild-tnt', _ccSpecialDiceVariant: 'beach-ball' })).toBe(false);
  });

  test('keeps PNG until load, pauses smoke for static drag, resumes without a second owner, and cleans up', () => {
    const baseline = animationManager.getStats().activeTimelines;
    const { tile, base } = makeTile();
    startSpecialDiceIdleMotion(tile);
    const first = tile._ccMushroomBouncyArtwork;
    startSpecialDiceIdleMotion(tile);

    expect(tile._ccMushroomBouncyArtwork).toBe(first);
    expect(base.renderable).toBe(true);
    expect(tile._ccMushroomSmokeTimeline).toBeTruthy();
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);

    first.image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect(first.wrapper.style.visibility).toBe('visible');

    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    expect(first.wrapper.style.visibility).toBe('hidden');
    expect(base.renderable).toBe(true);
    expect(tile._ccMushroomSmokeContainer.visible).toBe(false);
    expect(tile._ccMushroomSmokeTimeline.paused()).toBe(true);

    expect(setSpecialDiceIdleDragging(tile, false)).toBe(true);
    expect(first.wrapper.style.visibility).toBe('visible');
    expect(base.renderable).toBe(false);
    expect(tile._ccMushroomSmokeContainer.visible).toBe(true);
    expect(tile._ccMushroomSmokeTimeline.paused()).toBe(false);

    stopSpecialDiceIdleMotion(tile);
    expect(base.renderable).toBe(true);
    expect(tile._ccMushroomBouncyArtwork).toBeUndefined();
    expect(tile._ccMushroomSmokeTimeline).toBeUndefined();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
    expect(getMushroomBouncyRuntimeStats()).toEqual({
      controllers: 0,
      ready: 0,
      runtimeAttached: false,
      overlayAttached: false,
    });
  });

  test('leaves the canonical Mushroom PNG visible after an SVG load failure', () => {
    const { tile, base } = makeTile();
    const controller = startMushroomBouncyArtwork(tile);

    (controller as any).image.onerror(new Event('error'));

    expect(base.renderable).toBe(true);
    expect((controller as any).ready).toBe(false);
    expect((controller as any).wrapper.style.visibility).toBe('hidden');
  });

  test('cannot resurrect a disposed owner from a late load callback', () => {
    const { tile, base } = makeTile();
    const controller = startMushroomBouncyArtwork(tile);
    const lateLoad = (controller as any).image.onload as (event: Event) => void;

    stopMushroomBouncyArtwork(tile);
    lateLoad(new Event('load'));

    expect(base.renderable).toBe(true);
    expect(tile._ccMushroomBouncyArtwork).toBeUndefined();
    expect(getMushroomBouncyRuntimeStats().controllers).toBe(0);
  });

  test('starts concurrent Mushroom copies on separate clocks and cancels pending starts', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    try {
      const first = startMushroomBouncyArtwork(makeTile().tile);
      const second = startMushroomBouncyArtwork(makeTile().tile);

      expect((first as any).phaseLease.phaseSlot).toBe(0);
      expect((first as any).image.getAttribute('src')).toBe(MUSHROOM_BOUNCY_SVG_URL);
      expect((second as any).phaseLease.phaseSlot).toBe(1);
      expect((second as any).phaseLease.delayMs).toBe(170);
      expect((second as any).image.getAttribute('src')).toBeNull();

      jest.advanceTimersByTime(170);
      expect((second as any).image.getAttribute('src')).toBe(
        `${MUSHROOM_BOUNCY_SVG_URL}?cc-svg-phase=1`,
      );
      expect(MUSHROOM_BOUNCY_CYCLE_MS).toBe(2000);

      destroyMushroomBouncyArtworkRuntime();
      expect(getMushroomBouncyRuntimeStats().controllers).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
