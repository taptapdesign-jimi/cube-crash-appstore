/** @jest-environment jsdom */

import fs from 'fs';
import path from 'path';
import animationManager from '../animation-manager';
import {
  attachBeeFinaleScene,
  BEE_FINALE_AMBIENT_PLANS,
  BEE_FINALE_FLYBY_START_SECONDS,
  BEE_FINALE_EXIT_GUIDE_PROGRESS,
  BEE_FINALE_EXIT_RELEASE_PROGRESS,
  BEE_FINALE_FLIGHT_SECONDS,
  BEE_FINALE_IDLE_FRAME_SECONDS,
  BEE_FINALE_LEAF_COUNT,
  BEE_FINALE_LAST_LEAF_END_SECONDS,
  BEE_FINALE_LEAF_START_SECONDS,
  BEE_FINALE_ORBIT_END_SECONDS,
  BEE_FINALE_SCENE_SECONDS,
  BEE_FINALE_VISIBLE_ART_RADIUS_RATIO,
  createBeeFinaleRoutePlan,
  getBeeFinaleHorizontalAssetForVelocity,
  getBeeFinaleIdleBlend,
  resolveBeeFinaleOrigin,
  resolveBeeFinaleExit,
  sampleBeeFinalePose,
  sampleBeeFinaleAmbientPose,
} from '../bee-finale-scene';

const viewport = { width: 390, height: 844 };
const origin = { x: 195, y: 430 };

describe('Bee merge-six finale', () => {
  beforeEach(() => animationManager.killAll());
  afterEach(() => animationManager.killAll());

  test('builds only the enlarged bee1-bee4 hero and leaf assets under one owner', () => {
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const baseline = animationManager.getStats().activeTimelines;
    const cleanup = attachBeeFinaleScene(overlay, 1, origin);

    expect(overlay.querySelectorAll('.cc-bee-finale-bush')).toHaveLength(0);
    expect(overlay.querySelectorAll('.cc-bee-finale-orbit-frame')).toHaveLength(4);
    expect(overlay.querySelectorAll('.cc-bee-finale-fly-frame')).toHaveLength(0);
    expect(overlay.querySelectorAll('.cc-bee-finale-fly-hero')).toHaveLength(0);
    expect(overlay.querySelectorAll('.cc-bee-finale-leaf')).toHaveLength(BEE_FINALE_LEAF_COUNT);
    expect(overlay.querySelectorAll('.cc-bee-finale-journey-bee')).toHaveLength(6);
    expect(overlay.querySelectorAll('.cc-bee-finale-journey-frame')).toHaveLength(12);
    expect(Array.from(overlay.querySelectorAll<HTMLImageElement>('.cc-bee-finale-journey-frame')).every(
      (frame) => frame.src.includes('/assets/shop/honey/bee'),
    )).toBe(true);
    expect(overlay.querySelector<HTMLElement>('.cc-bee-finale-hero')?.style.width).toBe('min(32.2vw,141.4px)');
    expect(cleanup.completionDelaySeconds).toBe(4);
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);

    cleanup();
    cleanup();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
    expect(overlay.querySelector('.cc-bee-finale-scene')).toBeNull();
    overlay.remove();
  });

  test('turns ambient bees horizontally at direction changes without somersault assets', () => {
    expect(getBeeFinaleHorizontalAssetForVelocity(-1, 'bee1')).toBe('bee3');
    expect(getBeeFinaleHorizontalAssetForVelocity(1, 'bee3')).toBe('bee1');
    expect(getBeeFinaleHorizontalAssetForVelocity(0, 'bee3')).toBe('bee3');
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachBeeFinaleScene(overlay, 1, origin);
    const sources = Array.from(overlay.querySelectorAll<HTMLImageElement>('.cc-bee-finale-journey-frame'))
      .map((frame) => frame.getAttribute('src'));
    expect(sources.every((src) => src?.includes('/bee1.png') || src?.includes('/bee3.png'))).toBe(true);
    expect(sources.some((src) => src?.includes('/bee2.png'))).toBe(false);
    expect(sources.some((src) => /\/bee[4-7]\.png/.test(src ?? ''))).toBe(false);
    cleanup();
    overlay.remove();
  });

  test('gives every ambient Bee an asymmetric nervous route and stronger irregular bounce', () => {
    BEE_FINALE_AMBIENT_PLANS.forEach((plan) => {
      const samples = Array.from({ length: 241 }, (_, index) => (
        sampleBeeFinaleAmbientPose(
          plan,
          index * BEE_FINALE_SCENE_SECONDS / 240,
          origin,
          viewport,
        )
      ));
      const directionChanges = (axis: 'vx' | 'vy') => {
        const signs = samples
          .map((sample) => sample[axis])
          .filter((velocity) => Math.abs(velocity) > 0.03)
          .map(Math.sign);
        return signs.slice(1).filter((sign, index) => sign !== signs[index]).length;
      };
      const rotationPeak = Math.max(...samples.map((sample) => Math.abs(sample.rotation)));
      const scaleX = samples.map((sample) => sample.scaleX);

      expect(samples[0]).toMatchObject({ x: origin.x, y: origin.y });
      expect(samples[samples.length - 1].x).toBeCloseTo(plan.endX * viewport.width, 4);
      expect(samples[samples.length - 1].y).toBeCloseTo(plan.endY * viewport.height, 4);
      expect(directionChanges('vx') + directionChanges('vy')).toBeGreaterThanOrEqual(5);
      expect(rotationPeak).toBeGreaterThan(10);
      expect(rotationPeak).toBeLessThanOrEqual(13.01);
      expect(Math.max(...scaleX) - Math.min(...scaleX)).toBeGreaterThan(0.14);
      expect(Math.min(...scaleX)).toBeGreaterThanOrEqual(0.90);
      expect(Math.max(...scaleX)).toBeLessThanOrEqual(1.10);
    });
  });

  test('uses the real merge origin and a safe fallback', () => {
    expect(resolveBeeFinaleOrigin(origin, viewport)).toEqual(origin);
    const fallback = resolveBeeFinaleOrigin({ x: Number.NaN, y: 4 }, viewport);
    expect(fallback.x).toBe(195);
    expect(fallback.y).toBeCloseTo(455.76, 4);
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachBeeFinaleScene(overlay, 1, origin);
    const field = overlay.querySelector<HTMLElement>('.cc-bee-finale-scene');
    expect(field?.dataset.originX).toBe('195.00');
    expect(field?.dataset.originY).toBe('430.00');
    cleanup();
    overlay.remove();
  });

  test('starts every authored Bee route at the merge origin before separating its path', () => {
    const start = sampleBeeFinalePose(0, origin, viewport, 0);
    const firstArc = sampleBeeFinalePose(0.9, origin, viewport, 0);
    const right = sampleBeeFinalePose(1.8, origin, viewport, 0);
    const left = sampleBeeFinalePose(BEE_FINALE_FLYBY_START_SECONDS - 0.001, origin, viewport, 0);
    const lateArc = sampleBeeFinalePose(BEE_FINALE_FLYBY_START_SECONDS + 0.001, origin, viewport, 0);
    const finish = sampleBeeFinalePose(4, origin, viewport, 0);

    expect(BEE_FINALE_ORBIT_END_SECONDS).toBe(0.9);
    expect(start.phase).toBe('orbit');
    expect(start.x).toBeCloseTo(origin.x, 4);
    expect(start.y).toBeCloseTo(origin.y, 4);
    expect(firstArc.phase).toBe('orbit');
    expect(right.phase).toBe('right-feint');
    expect(left.phase).toBe('left-charge');
    expect(finish.phase).toBe('flyby');
    expect(Math.hypot(firstArc.x - origin.x, firstArc.y - origin.y)).toBeGreaterThan(40);
    expect(Math.hypot(left.x - right.x, left.y - right.y)).toBeGreaterThan(20);
    expect(lateArc.x).toBeGreaterThan(viewport.width * 0.25);
    expect(finish.x).toBeGreaterThan(viewport.width);
    expect(Math.abs(finish.y - origin.y)).toBeGreaterThan(40);
    expect(finish).toMatchObject(resolveBeeFinaleExit(origin, viewport, 0));
    expect(BEE_FINALE_SCENE_SECONDS).toBe(4);
    [0.9, 1.8].forEach((boundary) => {
      const before = sampleBeeFinalePose(boundary - 0.001, origin, viewport, 0);
      const after = sampleBeeFinalePose(boundary + 0.001, origin, viewport, 0);
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(5);
    });
  });

  test('flies opposite the merge quadrant across the viewport and keeps its head forward', () => {
    const bottomRight = { x: 330, y: 700 };
    const bottomLeft = { x: 60, y: 700 };
    const topRight = { x: 330, y: 170 };
    expect(resolveBeeFinaleExit(bottomRight, viewport, 0)).toEqual({ x: -78, y: -168.8 });
    expect(resolveBeeFinaleExit(bottomLeft, viewport, 0)).toEqual({ x: 468, y: -168.8 });
    expect(resolveBeeFinaleExit(topRight, viewport, 0)).toEqual({ x: -78, y: 1012.8 });
    expect(resolveBeeFinaleExit(origin, viewport, Math.PI * 1.5).y).toBeGreaterThan(viewport.height);
    const route = Array.from({ length: 61 }, (_, index) => sampleBeeFinalePose(index * 0.05, bottomRight, viewport, 0));
    expect(route[0].x).toBeCloseTo(bottomRight.x, 4);
    expect(route[0].y).toBeCloseTo(bottomRight.y, 4);
    expect(route[route.length - 1]).toMatchObject({ x: -78, y: -168.8, facing: -1 });
    const distance = (a: typeof origin, b: typeof origin) => Math.hypot(a.x - b.x, a.y - b.y);
    expect(BEE_FINALE_FLIGHT_SECONDS).toBe(3);
    const earlyDistance = distance(sampleBeeFinalePose(0.5, bottomRight, viewport, 0), bottomRight);
    const lateDistance = distance(sampleBeeFinalePose(3, bottomRight, viewport, 0), sampleBeeFinalePose(2.5, bottomRight, viewport, 0));
    expect(lateDistance).toBeGreaterThan(earlyDistance * 2);
    const midpoint = sampleBeeFinalePose(1.5, bottomRight, viewport, 0);
    const straightMidX = (bottomRight.x - 78) * 0.5;
    const straightMidY = (bottomRight.y - 168.8) * 0.5;
    expect(Math.hypot(midpoint.x - straightMidX, midpoint.y - straightMidY)).toBeGreaterThan(55);
    expect(route.every((sample) => Math.abs(sample.rotation) <= 20)).toBe(true);
    expect(route.every((sample) => Number.isFinite(sample.rotation))).toBe(true);
    const calm = sampleBeeFinalePose(1.13, origin, viewport, 0);
    const shifted = sampleBeeFinalePose(1.13, origin, viewport, Math.PI / 2);
    expect(Math.abs(calm.x - shifted.x) + Math.abs(calm.y - shifted.y)).toBeGreaterThan(1);
  });

  test('follows the mirrored right/down/left/up/centre/right route from every merge region', () => {
    const starts = [60, 195, 330].flatMap((x) => [170, 430, 700].map((y) => ({ x, y })));
    const seeds = [0.4, 2.0, 3.6, 5.2];
    starts.forEach((start) => seeds.forEach((seed) => {
      const exit = resolveBeeFinaleExit(start, viewport, seed);
      const exitX = Math.sign(exit.x - start.x);
      const exitY = Math.sign(exit.y - start.y);
      const plan = createBeeFinaleRoutePlan(start, viewport, seed);
      const poses = plan.progress.map((progress) => (
        sampleBeeFinalePose(progress * BEE_FINALE_FLIGHT_SECONDS, start, viewport, seed, plan)
      ));
      const [launch, right, down, left, up, centre, exitSide] = poses;
      const gate = sampleBeeFinalePose(
        BEE_FINALE_EXIT_RELEASE_PROGRESS * BEE_FINALE_FLIGHT_SECONDS,
        start,
        viewport,
        seed,
        plan,
      );
      const finish = sampleBeeFinalePose(BEE_FINALE_FLIGHT_SECONDS, start, viewport, seed, plan);

      expect(launch).toMatchObject(start);
      expect((right.x - start.x) * exitX).toBeGreaterThan(viewport.width * 0.10);
      expect((down.y - right.y) * exitY).toBeLessThan(-viewport.height * 0.035);
      expect((left.x - down.x) * exitX).toBeLessThan(-viewport.width * 0.20);
      expect((up.y - left.y) * exitY).toBeGreaterThan(viewport.height * 0.16);
      expect(Math.abs(centre.x - viewport.width * 0.5)).toBeLessThan(viewport.width * 0.16);
      expect(Math.abs(centre.y - viewport.height * 0.5)).toBeLessThan(viewport.height * 0.16);
      expect((exitSide.x - viewport.width * 0.5) * exitX).toBeGreaterThan(viewport.width * 0.16);
      expect((gate.x - viewport.width * 0.5) * exitX).toBeGreaterThan(viewport.width * 0.18);
      expect((gate.y - viewport.height * 0.5) * exitY).toBeGreaterThan(viewport.height * 0.08);
      expect(finish).toMatchObject(exit);
      expect(poses.every((pose) => Math.abs(pose.vx) <= 0.01 || pose.facing === Math.sign(pose.vx))).toBe(true);
      expect(poses.every((pose) => Number.isFinite(pose.rotation) && Math.abs(pose.rotation) <= 20)).toBe(true);
    }));
  });

  test('precomputes a deterministic but organically varied screen-space route', () => {
    const start = { x: 60, y: 700 };
    const seeds = [0.4, 2.0, 3.6, 5.2];
    const plans = seeds.map((seed) => createBeeFinaleRoutePlan(start, viewport, seed));
    plans.forEach((plan, index) => {
      expect(createBeeFinaleRoutePlan(start, viewport, seeds[index])).toEqual(plan);
      expect(plan.progress).toEqual([0, 0.10, 0.19, 0.34, 0.50, 0.62, BEE_FINALE_EXIT_GUIDE_PROGRESS]);
      expect(plan.points).toHaveLength(plan.progress.length);
      expect(plan.controlOut).toHaveLength(plan.progress.length - 1);
      expect(plan.controlIn).toHaveLength(plan.progress.length - 1);
      expect(plan.points[0]).toEqual(start);
    });
    const signatures = new Set(plans.map((plan) => (
      plan.points.slice(3).map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join('|')
    )));
    expect(signatures.size).toBeGreaterThanOrEqual(3);
    const interiorSeparation = Math.max(...plans.slice(1).map((plan) => Math.max(
      ...plan.points.slice(3).map((point, index) => Math.hypot(
        point.x - plans[0].points[index + 3].x,
        point.y - plans[0].points[index + 3].y,
      )),
    )));
    expect(interiorSeparation).toBeGreaterThan(8);
  });

  test('turns inside the viewport and crosses both exit edges together without boundary gliding', () => {
    const starts = [
      { x: 60, y: 700 },
      { x: 330, y: 700 },
      { x: 60, y: 170 },
      { x: 330, y: 170 },
      origin,
    ];
    const heroRadius = Math.min(viewport.width * BEE_FINALE_VISIBLE_ART_RADIUS_RATIO, 56) + 3;
    expect(BEE_FINALE_EXIT_GUIDE_PROGRESS).toBe(0.76);
    expect(BEE_FINALE_EXIT_RELEASE_PROGRESS).toBe(0.90);
    starts.forEach((start, routeIndex) => {
      const seed = routeIndex * 0.83;
      const safeSamples = Array.from({ length: 181 }, (_, index) => (
        sampleBeeFinalePose(index * BEE_FINALE_FLIGHT_SECONDS / 200, start, viewport, seed)
      ));
      safeSamples.forEach((pose) => {
        expect(pose.x).toBeGreaterThanOrEqual(heroRadius - 0.01);
        expect(pose.x).toBeLessThanOrEqual(viewport.width - heroRadius + 0.01);
        expect(pose.y).toBeGreaterThanOrEqual(heroRadius - 0.01);
        expect(pose.y).toBeLessThanOrEqual(viewport.height - heroRadius + 0.01);
      });
      const safeEdges = [
        { distance: (pose: typeof safeSamples[number]) => Math.abs(pose.x - heroRadius), tangent: 'y' as const, normal: 'x' as const },
        { distance: (pose: typeof safeSamples[number]) => Math.abs(pose.x - (viewport.width - heroRadius)), tangent: 'y' as const, normal: 'x' as const },
        { distance: (pose: typeof safeSamples[number]) => Math.abs(pose.y - heroRadius), tangent: 'x' as const, normal: 'y' as const },
        { distance: (pose: typeof safeSamples[number]) => Math.abs(pose.y - (viewport.height - heroRadius)), tangent: 'x' as const, normal: 'y' as const },
      ];
      safeEdges.forEach((edge) => {
        let runStart = -1;
        safeSamples.forEach((pose, index) => {
          const insideBand = edge.distance(pose) <= 6;
          if (insideBand && runStart < 0) runStart = index;
          const closesRun = runStart >= 0 && (!insideBand || index === safeSamples.length - 1);
          if (!closesRun) return;
          const runEnd = insideBand ? index : index - 1;
          if (runEnd - runStart + 1 >= 4) {
            const first = safeSamples[runStart];
            const last = safeSamples[runEnd];
            const tangentTravel = Math.abs(last[edge.tangent] - first[edge.tangent]);
            const normalTravel = Math.abs(last[edge.normal] - first[edge.normal]);
            expect(tangentTravel >= 10 && normalTravel <= 2).toBe(false);
          }
          runStart = -1;
        });
      });

      const exitSamples = Array.from({ length: 41 }, (_, index) => (
        sampleBeeFinalePose(
          (BEE_FINALE_EXIT_RELEASE_PROGRESS + index / 40 * (1 - BEE_FINALE_EXIT_RELEASE_PROGRESS))
            * BEE_FINALE_FLIGHT_SECONDS,
          start,
          viewport,
          seed,
        )
      ));
      exitSamples.forEach((pose) => {
        const outsideX = pose.x < heroRadius - 0.01 || pose.x > viewport.width - heroRadius + 0.01;
        const outsideY = pose.y < heroRadius - 0.01 || pose.y > viewport.height - heroRadius + 0.01;
        expect(outsideX).toBe(outsideY);
      });
      const exit = resolveBeeFinaleExit(start, viewport, seed);
      const exitX = Math.sign(exit.x - start.x);
      const exitY = Math.sign(exit.y - start.y);
      exitSamples.slice(1).forEach((pose, index) => {
        const previous = exitSamples[index];
        expect((pose.x - previous.x) * exitX).toBeGreaterThanOrEqual(-0.05);
        expect((pose.y - previous.y) * exitY).toBeGreaterThanOrEqual(-0.05);
      });
      const releasePose = sampleBeeFinalePose(
        BEE_FINALE_EXIT_RELEASE_PROGRESS * BEE_FINALE_FLIGHT_SECONDS,
        start,
        viewport,
        seed,
      );
      expect(Math.hypot(releasePose.vx, releasePose.vy)).toBeGreaterThan(0.1);
      expect(sampleBeeFinalePose(BEE_FINALE_FLIGHT_SECONDS, start, viewport, seed))
        .toMatchObject(resolveBeeFinaleExit(start, viewport, seed));
    });
  });

  test('crossfades bee1 through bee4 four times faster on a 1.04ms cadence', () => {
    for (let time = 0; time < BEE_FINALE_FLYBY_START_SECONDS; time += 0.01) {
      const blend = getBeeFinaleIdleBlend(time);
      expect(blend.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
      expect(blend.some((value) => value > 0)).toBe(true);
      expect(blend.filter((value) => value > 0).length).toBeLessThanOrEqual(2);
    }
    expect(BEE_FINALE_IDLE_FRAME_SECONDS).toBeCloseTo(1 / 960, 8);
    expect([0, 1, 2, 3, 4].map((frame) => (
      getBeeFinaleIdleBlend(frame * BEE_FINALE_IDLE_FRAME_SECONDS + 0.000001)
        .findIndex((opacity) => opacity > 0.99)
    ))).toEqual([0, 1, 2, 3, 0]);
    const duringFade = getBeeFinaleIdleBlend(BEE_FINALE_IDLE_FRAME_SECONDS * 0.8);
    expect(duringFade.filter((value) => value > 0)).toHaveLength(2);
  });

  test('shows larger Cubero-style world leaves throughout the complete Bee flight', () => {
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachBeeFinaleScene(overlay, 1, origin);
    const leaves = Array.from(overlay.querySelectorAll<HTMLElement>('.cc-bee-finale-leaf'));
    const starts = leaves.map((leaf) => Number(leaf.dataset.startAt));
    const ends = leaves.map((leaf) => Number(leaf.dataset.endAt));

    expect(BEE_FINALE_LEAF_START_SECONDS).toBe(0);
    expect(Math.min(...starts)).toBeCloseTo(0, 4);
    expect(Math.max(...starts)).toBeGreaterThan(2.8);
    expect(leaves.every((leaf) => leaf.closest('.cc-bee-finale-hero') === null)).toBe(true);
    expect(leaves.every((leaf) => leaf.parentElement?.classList.contains('cc-bee-finale-leaf-wrap'))).toBe(true);
    expect(new Set(leaves.map((leaf) => leaf.getAttribute('src')?.match(/leaf[1-6]/)?.[0])).size).toBe(6);
    expect(leaves.every((leaf) => leaf.dataset.src2x?.includes('@2x.png'))).toBe(true);
    expect(new Set(leaves.map((leaf) => leaf.dataset.birthX)).size).toBeGreaterThan(12);
    const wraps = leaves.map((leaf) => leaf.parentElement as HTMLElement);
    const mergeBurstLeaves = leaves.filter((leaf) => leaf.dataset.mergeBurst === 'true');
    expect(mergeBurstLeaves).toHaveLength(12);
    expect(mergeBurstLeaves.every((leaf) => leaf.parentElement?.dataset.sizeBoost === '2')).toBe(true);
    expect(mergeBurstLeaves.every((leaf) => Math.hypot(
      Number(leaf.dataset.birthX) - origin.x,
      Number(leaf.dataset.birthY) - origin.y,
    ) <= 40)).toBe(true);
    const leafWidths = wraps.map((wrap) => Number.parseFloat(wrap.style.width));
    const leafHeights = wraps.map((wrap) => Number.parseFloat(wrap.style.height));
    expect(Math.min(...leafWidths)).toBeGreaterThanOrEqual(16);
    expect(Math.max(...leafWidths)).toBeLessThanOrEqual(76);
    expect(Math.min(...leafHeights)).toBeGreaterThanOrEqual(14);
    expect(Math.max(...leafHeights)).toBeLessThanOrEqual(84);
    expect(wraps.some((wrap) => wrap.dataset.sizeBoost === '2')).toBe(true);
    expect(wraps.some((wrap) => wrap.dataset.sizeBoost === '1.5')).toBe(true);
    expect(wraps.some((wrap) => wrap.dataset.sizeBoost === '1')).toBe(true);
    expect(new Set(leafWidths).size).toBeGreaterThan(10);
    expect(new Set(leafHeights).size).toBeGreaterThan(10);
    expect(overlay.querySelector<HTMLElement>('.cc-bee-finale-leaves-front')?.style.zIndex).toBe('1');
    expect(overlay.querySelector<HTMLElement>('.cc-bee-finale-hero')?.style.zIndex).toBe('2');
    expect(wraps.some((wrap) => Number(wrap.dataset.velocityX) < 0)).toBe(true);
    expect(wraps.some((wrap) => Number(wrap.dataset.velocityX) > 0)).toBe(true);
    expect(wraps.some((wrap) => Number(wrap.dataset.velocityY) < -180)).toBe(true);
    expect(wraps.every((wrap) => Number(wrap.dataset.gravity) >= 290)).toBe(true);
    expect(wraps.every((wrap) => Number(wrap.dataset.scatterRatio) <= 1.19)).toBe(true);
    expect(wraps.every((wrap) => Number(wrap.dataset.scatterRatio) >= 0.476)).toBe(true);
    expect(overlay.querySelector<HTMLElement>('.cc-bee-finale-scene')?.style.overflow).toBe('visible');
    expect(Math.max(...ends)).toBeLessThanOrEqual(BEE_FINALE_LAST_LEAF_END_SECONDS);
    cleanup();
    overlay.remove();
  });

  test('reuses its tracked master for interrupted exit', () => {
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const baseline = animationManager.getStats().activeTimelines;
    const cleanup = attachBeeFinaleScene(overlay, 1, origin);
    cleanup.startExit?.();
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);
    cleanup();
    cleanup();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
    expect(overlay.querySelector('.cc-bee-finale-scene')).toBeNull();
    overlay.remove();
  });

  test('normal WEEEE! letter exit cannot interrupt the four-second Bee owner', () => {
    const splashSource = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/splash-text-overlay.ts'),
      'utf8',
    );
    expect(splashSource).toContain('attachBeeFinaleScene(overlay, 1, origin, {');
    expect(splashSource.indexOf('document.body.appendChild(overlay)')).toBeLessThan(
      splashSource.indexOf('attachBeeFinaleScene(overlay, 1, origin, {'),
    );
    expect(splashSource).toMatch(
      /const startExit = \(\) => \{[\s\S]*?if \(!usesBeeForestFlight\) \{[\s\S]*?smallStarBurstCleanup[\s\S]*?bounceTimelines\.forEach/,
    );
  });
});
