/** @jest-environment jsdom */

import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { startThermalIsolation } from '../../utils/thermal-isolation';
import { STATE } from '../app-state';
import {
  releaseIdleSharedPixiSheets,
  acquireSharedPixiSheetResource,
  getSharedPixiSheetCacheStats,
  destroySharedPixiSheetFamily,
  getSharedPixiSheetRuntimeStats,
  resetSharedPixiSheetAnimationForTests,
  setSharedPixiSheetAnimationDragging,
  startSharedPixiSheetAnimation,
  stopSharedPixiSheetAnimation,
  type SharedPixiSheetSpec,
} from '../shared-pixi-sheet-animation';

const spec: SharedPixiSheetSpec = Object.freeze({
  family: 'test-shared-sheet',
  sheetUrl: './test-shared-sheet.webp',
  atlasWidth: 20,
  atlasHeight: 20,
  cellWidth: 10,
  cellHeight: 10,
  columns: 2,
  frameCount: 4,
  cycleMs: 400,
  anchorX: 5,
  anchorY: 5,
  evictionDelayMs: 1000,
  renderAboveHud: true,
});

function makeSheet(): Texture {
  return new Texture({
    source: new TextureSource({
      resource: { width: 20, height: 20 } as any,
      width: 20,
      height: 20,
    }),
  });
}

function makeTile() {
  const base = new Sprite(Texture.WHITE);
  const rotG = new Container();
  rotG.addChild(base);
  return {
    tile: { destroyed: false, eligible: true, base, rotG } as any,
    base,
    rotG,
  };
}

describe('shared Pixi sheet animation runtime', () => {
  let sheet: Texture;
  let callbacks: Set<(ticker: any) => void>;
  let ticker: any;
  let loadSpy: jest.SpiedFunction<typeof Assets.load>;
  let getSpy: jest.SpiedFunction<typeof Assets.get>;
  let unloadSpy: jest.SpiedFunction<typeof Assets.unload>;
  let stage: Container;

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
    stage = new Container();
    stage.sortableChildren = true;
    STATE.app = { ticker, stage } as any;
  });

  afterEach(() => {
    resetSharedPixiSheetAnimationForTests();
    STATE.app = null;
    loadSpy.mockRestore();
    getSpy.mockRestore();
    unloadSpy.mockRestore();
    try { sheet.destroy(true); } catch {}
    jest.useRealTimers();
  });

  const start = (tile: any, animateDuringDrag = false) => startSharedPixiSheetAnimation({
    tile,
    spec,
    isEligible: (candidate) => candidate?.eligible === true,
    propertyKey: '_ccTestSheet',
    animateDuringDrag,
  });

  test('OS pressure releases idle atlases below budget and preserves leased resources', async () => {
    const owner = acquireSharedPixiSheetResource(spec);
    await owner.load();
    await releaseIdleSharedPixiSheets();
    expect(unloadSpy).not.toHaveBeenCalled();
    expect(getSharedPixiSheetCacheStats().activeRefs).toBe(1);
    owner.release();
    await releaseIdleSharedPixiSheets();
    expect(unloadSpy).toHaveBeenCalledWith(spec.sheetUrl);
    expect(getSharedPixiSheetCacheStats()).toMatchObject({ retainedBytes: 0, idleBytes: 0 });
    expect(getSharedPixiSheetRuntimeStats(spec).evictionScheduled).toBe(false);
    await releaseIdleSharedPixiSheets();
    expect(unloadSpy).toHaveBeenCalledTimes(1);
    const next = acquireSharedPixiSheetResource(spec);
    await next.load();
    expect(getSharedPixiSheetRuntimeStats(spec).frames).toBe(4);
    next.release();
  });

  test('resource-only owners share residency, release once, and wait for unload before reacquiring', async () => {
    const first = acquireSharedPixiSheetResource(spec);
    const frames = await first.load();
    expect(getSharedPixiSheetCacheStats()).toMatchObject({ activeRefs: 1, retainedBytes: 1600, idleBytes: 0 });
    first.release();
    first.release();
    expect(getSharedPixiSheetCacheStats()).toMatchObject({ activeRefs: 0, idleBytes: 1600 });
    let finishUnload!: () => void;
    unloadSpy.mockImplementationOnce(() => new Promise<void>((resolve) => { finishUnload = resolve; }));
    jest.advanceTimersByTime(1000);
    expect(frames[0].destroyed).toBe(true);
    const second = acquireSharedPixiSheetResource(spec);
    const next = second.load();
    await flush();
    expect(loadSpy).toHaveBeenCalledTimes(1);
    finishUnload();
    await next;
    expect(loadSpy).toHaveBeenCalledTimes(2);
    expect(getSharedPixiSheetCacheStats()).toMatchObject({ activeRefs: 1, retainedBytes: 1600 });
    second.release();
    await expect(second.load()).rejects.toThrow('resource lease was released');
  });

  test.each(['tile', 'variant', 'base', 'host'])('releases an owner invalidated during loading: %s', async (invalidated) => {
    let resolveLoad!: (value: Texture) => void;
    loadSpy.mockImplementationOnce(() => new Promise((resolve) => { resolveLoad = resolve as any; }) as any);
    const { tile, base, rotG } = makeTile();
    const controller = start(tile) as any;
    if (invalidated === 'tile') tile.destroyed = true;
    if (invalidated === 'variant') tile.eligible = false;
    if (invalidated === 'base') base.destroy();
    if (invalidated === 'host') rotG.destroy();
    resolveLoad(sheet);
    await flush();
    expect(controller.disposed).toBe(true);
    expect(getSharedPixiSheetRuntimeStats(spec)).toMatchObject({ controllers: 0, tickerAttached: false });
    expect(ticker.add).not.toHaveBeenCalled();
    expect(getSharedPixiSheetRuntimeStats(spec)).toMatchObject({ refs: 0, evictionScheduled: true });
    jest.advanceTimersByTime(1000);
    await flush();
    expect(getSharedPixiSheetRuntimeStats(spec).decodedBytes).toBe(0);
  });

  test('shares one source while duplicate tiles keep separate clocks and one ticker', async () => {
    const first = makeTile();
    const second = makeTile();
    const firstController = start(first.tile) as any;
    const secondController = start(second.tile) as any;
    await flush();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(firstController.sprite.texture.source).toBe(secondController.sprite.texture.source);
    expect(firstController.sprite.parent?.label).toBe('ANIMATED_DICE_HUD_FOREGROUND');
    expect(firstController.sprite.parent?.zIndex).toBe(10_001);
    expect(firstController.running).toBe(true);
    expect(secondController.running).toBe(false);
    expect(ticker.add).toHaveBeenCalledTimes(1);

    ticker.elapsedMS = secondController.phaseLease.delayMs;
    callbacks.forEach((callback) => callback(ticker));
    jest.advanceTimersByTime(secondController.phaseLease.delayMs);
    ticker.elapsedMS = 110;
    callbacks.forEach((callback) => callback(ticker));
    expect(firstController.frameIndex).not.toBe(secondController.frameIndex);

    stopSharedPixiSheetAnimation(first.tile, '_ccTestSheet');
    stopSharedPixiSheetAnimation(second.tile, '_ccTestSheet');
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(stage.children.some((child) => child.label === 'ANIMATED_DICE_HUD_FOREGROUND')).toBe(false);
    expect(getSharedPixiSheetRuntimeStats(spec)).toMatchObject({ controllers: 0, refs: 0 });
    jest.advanceTimersByTime(1000);
    await flush();
    expect(unloadSpy).toHaveBeenCalledWith(spec.sheetUrl);
  });

  test('diagnostic suppression freezes only the sheet clock and resumes its existing owner', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    const { tile } = makeTile();
    const controller = start(tile, false) as any;
    await flush();
    const stop = startThermalIsolation({ enabled: true, group: 'sheets', fingerprint: () => 'same', suppress: () => () => {}, emit: () => {} });
    try {
      jest.advanceTimersByTime(30000);
      const elapsed = controller.elapsedMs;
      ticker.elapsedMS = 100;
      callbacks.forEach(callback => callback(ticker));
      expect(controller.elapsedMs).toBe(elapsed);
      expect(getSharedPixiSheetRuntimeStats(spec).controllers).toBe(1);
      stop?.();
      callbacks.forEach(callback => callback(ticker));
      expect(controller.elapsedMs).toBeGreaterThan(elapsed);
      expect(getSharedPixiSheetRuntimeStats(spec).controllers).toBe(1);
    } finally { stop?.(); }
  });

  test('keeps the fallback during drag and resumes the same controller clock', async () => {
    const { tile, base } = makeTile();
    const controller = start(tile, false) as any;
    await flush();
    ticker.elapsedMS = 100;
    callbacks.forEach((callback) => callback(ticker));
    const elapsedBeforeDrag = controller.elapsedMs;

    expect(setSharedPixiSheetAnimationDragging(tile, '_ccTestSheet', true)).toBe(true);
    expect(base.renderable).toBe(true);
    ticker.elapsedMS = 100;
    callbacks.forEach((callback) => callback(ticker));
    expect(controller.elapsedMs).toBeGreaterThan(elapsedBeforeDrag);

    setSharedPixiSheetAnimationDragging(tile, '_ccTestSheet', false);
    expect(base.renderable).toBe(false);
    expect(controller.sprite.renderable).toBe(true);
  });

  test('performs one bounded automatic retry and leaves no controller after a second failure', async () => {
    loadSpy.mockRejectedValue(new Error('decode failed'));
    const { tile, base } = makeTile();
    const controller = start(tile) as any;
    await flush();
    expect(controller.disposed).toBe(false);
    expect(base.renderable).toBe(true);

    jest.advanceTimersByTime(750);
    await flush();
    expect(controller.disposed).toBe(true);
    expect(tile._ccTestSheet).toBeUndefined();
    expect(getSharedPixiSheetRuntimeStats(spec).controllers).toBe(0);
  });

  test('cannot repopulate an evicted family from a superseded slow load', async () => {
    let resolveSlowLoad!: (texture: Texture) => void;
    const slowSheet = sheet;
    const freshSheet = makeSheet();
    const slowLoad = new Promise<Texture>((resolve) => { resolveSlowLoad = resolve; });
    loadSpy
      .mockReset()
      .mockImplementationOnce(() => slowLoad as any)
      .mockResolvedValueOnce(freshSheet as any);

    const first = makeTile();
    const firstController = start(first.tile) as any;
    await flush();
    stopSharedPixiSheetAnimation(first.tile, '_ccTestSheet');
    destroySharedPixiSheetFamily(spec);
    await flush();

    const second = makeTile();
    const secondController = start(second.tile) as any;
    await flush();
    expect(secondController.sprite.texture.source).toBe(freshSheet.source);

    resolveSlowLoad(slowSheet);
    await flush();
    expect(firstController.disposed).toBe(true);
    expect(secondController.sprite.texture.source).toBe(freshSheet.source);
    expect(getSharedPixiSheetRuntimeStats(spec)).toMatchObject({
      controllers: 1,
      ready: 1,
      refs: 1,
      frames: 4,
    });

    stopSharedPixiSheetAnimation(second.tile, '_ccTestSheet');
    try { freshSheet.destroy(true); } catch {}
  });

  test('enforces the idle budget immediately when an active family releases its last owner', async () => {
    const firstSpec: SharedPixiSheetSpec = {
      ...spec,
      family: 'large-family-one',
      sheetUrl: './large-family-one.webp',
      atlasWidth: 3000,
      atlasHeight: 3000,
      cellWidth: 3000,
      cellHeight: 3000,
      columns: 1,
      frameCount: 1,
    };
    const secondSpec: SharedPixiSheetSpec = {
      ...firstSpec,
      family: 'large-family-two',
      sheetUrl: './large-family-two.webp',
    };
    const firstSheet = new Texture({
      source: new TextureSource({
        resource: { width: 3000, height: 3000 } as any,
        width: 3000,
        height: 3000,
      }),
    });
    const secondSheet = new Texture({
      source: new TextureSource({
        resource: { width: 3000, height: 3000 } as any,
        width: 3000,
        height: 3000,
      }),
    });
    loadSpy.mockImplementation(async (source: any) => (
      source === firstSpec.sheetUrl ? firstSheet : secondSheet
    ) as any);

    const first = makeTile();
    const second = makeTile();
    startSharedPixiSheetAnimation({
      tile: first.tile,
      spec: firstSpec,
      isEligible: (candidate) => candidate?.eligible === true,
      propertyKey: '_ccLargeOne',
      animateDuringDrag: false,
    });
    startSharedPixiSheetAnimation({
      tile: second.tile,
      spec: secondSpec,
      isEligible: (candidate) => candidate?.eligible === true,
      propertyKey: '_ccLargeTwo',
      animateDuringDrag: false,
    });
    await flush();

    expect(getSharedPixiSheetRuntimeStats(firstSpec).decodedBytes).toBe(36_000_000);
    expect(getSharedPixiSheetRuntimeStats(secondSpec).decodedBytes).toBe(36_000_000);
    stopSharedPixiSheetAnimation(first.tile, '_ccLargeOne');
    await flush();

    expect(unloadSpy).toHaveBeenCalledWith(firstSpec.sheetUrl);
    expect(getSharedPixiSheetRuntimeStats(firstSpec).decodedBytes).toBe(0);
    expect(getSharedPixiSheetRuntimeStats(secondSpec).decodedBytes).toBe(36_000_000);

    stopSharedPixiSheetAnimation(second.tile, '_ccLargeTwo');
    try { firstSheet.destroy(true); } catch {}
    try { secondSheet.destroy(true); } catch {}
  });
});
