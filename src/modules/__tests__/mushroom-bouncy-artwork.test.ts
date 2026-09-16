/** @jest-environment jsdom */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { STATE } from '../app-state';
import animationManager from '../animation-manager';
import {
  destroyMushroomBouncyArtworkRuntime,
  getMushroomBouncyDisplayGeometry,
  getMushroomBouncyRuntimeStats,
  isMushroomBouncyTile,
  MUSHROOM_BOUNCY_CYCLE_MS,
  MUSHROOM_BOUNCY_FRAME_COUNT,
  MUSHROOM_BOUNCY_SHEET_SPEC,
  MUSHROOM_BOUNCY_SHEET_URL,
  startMushroomBouncyArtwork,
  stopMushroomBouncyArtwork,
} from '../mushroom-bouncy-artwork';
import { resetSharedPixiSheetAnimationForTests } from '../shared-pixi-sheet-animation';
import {
  setSpecialDiceIdleDragging,
  startSpecialDiceIdleMotion,
  stopSpecialDiceIdleMotion,
} from '../special-dice-idle';

function makeSheet(): Texture {
  return new Texture({
    source: new TextureSource({
      resource: { width: 3990, height: 608 } as any,
      width: 3990,
      height: 608,
    }),
  });
}

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
    rotG,
  };
}

describe('Mushroom shared Pixi sheet artwork', () => {
  let sheet: Texture;
  let callbacks: Set<(ticker: any) => void>;
  let ticker: any;
  let loadSpy: jest.SpiedFunction<typeof Assets.load>;
  let getSpy: jest.SpiedFunction<typeof Assets.get>;
  let unloadSpy: jest.SpiedFunction<typeof Assets.unload>;

  const flush = async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    resetSharedPixiSheetAnimationForTests();
    sheet = makeSheet();
    getSpy = jest.spyOn(Assets, 'get').mockReturnValue(undefined as any);
    loadSpy = jest.spyOn(Assets, 'load').mockResolvedValue(sheet as any);
    unloadSpy = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);
    callbacks = new Set();
    ticker = {
      elapsedMS: 0,
      add: jest.fn((callback: (value: any) => void) => callbacks.add(callback)),
      remove: jest.fn((callback: (value: any) => void) => callbacks.delete(callback)),
    };
    STATE.app = { ticker } as any;
  });

  afterEach(() => {
    destroyMushroomBouncyArtworkRuntime();
    resetSharedPixiSheetAnimationForTests();
    STATE.app = null;
    loadSpy.mockRestore();
    getSpy.mockRestore();
    unloadSpy.mockRestore();
    try { sheet.destroy(true); } catch {}
    jest.useRealTimers();
  });

  const tick = (elapsedMS: number) => {
    ticker.elapsedMS = elapsedMS;
    callbacks.forEach((callback) => callback(ticker));
  };

  test('keeps the exact cropped geometry, two-second cadence, and generated atlas identity', () => {
    expect(getMushroomBouncyDisplayGeometry()).toEqual({
      width: 133,
      height: 152,
      anchorX: 69 / 133,
      anchorY: 86 / 152,
      restingArtworkWidth: 128,
      restingArtworkHeight: 128,
    });
    expect(MUSHROOM_BOUNCY_CYCLE_MS).toBe(2000);
    expect(MUSHROOM_BOUNCY_FRAME_COUNT).toBe(120);
    expect(MUSHROOM_BOUNCY_SHEET_SPEC).toMatchObject({
      atlasWidth: 3990,
      atlasHeight: 608,
      cellWidth: 133,
      cellHeight: 152,
      columns: 30,
      anchorX: 69,
      anchorY: 86,
    });
    const bytes = fs.readFileSync(path.resolve(process.cwd(), MUSHROOM_BOUNCY_SHEET_URL));
    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe('aa3b28a01a61f9cad00fbb440607d4fa4c89969882643dbd8ad889847d371546');
  });

  test('owns only the exact Mushroom registry variant', () => {
    expect(isMushroomBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'mushroom' })).toBe(true);
    expect(isMushroomBouncyTile({ special: 'wild-juice' })).toBe(false);
    expect(isMushroomBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'robo-cube' })).toBe(false);
  });

  test('shares one source, keeps independent clocks, and removes every owner', async () => {
    const first = makeTile();
    const second = makeTile();
    const firstController = startMushroomBouncyArtwork(first.tile) as any;
    const secondController = startMushroomBouncyArtwork(second.tile) as any;
    await flush();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith(MUSHROOM_BOUNCY_SHEET_URL);
    expect(firstController.sprite.texture.source).toBe(secondController.sprite.texture.source);
    expect(firstController.running).toBe(true);
    expect(secondController.running).toBe(false);
    expect(first.base.renderable).toBe(false);
    expect(second.base.renderable).toBe(true);
    expect(ticker.add).toHaveBeenCalledTimes(1);

    tick(secondController.phaseLease.delayMs);
    jest.advanceTimersByTime(secondController.phaseLease.delayMs);
    tick(100);
    expect(secondController.running).toBe(true);
    expect(firstController.frameIndex).not.toBe(secondController.frameIndex);

    stopMushroomBouncyArtwork(first.tile);
    stopMushroomBouncyArtwork(second.tile);
    expect(first.base.renderable).toBe(true);
    expect(second.base.renderable).toBe(true);
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(getMushroomBouncyRuntimeStats()).toMatchObject({ controllers: 0, refs: 0 });
  });

  test('keeps static drag fallback and Mushroom smoke pause/resume lifecycle', async () => {
    const baseline = animationManager.getStats().activeTimelines;
    const { tile, base } = makeTile();
    startSpecialDiceIdleMotion(tile);
    await flush();
    const controller = tile._ccMushroomBouncyArtwork as any;

    expect(controller.sprite).toBeTruthy();
    expect(base.renderable).toBe(false);
    expect(tile._ccMushroomSmokeTimeline).toBeTruthy();
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);

    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    expect(controller.sprite.renderable).toBe(false);
    expect(base.renderable).toBe(true);
    expect(tile._ccMushroomSmokeContainer.visible).toBe(false);
    expect(tile._ccMushroomSmokeTimeline.paused()).toBe(true);

    expect(setSpecialDiceIdleDragging(tile, false)).toBe(true);
    expect(controller.sprite.renderable).toBe(true);
    expect(base.renderable).toBe(false);
    expect(tile._ccMushroomSmokeContainer.visible).toBe(true);
    expect(tile._ccMushroomSmokeTimeline.paused()).toBe(false);

    stopSpecialDiceIdleMotion(tile);
    expect(base.renderable).toBe(true);
    expect(tile._ccMushroomSmokeTimeline).toBeUndefined();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });
});
