/** @jest-environment jsdom */

import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { STATE } from '../app-state';
import {
  BARREL_BOUNCY_ACTIVE_LOOPS,
  BARREL_BOUNCY_CYCLE_MS,
  BARREL_BOUNCY_FRAME_COUNT,
  BARREL_BOUNCY_REST_MS,
  BARREL_BOUNCY_SEQUENCE_MS,
  BARREL_BOUNCY_SHEET_URL,
  getBarrelBouncyFrameIndex,
  getBarrelBouncyDisplayGeometry,
  getBarrelBouncyRuntimeStats,
  isBarrelBouncyResting,
  preloadBarrelBouncyArtwork,
  resetBarrelBouncyArtworkCacheForTests,
  startBarrelBouncyArtwork,
  stopBarrelBouncyArtwork,
} from '../barrel-bouncy-artwork';

function makeSheetTexture(): Texture {
  const source = new TextureSource({
    resource: { width: 2430, height: 2106 } as any,
    width: 2430,
    height: 2106,
  });
  return new Texture({ source });
}

function makeTile() {
  const base = new Sprite(Texture.WHITE);
  const geometry = getBarrelBouncyDisplayGeometry();
  base.anchor.set(geometry.anchorX, geometry.anchorY);
  base.width = geometry.width;
  base.height = geometry.height;
  const rotG = new Container();
  rotG.addChild(base);
  return {
    tile: {
      special: 'wild-tnt',
      _ccSpecialDiceVariant: 'barell',
      destroyed: false,
      base,
      rotG,
    } as any,
    base,
    rotG,
  };
}

describe('Barrel shared Pixi artwork', () => {
  let sheet: Texture;
  let loadSpy: jest.SpiedFunction<typeof Assets.load>;
  let getSpy: jest.SpiedFunction<typeof Assets.get>;
  let unloadSpy: jest.SpiedFunction<typeof Assets.unload>;
  let tickerCallbacks: Set<(ticker: any) => void>;
  let ticker: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    resetBarrelBouncyArtworkCacheForTests();
    sheet = makeSheetTexture();
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
    resetBarrelBouncyArtworkCacheForTests();
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

  test('maps two active loops to all 54 frames and holds frame zero for the one-second rest', () => {
    expect(BARREL_BOUNCY_ACTIVE_LOOPS).toBe(2);
    expect(BARREL_BOUNCY_REST_MS).toBe(1000);
    expect(getBarrelBouncyFrameIndex(0)).toBe(0);
    expect(getBarrelBouncyFrameIndex(BARREL_BOUNCY_CYCLE_MS - 0.001)).toBe(BARREL_BOUNCY_FRAME_COUNT - 1);
    expect(getBarrelBouncyFrameIndex(BARREL_BOUNCY_CYCLE_MS)).toBe(0);
    expect(getBarrelBouncyFrameIndex(BARREL_BOUNCY_CYCLE_MS * 2 - 0.001)).toBe(BARREL_BOUNCY_FRAME_COUNT - 1);
    expect(isBarrelBouncyResting(BARREL_BOUNCY_CYCLE_MS * 2)).toBe(true);
    expect(getBarrelBouncyFrameIndex(BARREL_BOUNCY_CYCLE_MS * 2 + 500)).toBe(0);
    expect(isBarrelBouncyResting(BARREL_BOUNCY_SEQUENCE_MS - 0.001)).toBe(true);
    expect(isBarrelBouncyResting(BARREL_BOUNCY_SEQUENCE_MS)).toBe(false);
  });

  test('loads one sheet, gives every Barrel an independent sprite clock, and cleans up the shared ticker', async () => {
    await preloadBarrelBouncyArtwork();
    const first = makeTile();
    const second = makeTile();
    const firstController = startBarrelBouncyArtwork(first.tile) as any;
    const secondController = startBarrelBouncyArtwork(second.tile) as any;
    await flushPromises();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith(BARREL_BOUNCY_SHEET_URL);
    expect(firstController.ready).toBe(true);
    expect(firstController.running).toBe(true);
    expect(secondController.ready).toBe(true);
    expect(secondController.running).toBe(false);
    expect(first.base.renderable).toBe(false);
    expect(second.base.renderable).toBe(true);
    expect(firstController.sprite).not.toBe(secondController.sprite);
    expect(firstController.sprite.texture.source).toBe(secondController.sprite.texture.source);
    expect(ticker.add).toHaveBeenCalledTimes(1);

    tick(secondController.phaseLease.delayMs);
    jest.advanceTimersByTime(secondController.phaseLease.delayMs);
    expect(secondController.running).toBe(true);
    expect(second.base.renderable).toBe(false);

    tick(100);
    tick(100);
    expect(firstController.elapsedMs).toBeCloseTo(200 + secondController.phaseLease.delayMs);
    expect(secondController.elapsedMs).toBeCloseTo(200);
    expect(firstController.frameIndex).not.toBe(secondController.frameIndex);
    expect(firstController.frameIndex).toBeGreaterThan(0);

    firstController.elapsedMs = BARREL_BOUNCY_CYCLE_MS * 2 - 10;
    tick(20);
    expect(firstController.resting).toBe(true);
    expect(firstController.frameIndex).toBe(0);

    stopBarrelBouncyArtwork(first.tile);
    expect(first.base.renderable).toBe(true);
    expect(first.rotG.getChildByLabel('barrel-bouncy-pixi')).toBeNull();
    expect(getBarrelBouncyRuntimeStats()).toMatchObject({ controllers: 1, sharedFrames: 54 });

    stopBarrelBouncyArtwork(second.tile);
    expect(second.base.renderable).toBe(true);
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(getBarrelBouncyRuntimeStats()).toEqual({
      controllers: 0,
      ready: 0,
      running: 0,
      resting: 0,
      sharedFrames: 54,
      sharedSheetReady: true,
      runtimeAttached: false,
    });
  });

  test('keeps the static fallback when a tile is disposed before the shared sheet finishes loading', async () => {
    let resolveLoad: ((texture: Texture) => void) | null = null;
    loadSpy.mockImplementation(() => new Promise((resolve) => { resolveLoad = resolve as any; }) as any);
    const { tile, base, rotG } = makeTile();
    startBarrelBouncyArtwork(tile);
    expect(base.renderable).toBe(true);

    stopBarrelBouncyArtwork(tile);
    resolveLoad?.(sheet);
    await flushPromises();

    expect(base.renderable).toBe(true);
    expect(rotG.getChildByLabel('barrel-bouncy-pixi')).toBeNull();
    expect(getBarrelBouncyRuntimeStats().controllers).toBe(0);
  });

  test('automatically retries one failed cold load without waiting for another tile event', async () => {
    loadSpy
      .mockRejectedValueOnce(new Error('cold load failed'))
      .mockRejectedValueOnce(new Error('reload failed'))
      .mockResolvedValueOnce(sheet as any);
    const { tile, base, rotG } = makeTile();

    const failedController = startBarrelBouncyArtwork(tile) as any;
    await flushPromises();
    expect(failedController.disposed).toBe(false);
    expect(base.renderable).toBe(true);
    expect(tile._ccBarrelBouncyArtwork).toBe(failedController);
    expect(getBarrelBouncyRuntimeStats().controllers).toBe(1);

    jest.advanceTimersByTime(750);
    await flushPromises();
    expect(failedController.ready).toBe(true);
    expect(failedController.running).toBe(true);
    expect(base.renderable).toBe(false);
    expect(rotG.getChildByLabel('barrel-bouncy-pixi')).toBeTruthy();
    expect(loadSpy).toHaveBeenCalledTimes(3);
  });
});
