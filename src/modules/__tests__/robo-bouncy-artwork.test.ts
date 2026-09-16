/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { STATE } from '../app-state';
import {
  destroyRoboBouncyArtworkRuntime,
  getRoboBouncyDisplayGeometry,
  getRoboBouncyRuntimeStats,
  isRoboBouncyTile,
  ROBO_BOUNCY_CYCLE_MS,
  ROBO_BOUNCY_DISPLAY_SIZE,
  ROBO_BOUNCY_FRAME_COUNT,
  ROBO_BOUNCY_REST_ART,
  ROBO_BOUNCY_SHEET_URL,
  ROBO_BOUNCY_SVG_URL,
  setRoboBouncyArtworkDragging,
  startRoboBouncyArtwork,
  stopRoboBouncyArtwork,
} from '../robo-bouncy-artwork';

const DRAG_TEXTURE_URL = './assets/shop/robo/robo-cube2.png';

function makeTexture(width: number, height: number): Texture {
  return new Texture({
    source: new TextureSource({
      resource: { width, height } as any,
      width,
      height,
    }),
  });
}

function makeTile(variant = 'robo-cube') {
  const originalTexture = makeTexture(128, 128);
  const base = new Sprite(originalTexture);
  base.width = 128;
  base.height = 128;
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
    rotG,
    originalTexture,
  };
}

describe('Robo Cube shared Pixi board artwork', () => {
  let sheet: Texture;
  let dragTexture: Texture;
  let loadSpy: jest.SpiedFunction<typeof Assets.load>;
  let getSpy: jest.SpiedFunction<typeof Assets.get>;
  let unloadSpy: jest.SpiedFunction<typeof Assets.unload>;
  let tickerCallbacks: Set<(ticker: any) => void>;
  let ticker: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    sheet = makeTexture(4077, 1032);
    dragTexture = makeTexture(128, 128);
    getSpy = jest.spyOn(Assets, 'get').mockReturnValue(undefined as any);
    loadSpy = jest.spyOn(Assets, 'load').mockImplementation(async (source: any) => {
      if (source === ROBO_BOUNCY_SHEET_URL) return sheet as any;
      if (source === DRAG_TEXTURE_URL) return dragTexture as any;
      return Texture.WHITE as any;
    });
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
    destroyRoboBouncyArtworkRuntime();
    STATE.app = null;
    loadSpy.mockRestore();
    getSpy.mockRestore();
    unloadSpy.mockRestore();
    try { sheet.destroy(true); } catch {}
    try { dragTexture.destroy(true); } catch {}
    jest.useRealTimers();
  });

  const flushPromises = async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  };

  const tick = (elapsedMS: number) => {
    ticker.elapsedMS = elapsedMS;
    Array.from(tickerCallbacks).forEach((callback) => callback(ticker));
  };

  test('keeps the authored source contract and maps the trimmed sheet to the 128px rest footprint', () => {
    const geometry = getRoboBouncyDisplayGeometry();
    expect(geometry).toMatchObject({ width: 151, height: 172 });
    expect(geometry.anchorX).toBeCloseTo(79.5 / 151, 8);
    expect(geometry.anchorY).toBeCloseTo(104.5 / 172, 8);
    expect(geometry.restingArtworkWidth).toBe(ROBO_BOUNCY_DISPLAY_SIZE);
    expect(geometry.restingArtworkHeight).toBe(ROBO_BOUNCY_DISPLAY_SIZE);
    expect(ROBO_BOUNCY_REST_ART).toEqual({ centerX: 195, centerY: 239, size: 256 });
    expect(ROBO_BOUNCY_CYCLE_MS).toBe(2400);
    expect(ROBO_BOUNCY_FRAME_COUNT).toBe(144);
    expect(fs.existsSync(path.resolve(process.cwd(), ROBO_BOUNCY_SHEET_URL))).toBe(true);
    expect(fs.readFileSync(path.resolve(process.cwd(), ROBO_BOUNCY_SVG_URL), 'utf8'))
      .toContain('dur="2.4s"');
  });

  test('owns only the exact Robo Cube registry variant', () => {
    expect(isRoboBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'robo-cube' })).toBe(true);
    expect(isRoboBouncyTile({ special: 'wild-juice' })).toBe(false);
    expect(isRoboBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'mushroom' })).toBe(false);
    expect(isRoboBouncyTile({ special: 'wild' })).toBe(false);
  });

  test('shares one texture source, gives copies independent clocks, and cleans up', async () => {
    const first = makeTile();
    const second = makeTile();
    const firstController = startRoboBouncyArtwork(first.tile) as any;
    const secondController = startRoboBouncyArtwork(second.tile) as any;
    await flushPromises();

    expect(firstController.ready).toBe(true);
    expect(firstController.running).toBe(true);
    expect(secondController.ready).toBe(true);
    expect(secondController.running).toBe(false);
    expect(firstController.sprite.texture.source).toBe(secondController.sprite.texture.source);
    expect(firstController.sprite).not.toBe(secondController.sprite);
    expect(loadSpy.mock.calls.filter(([source]) => (source as any) === ROBO_BOUNCY_SHEET_URL)).toHaveLength(1);
    expect(ticker.add).toHaveBeenCalledTimes(1);

    tick(secondController.phaseLease.delayMs);
    jest.advanceTimersByTime(secondController.phaseLease.delayMs);
    expect(secondController.running).toBe(true);
    tick(100);
    expect(firstController.frameIndex).not.toBe(secondController.frameIndex);

    stopRoboBouncyArtwork(first.tile);
    stopRoboBouncyArtwork(second.tile);
    expect(first.base.renderable).toBe(true);
    expect(second.base.renderable).toBe(true);
    expect(first.rotG.getChildByLabel('robo-bouncy-pixi')).toBeNull();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(getRoboBouncyRuntimeStats()).toMatchObject({
      controllers: 0,
      ready: 0,
      overlayAttached: false,
      refs: 0,
    });
  });

  test('uses the accepted second Robo frame during drag and resumes the same Pixi controller', async () => {
    const { tile, base, originalTexture } = makeTile();
    const controller = startRoboBouncyArtwork(
      tile,
      ['./assets/shop/robo/robo-cube1.png', DRAG_TEXTURE_URL],
      ['./finale-1.png', './finale-2.png', './finale-3.png', './finale-4.png'],
    ) as any;
    await flushPromises();

    expect(base.renderable).toBe(false);
    expect(controller.sprite.renderable).toBe(true);
    expect(loadSpy).toHaveBeenCalledWith('./finale-1.png');
    expect(loadSpy).toHaveBeenCalledWith('./finale-4.png');

    expect(setRoboBouncyArtworkDragging(tile, true)).toBe(true);
    expect(base.renderable).toBe(true);
    expect(base.texture).toBe(dragTexture);
    expect(controller.sprite.renderable).toBe(false);

    tick(100);
    const elapsedDuringDrag = controller.elapsedMs;
    expect(elapsedDuringDrag).toBeGreaterThan(0);
    expect(setRoboBouncyArtworkDragging(tile, false)).toBe(true);
    expect(base.texture).toBe(originalTexture);
    expect(base.renderable).toBe(false);
    expect(controller.sprite.renderable).toBe(true);
    expect(controller.elapsedMs).toBe(elapsedDuringDrag);
  });
});
