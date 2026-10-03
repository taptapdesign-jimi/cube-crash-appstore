import { Assets, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';
import { applyWildSkinLocalCore } from '../app-core-wild-skin';
import { KANTA_IDLE_FRAME_SOURCE } from '../kanta-dice-idle';
import {
  invalidateVisualAssetRendererGeneration,
  visualAssetBroker,
  type VisualAssetTextureHandle,
} from '../../utils/visual-asset-broker';

function makeTexture(label: string): Texture {
  const texture = new Texture({
    source: new TextureSource({
      resource: { width: 128, height: 128 },
      width: 128,
      height: 128,
    }),
  });
  texture.label = label;
  return texture;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

function fixture(baseTexture = makeTexture('holder')) {
  const base = new Sprite(baseTexture);
  base.anchor.set(0.5);
  base.width = 128;
  base.height = 128;
  const tile: any = {
    base,
    special: 'wild',
    _ccSpecialDiceVariant: 'kanta',
    destroyed: false,
    _ccDeferWildIdleFx: true,
  };
  const noOp = () => {};
  const deps = {
    Assets: { get: () => null },
    Texture,
    Rectangle,
    ASSET_WILD: 'wild',
    ASSET_WILD_MAGNET: 'magnet',
    ASSET_WILD_JUICE: 'juice',
    ASSET_WILD_TNT: 'tnt',
    TILE: 128,
    startWildShimmer: noOp,
    startWildJuiceBubbles: noOp,
    startWildStars: noOp,
    startMagnetIdleParticles: noOp,
    startTntIdleParticles: noOp,
    startTntIdleShake: noOp,
    stopTntIdleParticles: noOp,
    stopTntIdleShake: noOp,
    trackAppAnimationFrame: noOp,
    devWarn: jest.fn(),
  };
  return { tile, base, baseTexture, deps };
}

beforeEach(() => {
  visualAssetBroker.resetForTests();
});

afterEach(() => {
  visualAssetBroker.resetForTests();
  jest.restoreAllMocks();
});

test('canonical Special base face reloads before painting in a new renderer generation', async () => {
  const staleTexture = makeTexture('stale-magnet');
  const freshTexture = makeTexture('fresh-magnet');
  const load = jest.spyOn(Assets, 'load')
    .mockResolvedValueOnce(staleTexture)
    .mockResolvedValueOnce(freshTexture);
  const unload = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);
  const h = fixture();

  applyWildSkinLocalCore(h.tile, h.deps);
  await flushPromises();
  expect(h.base.texture).toBe(staleTexture);

  invalidateVisualAssetRendererGeneration('webglcontextlost');
  applyWildSkinLocalCore(h.tile, h.deps);
  await flushPromises();

  expect(unload).toHaveBeenCalledTimes(1);
  expect(unload).toHaveBeenCalledWith(KANTA_IDLE_FRAME_SOURCE);
  expect(load).toHaveBeenCalledTimes(2);
  expect(h.base.texture).toBe(freshTexture);
});

test('canonical owner does not paint a handle rejected by the current-generation check', async () => {
  const pending = deferred<VisualAssetTextureHandle>();
  const rejectedTexture = makeTexture('retired-generation');
  const h = fixture();
  let current = true;
  const deps = {
    ...h.deps,
    acquireVisualAssetTexture: () => pending.promise,
    getVisualAssetRendererGeneration: () => 4,
    isVisualAssetTextureHandleCurrent: () => current,
    reloadPixiImageTexture: jest.fn(),
  };

  applyWildSkinLocalCore(h.tile, deps);
  current = false;
  pending.resolve({
    assetPath: KANTA_IDLE_FRAME_SOURCE,
    rendererGeneration: 4,
    texture: rejectedTexture,
  });
  await flushPromises();

  expect(h.base.texture).toBe(h.baseTexture);
  expect(deps.reloadPixiImageTexture).not.toHaveBeenCalled();
});

test('decode failure preserves the one-shot reload fallback but repaints only through a broker handle', async () => {
  const freshTexture = makeTexture('retry-magnet');
  const h = fixture();
  const acquire = jest.fn()
    .mockRejectedValueOnce(new Error('cached decode unavailable'))
    .mockResolvedValueOnce({
      assetPath: KANTA_IDLE_FRAME_SOURCE,
      rendererGeneration: 2,
      texture: freshTexture,
    });
  const reload = jest.fn().mockResolvedValue(freshTexture);
  const deps = {
    ...h.deps,
    acquireVisualAssetTexture: acquire,
    getVisualAssetRendererGeneration: () => 2,
    isVisualAssetTextureHandleCurrent: () => true,
    reloadPixiImageTexture: reload,
  };

  applyWildSkinLocalCore(h.tile, deps);
  await flushPromises();

  expect(reload).toHaveBeenCalledTimes(1);
  expect(reload).toHaveBeenCalledWith(KANTA_IDLE_FRAME_SOURCE);
  expect(acquire).toHaveBeenCalledTimes(2);
  expect(h.base.texture).toBe(freshTexture);
});
