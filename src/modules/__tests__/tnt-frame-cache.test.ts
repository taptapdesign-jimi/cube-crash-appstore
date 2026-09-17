import { TntFrameCache, isOwnedTntFrameSource } from '../tnt-frame-cache';

const source = './assets/shop/bush/bush1@2x.png';
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('TNT frame cache session ownership', () => {
  test('deduplicates warmup until exit, releases references before unload and reloads on reentry', async () => {
    const order: string[] = [];
    const unload = jest.fn(async () => { order.push('unload'); });
    const cache = new TntFrameCache(unload);
    const load = jest.fn(async () => { cache.remember(source); });
    await Promise.all([cache.request('flower', load), cache.request('flower', load)]);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.retire(() => true, () => { order.push('detach'); });
    expect(order).toEqual(['detach', 'unload']);
    expect(unload).toHaveBeenCalledWith(source);
    await cache.request('flower', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('never unloads an active finale', async () => {
    const unload = jest.fn(async () => {});
    const cache = new TntFrameCache(unload);
    await cache.request('flower', async () => { cache.remember(source); });
    const detach = jest.fn();
    await cache.retire(() => false, detach);
    expect(unload).not.toHaveBeenCalled();
    expect(detach).not.toHaveBeenCalled();
    await cache.retire(() => true, detach);
    expect(unload).toHaveBeenCalledTimes(1);
  });

  test('waits for a late load at exit before releasing its texture', async () => {
    const pending = deferred();
    const unload = jest.fn(async () => {});
    const cache = new TntFrameCache(unload);
    const load = cache.request('flower', async () => {
      await pending.promise;
      cache.remember(source);
    });
    const exit = cache.retire(() => true, () => {});
    await Promise.resolve();
    expect(unload).not.toHaveBeenCalled();
    pending.resolve();
    await Promise.all([load, exit]);
    expect(unload).toHaveBeenCalledWith(source);
  });

  test('rapid reentry cancels retirement before unload without redundant decode', async () => {
    const pending = deferred();
    const unload = jest.fn(async () => {});
    const cache = new TntFrameCache(unload);
    const load = jest.fn(async () => { await pending.promise; cache.remember(source); });
    const first = cache.request('flower', load);
    const exit = cache.retire(() => true, () => {});
    const reentry = cache.request('flower', load);
    pending.resolve();
    await Promise.all([first, exit, reentry]);
    expect(unload).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });

  test('reentry during unload waits for it and then loads fresh frames', async () => {
    const unloading = deferred();
    const started = deferred();
    const cache = new TntFrameCache(async () => { started.resolve(); await unloading.promise; });
    const load = jest.fn(async () => { cache.remember(source); });
    await cache.request('flower', load);
    const exit = cache.retire(() => true, () => {});
    await started.promise;
    const reentry = cache.request('flower', load);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    unloading.resolve();
    await Promise.all([exit, reentry]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('failed loads are retryable and partial successful resources are retired', async () => {
    const unload = jest.fn(async () => {});
    const cache = new TntFrameCache(unload);
    await expect(cache.request('flower', async () => {
      cache.remember(source);
      throw new Error('decode');
    })).rejects.toThrow('decode');
    await cache.retire(() => true, () => {});
    expect(unload).toHaveBeenCalledWith(source);
    const retry = jest.fn(async () => {});
    await cache.request('flower', retry);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('failed unload remains tracked for a later exit', async () => {
    const unload = jest.fn<Promise<void>, [string]>()
      .mockRejectedValueOnce(new Error('busy')).mockResolvedValue(undefined);
    const cache = new TntFrameCache(unload);
    await cache.request('flower', async () => { cache.remember(source); });
    await cache.retire(() => true, () => {});
    await cache.retire(() => true, () => {});
    expect(unload).toHaveBeenCalledTimes(2);
  });

  test('only owns smoke and flower burst textures, never shared tiles or idle art', async () => {
    const unload = jest.fn(async () => {});
    const cache = new TntFrameCache(unload);
    for (const other of ['./assets/tile.png', './assets/shop/bush/flower.png',
      './assets/shop/bush/flower@2x.png', './assets/shop/wood/wood1.png']) {
      expect(isOwnedTntFrameSource(other)).toBe(false);
      cache.remember(other);
    }
    cache.remember(source);
    cache.remember('./assets/shop/explosion pack/animation/tnt12@2x.png');
    await cache.retire(() => true, () => {});
    expect(unload).toHaveBeenCalledTimes(2);
  });
});
