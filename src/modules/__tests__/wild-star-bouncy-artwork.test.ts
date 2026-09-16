/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { STATE } from '../app-state';
import {
  destroyWildStarBouncyArtworkRuntime,
  getWildStarBouncyDisplayGeometry,
  getWildStarBouncyRuntimeStats,
  isPlainWildStarBouncyTile,
  setWildStarBouncyArtworkDragging,
  startWildStarBouncyArtwork,
  stopWildStarBouncyArtwork,
  WILD_STAR_BOUNCY_CYCLE_MS,
  WILD_STAR_BOUNCY_DISPLAY_SIZE,
  WILD_STAR_BOUNCY_FRAME_COUNT,
  WILD_STAR_BOUNCY_SHEET_URL,
} from '../wild-star-bouncy-artwork';

function makeSheet(): Texture {
  return new Texture({
    source: new TextureSource({
      resource: { width: 4077, height: 735 } as any,
      width: 4077,
      height: 735,
    }),
  });
}

function makeTile() {
  const base = new Sprite(Texture.WHITE);
  base.width = 128;
  base.height = 128;
  const rotG = new Container();
  rotG.addChild(base);
  const orbitContainer = new Container();
  orbitContainer.renderable = true;
  rotG.addChild(orbitContainer);
  const tile: any = {
    special: 'wild',
    destroyed: false,
    base,
    rotG,
    _wildStarSystem: { disposed: false, container: orbitContainer, stars: [] },
  };
  return { tile, base, rotG, orbitContainer };
}

describe('Wild Star shared Pixi sheet artwork', () => {
  let sheet: Texture;
  let loadSpy: jest.SpiedFunction<typeof Assets.load>;
  let getSpy: jest.SpiedFunction<typeof Assets.get>;
  let unloadSpy: jest.SpiedFunction<typeof Assets.unload>;
  let callbacks: Set<(ticker: any) => void>;
  let ticker: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    sheet = makeSheet();
    getSpy = jest.spyOn(Assets, 'get').mockReturnValue(undefined as any);
    loadSpy = jest.spyOn(Assets, 'load').mockResolvedValue(sheet as any);
    unloadSpy = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);
    callbacks = new Set();
    ticker = {
      elapsedMS: 0,
      add: jest.fn((callback: (liveTicker: any) => void) => callbacks.add(callback)),
      remove: jest.fn((callback: (liveTicker: any) => void) => callbacks.delete(callback)),
    };
    STATE.app = { ticker } as any;
  });

  afterEach(() => {
    destroyWildStarBouncyArtworkRuntime();
    STATE.app = null;
    loadSpy.mockRestore();
    getSpy.mockRestore();
    unloadSpy.mockRestore();
    try { sheet.destroy(true); } catch {}
    jest.useRealTimers();
    document.body.replaceChildren();
  });

  const flush = async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  };

  const tick = (elapsedMS: number) => {
    ticker.elapsedMS = elapsedMS;
    Array.from(callbacks).forEach((callback) => callback(ticker));
  };

  test('keeps the accepted rest footprint and exact two-second 60fps source animation', () => {
    const geometry = getWildStarBouncyDisplayGeometry();
    expect(geometry).toMatchObject({
      width: 151,
      height: 147,
      restingArtworkWidth: WILD_STAR_BOUNCY_DISPLAY_SIZE,
      restingArtworkHeight: WILD_STAR_BOUNCY_DISPLAY_SIZE,
    });
    expect(geometry.anchorX).toBeCloseTo(75.5 / 151, 8);
    expect(geometry.anchorY).toBeCloseTo(86.39 / 147, 8);
    expect(WILD_STAR_BOUNCY_CYCLE_MS).toBe(2000);
    expect(WILD_STAR_BOUNCY_FRAME_COUNT).toBe(120);

    const svg = fs.readFileSync(path.resolve('assets/shop/star/star.svg'), 'utf8');
    expect(svg).toContain('viewBox="0 0 520 560"');
    expect(svg).toContain('dur="2s"');
    expect(svg.match(/<animate(?=\s)/g)).toHaveLength(28);
    expect(svg.match(/<animateTransform(?=\s)/g)).toHaveLength(34);
  });

  test('owns only the generic Wild Star', () => {
    expect(isPlainWildStarBouncyTile({ special: 'wild' })).toBe(true);
    expect(isPlainWildStarBouncyTile({ special: 'wild', _ccSpecialDiceVariant: 'bee' })).toBe(false);
    expect(isPlainWildStarBouncyTile({ special: 'wild-tnt' })).toBe(false);
  });

  test('shares one source, phases every copy, and leaves the Pixi orbit as sole owner', async () => {
    const first = makeTile();
    const second = makeTile();
    const firstController = startWildStarBouncyArtwork(first.tile)!;
    const secondController = startWildStarBouncyArtwork(second.tile)!;
    await flush();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith(WILD_STAR_BOUNCY_SHEET_URL);
    expect(firstController.sprite?.texture.source).toBe(secondController.sprite?.texture.source);
    expect(firstController.phaseLease?.phaseSlot).not.toBe(secondController.phaseLease?.phaseSlot);
    expect(first.orbitContainer.renderable).toBe(true);
    expect(second.orbitContainer.renderable).toBe(true);
    expect(document.querySelector('.wild-star-bouncy-artwork')).toBeNull();
    expect(firstController.sprite?.zIndex).toBeLessThan(first.base.zIndex);

    const delay = secondController.phaseLease?.delayMs ?? 0;
    tick(delay);
    jest.advanceTimersByTime(delay);
    tick(100);
    expect(firstController.elapsedMs).not.toBe(secondController.elapsedMs);
    expect(getWildStarBouncyRuntimeStats()).toMatchObject({
      controllers: 2,
      ready: 2,
      sourceTextures: 1,
      frames: 120,
      refs: 2,
      orbitBridged: 0,
      runtimeAttached: true,
      overlayAttached: false,
    });
  });

  test('stays animated through drag and restores the fallback on cleanup', async () => {
    const { tile, base, orbitContainer } = makeTile();
    const controller = startWildStarBouncyArtwork(tile)!;
    await flush();
    tick(240);
    const elapsedBeforeDrag = controller.elapsedMs;

    expect(base.renderable).toBe(false);
    expect(setWildStarBouncyArtworkDragging(tile, true)).toBe(true);
    expect(base.renderable).toBe(false);
    expect(controller.sprite?.renderable).toBe(true);
    tick(120);
    expect(controller.elapsedMs).toBeGreaterThan(elapsedBeforeDrag);
    expect(orbitContainer.renderable).toBe(true);

    expect(setWildStarBouncyArtworkDragging(tile, false)).toBe(true);
    expect(controller.sprite?.renderable).toBe(true);
    stopWildStarBouncyArtwork(tile);
    expect(base.renderable).toBe(true);
    expect(orbitContainer.renderable).toBe(true);
    expect(tile._ccWildStarBouncyArtwork).toBeUndefined();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
  });
});
