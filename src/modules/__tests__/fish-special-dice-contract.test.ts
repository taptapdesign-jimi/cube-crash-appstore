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
  FISH_FINALE_SWIMMER_DURATION_SECONDS,
  FISH_FINALE_SWIMMER_SCALE,
  FISH_FINALE_SWIMMER_VISIBLE_SIZE,
  createFishFinaleSwimmerPlan,
  sampleFishFinaleSwimmerPose,
} from '../fish-finale-swimmer';
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
      idleBubbleColors: [0x65BAC8, 0xA1DDBE],
      finaleScene: 'fish-bubbles',
      idleOrbit: false,
      idleMotion: 'fish-swim',
    });
    expect(getCoreWildTypeForSpecialDiceVariant(fish)).toBe('wild');
    expect(getSpecialDiceTrailColors(fish)).toEqual([0xF5D8BF, 0xFDAC78, 0xFDA458, 0xFD7C41]);
    expect(getSpecialDiceIdleBubbleColors(fish)).toEqual([0x65BAC8, 0xA1DDBE]);
    expect(usesSpecialDiceIdleBubbles({ special: 'wild', _ccSpecialDiceVariant: 'fish' })).toBe(true);
    expect(getSpecialDiceSplashLetterColors(fish)).toEqual([
      '#FD7C41', '#FD7C41', '#FD7C41', '#FCA470', '#FCA470',
    ]);
    expect(fish.burstParticleSources).toBeUndefined();
    expect(getSpecialDiceSplashOptions(fish)).toMatchObject({
      finaleScene: 'fish-bubbles',
    });
    expect(getSpecialDiceSplashOptions(fish).burstSources).toBeUndefined();
  });

  test('restores Bubbly Fast and mounts one reduced Fish at the exact Merge-6 origin', () => {
    expect(FISH_BUBBLES_SOURCE_DURATION_MS).toBe(3600);
    expect(FISH_BUBBLES_SPEED).toBe(1.5);
    expect(FISH_BUBBLES_DURATION_MS).toBe(2400);
    expect(FISH_BUBBLES_START_SCALE).toBe(1.7);
    expect(FISH_BUBBLES_END_SCALE).toBe(1);
    expect(FISH_BUBBLES_SCALE_DOWN_START_RATIO).toBe(0.72);
    expect(FISH_BUBBLES_VERTICAL_OFFSET_VIEWPORT_RATIO).toBe(0.25);
    const finaleSvgPath = path.resolve(process.cwd(), FISH_BUBBLES_SVG_SOURCE.replace('./', ''));
    const hevcPath = path.resolve(process.cwd(), FISH_BUBBLES_HEVC_SOURCE.replace('./', ''));
    const finaleSvg = fs.readFileSync(finaleSvgPath, 'utf8');
    expect(finaleSvg).toContain('dur="2.4s"');
    expect(finaleSvg).not.toContain('dur="3.6s"');
    expect(finaleSvg).not.toContain('repeatCount="indefinite"');
    expect(fs.existsSync(hevcPath)).toBe(true);
    expect(FISH_BUBBLES_SVG_SOURCE).toContain('bubbly-fast.svg');
    expect(FISH_BUBBLES_HEVC_SOURCE).toContain('bubbly-fast-hevc.mov');
    expect(fs.statSync(hevcPath).size).toBeGreaterThan(0);
    expect(fs.statSync(hevcPath).size).toBeLessThan(2_000_000);

    const fish = getSpecialDiceVariant('fish');
    showSparkleText({ x: 195, y: 430 }, getSpecialDiceSplashOptions(fish));
    const bubbles = document.querySelector<HTMLElement>('[data-fish-bubbles="active"]');
    expect(bubbles).not.toBeNull();
    expect(Number(bubbles?.dataset.fishBubblesVerticalOffset)).toBeCloseTo(
      Math.max(520, window.innerHeight || 844) * FISH_BUBBLES_VERTICAL_OFFSET_VIEWPORT_RATIO,
      5,
    );
    expect(bubbles?.querySelector<HTMLImageElement>('[data-fish-bubbles-source="svg-fast-fallback"]')?.src)
      .toContain('assets/shop/fish/bubbly-fast.svg');
    expect(document.querySelector('[data-fish-finale-school="active"]')).toBeNull();
    const swimmerField = document.querySelector<HTMLElement>('[data-fish-finale-swimmer="active"]');
    const swimmer = swimmerField?.querySelector<HTMLElement>('.cc-fish-finale-swimmer');
    expect(document.querySelectorAll('[data-fish-finale-swimmer="active"]')).toHaveLength(1);
    expect(document.querySelectorAll('.cc-fish-finale-swimmer')).toHaveLength(1);
    expect(swimmerField?.dataset.fishFinaleOriginX).toBe('195.00');
    expect(swimmerField?.dataset.fishFinaleOriginY).toBe('430.00');
    expect(swimmerField?.dataset.fishFinaleVisibleSize).toBe('166.4');
    expect(swimmer?.dataset.fishFinaleX).toBe('195.00');
    expect(swimmer?.dataset.fishFinaleY).toBe('430.00');
    expect(swimmer?.querySelector<HTMLImageElement>('[data-fish-finale-source="svg-fallback"]')?.src)
      .toContain('assets/shop/fish/fish.svg?cc-fish-finale-run=');
  });

  test('flies in one monotonic direction with no Bee-style route reversal', () => {
    const viewport = { width: 390, height: 844 };
    expect(FISH_FINALE_SWIMMER_SCALE).toBe(1.3);
    expect(FISH_FINALE_SWIMMER_VISIBLE_SIZE).toBe(FISH_SWIM_DISPLAY_SIZE * 1.3);
    expect(FISH_FINALE_SWIMMER_DURATION_SECONDS).toBe(3.6);

    const rightward = createFishFinaleSwimmerPlan({ x: 80, y: 430 }, viewport);
    const leftward = createFishFinaleSwimmerPlan({ x: 310, y: 430 }, viewport);
    expect(rightward.direction).toBe(1);
    expect(leftward.direction).toBe(-1);
    expect(rightward.origin).toEqual({ x: 80, y: 430 });
    expect(leftward.origin).toEqual({ x: 310, y: 430 });
    expect(rightward.end.x).toBeGreaterThan(viewport.width);
    expect(leftward.end.x).toBeLessThan(0);

    for (const plan of [rightward, leftward]) {
      const poses = Array.from({ length: 25 }, (_, index) => (
        sampleFishFinaleSwimmerPose(
          FISH_FINALE_SWIMMER_DURATION_SECONDS * index / 24,
          plan,
          viewport,
        )
      ));
      expect(poses[0]).toMatchObject({ x: plan.origin.x, y: plan.origin.y });
      for (let index = 1; index < poses.length; index += 1) {
        const deltaX = poses[index].x - poses[index - 1].x;
        expect(deltaX * plan.direction).toBeGreaterThanOrEqual(0);
      }
      expect(poses[poses.length - 1].x).toBeCloseTo(plan.end.x, 8);
      expect(poses[poses.length - 1].opacity).toBe(0);
    }
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
    expect(document.querySelectorAll('[data-fish-finale-swimmer="active"]')).toHaveLength(1);
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
        _ccIdleBubblePaint: { radius: 10, color: 0x65BAC8 },
      }],
    };
    expect(isFishSwimTile(tile)).toBe(true);
    expect(isFishSwimTile({ special: 'wild' })).toBe(false);

    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccFishSwimArtwork;
    expect(controller).toBeDefined();
    expect(controller.wrapper.style.overflow).toBe('visible');
    expect(controller.artworkClip.style.overflow).toBe('hidden');
    expect(controller.image?.dataset.fishSwimSource).toBe('svg-fallback');
    expect(controller.image?.getAttribute('src')).toBe(FISH_SWIM_SVG_URL);
    expect(controller.image?.parentElement).toBe(controller.artworkClip);
    expect(controller.bubbleLayer.parentElement).toBe(controller.wrapper);
    expect(base.renderable).toBe(true);

    controller.image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect(pixiBubbleContainer.renderable).toBe(false);
    expect(controller.bubbleLayer.style.zIndex).toBe('2');
    expect(controller.bubbleLayer.childElementCount).toBe(1);
    expect((controller.bubbleLayer.firstElementChild as HTMLElement)?.style.background)
      .toBe('rgba(101, 186, 200, 0.6)');
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

  test('keeps two Fish animated on distinct oscillation clocks', () => {
    jest.useFakeTimers();
    const first = makeFishTile();
    const second = makeFishTile();
    try {
      startSpecialDiceIdleMotion(first.tile);
      startSpecialDiceIdleMotion(second.tile);

      const firstController = first.tile._ccFishSwimArtwork;
      const secondController = second.tile._ccFishSwimArtwork;
      expect(firstController).toBeDefined();
      expect(secondController).toBeDefined();
      expect(firstController.image?.dataset.ccSvgPhaseSlot).toBe('0');
      expect(secondController.image?.dataset.ccSvgPhaseSlot).toBe('1');
      expect(firstController.image?.getAttribute('src')).toBe(FISH_SWIM_SVG_URL);
      expect(secondController.image?.getAttribute('src')).toBeNull();
      expect(secondController.phaseLease.delayMs).toBeGreaterThanOrEqual(100);

      jest.advanceTimersByTime(secondController.phaseLease.delayMs);
      expect(secondController.image?.getAttribute('src')).toBe(
        `${FISH_SWIM_SVG_URL}?cc-svg-phase=1`,
      );
      expect(getFishSwimRuntimeStats()).toMatchObject({
        controllers: 2,
        svg: 2,
      });
    } finally {
      stopSpecialDiceIdleMotion(second.tile);
      stopSpecialDiceIdleMotion(first.tile);
      jest.useRealTimers();
    }
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
