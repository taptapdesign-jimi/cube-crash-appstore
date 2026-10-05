import { prepareSceneImages, invalidateSceneImageReadiness } from '../scene-resources';

const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
function fixture(count = 5) {
  const root = document.createElement('section');
  const controller = new AbortController();
  const context = { signal: controller.signal, isCurrent: jest.fn(() => true) };
  const pending: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  let active = 0; let maxActive = 0;
  const images = Array.from({ length: count }, (_, index) => {
    const image = document.createElement('img'); image.src = `./image-${index}.png`;
    Object.defineProperties(image, { complete: { get: () => true }, naturalWidth: { get: () => 32 } });
    image.decode = jest.fn(() => new Promise<void>((resolve, reject) => {
      active += 1; maxActive = Math.max(maxActive, active);
      pending.push({ resolve: () => { active -= 1; resolve(); }, reject: error => { active -= 1; reject(error); } });
    }));
    root.append(image); return image;
  });
  return { root, controller, context, images, pending, maxActive: () => maxActive };
}

afterEach(() => { jest.useRealTimers(); });

test('decodes actual nodes at most two at once, includes hidden Home panels and skips all warm traversal', async () => {
  const f = fixture(); f.images[4].hidden = true;
  const run = prepareSceneImages(f.root, f.context); await flush();
  expect(f.pending).toHaveLength(2);
  for (let index = 0; index < 5; index++) { f.pending[index].resolve(); await flush(); }
  await run; expect(f.maxActive()).toBe(2);
  expect(f.images[4].decode).toHaveBeenCalledTimes(1);
  const query = jest.spyOn(f.root, 'querySelectorAll'); await prepareSceneImages(f.root, f.context);
  expect(query).not.toHaveBeenCalled();
});

test('abort stops admission immediately and cancelled native decodes retain their two slots during retry', async () => {
  const f = fixture(); const first = prepareSceneImages(f.root, f.context);
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' }); await flush();
  f.controller.abort(); await rejected; expect(f.pending).toHaveLength(2);
  const next = new AbortController(); const retry = prepareSceneImages(f.root, { signal: next.signal, isCurrent: () => true }); await flush();
  expect(f.pending).toHaveLength(2);
  f.pending[0].resolve(); f.pending[1].resolve(); await flush();
  for (let index = 2; index < 7; index++) { f.pending[index].resolve(); await flush(); }
  await retry; expect(f.maxActive()).toBe(2);
});

test('decode error rejects, never memoizes success and permits retry', async () => {
  const f = fixture(1); const failed = prepareSceneImages(f.root, f.context); const rejection = expect(failed).rejects.toThrow('decode failed');
  await flush(); f.pending[0].reject(new Error('decode failed')); await rejection;
  const retry = prepareSceneImages(f.root, f.context); await flush(); expect(f.pending).toHaveLength(2);
  f.pending[1].resolve(); await retry;
});

test('timeout retires the waiter and timer but does not claim success or start queued images', async () => {
  jest.useFakeTimers(); const f = fixture(); const run = prepareSceneImages(f.root, f.context);
  const rejection = expect(run).rejects.toThrow('timed out'); await flush();
  jest.advanceTimersByTime(8000); await rejection;
  expect(f.pending).toHaveLength(2); expect(jest.getTimerCount()).toBe(0);
  f.pending.forEach(job => job.resolve()); await flush(); expect(f.pending).toHaveLength(2);
});

test('stale ownership and explicit invalidation cannot produce a warm receipt', async () => {
  const f = fixture(1); const run = prepareSceneImages(f.root, f.context); const rejection = expect(run).rejects.toMatchObject({ name: 'AbortError' });
  await flush(); invalidateSceneImageReadiness(f.root); f.pending[0].resolve(); await rejection;
  const retry = prepareSceneImages(f.root, f.context); await flush(); f.pending[1].resolve(); await retry;
  invalidateSceneImageReadiness(f.root);
  const third = prepareSceneImages(f.root, f.context); await flush(); f.pending[2].resolve(); await third;
  f.context.isCurrent.mockReturnValue(false); await expect(prepareSceneImages(f.root, f.context)).rejects.toMatchObject({ name: 'AbortError' });
});

test('without decode, load/error readiness is real and listeners are removed on cancellation', async () => {
  const f = fixture(1); (f.images[0] as any).decode = undefined;
  const root = document.createElement('section'); const image = document.createElement('img'); image.src = './waiting.png'; root.append(image);
  Object.defineProperties(image, { complete: { get: () => false }, naturalWidth: { get: () => 0 } });
  const remove = jest.spyOn(image, 'removeEventListener'); const run = prepareSceneImages(root, f.context);
  const rejection = expect(run).rejects.toMatchObject({ name: 'AbortError' }); await flush(); f.controller.abort(); await rejection;
  expect(remove.mock.calls.map(([event]) => event)).toEqual(expect.arrayContaining(['load', 'error']));
});
