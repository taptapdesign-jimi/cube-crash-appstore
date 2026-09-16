/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { STATE } from '../app-state';
import {
  destroyJuiceBounceArtworkRuntime,
  getJuiceBounceDisplayGeometry,
  getJuiceBounceRuntimeStats,
  isPlainJuiceBounceTile,
  JUICE_BOUNCE_ACTIVE_DURATION_MS,
  JUICE_BOUNCE_CYCLE_MS,
  JUICE_BOUNCE_DISPLAY_SIZE,
  JUICE_BOUNCE_FRAME_COUNT,
  JUICE_BOUNCE_SHEET_URL,
  JUICE_BOUNCE_SVG_URL,
  setJuiceBounceArtworkDragging,
  startJuiceBounceArtwork,
  stopJuiceBounceArtwork,
} from '../juice-bounce-artwork';

function makeTexture(width: number, height: number): Texture {
  return new Texture({
    source: new TextureSource({
      resource: { width, height } as any,
      width,
      height,
    }),
  });
}

function makeTile() {
  const baseTexture = makeTexture(128, 128);
  const base = new Sprite(baseTexture);
  base.width = 128;
  base.height = 128;
  const rotG = new Container();
  rotG.addChild(base);
  return {
    tile: { special: 'wild-juice', destroyed: false, base, rotG } as any,
    base,
    rotG,
    baseTexture,
  };
}

describe('Juice shared Pixi board artwork', () => {
  let sheet: Texture;
  let loadSpy: jest.SpiedFunction<typeof Assets.load>;
  let getSpy: jest.SpiedFunction<typeof Assets.get>;
  let unloadSpy: jest.SpiedFunction<typeof Assets.unload>;
  let tickerCallbacks: Set<(ticker: any) => void>;
  let ticker: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    sheet = makeTexture(3999, 561);
    getSpy = jest.spyOn(Assets, 'get').mockReturnValue(undefined as any);
    loadSpy = jest.spyOn(Assets, 'load').mockResolvedValue(sheet as any);
    unloadSpy = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);
    tickerCallbacks = new Set();
    ticker = {
      elapsedMS: 0,
      add: jest.fn((callback: (liveTicker: any) => void) => tickerCallbacks.add(callback)),
      remove: jest.fn((callback: (liveTicker: any) => void) => tickerCallbacks.delete(callback)),
    };
    STATE.app = { ticker } as any;
  });

  afterEach(() => {
    destroyJuiceBounceArtworkRuntime();
    STATE.app = null;
    loadSpy.mockRestore();
    getSpy.mockRestore();
    unloadSpy.mockRestore();
    try { sheet.destroy(true); } catch {}
    jest.useRealTimers();
  });

  const flushPromises = async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  };

  const tick = (elapsedMS: number) => {
    ticker.elapsedMS = elapsedMS;
    Array.from(tickerCallbacks).forEach((callback) => callback(ticker));
  };

  test('maps the trimmed 60fps sheet to the exact accepted 128px resting footprint', () => {
    const geometry = getJuiceBounceDisplayGeometry();
    expect(geometry).toMatchObject({ width: 129, height: 187 });
    expect(geometry.anchorX).toBeCloseTo(67.326 / 129, 8);
    expect(geometry.anchorY).toBeCloseTo(119.38 / 187, 8);
    expect(geometry.restingArtworkWidth).toBe(JUICE_BOUNCE_DISPLAY_SIZE);
    expect(geometry.restingArtworkHeight).toBe(JUICE_BOUNCE_DISPLAY_SIZE);
    expect(JUICE_BOUNCE_CYCLE_MS).toBe(2000);
    expect(JUICE_BOUNCE_ACTIVE_DURATION_MS).toBe(1400);
    expect(JUICE_BOUNCE_FRAME_COUNT).toBe(84);
    expect(fs.existsSync(path.resolve(process.cwd(), JUICE_BOUNCE_SHEET_URL))).toBe(true);
    expect(fs.readFileSync(path.resolve(process.cwd(), JUICE_BOUNCE_SVG_URL), 'utf8'))
      .toContain('dur="2s"');
  });

  test('owns only generic Juice, never another Juice-archetype registry die', () => {
    expect(isPlainJuiceBounceTile({ special: 'wild-juice' })).toBe(true);
    expect(isPlainJuiceBounceTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'mushroom' })).toBe(false);
    expect(isPlainJuiceBounceTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'robo-cube' })).toBe(false);
    expect(isPlainJuiceBounceTile({ special: 'wild' })).toBe(false);
  });

  test('uses one source for independent Juice sprites and preserves the authored rest', async () => {
    const first = makeTile();
    const second = makeTile();
    const firstController = startJuiceBounceArtwork(first.tile) as any;
    const secondController = startJuiceBounceArtwork(second.tile) as any;
    await flushPromises();

    expect(firstController.sprite.texture.source).toBe(secondController.sprite.texture.source);
    expect(firstController.sprite).not.toBe(secondController.sprite);
    expect(firstController.running).toBe(true);
    expect(secondController.running).toBe(false);
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith(JUICE_BOUNCE_SHEET_URL);

    tick(secondController.phaseLease.delayMs);
    jest.advanceTimersByTime(secondController.phaseLease.delayMs);
    expect(secondController.running).toBe(true);
    tick(100);
    expect(firstController.frameIndex).not.toBe(secondController.frameIndex);

    firstController.elapsedMs = JUICE_BOUNCE_ACTIVE_DURATION_MS - 10;
    tick(20);
    expect(firstController.frameIndex).toBe(0);
    tick(100);
    expect(firstController.frameIndex).toBe(0);
  });

  test('keeps the existing Pixi bubbles visible and animates through drag without DOM mirrors', async () => {
    const { tile, base, rotG } = makeTile();
    const bubbleContainer = { destroyed: false, renderable: true };
    tile._wildJuiceBubbleSystem = { container: bubbleContainer, disposed: false, bubbles: [] };
    const controller = startJuiceBounceArtwork(tile) as any;
    await flushPromises();

    expect(base.renderable).toBe(false);
    expect(bubbleContainer.renderable).toBe(true);
    expect(controller.sprite.renderable).toBe(true);
    expect(document.querySelector('.juice-bounce-artwork')).toBeNull();
    expect(document.querySelector('.juice-bounce-front-bubbles')).toBeNull();

    const elapsedBeforeDrag = controller.elapsedMs;
    expect(setJuiceBounceArtworkDragging(tile, true)).toBe(true);
    tick(100);
    expect(base.renderable).toBe(false);
    expect(controller.sprite.renderable).toBe(true);
    expect(controller.elapsedMs).toBeGreaterThan(elapsedBeforeDrag);
    expect(bubbleContainer.renderable).toBe(true);

    expect(setJuiceBounceArtworkDragging(tile, false)).toBe(true);
    stopJuiceBounceArtwork(tile);
    expect(base.renderable).toBe(true);
    expect(rotG.getChildByLabel('juice-bounce-pixi')).toBeNull();
    expect(getJuiceBounceRuntimeStats()).toMatchObject({
      controllers: 0,
      ready: 0,
      overlayAttached: false,
      refs: 0,
    });
  });
});
