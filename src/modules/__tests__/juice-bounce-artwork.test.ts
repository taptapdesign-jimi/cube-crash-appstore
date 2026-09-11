/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import {
  destroyJuiceBounceArtworkRuntime,
  getJuiceBounceDisplayGeometry,
  getJuiceBounceRuntimeStats,
  isPlainJuiceBounceTile,
  JUICE_BOUNCE_CROP,
  JUICE_BOUNCE_DRAG_Z_INDEX,
  JUICE_BOUNCE_DISPLAY_SIZE,
  JUICE_BOUNCE_REST_ART,
} from '../juice-bounce-artwork';
import {
  setSpecialDiceIdleDragging,
  startSpecialDiceIdleMotion,
  stopSpecialDiceIdleMotion,
} from '../special-dice-idle';
import {
  acquireGameplayDragForeground,
  setGameplayDragBounds,
} from '../gameplay-drag-foreground-owner';

describe('Juice animated SVG board artwork', () => {
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
    destroyJuiceBounceArtworkRuntime();
    STATE.app = null;
    document.body.replaceChildren();
  });

  test('maps the resting authored cup to the exact existing 128px Juice footprint', () => {
    const geometry = getJuiceBounceDisplayGeometry();
    expect(geometry.restingArtworkWidth).toBeCloseTo(JUICE_BOUNCE_DISPLAY_SIZE, 8);
    expect(geometry.restingArtworkHeight).toBeCloseTo(JUICE_BOUNCE_DISPLAY_SIZE, 8);
    expect(geometry.anchorX).toBeGreaterThan(0);
    expect(geometry.anchorX).toBeLessThan(1);
    expect(geometry.anchorY).toBeGreaterThan(0);
    expect(geometry.anchorY).toBeLessThan(1);
  });

  test('crop retains the complete resting artwork and its authored upward jump corridor', () => {
    const restingTop = JUICE_BOUNCE_REST_ART.centerY - JUICE_BOUNCE_REST_ART.size / 2;
    const restingBottom = JUICE_BOUNCE_REST_ART.centerY + JUICE_BOUNCE_REST_ART.size / 2;
    const authoredJump = 93 * 0.78;
    expect(JUICE_BOUNCE_CROP.y).toBeLessThan(restingTop - authoredJump);
    expect(JUICE_BOUNCE_CROP.y + JUICE_BOUNCE_CROP.height).toBeGreaterThan(restingBottom);
  });

  test('uses the optimized self-contained two-second indefinite SMIL animation', () => {
    const svg = fs.readFileSync(
      path.resolve(process.cwd(), 'assets/shop/juice/juice-bounce.svg'),
      'utf8',
    );
    const animateCount = svg.match(/<animate(?=\s)/g)?.length ?? 0;
    const animateTransformCount = svg.match(/<animateTransform(?=\s)/g)?.length ?? 0;

    expect(Buffer.byteLength(svg, 'utf8')).toBeLessThanOrEqual(250_000);
    expect(svg).toContain('viewBox="0 0 390 800"');
    expect(svg).toContain('dur="2s"');
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).toContain('calcMode="spline"');
    expect(animateCount).toBe(1);
    expect(animateTransformCount).toBe(9);
    expect(svg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
  });

  test('owns only generic Juice, never another Juice-archetype registry die', () => {
    expect(isPlainJuiceBounceTile({ special: 'wild-juice' })).toBe(true);
    expect(isPlainJuiceBounceTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'mushroom' })).toBe(false);
    expect(isPlainJuiceBounceTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'robo-cube' })).toBe(false);
    expect(isPlainJuiceBounceTile({ special: 'wild' })).toBe(false);
  });

  test('deduplicates ownership, paints idle bubbles above SVG, and restores Pixi fallback on cleanup', () => {
    const base = new Sprite(Texture.WHITE);
    const rotG = new Container();
    rotG.addChild(base);
    const tile: any = { special: 'wild-juice', destroyed: false, base, rotG };
    const pixiBubbleContainer = { destroyed: false, renderable: true };
    tile._wildJuiceBubbleSystem = {
      disposed: false,
      container: pixiBubbleContainer,
      bubbles: [{
        destroyed: false,
        visible: true,
        renderable: true,
        x: 8,
        y: -12,
        alpha: 0.75,
        scale: { x: 0.8, y: 0.9 },
        _ccIdleBubblePaint: { radius: 12, color: 0xFFE6E1 },
      }],
    };

    startSpecialDiceIdleMotion(tile);
    const first = tile._ccJuiceBounceArtwork;
    startSpecialDiceIdleMotion(tile);
    const second = tile._ccJuiceBounceArtwork;
    expect(first).toBe(second);
    expect((first as any).wrapper.style.overflow).toBe('visible');
    expect((first as any).artworkClip.style.overflow).toBe('hidden');
    expect((first as any).image.parentElement).toBe((first as any).artworkClip);
    expect((first as any).bubbleLayer.parentElement).toBe((first as any).wrapper);
    expect(getJuiceBounceRuntimeStats()).toMatchObject({
      controllers: 1,
      ready: 0,
      tickerAttached: true,
      overlayAttached: true,
    });
    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    expect((first as any).dragging).toBe(true);
    expect((first as any).wrapper.style.zIndex).toBe(String(JUICE_BOUNCE_DRAG_Z_INDEX));
    (first as any).image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect(pixiBubbleContainer.renderable).toBe(false);
    expect((first as any).image.style.zIndex).toBe('1');
    expect((first as any).bubbleLayer.style.zIndex).toBe('2');
    expect((first as any).bubbleLayer.childElementCount).toBe(1);
    expect(getJuiceBounceRuntimeStats()).toMatchObject({ controllers: 1, ready: 1 });
    expect(setSpecialDiceIdleDragging(tile, false)).toBe(true);
    expect((first as any).dragging).toBe(false);

    stopSpecialDiceIdleMotion(tile);
    expect(base.renderable).toBe(true);
    expect(pixiBubbleContainer.renderable).toBe(true);
    expect(tile._ccJuiceBounceArtwork).toBeUndefined();
    expect(getJuiceBounceRuntimeStats()).toEqual({
      controllers: 0,
      ready: 0,
      tickerAttached: false,
      overlayAttached: false,
    });
  });

  test('keeps idle Juice live during another drag and portals only the owned Juice', () => {
    const base = new Sprite(Texture.WHITE);
    const rotG = new Container();
    rotG.addChild(base);
    const tile: any = { special: 'wild-juice', destroyed: false, base, rotG };
    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccJuiceBounceArtwork;
    (controller as any).image.onload(new Event('load'));
    expect(base.renderable).toBe(false);

    const releaseForeground = acquireGameplayDragForeground();
    try {
      expect((controller as any).wrapper.style.visibility).toBe('visible');
      expect(base.renderable).toBe(false);

      expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
      expect((controller as any).wrapper.parentElement?.className)
        .toBe('animated-special-artwork-drag-layer');
      expect((controller as any).wrapper.style.visibility).toBe('visible');
      expect(base.renderable).toBe(false);

      expect(setSpecialDiceIdleDragging(tile, false)).toBe(true);
      expect((controller as any).wrapper.parentElement?.className)
        .toBe('animated-special-artwork-layer');
      expect((controller as any).wrapper.style.visibility).toBe('visible');
      expect(base.renderable).toBe(false);
    } finally {
      releaseForeground();
    }
    expect((controller as any).wrapper.style.visibility).toBe('visible');
    expect(base.renderable).toBe(false);
  });

  test('keeps the live Juice SVG and bubbles running while another die crosses it', () => {
    const base = new Sprite(Texture.WHITE);
    const rotG = new Container();
    rotG.addChild(base);
    const tile: any = { special: 'wild-juice', destroyed: false, base, rotG };
    const pixiBubbleContainer = { destroyed: false, renderable: true };
    tile._wildJuiceBubbleSystem = {
      disposed: false,
      container: pixiBubbleContainer,
      bubbles: [],
    };
    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccJuiceBounceArtwork as any;
    controller.image.onload(new Event('load'));
    const footprint = controller.wrapper.querySelector(
      '[data-animated-special-artwork-overlap-footprint]',
    ) as HTMLElement;
    jest.spyOn(footprint, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      right: 228,
      bottom: 228,
      width: 128,
      height: 128,
      toJSON: () => ({}),
    });

    const originalImage = controller.image;
    const originalSrc = originalImage.getAttribute('src');
    const releaseForeground = acquireGameplayDragForeground();
    try {
      setGameplayDragBounds({ x: 120, y: 120, width: 128, height: 128 });
      expect(controller.wrapper.parentElement?.className)
        .toBe('animated-special-artwork-occluded-layer');
      expect(controller.wrapper.style.visibility).toBe('visible');
      expect(controller.image).toBe(originalImage);
      expect(controller.image.getAttribute('src')).toBe(originalSrc);
      expect(base.renderable).toBe(false);
      expect(pixiBubbleContainer.renderable).toBe(false);

      setGameplayDragBounds({ x: 260, y: 120, width: 128, height: 128 });
      expect(controller.wrapper.parentElement?.className)
        .toBe('animated-special-artwork-layer');
      expect(controller.image).toBe(originalImage);
      expect(controller.image.getAttribute('src')).toBe(originalSrc);
      expect(base.renderable).toBe(false);
    } finally {
      setGameplayDragBounds(null);
      releaseForeground();
    }
  });
});
