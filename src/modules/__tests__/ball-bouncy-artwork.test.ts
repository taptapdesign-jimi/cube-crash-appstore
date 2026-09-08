/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import {
  BALL_BOUNCY_DISPLAY_SIZE,
  BALL_BOUNCY_DRAG_Z_INDEX,
  BALL_BOUNCY_IDLE_OFFSET_Y,
  BALL_BOUNCY_REST_ART,
  destroyBallBouncyArtworkRuntime,
  BALL_BOUNCY_BUBBLE_ORIGIN_COMPENSATION_Y,
  getBallBouncyDisplayGeometry,
  getBallBouncyRuntimeStats,
  isBeachBallBouncyTile,
} from '../ball-bouncy-artwork';
import { getAnimatedSpecialArtworkLayerStats } from '../animated-special-artwork-layer';
import { getAnimatedSpecialArtworkMode } from '../animated-special-artwork-mode';
import {
  acquireGameplayDragForeground,
  setGameplayDragBounds,
} from '../gameplay-drag-foreground-owner';
import {
  destroyJuiceBounceArtworkRuntime,
  startJuiceBounceArtwork,
} from '../juice-bounce-artwork';
import {
  setSpecialDiceIdleDragging,
  startSpecialDiceIdleMotion,
  stopSpecialDiceIdleMotion,
} from '../special-dice-idle';

function makeTile(variant: string, special: string) {
  const base = new Sprite(Texture.WHITE);
  const rotG = new Container();
  rotG.addChild(base);
  const tile = {
      special,
      _ccSpecialDiceVariant: variant,
      destroyed: false,
      zIndex: 7,
      base,
      rotG,
      getBounds: () => ({ x: 100, y: 100, width: 128, height: 128 }),
    } as any;
  return {
    tile,
    base,
  };
}

describe('Beach Ball animated SVG board artwork', () => {
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
    destroyBallBouncyArtworkRuntime();
    destroyJuiceBounceArtworkRuntime();
    STATE.app = null;
    document.body.replaceChildren();
  });

  test('maps the authored grounded ball to the exact existing 128px footprint', () => {
    const geometry = getBallBouncyDisplayGeometry();
    expect(geometry.restingArtworkWidth).toBeCloseTo(BALL_BOUNCY_DISPLAY_SIZE, 8);
    expect(geometry.restingArtworkHeight).toBeCloseTo(BALL_BOUNCY_DISPLAY_SIZE, 8);
    expect(geometry.idleOffsetY).toBe(BALL_BOUNCY_IDLE_OFFSET_Y);
    expect(BALL_BOUNCY_IDLE_OFFSET_Y).toBe(56);
    expect(BALL_BOUNCY_BUBBLE_ORIGIN_COMPENSATION_Y).toBe(-56);
    expect(BALL_BOUNCY_REST_ART.centerY).toBe(354);
    expect(geometry.anchorX).toBeGreaterThan(0);
    expect(geometry.anchorX).toBeLessThan(1);
    expect(geometry.anchorY).toBeGreaterThan(0);
    expect(geometry.anchorY).toBeLessThan(1);
  });

  test('uses the self-contained 1.4-second indefinite SMIL animation', () => {
    const svg = fs.readFileSync(
      path.resolve(process.cwd(), 'assets/shop/ball/ball-bouncy.svg'),
      'utf8',
    );
    const animateCount = svg.match(/<animate(?=\s)/g)?.length ?? 0;
    const animateTransformCount = svg.match(/<animateTransform(?=\s)/g)?.length ?? 0;

    expect(Buffer.byteLength(svg, 'utf8')).toBeLessThanOrEqual(200_000);
    expect(svg).toContain('viewBox="0 0 390 440"');
    expect(svg).toContain('dur="1.4s"');
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).toContain('calcMode="spline"');
    expect(svg).toContain('xlink:href="data:image/png;base64,');
    expect(animateCount).toBe(0);
    expect(animateTransformCount).toBe(3);
    expect(svg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
  });

  test('owns only the Beach Ball registry variant', () => {
    expect(isBeachBallBouncyTile({ special: 'wild-tnt', _ccSpecialDiceVariant: 'beach-ball' })).toBe(true);
    expect(isBeachBallBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'bottle' })).toBe(false);
    expect(isBeachBallBouncyTile({ special: 'wild-juice' })).toBe(false);
    expect(isBeachBallBouncyTile({ special: 'wild-tnt' })).toBe(false);
  });

  test('lowers idle 56px while bubbles retain the PNG origin, then swaps cleanly during drag', () => {
    const { tile, base } = makeTile('beach-ball', 'wild-tnt');
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
        _ccIdleBubblePaint: { radius: 12, color: 0x4BC9FC },
      }],
    };

    startSpecialDiceIdleMotion(tile);
    const first = tile._ccBallBouncyArtwork;
    startSpecialDiceIdleMotion(tile);
    const second = tile._ccBallBouncyArtwork;

    expect(first).toBe(second);
    expect(tile._ccSpecialDiceIdleTl).toBeUndefined();
    expect(getBallBouncyRuntimeStats()).toMatchObject({
      controllers: 1,
      ready: 0,
      runtimeAttached: true,
      overlayAttached: true,
    });

    (first as any).image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect(pixiBubbleContainer.renderable).toBe(false);
    expect((first as any).wrapper.style.visibility).toBe('visible');
    expect((first as any).image.style.zIndex).toBe('1');
    expect((first as any).bubbleLayer.style.zIndex).toBe('2');
    expect((first as any).bubbleLayer.childElementCount).toBe(1);
    const geometry = getBallBouncyDisplayGeometry();
    const matrixValues = (first as any).wrapper.style.transform
      .slice('matrix('.length, -1)
      .split(',')
      .map((value: string) => Number(value.trim()));
    expect(matrixValues[5]).toBeCloseTo(
      -geometry.height * geometry.anchorY + BALL_BOUNCY_IDLE_OFFSET_Y,
      8,
    );
    const bubbleNode = (first as any).bubbleLayer.firstElementChild as HTMLDivElement;
    const bubbleTranslate = bubbleNode.style.transform.match(
      /translate3d\([^,]+,\s*(-?[\d.]+)px,/,
    );
    expect(bubbleTranslate).not.toBeNull();
    const bubbleLocalY = Number(bubbleTranslate?.[1]);
    // The wrapper moves +56px, while the mirrored paint moves -56px locally:
    // world-space bubble coordinates therefore still equal Pixi's PNG origin.
    expect(matrixValues[5] + bubbleLocalY).toBeCloseTo(-12 - 12, 8);
    expect(getBallBouncyRuntimeStats()).toMatchObject({ controllers: 1, ready: 1 });

    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    expect((first as any).dragging).toBe(true);
    expect((first as any).wrapper.style.zIndex).toBe(String(BALL_BOUNCY_DRAG_Z_INDEX));
    expect((first as any).wrapper.style.visibility).toBe('hidden');
    expect(base.renderable).toBe(true);
    expect(pixiBubbleContainer.renderable).toBe(true);
    expect((first as any).bubbleLayer.childElementCount).toBe(0);

    expect(setSpecialDiceIdleDragging(tile, false)).toBe(true);
    expect((first as any).dragging).toBe(false);
    expect((first as any).wrapper.style.visibility).toBe('visible');
    expect(base.renderable).toBe(false);
    expect(pixiBubbleContainer.renderable).toBe(false);
    expect((first as any).bubbleLayer.childElementCount).toBe(1);

    stopSpecialDiceIdleMotion(tile);
    expect(base.renderable).toBe(true);
    expect(pixiBubbleContainer.renderable).toBe(true);
    expect(tile._ccBallBouncyArtwork).toBeUndefined();
    expect(getBallBouncyRuntimeStats()).toEqual({
      controllers: 0,
      ready: 0,
      runtimeAttached: false,
      overlayAttached: false,
    });
  });

  test('keeps the static Ball PNG visible when the SVG cannot load', () => {
    const { tile, base } = makeTile('beach-ball', 'wild-tnt');
    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccBallBouncyArtwork;

    (controller as any).image.onerror(new Event('error'));

    expect(base.renderable).toBe(true);
    expect((controller as any).ready).toBe(false);
    expect((controller as any).wrapper.style.visibility).toBe('hidden');
  });

  test('keeps a stable PNG choice for one duplicate while another duplicate uses a phased SVG', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    const random = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.25);
    const first = makeTile('beach-ball', 'wild-tnt');
    const pngDuplicate = makeTile('beach-ball', 'wild-tnt');
    const svgDuplicate = makeTile('beach-ball', 'wild-tnt');
    try {
      startSpecialDiceIdleMotion(first.tile);
      startSpecialDiceIdleMotion(pngDuplicate.tile);
      startSpecialDiceIdleMotion(svgDuplicate.tile);

      expect(first.tile._ccBallBouncyArtwork).toBeDefined();
      expect(getAnimatedSpecialArtworkMode(first.tile)).toBe('svg');
      expect(pngDuplicate.tile._ccBallBouncyArtwork).toBeUndefined();
      expect(getAnimatedSpecialArtworkMode(pngDuplicate.tile)).toBe('png');
      expect(pngDuplicate.base.renderable).toBe(true);
      expect(setSpecialDiceIdleDragging(pngDuplicate.tile, true)).toBe(true);
      expect(setSpecialDiceIdleDragging(pngDuplicate.tile, false)).toBe(true);
      startSpecialDiceIdleMotion(pngDuplicate.tile);
      expect(getAnimatedSpecialArtworkMode(pngDuplicate.tile)).toBe('png');
      expect(random).toHaveBeenCalledTimes(2);

      expect(getAnimatedSpecialArtworkMode(svgDuplicate.tile)).toBe('svg');
      expect((svgDuplicate.tile._ccBallBouncyArtwork as any).phaseLease.phaseSlot).toBe(1);
      expect((svgDuplicate.tile._ccBallBouncyArtwork as any).phaseLease.delayMs).toBeGreaterThan(0);
    } finally {
      stopSpecialDiceIdleMotion(svgDuplicate.tile);
      stopSpecialDiceIdleMotion(pngDuplicate.tile);
      stopSpecialDiceIdleMotion(first.tile);
      random.mockRestore();
      jest.useRealTimers();
    }
  });

  test('keeps Ball animated during another drag and swaps only while their bounds overlap', () => {
    const { tile, base } = makeTile('beach-ball', 'wild-tnt');
    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccBallBouncyArtwork;
    const overlapFootprint = (controller as any).wrapper.querySelector(
      '[data-animated-special-artwork-overlap-footprint]',
    ) as HTMLElement;
    overlapFootprint.getBoundingClientRect = () => ({
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
    (controller as any).image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect((controller as any).wrapper.style.visibility).toBe('visible');

    const releaseForeground = acquireGameplayDragForeground();
    try {
      expect((controller as any).dragging).toBe(false);
      setGameplayDragBounds({ x: 300, y: 300, width: 128, height: 128 });
      expect((controller as any).wrapper.style.visibility).toBe('visible');
      expect(base.renderable).toBe(false);

      setGameplayDragBounds({ x: 150, y: 150, width: 128, height: 128 });
      expect((controller as any).wrapper.style.visibility).toBe('hidden');
      expect(base.renderable).toBe(true);

      setGameplayDragBounds({ x: 300, y: 300, width: 128, height: 128 });
      expect((controller as any).wrapper.style.visibility).toBe('visible');
      expect(base.renderable).toBe(false);
    } finally {
      releaseForeground();
    }

    expect((controller as any).wrapper.style.visibility).toBe('visible');
    expect(base.renderable).toBe(false);
  });

  test('shares one depth-sorted overlay with Juice instead of creating competing roots', () => {
    const { tile: ballTile } = makeTile('beach-ball', 'wild-tnt');
    const { tile: juiceTile } = makeTile('', 'wild-juice');

    startSpecialDiceIdleMotion(ballTile);
    startJuiceBounceArtwork(juiceTile);

    const ballWrapper = ballTile._ccBallBouncyArtwork.wrapper as HTMLDivElement;
    const juiceWrapper = juiceTile._ccJuiceBounceArtwork.wrapper as HTMLDivElement;
    expect(ballWrapper.parentElement).toBe(juiceWrapper.parentElement);
    expect(ballWrapper.parentElement?.classList.contains('animated-special-artwork-layer')).toBe(true);
    expect(getAnimatedSpecialArtworkLayerStats()).toMatchObject({
      owners: 2,
      tickerAttached: true,
      overlayAttached: true,
    });

    stopSpecialDiceIdleMotion(ballTile);
    expect(juiceWrapper.isConnected).toBe(true);
    expect(getAnimatedSpecialArtworkLayerStats().owners).toBe(1);
  });
});
