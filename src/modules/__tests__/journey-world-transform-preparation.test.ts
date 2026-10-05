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
  const waitForTurn = jest.fn(async () => { events.push('turn'); return current; });
  const writePose = jest.fn(() => { events.push('write'); });
  const chunkDurationsMs: number[] = [];
  return {
    targets, events, waitForTurn, writePose, chunkDurationsMs,
    isCurrent: () => current,
    cancel: () => { current = false; },
    spend: (ms: number) => { now += ms; },
  };
}

test('known detached poses write without transform/style reads or unnecessary presentation turns', async () => {
  const f = fixture();
  const computedStyle = jest.spyOn(window, 'getComputedStyle');
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(true);
  expect(f.events).toEqual(Array(20).fill('write'));
  expect(computedStyle).not.toHaveBeenCalled();
  expect(f.waitForTurn).not.toHaveBeenCalled();
  expect(f.writePose.mock.calls).toHaveLength(20);
});

test('an indivisible expensive write yields before continuing', async () => {
  const f = fixture(2);
  f.writePose.mockImplementation(() => { f.events.push('write'); f.spend(7); });
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(true);
  expect(f.events).toEqual(['write', 'turn', 'write']);
  expect(f.chunkDurationsMs).toEqual([7, 7]);
});

test('pose work yields at its measured budget without pre-reading transform caches', async () => {
  const f = fixture(8);
  f.writePose.mockImplementation(() => { f.events.push('write'); f.spend(3); });
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(true);
  expect(f.waitForTurn).toHaveBeenCalledTimes(3);
  expect(f.chunkDurationsMs).toEqual([6, 6, 6, 6]);
});

test.each(['before', 'during-write', 'retired-wait'])('retired %s stage cannot continue or publish readiness', async kind => {
  const f = fixture(20);
  if (kind === 'before') f.cancel();
  if (kind === 'during-write') f.writePose.mockImplementation(() => { f.cancel(); });
  if (kind === 'retired-wait') {
    f.writePose.mockImplementation(() => { f.events.push('write'); f.spend(7); });
    f.waitForTurn.mockImplementation(async () => false);
  }
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(false);
  expect(f.writePose).toHaveBeenCalledTimes(kind === 'before' ? 0 : 1);
});

test('write owner receives the authored inline transform untouched', async () => {
  const target = document.createElement('div');
  target.style.transform = 'translateX(-50%) rotate(-7deg) scale(1)';
  document.body.append(target);
  await expect(prepareJourneyWorldTransforms({
    targets: [target], isCurrent: () => true, waitForTurn: async () => true,
    chunkDurationsMs: [],
    writePose: element => {
      element.style.opacity = '0';
      element.dataset.enterY = '30';
      element.dataset.enterScale = '0.65';
    },
  })).resolves.toBe(true);
  expect(target.style.transform).toBe('translateX(-50%) rotate(-7deg) scale(1)');
  expect(target.dataset.enterY).toBe('30');
  expect(target.dataset.enterScale).toBe('0.65');
  expect(target.style.opacity).toBe('0');
});

test('real CSSPlugin write preserves authored rotation and percentage translation', async () => {
  const target = document.createElement('div');
  document.body.append(target);
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
});

test('replacement starts a fresh finite transaction; cancelled work has no background owner', async () => {
  const f = fixture(2);
  f.cancel();
  await expect(prepareJourneyWorldTransforms(f)).resolves.toBe(false);
  await expect(prepareJourneyWorldTransforms({ ...f, isCurrent: () => true, waitForTurn: async () => true }))
    .resolves.toBe(true);
  expect(f.writePose).toHaveBeenCalledTimes(2);
});
