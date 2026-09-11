/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import {
  destroyFishSwimArtworkRuntime,
  FISH_SWIM_CYCLE_MS,
  FISH_SWIM_DISPLAY_SIZE,
  FISH_SWIM_HEVC_URL,
  FISH_SWIM_PNG_URL,
  FISH_SWIM_REST_ART,
  FISH_SWIM_SVG_URL,
  FISH_SWIM_VIEWBOX,
  getFishSwimDisplayGeometry,
  getFishSwimRuntimeStats,
  isFishSwimTile,
  shouldFlipFishForViewport,
} from '../fish-swim-artwork';
import {
  FISH_BUBBLES_DURATION_MS,
  FISH_BUBBLES_HEVC_SOURCE,
  FISH_BUBBLES_END_SCALE,
  FISH_BUBBLES_SCALE_DOWN_START_RATIO,
  FISH_BUBBLES_SOURCE_DURATION_MS,
  FISH_BUBBLES_START_SCALE,
  FISH_BUBBLES_SPEED,
  FISH_BUBBLES_SVG_SOURCE,
  FISH_BUBBLES_VERTICAL_OFFSET_VIEWPORT_RATIO,
} from '../fish-finale-bubbles';
import {
  FISH_FINALE_ARC_WIDTH_MULTIPLIER,
  FISH_FINALE_BEE_MOTION_DIFFERENCE,
  FISH_FINALE_BUBBLY_START_RATIO,
  FISH_FINALE_DIRECTION_THRESHOLD,
  FISH_FINALE_DURATION_EXTENSION_SECONDS,
  FISH_FINALE_MAX_PITCH_DEGREES,
  FISH_FINALE_ORIGINAL_START_COUNT,
  FISH_FINALE_SCHOOL_COUNT,
  FISH_FINALE_SCHOOL_DURATION_SECONDS,
  FISH_FINALE_SIZE_VARIATION_RATIO,
  FISH_FINALE_SPEED_WAVE_MULTIPLIER,
  FISH_FINALE_SWIM_BOB_PX,
  FISH_FINALE_SWIM_SCALE_PULSE,
  FISH_FINALE_SWIM_WOBBLE_PX,
  FISH_FINALE_TURN_OPACITY,
  FISH_FINALE_TURN_POP_SECONDS,
  FISH_FINALE_TURN_SQUASH_RATIO,
  FISH_FINALE_TURN_STRETCH_RATIO,
  createFishFinaleSchoolRoute,
  resolveFishFinaleFacing,
  warpFishFinaleProgress,
} from '../fish-finale-school';
import {
  getCoreWildTypeForSpecialDiceVariant,
  getSpecialDiceIdleBubbleColors,
  getSpecialDiceSplashLetterColors,
  getSpecialDiceSplashOptions,
  getSpecialDiceVariant,
  getSpecialDiceTrailColors,
  usesSpecialDiceIdleBubbles,
} from '../special-dice-registry';
import {
  setSpecialDiceIdleDragging,
  startSpecialDiceIdleMotion,
  stopSpecialDiceIdleMotion,
} from '../special-dice-idle';
import { showSparkleText, stopSparkleText } from '../splash-text-overlay';

function makeFishTile() {
  const base = new Sprite(Texture.WHITE);
  base.width = 128;
  base.height = 128;
  const rotG = new Container();
  rotG.addChild(base);
  const tile: any = {
    special: 'wild',
    _ccSpecialDiceVariant: 'fish',
    destroyed: false,
    zIndex: 7,
    base,
    rotG,
  };
  return { tile, base };
}

describe('Beach Fish special-die contract', () => {
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
    stopSparkleText();
    destroyFishSwimArtworkRuntime();
    STATE.app = null;
    document.body.replaceChildren();
  });

  test('inherits Wild Star gameplay and owns the supplied visual palette', () => {
    const fish = getSpecialDiceVariant('fish');
    expect(fish).toMatchObject({
      archetype: 'wild-star',
      texture: FISH_SWIM_PNG_URL,
      splashText: 'FISHY',
      splashColor: '#FD7C41',
      splashColors: ['#FD7C41', '#FCA470'],
      splashSplitIndex: 3,
      shardColor: 0xFCA470,
      shardColors: [0xFCA470, 0xFD6B38],
      trailColors: [0xF5D8BF, 0xFDAC78, 0xFDA458, 0xFD7C41],
      idleBubbleColors: [0xFFE6E1, 0xFFF2E9, 0xFFD5D6],
      burstParticleSources: [FISH_SWIM_PNG_URL],
      finaleScene: 'fish-bubbles',
      idleOrbit: false,
      idleMotion: 'fish-swim',
    });
    expect(getCoreWildTypeForSpecialDiceVariant(fish)).toBe('wild');
    expect(getSpecialDiceTrailColors(fish)).toEqual([0xF5D8BF, 0xFDAC78, 0xFDA458, 0xFD7C41]);
    expect(getSpecialDiceIdleBubbleColors(fish)).toEqual([0xFFE6E1, 0xFFF2E9, 0xFFD5D6]);
    expect(usesSpecialDiceIdleBubbles({ special: 'wild', _ccSpecialDiceVariant: 'fish' })).toBe(true);
    expect(getSpecialDiceSplashLetterColors(fish)).toEqual([
      '#FD7C41', '#FD7C41', '#FD7C41', '#FCA470', '#FCA470',
    ]);
    expect(getSpecialDiceSplashOptions(fish)).toMatchObject({
      burstSources: [FISH_SWIM_PNG_URL],
      finaleScene: 'fish-bubbles',
    });
  });

  test('starts the supplied Bubbly animation at 1.7x and 25% below centre during Fish Merge-6', () => {
    expect(FISH_BUBBLES_SOURCE_DURATION_MS).toBe(3600);
    expect(FISH_BUBBLES_SPEED).toBe(1.5);
    expect(FISH_BUBBLES_DURATION_MS).toBe(2400);
    expect(FISH_BUBBLES_START_SCALE).toBe(1.7);
    expect(FISH_BUBBLES_END_SCALE).toBe(1);
    expect(FISH_BUBBLES_SCALE_DOWN_START_RATIO).toBe(0.72);
    expect(FISH_BUBBLES_VERTICAL_OFFSET_VIEWPORT_RATIO).toBe(0.25);
    const fastSvgPath = path.resolve(process.cwd(), FISH_BUBBLES_SVG_SOURCE.replace('./', ''));
    const hevcPath = path.resolve(process.cwd(), FISH_BUBBLES_HEVC_SOURCE.replace('./', ''));
    const fastSvg = fs.readFileSync(fastSvgPath, 'utf8');
    expect(fastSvg).toContain('dur="2.4s"');
    expect(fastSvg).not.toContain('dur="3.6s"');
    expect(fastSvg).not.toContain('repeatCount="indefinite"');
    expect(fs.existsSync(hevcPath)).toBe(true);

    const fish = getSpecialDiceVariant('fish');
    showSparkleText({ x: 195, y: 430 }, getSpecialDiceSplashOptions(fish));
    const bubbles = document.querySelector<HTMLElement>('[data-fish-bubbles="active"]');
    expect(bubbles).not.toBeNull();
    expect(Number(bubbles?.dataset.fishBubblesVerticalOffset)).toBeCloseTo(
      Math.max(520, window.innerHeight || 844) * 0.25,
      5,
    );
    expect(bubbles?.querySelector<HTMLImageElement>('[data-fish-bubbles-source="svg-fast-fallback"]')?.src)
      .toContain('assets/shop/fish/bubbly-fast.svg');
  });

  test('gives every repeated Fish Merge-6 a fresh one-shot Bubbly playback owner', () => {
    const fish = getSpecialDiceVariant('fish');
    const options = getSpecialDiceSplashOptions(fish);

    showSparkleText({ x: 195, y: 430 }, options);
    const firstField = document.querySelector<HTMLElement>('[data-fish-bubbles="active"]');
    const firstMedia = firstField?.querySelector<HTMLImageElement>('[data-fish-bubbles-source]');
    const firstRun = firstField?.dataset.fishBubblesRun;
    const firstSource = firstMedia?.getAttribute('src');

    expect(firstField).not.toBeNull();
    expect(firstSource).toContain(`${FISH_BUBBLES_SVG_SOURCE}?cc-fish-bubbles-run=`);

    stopSparkleText();
    showSparkleText({ x: 195, y: 430 }, options);
    const secondFields = document.querySelectorAll<HTMLElement>('[data-fish-bubbles="active"]');
    const secondField = secondFields[0];
    const secondMedia = secondField?.querySelector<HTMLImageElement>('[data-fish-bubbles-source]');

    expect(secondFields).toHaveLength(1);
    expect(secondField).not.toBe(firstField);
    expect(secondField?.dataset.fishBubblesRun).not.toBe(firstRun);
    expect(secondMedia).not.toBe(firstMedia);
    expect(secondMedia?.getAttribute('src')).not.toBe(firstSource);
    expect(secondMedia?.getAttribute('src')).toContain(
      `${FISH_BUBBLES_SVG_SOURCE}?cc-fish-bubbles-run=`,
    );
  });

  test('uses exactly five directional Fish PNG swimmers instead of a radial particle burst', () => {
    const fish = getSpecialDiceVariant('fish');
    showSparkleText({ x: 195, y: 430 }, getSpecialDiceSplashOptions(fish));
    const overlay = document.querySelector<HTMLElement>('[data-effect-text="FISHY"]');
    const letters = Array.from(overlay?.querySelectorAll<HTMLElement>('.cc-sparkle-text-letter') ?? []);
    const particles = Array.from(overlay?.querySelectorAll<HTMLImageElement>('.cc-fish-finale-swimmer') ?? []);

    expect(letters.map((letter) => letter.dataset.effectLetterColor)).toEqual([
      '#FD7C41', '#FD7C41', '#FD7C41', '#FCA470', '#FCA470',
    ]);
    expect(particles).toHaveLength(5);
    expect(particles.every((particle) => particle.getAttribute('src') === FISH_SWIM_PNG_URL)).toBe(true);
    expect(particles.every((particle) => particle.dataset.directionalFish === 'true')).toBe(true);
    expect(particles.every((particle) => ['left', 'right'].includes(particle.dataset.fishFacing || ''))).toBe(true);
    expect(particles.map((particle) => particle.dataset.fishSchoolIndex)).toEqual(['0', '1', '2', '3', '4']);
    expect(particles.filter((particle) => particle.dataset.fishStartRegion === 'merge-origin')).toHaveLength(1);
    expect(particles.filter((particle) => particle.dataset.fishStartRegion === 'bubbly-origin')).toHaveLength(4);
  });

  test('keeps five lively Fish routes upward with instant masked turns and bounded pitch', () => {
    expect(FISH_FINALE_SCHOOL_COUNT).toBe(5);
    expect(FISH_FINALE_BEE_MOTION_DIFFERENCE).toBe(0.70);
    expect(FISH_FINALE_DURATION_EXTENSION_SECONDS).toBe(0.5);
    expect(FISH_FINALE_SCHOOL_DURATION_SECONDS).toBe(2.9);
    expect(FISH_FINALE_ORIGINAL_START_COUNT / FISH_FINALE_SCHOOL_COUNT).toBe(0.20);
    expect(FISH_FINALE_BUBBLY_START_RATIO).toBe(0.80);
    expect(FISH_FINALE_ARC_WIDTH_MULTIPLIER).toBeGreaterThanOrEqual(1.30);
    expect(FISH_FINALE_SPEED_WAVE_MULTIPLIER).toBeGreaterThanOrEqual(1.40);
    expect(FISH_FINALE_SIZE_VARIATION_RATIO).toBe(0.40);
    expect(FISH_FINALE_MAX_PITCH_DEGREES).toBe(24);
    expect(FISH_FINALE_DIRECTION_THRESHOLD).toBe(1.4);
    expect(FISH_FINALE_TURN_POP_SECONDS).toBeLessThanOrEqual(0.10);
    expect(FISH_FINALE_TURN_OPACITY).toBeGreaterThanOrEqual(0.70);
    expect(FISH_FINALE_SWIM_BOB_PX).toBeGreaterThanOrEqual(4);
    expect(FISH_FINALE_SWIM_WOBBLE_PX).toBeGreaterThanOrEqual(2);
    expect(FISH_FINALE_SWIM_SCALE_PULSE).toBeGreaterThanOrEqual(0.05);
    expect(FISH_FINALE_TURN_SQUASH_RATIO).toBeGreaterThanOrEqual(0.25);
    expect(FISH_FINALE_TURN_STRETCH_RATIO).toBeGreaterThanOrEqual(0.15);
    expect(resolveFishFinaleFacing(1, -2)).toEqual({ facing: -1, changed: true });
    expect(resolveFishFinaleFacing(-1, 2)).toEqual({ facing: 1, changed: true });
    expect(resolveFishFinaleFacing(1, 0.4)).toEqual({ facing: 1, changed: false });

    const viewport = { width: 390, height: 844 };
    const mergeOrigin = { x: 195, y: 430 };
    const bubblyOrigin = { x: 195, y: viewport.height * FISH_FINALE_BUBBLY_START_RATIO };
    const routes = Array.from({ length: FISH_FINALE_SCHOOL_COUNT }, (_, index) => (
      createFishFinaleSchoolRoute(index, viewport, mergeOrigin, bubblyOrigin)
    ));
    expect(routes.filter((route) => route.startRegion === 'merge-origin')).toHaveLength(1);
    expect(routes.filter((route) => route.startRegion === 'bubbly-origin')).toHaveLength(4);
    expect(routes[0].start).toEqual({
      x: mergeOrigin.x - viewport.width * 0.08,
      y: mergeOrigin.y + viewport.height * 0.12,
    });
    expect(routes[1].start).toEqual({
      x: bubblyOrigin.x + viewport.width * 0.09,
      y: bubblyOrigin.y + viewport.height * 0.14,
    });
    expect(routes.every((route) => route.duration > 2.1)).toBe(true);
    expect(routes.every((route) => route.delay + route.duration <= FISH_FINALE_SCHOOL_DURATION_SECONDS)).toBe(true);
    expect(routes.every((route) => route.speedWave > 0.33)).toBe(true);
    const sizes = routes.map((route) => route.size);
    expect(new Set(sizes).size).toBe(FISH_FINALE_SCHOOL_COUNT);
    expect(1 - Math.min(...sizes) / Math.max(...sizes)).toBeCloseTo(FISH_FINALE_SIZE_VARIATION_RATIO, 1);
    expect(routes.every((route) => route.points.length === 6)).toBe(true);
    expect(routes.every((route) => route.points[route.points.length - 1].y < 0)).toBe(true);
    expect(routes.some((route) => route.points[route.points.length - 1].x < 0)).toBe(true);
    expect(routes.some((route) => route.points[route.points.length - 1].x > viewport.width)).toBe(true);
    expect(routes.every((route) => {
      const horizontalSteps = route.points.slice(1).map((point, index) => point.x - route.points[index].x);
      return horizontalSteps.some((step) => step < 0) && horizontalSteps.some((step) => step > 0);
    })).toBe(true);

    const samples = Array.from({ length: 101 }, (_, index) => warpFishFinaleProgress(index / 100, 0.31));
    expect(samples[0]).toBe(0);
    expect(samples[samples.length - 1]).toBe(1);
    expect(samples.every((sample, index) => index === 0 || sample >= samples[index - 1])).toBe(true);
    expect(samples.some((sample, index) => index > 0 && index < samples.length - 1
      && Math.abs((sample - samples[index - 1]) - (samples[index + 1] - sample)) > 0.00001)).toBe(true);
  });

  test('keeps the authored 128px fish centred inside its complete motion corridor', () => {
    const geometry = getFishSwimDisplayGeometry();
    expect(FISH_SWIM_VIEWBOX).toEqual({ minX: -24, minY: -28, width: 272, height: 280 });
    expect(FISH_SWIM_REST_ART).toEqual({ centerX: 112, centerY: 112, size: 224 });
    expect(FISH_SWIM_CYCLE_MS).toBe(1125);
    expect(geometry.restingArtworkWidth).toBeCloseTo(FISH_SWIM_DISPLAY_SIZE, 8);
    expect(geometry.restingArtworkHeight).toBeCloseTo(FISH_SWIM_DISPLAY_SIZE, 8);
    expect(geometry.anchorX).toBeCloseTo(0.5, 8);
    expect(geometry.anchorY).toBeCloseTo(0.5, 8);
    expect(geometry.width).toBeGreaterThan(FISH_SWIM_DISPLAY_SIZE);
    expect(geometry.height).toBeGreaterThan(FISH_SWIM_DISPLAY_SIZE);
  });

  test('retains PNG, authored SVG and bounded iOS HEVC assets', () => {
    const pngPath = path.resolve(process.cwd(), FISH_SWIM_PNG_URL.replace('./', ''));
    const svgPath = path.resolve(process.cwd(), FISH_SWIM_SVG_URL.replace('./', ''));
    const hevcPath = path.resolve(process.cwd(), FISH_SWIM_HEVC_URL.replace('./', ''));
    const svg = fs.readFileSync(svgPath, 'utf8');

    expect(fs.existsSync(pngPath)).toBe(true);
    expect(fs.existsSync(hevcPath)).toBe(true);
    expect(fs.statSync(hevcPath).size).toBeLessThan(400_000);
    expect(svg).toContain('viewBox="-24 -28 272 280"');
    expect(svg).toContain('72 frames in a 1.125-second loop');
    expect(svg).toContain('dur="1.125s"');
    expect(svg.match(/<animateTransform(?=\s)/g)).toHaveLength(4);
    expect(svg.match(/<image(?=\s)/g)).toHaveLength(1);
    expect(svg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
  });

  test('uses direct animation only for Fish, swaps to PNG during drag, and restores cleanup', () => {
    const { tile, base } = makeFishTile();
    const pixiBubbleContainer = { destroyed: false, renderable: true };
    tile._wildJuiceBubbleSystem = {
      disposed: false,
      container: pixiBubbleContainer,
      bubbles: [{
        destroyed: false,
        x: 8,
        y: -18,
        alpha: 0.85,
        visible: true,
        renderable: true,
        scale: { x: 0.7, y: 0.7 },
        _ccIdleBubblePaint: { radius: 10, color: 0xFFE6E1 },
      }],
    };
    expect(isFishSwimTile(tile)).toBe(true);
    expect(isFishSwimTile({ special: 'wild' })).toBe(false);

    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccFishSwimArtwork;
    expect(controller).toBeDefined();
    expect(controller.image?.dataset.fishSwimSource).toBe('svg-fallback');
    expect(controller.image?.getAttribute('src')).toBe(FISH_SWIM_SVG_URL);
    expect(base.renderable).toBe(true);

    controller.image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect(pixiBubbleContainer.renderable).toBe(false);
    expect(controller.bubbleLayer.style.zIndex).toBe('2');
    expect(controller.bubbleLayer.childElementCount).toBe(1);
    expect(getFishSwimRuntimeStats()).toMatchObject({
      controllers: 1,
      ready: 1,
      hevc: 0,
      svg: 1,
      runtimeAttached: true,
    });

    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    expect(controller.wrapper.style.visibility).toBe('hidden');
    expect(base.renderable).toBe(true);
    expect(pixiBubbleContainer.renderable).toBe(true);
    expect(controller.bubbleLayer.childElementCount).toBe(0);

    expect(setSpecialDiceIdleDragging(tile, false)).toBe(true);
    expect(base.renderable).toBe(false);
    expect(pixiBubbleContainer.renderable).toBe(false);
    expect(controller.bubbleLayer.childElementCount).toBe(1);

    stopSpecialDiceIdleMotion(tile);
    expect(tile._ccFishSwimArtwork).toBeUndefined();
    expect(base.renderable).toBe(true);
    expect(pixiBubbleContainer.renderable).toBe(true);
    expect(getFishSwimRuntimeStats()).toEqual({
      controllers: 0,
      ready: 0,
      hevc: 0,
      svg: 0,
      runtimeAttached: false,
      overlayAttached: false,
    });
  });

  test('faces right on the left half and flips the dragged Fish on the right half like Bee', () => {
    expect(shouldFlipFishForViewport(0, 390)).toBe(false);
    expect(shouldFlipFishForViewport(195, 390)).toBe(false);
    expect(shouldFlipFishForViewport(195.01, 390)).toBe(true);
    expect(shouldFlipFishForViewport(390, 390)).toBe(true);
    expect(shouldFlipFishForViewport(Number.NaN, 390)).toBe(false);
    expect(shouldFlipFishForViewport(300, 0)).toBe(false);

    const dragSource = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/drag-core.ts'), 'utf8');
    expect(dragSource.indexOf('t.position.set(parentPoint.x, parentPoint.y);')).toBeLessThan(
      dragSource.indexOf('refreshSpecialDiceIdleDragFacing(t);'),
    );
  });
});
