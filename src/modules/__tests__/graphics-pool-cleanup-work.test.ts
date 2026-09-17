import { Container } from 'pixi.js';
import { gsap } from 'gsap';
import { GraphicsPool } from '../object-pool';

it('skips animation searches for unpublished allocations and prewarming', () => {
  const pool = new GraphicsPool();
  const kill = jest.spyOn(gsap, 'getTweensOf');
  const fresh = pool.acquire();
  expect(kill).not.toHaveBeenCalled();
  pool.prewarmToSize(5);
  expect(kill).not.toHaveBeenCalled();
  fresh.destroy(); pool.clear();
});

it('batches cleanup at release/detach/reacquire boundaries without leaving zombie tweens', () => {
  const pool = new GraphicsPool();
  const graphic = pool.acquire();
  const parent = new Container(); parent.addChild(graphic);
  const targets = [graphic, graphic.scale, graphic.pivot, graphic.skew];
  targets.forEach(target => gsap.to(target, { x: 12, duration: 10, paused: true }));
  // Pixi removed callbacks can create new work during release's detach boundary.
  graphic.once('removed', () => { gsap.to(graphic, { x: 40, duration: 10, paused: true }); });
  const kill = jest.spyOn(gsap, 'getTweensOf');
  pool.release(graphic);
  expect(kill).toHaveBeenCalledTimes(2);
  expect(kill).toHaveBeenNthCalledWith(1, targets);
  expect(kill).toHaveBeenNthCalledWith(2, targets);
  expect(gsap.globalTimeline.getTweensOf(targets)).toHaveLength(0);
  expect(graphic.parent).toBeNull();
  expect(graphic.x).toBe(0);
  pool.release(graphic);
  expect(kill).toHaveBeenCalledTimes(2);
  // A stale caller is still harmless when a cached object is borrowed again.
  gsap.to(graphic.scale, { x: 9, duration: 10, paused: true });
  expect(pool.acquire()).toBe(graphic);
  expect(kill).toHaveBeenCalledTimes(3);
  expect(gsap.globalTimeline.getTweensOf(targets)).toHaveLength(0);
  expect(graphic.scale.x).toBe(1);
  graphic.destroy(); parent.destroy(); pool.clear();
});

it('retires nested/delayed Graphics targets while preserving unrelated multi-target motion', () => {
  const pool = new GraphicsPool();
  const graphic = pool.acquire();
  const unrelated = { x: 0 };
  const master = gsap.timeline({ paused: true });
  master.to([graphic, unrelated], { x: 100, duration: 1 }, 2);
  master.to(graphic.pivot, { x: 8, duration: 1 }, 3);
  pool.release(graphic);
  // GSAP retains the original target list for a partially killed multi-target
  // tween. Assert actual motion below, not removal of that metadata reference.
  expect(gsap.globalTimeline.getTweensOf(graphic.pivot)).toHaveLength(0);
  expect(gsap.globalTimeline.getTweensOf(unrelated)).toHaveLength(1);
  master.seek(2.5);
  expect(unrelated.x).toBeGreaterThan(0);
  expect(graphic.x).toBe(0);
  master.kill(); pool.clear();
});

it('clearing cached objects also retires late nested transform tweens before destruction', () => {
  const pool = new GraphicsPool();
  const graphic = pool.acquire();
  pool.release(graphic);
  const scale = graphic.scale, pivot = graphic.pivot, skew = graphic.skew;
  const master = gsap.timeline({ paused: true });
  master.to(scale, { x: 9, duration: 1 }, 2);
  master.to(pivot, { x: 9, duration: 1 }, 2);
  master.to(skew, { x: 9, duration: 1 }, 2);
  pool.clear();
  expect(graphic.destroyed).toBe(true);
  expect(gsap.globalTimeline.getTweensOf([scale, pivot, skew])).toHaveLength(0);
  expect(() => master.seek(3)).not.toThrow();
  master.kill();
});
