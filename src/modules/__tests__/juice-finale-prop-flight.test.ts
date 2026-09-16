/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Assets, Container, Texture } from 'pixi.js';
import { clearBubbleSpritePool, getBubbleSpritePool } from '../object-pool.ts';
import {
  createJuiceFinalePropFlightPlan,
  createJuiceFinalePropFlights,
  getJuiceFinalePropTextures,
  JUICE_FINALE_PROP_POOL_KEY,
  JUICE_FINALE_PROP_SOURCES,
  preloadJuiceFinalePropTextures,
  sampleJuiceFinalePropPose,
} from '../juice-finale-prop-flight.ts';

describe('Juice Merge-6 cup, lid and straw flight', () => {
  afterEach(() => clearBubbleSpritePool(JUICE_FINALE_PROP_POOL_KEY));

  test('keeps all supplied 1x art and places cup behind bubbles, lid above them, straw in front', () => {
    Object.values(JUICE_FINALE_PROP_SOURCES).forEach((source) => {
      expect(fs.existsSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')))).toBe(true);
    });
    const cup = createJuiceFinalePropFlightPlan('cup', 390, 844, () => 0.25);
    const lid = createJuiceFinalePropFlightPlan('lid', 390, 844, () => 0.25);
    const straw = createJuiceFinalePropFlightPlan('straw', 390, 844, () => 0.25);
    expect(cup.depth).toBeLessThan(0);
    expect(lid.depth).toBeGreaterThan(0);
    expect(straw.depth).toBeGreaterThan(lid.depth);
    expect(straw.delay).toBe(0);
    expect(lid.delay).toBeGreaterThan(straw.delay);
    expect(cup.delay).toBeGreaterThan(lid.delay);
    expect(straw.duration).toBeLessThan(lid.duration);
    expect(lid.duration).toBeLessThan(cup.duration);
    expect(straw.delay + straw.duration).toBeLessThan(lid.delay + lid.duration);
    expect(lid.delay + lid.duration).toBeLessThan(cup.delay + cup.duration);
    expect(cup.startX + cup.size / 2).toBeLessThan(straw.startX - straw.size / 2);
    for (const plan of [cup, lid, straw]) {
      expect(plan.startY).toBeGreaterThan(844);
      expect(plan.endY).toBeLessThan(0);
      expect(plan.weaveAmplitude).toBeGreaterThan(20);
      expect(plan.rotationAmplitude).toBeGreaterThan(30 * Math.PI / 180);
      expect(plan.rotationAmplitude).toBeLessThanOrEqual(40 * Math.PI / 180);
    }
  });

  test('samples one continuous accelerating rise with strong bounded side bounce and both rotation signs', () => {
    for (const prop of ['cup', 'lid', 'straw'] as const) {
      const plan = createJuiceFinalePropFlightPlan(prop, 390, 844, () => 0.25);
      const poses = Array.from({ length: 101 }, (_, index) => sampleJuiceFinalePropPose(plan, index / 100));
      expect(poses[0].x).toBeCloseTo(plan.startX);
      expect(poses[0].y).toBeCloseTo(plan.startY);
      expect(poses[0].rotation).toBeCloseTo(0);
      expect(poses[100].y).toBeCloseTo(plan.endY);
      for (let index = 1; index < poses.length; index += 1) {
        expect(poses[index].y).toBeLessThan(poses[index - 1].y);
      }
      const xs = poses.map(({ x }) => x);
      const rotations = poses.map(({ rotation }) => rotation);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(plan.horizontalMargin - 0.001);
      expect(Math.max(...xs)).toBeLessThanOrEqual(390 - plan.horizontalMargin + 0.001);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(plan.weaveAmplitude);
      let lateralReversals = 0;
      let lastLateralSign = 0;
      for (let index = 1; index < xs.length; index += 1) {
        const sign = Math.sign(xs[index] - xs[index - 1]);
        if (sign !== 0 && lastLateralSign !== 0 && sign !== lastLateralSign) lateralReversals += 1;
        if (sign !== 0) lastLateralSign = sign;
      }
      expect(lateralReversals).toBeGreaterThanOrEqual(4);
      expect(Math.min(...rotations)).toBeLessThan(-0.30);
      expect(Math.max(...rotations)).toBeGreaterThan(0.30);
      expect(Math.max(...rotations.map(Math.abs))).toBeLessThanOrEqual(40 * Math.PI / 180);
      const beforeFullSway = sampleJuiceFinalePropPose(plan, 0.2 - 0.0001);
      const atFullSway = sampleJuiceFinalePropPose(plan, 0.2);
      const afterFullSway = sampleJuiceFinalePropPose(plan, 0.2 + 0.0001);
      expect(Math.abs(
        (atFullSway.x - beforeFullSway.x) - (afterFullSway.x - atFullSway.x),
      )).toBeLessThan(0.005);
      const earlyRise = poses[25].y - poses[0].y;
      const lateRise = poses[100].y - poses[75].y;
      expect(Math.abs(lateRise)).toBeGreaterThan(Math.abs(earlyRise));
    }
  });

  test('draws a different bounded upward route for each part on every new finale', () => {
    const randomFromSeed = (initialSeed: number) => {
      let seed = initialSeed;
      return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      };
    };
    for (const prop of ['cup', 'lid', 'straw'] as const) {
      const routes = new Set<string>();
      for (let run = 1; run <= 8; run += 1) {
        const plan = createJuiceFinalePropFlightPlan(prop, 390, 844, randomFromSeed(run));
        const poses = Array.from({ length: 41 }, (_, index) => sampleJuiceFinalePropPose(plan, index / 40));
        expect(poses.every(({ x }) => x >= plan.horizontalMargin - 0.001
          && x <= 390 - plan.horizontalMargin + 0.001)).toBe(true);
        expect(poses.slice(1).every(({ y }, index) => y < poses[index].y)).toBe(true);
        routes.add(poses.filter((_, index) => index % 5 === 0)
          .map(({ x, y }) => `${Math.round(x)},${Math.round(y)}`).join('|'));
      }
      expect(routes.size).toBe(8);
    }
  });

  test('returns each live sprite to one separate pool and reuses it on the next finale', () => {
    const container = new Container();
    const textures = { cup: Texture.WHITE, lid: Texture.WHITE, straw: Texture.WHITE };
    const first = createJuiceFinalePropFlights(container, textures, 390, 844, jest.fn());
    expect(container.children.map((sprite) => sprite.zIndex)).toEqual([-20, 20, 30]);
    first.release();
    first.release();
    expect(container.children).toHaveLength(0);
    expect(getBubbleSpritePool(() => Texture.WHITE, JUICE_FINALE_PROP_POOL_KEY).getStats())
      .toMatchObject({ created: 3, poolSize: 3 });

    const second = createJuiceFinalePropFlights(container, textures, 390, 844, jest.fn());
    expect(container.children).toHaveLength(3);
    second.release();
    expect(getBubbleSpritePool(() => Texture.WHITE, JUICE_FINALE_PROP_POOL_KEY).getStats())
      .toMatchObject({ created: 3, reused: 3, poolSize: 3 });
    container.destroy({ children: false });
  });

  test('prewarms three parts in parallel and retains ready art while one decode is pending', async () => {
    let resolveLid!: (texture: Texture) => void;
    const slowLid = new Promise<Texture>((resolve) => { resolveLid = resolve; });
    const load = jest.spyOn(Assets, 'load').mockImplementation((source: any) => (
      source === JUICE_FINALE_PROP_SOURCES.lid ? slowLid : Promise.resolve(Texture.WHITE)
    ) as any);
    try {
      const pending = preloadJuiceFinalePropTextures();
      expect(load).toHaveBeenCalledTimes(3);
      await Promise.resolve();
      expect(getJuiceFinalePropTextures()).toMatchObject({
        cup: Texture.WHITE,
        straw: Texture.WHITE,
      });
      expect(getJuiceFinalePropTextures().lid).toBeUndefined();
      resolveLid(Texture.WHITE);
      await pending;
      expect(Object.keys(getJuiceFinalePropTextures())).toHaveLength(3);
    } finally {
      load.mockRestore();
    }
  });

  test('routes optional props only from both generic Juice owners and keeps safety cleanup', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const explosion = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/wild-juice-bubbles-explosion.ts'), 'utf8');
    expect(appCore).toContain('showJuiceProps: !variant,');
    expect(appCore).toContain('showJuiceProps: !wildJuiceVariantForExplosion,');
    expect(appCore).toContain('void preloadJuiceFinalePropTextures();');
    const startLevelStart = appCore.indexOf('async function startLevel(n)');
    const startLevelBarrier = appCore.indexOf("ensureCoreRenderTexturesGpuReady('startLevel')", startLevelStart);
    expect(appCore.slice(startLevelStart, startLevelBarrier)).not.toContain('preloadJuiceFinalePropTextures');
    expect(appCore.slice(startLevelStart, startLevelBarrier)).not.toContain('preloadJuiceMerge6Sounds');
    expect(explosion).toContain("options.showJuiceProps && usesDefaultBubbleSprites && options.direction !== 'down'");
    expect(explosion).toContain('Promise.race([preloadJuiceFinalePropTextures(), boundedWait])');
    expect(explosion).toContain('active === 0 && juicePropsComplete');
    expect(explosion).toContain('juicePropFlight?.release();');
    expect(appCore).toContain('forceStopWildJuiceBubblesExplosion();\n      if (wasActive)');
  });
});
