import { Assets } from 'pixi.js';
import {
  StaleVisualAssetGenerationError,
  VisualAssetBroker,
} from '../visual-asset-broker';

function makeTexture(label: string): any {
  return {
    label,
    destroyed: false,
    width: 128,
    height: 171,
    source: {
      destroyed: false,
      valid: true,
      width: 128,
      height: 171,
      resource: { width: 128, height: 171 },
      autoGarbageCollect: true,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('VisualAssetBroker renderer generations', () => {
  test('coalesces one texture acquisition within the current generation', async () => {
    const texture = makeTexture('initial');
    const load = jest.spyOn(Assets, 'load').mockResolvedValue(texture);
    const broker = new VisualAssetBroker();

    const first = broker.acquireTexture('./asset.png');
    const second = broker.acquireTexture('./asset.png');

    expect(second).toBe(first);
    const handle = await first;
    expect(handle).toEqual({
      assetPath: './asset.png',
      rendererGeneration: 0,
      texture,
    });
    expect(broker.isHandleCurrent(handle)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(texture.source.autoGarbageCollect).toBe(false);
  });

  test('rejects an old in-flight result and serializes one forced reload for the new generation', async () => {
    const stale = makeTexture('stale');
    const fresh = makeTexture('fresh');
    const pending = deferred<any>();
    const load = jest.spyOn(Assets, 'load')
      .mockImplementationOnce(() => pending.promise as any)
      .mockResolvedValueOnce(fresh);
    const unload = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);
    const broker = new VisualAssetBroker();

    const oldBorrow = broker.acquireTexture('./asset.png');
    const oldRejection = expect(oldBorrow).rejects.toBeInstanceOf(StaleVisualAssetGenerationError);
    expect(broker.invalidateRendererGeneration('webglcontextlost')).toBe(1);
    const firstNewBorrow = broker.acquireTexture('./asset.png');
    const secondNewBorrow = broker.acquireTexture('./asset.png');
    expect(secondNewBorrow).toBe(firstNewBorrow);

    pending.resolve(stale);
    await oldRejection;
    const handle = await firstNewBorrow;

    expect(unload).toHaveBeenCalledTimes(1);
    expect(unload).toHaveBeenCalledWith('./asset.png');
    expect(load).toHaveBeenCalledTimes(2);
    expect(handle.rendererGeneration).toBe(1);
    expect(handle.texture).toBe(fresh);
    expect(broker.isHandleCurrent(handle)).toBe(true);
  });

  test('reloads an untracked dormant path on first use after context loss', async () => {
    const fresh = makeTexture('fresh');
    const load = jest.spyOn(Assets, 'load').mockResolvedValue(fresh);
    const unload = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);
    const broker = new VisualAssetBroker();

    broker.invalidateRendererGeneration('webglcontextlost');
    const handle = await broker.acquireTexture('./dormant-special.png');

    expect(unload).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(handle.rendererGeneration).toBe(1);
  });
});
