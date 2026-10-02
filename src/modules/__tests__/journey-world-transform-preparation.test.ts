import { gsap } from 'gsap';
import { prepareJourneyWorldTransforms } from '../journey-world-transform-preparation';

afterEach(() => {
  jest.restoreAllMocks();
  gsap.globalTimeline.clear();
  document.body.replaceChildren();
});

function fixture(count = 20) {
  const targets = Array.from({ length: count }, () => document.createElement('div'));
  document.body.append(...targets);
  let current = true;
  let now = 0;
  const events: string[] = [];
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  // Select the direct two-argument overload, not GSAP's curried getter.
  const read = jest.spyOn(gsap, 'getProperty') as unknown as jest.SpyInstance<number, [HTMLElement, string]>;
  read.mockImplementation(() => {
    events.push('read');
    return 0;
  });
  const waitForTurn = jest.fn(async () => { events.push('turn'); return current; });
  const writePose = jest.fn(() => { events.push('write'); });
  const chunkDurationsMs: number[] = [];
  return {
    targets, events, read, waitForTurn, writePose, chunkDurationsMs,
    isCurrent: () => current,
    cancel: () => { current = false; },
    spend: (ms: number) => { now += ms; },
  };
}

test('every bounded batch reads all transform caches before any pose write', async () => {
  const f = fixture();
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(true);
  expect(f.events).toEqual([
    'turn', ...Array(8).fill('read'), ...Array(8).fill('write'),
    'turn', ...Array(8).fill('read'), ...Array(8).fill('write'),
    'turn', ...Array(4).fill('read'), ...Array(4).fill('write'),
  ]);
  expect(f.read.mock.calls.map(([target]) => target)).toEqual(f.targets);
  expect(f.writePose.mock.calls).toHaveLength(20);
});

test('an indivisible expensive read yields before the first write', async () => {
  const f = fixture(2);
  f.read.mockImplementation(() => { f.events.push('read'); f.spend(7); return 0; });
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(true);
  expect(f.events).toEqual(['turn', 'read', 'turn', 'read', 'turn', 'write', 'write']);
  expect(f.chunkDurationsMs).toEqual([7, 7, 0]);
});

test('pose work yields at its measured budget without re-reading a hydrated batch', async () => {
  const f = fixture(8);
  f.writePose.mockImplementation(() => { f.events.push('write'); f.spend(3); });
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(true);
  expect(f.read).toHaveBeenCalledTimes(8);
  expect(f.waitForTurn).toHaveBeenCalledTimes(4);
  expect(f.chunkDurationsMs).toEqual([6, 6, 6, 6]);
});

test.each(['before', 'after-read', 'during-write', 'retired-wait'])('retired %s stage cannot continue or publish readiness', async kind => {
  const f = fixture(20);
  if (kind === 'before') f.cancel();
  if (kind === 'after-read') f.read.mockImplementation(() => { f.cancel(); return 0; });
  if (kind === 'during-write') f.writePose.mockImplementation(() => { f.cancel(); });
  if (kind === 'retired-wait') f.waitForTurn.mockImplementation(async () => false);
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(false);
  expect(f.writePose).toHaveBeenCalledTimes(kind === 'during-write' ? 1 : 0);
});

test('real CSSPlugin preserves authored rotation and percentage translation in the primed pose', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  // JSDOM does not compute transform matrices; use GSAP to establish the same
  // authored cache, then exercise the real preparation/write/enter ownership.
  gsap.set(target, { xPercent: -50, rotation: -7, scale: 1 });
  await expect(prepareJourneyWorldTransforms({
    targets: [target], isCurrent: () => true, waitForTurn: async () => true,
    chunkDurationsMs: [],
    writePose: element => {
      element.style.opacity = '0';
      gsap.set(element, { y: 30, scale: 0.65, force3D: false });
    },
  })).resolves.toBe(true);
  expect(gsap.getProperty(target, 'xPercent')).toBe(-50);
  expect(gsap.getProperty(target, 'rotation')).toBe(-7);
  expect(gsap.getProperty(target, 'y')).toBe(30);
  expect(gsap.getProperty(target, 'scaleX')).toBe(0.65);
  expect(target.style.opacity).toBe('0');
});

test('neutral longhands are normalized together, while non-neutral authored values are preserved', async () => {
  const f = fixture(2);
  jest.spyOn(window, 'getComputedStyle').mockImplementation(target => ({
    translate: target === f.targets[0] ? 'none' : '-50% -50%',
    rotate: target === f.targets[0] ? 'none' : '7deg',
    scale: 'none',
  } as CSSStyleDeclaration));
  f.read.mockImplementation(() => {
    expect(f.targets[0].style.translate).toBe('none');
    expect(f.targets[0].style.rotate).toBe('none');
    expect(f.targets[1].style.translate).toBe('');
    expect(f.targets[1].style.rotate).toBe('');
    expect(f.targets[1].style.scale).toBe('none');
    return 0;
  });
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(true);
  expect(f.read).toHaveBeenCalledTimes(2);
});

test('replacement starts a fresh finite transaction; cancelled work has no background owner', async () => {
  const f = fixture(2);
  f.cancel();
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(false);
  await expect(prepareJourneyWorldTransforms({ ...f, isCurrent: () => true, waitForTurn: async () => true }))
    .resolves.toBe(true);
  expect(f.writePose).toHaveBeenCalledTimes(2);
});
