import { buildBeachScene, createBeachSceneAssembly, buildHubScene, createHubSceneAssembly } from '../scene-builders';
import { buildBeachSceneIncrementally, buildHubSceneIncrementally } from '../scene-assembly';
import { resolveJourneyCardAsset } from '../../modules/journey-card-assets';
import type { JimiBoardSnapshot, JimiProgressSnapshot } from '../scene-catalog';
import type { SceneTransitionContext } from '../scene-director';

const context = () => {
  const controller = new AbortController();
  const current = jest.fn(() => !controller.signal.aborted);
  const value: SceneTransitionContext = { signal: controller.signal, isCurrent: current };
  return { controller, current, value };
};
function board(boardId: number, interim = false): JimiBoardSnapshot {
  const art = resolveJourneyCardAsset(boardId, 0);
  return Object.freeze({ unlocked: !interim, interim, stars: 2,
    card: Object.freeze({ src: art.path1x, src2x: art.path2x, name: 'Original reward', rarity: art.rarity }) });
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('cursor constructs exactly one Unit per call, in the same order, and completion is idempotent', () => {
  const assembly = createBeachSceneAssembly({});
  expect(assembly.root.querySelectorAll('img')).toHaveLength(0);
  expect(assembly.root.querySelectorAll('[data-jimi-unit]')).toHaveLength(1);
  for (let index = 0; index < 11; index++) {
    expect(assembly.appendNext()).toBe(index === 10);
    expect(assembly.root.querySelectorAll('[data-jimi-unit]')).toHaveLength(index + 2);
  }
  const html = assembly.root.outerHTML;
  expect(assembly.appendNext()).toBe(true);
  expect(assembly.root.outerHTML).toBe(html);
  expect([...assembly.root.querySelectorAll<HTMLElement>('[data-jimi-unit]')].map(node => node.dataset.jimiUnit))
    .toEqual(['header', 'beach-main', ...Array.from({ length: 10 }, (_, index) => `board-${index + 11}`)]);
});

test.each([false, true])('incremental result exactly matches immediate DOM, assets/actions and immutable progress (known=%s)', async known => {
  const progress: JimiProgressSnapshot = known ? Object.freeze({ 11: board(11), 12: board(12, true) }) : Object.freeze({});
  const snapshot = JSON.stringify(progress);
  const expected = buildBeachScene(progress).outerHTML;
  const f = context();
  const result = buildBeachSceneIncrementally(progress, f.value);
  expect(jest.getTimerCount()).toBe(1);
  for (let index = 0; index < 11; index++) {
    jest.advanceTimersToNextTimer();
    expect(jest.getTimerCount()).toBe(index === 10 ? 0 : 1);
  }
  const root = await result;
  expect(root.outerHTML).toBe(expected);
  expect(root.isConnected).toBe(false);
  expect(JSON.stringify(progress)).toBe(snapshot);
});

test('initial yield precedes every image assignment and abort before it creates no image nodes', async () => {
  const create = jest.spyOn(document, 'createElement');
  const f = context();
  const result = buildBeachSceneIncrementally({}, f.value);
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  expect(create.mock.calls.filter(([tag]) => tag === 'img')).toHaveLength(0);
  f.controller.abort();
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
  jest.runAllTimers();
  expect(create.mock.calls.filter(([tag]) => tag === 'img')).toHaveLength(0);
});

test('abort after a chunk cancels the only queued task and discards its partial detached root', async () => {
  const create = jest.spyOn(document, 'createElement');
  const f = context();
  const remove = jest.spyOn(f.controller.signal, 'removeEventListener');
  const result = buildBeachSceneIncrementally({}, f.value);
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  jest.advanceTimersToNextTimer();
  const root = create.mock.results[0].value as HTMLElement;
  const images = create.mock.calls.filter(([tag]) => tag === 'img').length;
  expect(images).toBe(8);
  f.controller.abort();
  await rejected;
  expect(root.childElementCount).toBe(0);
  expect(root.isConnected).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
  jest.runAllTimers();
  expect(create.mock.calls.filter(([tag]) => tag === 'img')).toHaveLength(images);
});

test('stale ownership without an abort rejects before another Unit is appended', async () => {
  const f = context();
  const result = buildBeachSceneIncrementally({}, f.value);
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  jest.advanceTimersToNextTimer();
  f.current.mockReturnValue(false);
  jest.advanceTimersToNextTimer();
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
});

test('already stale or aborted requests create neither DOM nor a timer', async () => {
  const create = jest.spyOn(document, 'createElement');
  const f = context();
  f.current.mockReturnValue(false);
  await expect(buildBeachSceneIncrementally({}, f.value)).rejects.toMatchObject({ name: 'AbortError' });
  f.current.mockReturnValue(true);
  f.controller.abort();
  await expect(buildBeachSceneIncrementally({}, f.value)).rejects.toMatchObject({ name: 'AbortError' });
  expect(create).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('construction errors reject and retire scheduled work instead of leaving a pending preparation', async () => {
  const f = context();
  const result = buildBeachSceneIncrementally({}, f.value);
  const failure = new Error('construction failed');
  const rejected = expect(result).rejects.toBe(failure);
  jest.spyOn(document, 'createElement').mockImplementationOnce(() => { throw failure; });
  jest.advanceTimersToNextTimer();
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
});

test('optional synchronous measurement wraps exactly eleven real chunks without an extra completion task', async () => {
  const f = context();
  const measure = jest.fn((_index: number, work: () => boolean) => work());
  const result = buildBeachSceneIncrementally({}, f.value, measure);
  jest.runAllTimers();
  await result;
  expect(measure.mock.calls.map(([index]) => index)).toEqual(Array.from({ length: 11 }, (_, index) => index));
  expect(measure.mock.results.map(result => result.value)).toEqual([...Array(10).fill(false), true]);
  expect(jest.getTimerCount()).toBe(0);
});

test('Hub cursor yields three complete canonical artwork Units and never constructs a World screen', () => {
  const assembly = createHubSceneAssembly({});
  expect(assembly.root.querySelectorAll('img')).toHaveLength(0);
  for (const [index, worldId] of [1, 3, 2].entries()) {
    expect(assembly.appendNext()).toBe(index === 2);
    const units = assembly.root.querySelectorAll<HTMLElement>('.jimi-hub-world');
    expect(units).toHaveLength(index + 1);
    expect(units[index].dataset.worldId).toBe(String(worldId));
    expect(units[index].querySelector('.jimi-hub-image')).not.toBeNull();
    expect(units[index].querySelector('.jimi-hub-flag')).not.toBeNull();
  }
  expect(assembly.root.querySelectorAll('img')).toHaveLength(19);
  expect(assembly.root.querySelectorAll('.jimi-beach-unit,.jimi-board-card')).toHaveLength(0);
  const html = assembly.root.outerHTML;
  expect(assembly.appendNext()).toBe(true);
  expect(assembly.root.outerHTML).toBe(html);
});

test.each([false, true])('incremental Hub has exact immediate DOM/progression parity with only three yielded tasks (known=%s)', async known => {
  const progress: JimiProgressSnapshot = known ? Object.freeze(Object.fromEntries(
    Array.from({ length: 30 }, (_, index) => [index + 1, board(index + 1, index % 4 === 0)]),
  )) : Object.freeze({});
  const expected = buildHubScene(progress).outerHTML;
  const snapshot = JSON.stringify(progress);
  const create = jest.spyOn(document, 'createElement');
  const f = context();
  const measure = jest.fn((_index: number, work: () => boolean) => work());
  const result = buildHubSceneIncrementally(progress, f.value, measure);
  expect(create.mock.calls.filter(([tag]) => tag === 'img')).toHaveLength(0);
  for (let index = 0; index < 3; index++) {
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersToNextTimer();
    expect(measure).toHaveBeenCalledTimes(index + 1);
  }
  expect(jest.getTimerCount()).toBe(0);
  expect(measure.mock.calls.map(([index]) => index)).toEqual([0, 1, 2]);
  expect(measure.mock.results.map(result => result.value)).toEqual([false, false, true]);
  const root = await result;
  expect(root.outerHTML).toBe(expected);
  expect(root.isConnected).toBe(false);
  expect(JSON.stringify(progress)).toBe(snapshot);
});

test.each(['abort', 'stale'] as const)('Hub %s before admission creates no DOM or scheduled work', async mode => {
  const create = jest.spyOn(document, 'createElement');
  const f = context();
  if (mode === 'abort') f.controller.abort();
  else f.current.mockReturnValue(false);
  await expect(buildHubSceneIncrementally({}, f.value)).rejects.toMatchObject({ name: 'AbortError' });
  expect(create).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test.each([
  ['abort', 0], ['abort', 1], ['abort', 2], ['stale', 0], ['stale', 1], ['stale', 2],
] as const)('Hub %s after %s chunks releases partial DOM and admits no later World', async (mode, chunks) => {
  const create = jest.spyOn(document, 'createElement');
  const f = context();
  const result = buildHubSceneIncrementally({}, f.value);
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  for (let index = 0; index < chunks; index++) jest.advanceTimersToNextTimer();
  const root = create.mock.results[0].value as HTMLElement;
  const images = create.mock.calls.filter(([tag]) => tag === 'img').length;
  if (mode === 'abort') f.controller.abort();
  else { f.current.mockReturnValue(false); jest.advanceTimersToNextTimer(); }
  await rejected;
  expect(root.childElementCount).toBe(0);
  expect(root.isConnected).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  jest.runAllTimers();
  expect(create.mock.calls.filter(([tag]) => tag === 'img')).toHaveLength(images);
});

test('Hub abort inside measured construction cannot publish or schedule a successor chunk', async () => {
  const f = context();
  const measure = jest.fn((_index: number, work: () => boolean) => {
    const complete = work();
    f.controller.abort();
    return complete;
  });
  const result = buildHubSceneIncrementally({}, f.value, measure);
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  jest.advanceTimersToNextTimer();
  await rejected;
  expect(measure).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
