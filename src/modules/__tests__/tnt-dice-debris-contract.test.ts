import fs from 'node:fs';
import path from 'node:path';
import {
  createTntDiceDebrisPlans,
  TNT_DICE_DEBRIS_COUNT,
  TNT_DICE_DEBRIS_DEPTHS,
} from '../tnt-animation';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('TNT depth-layered board-dice debris', () => {
  test('creates one bounded randomized plan per authored smoke depth', () => {
    let state = 0x12345678;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    const plans = createTntDiceDebrisPlans(random);

    expect(plans).toHaveLength(TNT_DICE_DEBRIS_COUNT);
    expect(plans.map(({ depth }) => depth)).toEqual([...TNT_DICE_DEBRIS_DEPTHS]);
    expect(plans.filter(({ depth }) => depth > 11)).toHaveLength(2);
    expect(plans.filter(({ depth }) => depth > 0 && depth < 11)).toHaveLength(12);
    expect(new Set(plans.map(({ depth }) => Math.floor(depth)))).toEqual(
      new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
    );
    const boomUnderlay = plans.filter(({ depth }) => depth > 11);
    expect(boomUnderlay.map(({ startX, startY, delay }) => ({ startX, startY, delay }))).toEqual([
      { startX: -38, startY: 4, delay: 0.32 },
      { startX: 38, startY: -4, delay: 0.40 },
    ]);
    expect(boomUnderlay.every(({ distance, duration }) => (
      distance === 72 && duration >= 0.96 && duration <= 1
    ))).toBe(true);
    expect(plans[1]).toMatchObject({ depth: 10.5, startX: 0, startY: 48, delay: 0.36 });
    expect(plans.slice(2, 4).every(({ delay }) => delay < 0.30)).toBe(true);
    expect(plans.slice(4, 8).every(({ delay }) => delay >= 0.36)).toBe(true);
    expect(plans.slice(4, 8).every(({ startX }) => Math.abs(startX) >= 52)).toBe(true);
    expect(new Set(plans.slice(4, 8).map(({ startX }) => Math.sign(startX)))).toEqual(new Set([-1, 1]));
    const edgeClearances = plans.flatMap((plan, index) => plans.slice(index + 1).map((other) => (
      Math.hypot(plan.startX - other.startX, plan.startY - other.startY)
        - (plan.size + other.size) * 0.5
    )));
    expect(Math.min(...edgeClearances)).toBeGreaterThanOrEqual(2.99);
    expect(Math.max(...plans.map(({ startX }) => Math.abs(startX)))).toBeLessThan(120);
    expect(Math.max(...plans.map(({ startY }) => Math.abs(startY)))).toBeLessThan(110);
    expect(plans.filter((_, index) => ![0, 1, 12].includes(index)).every(({ distance }) => (
      distance >= 95 && distance <= 165
    ))).toBe(true);
    expect(plans.every(({ curve }) => Math.abs(curve) >= 10 && Math.abs(curve) <= 26)).toBe(true);
    expect(plans.every((plan) => {
      const outwardAngle = Math.atan2(plan.startY, plan.startX);
      const delta = Math.atan2(Math.sin(plan.angle - outwardAngle), Math.cos(plan.angle - outwardAngle));
      return Math.abs(delta) <= 0.101;
    })).toBe(true);
    expect(plans.every(({ value }) => Number.isInteger(value) && value >= 1 && value <= 6)).toBe(true);
    expect(new Set(plans.map(({ value }) => value)).size).toBeGreaterThan(2);
    expect(plans.every(({ size }) => size >= 36 && size <= 58)).toBe(true);
    expect(plans.every(({ duration }) => duration >= 0.82 && duration <= 1.04)).toBe(true);
    expect(plans.every(({ startScale }) => startScale >= 0.44 && startScale <= 0.72)).toBe(true);
    expect(plans.every(({ peakScale }) => peakScale >= 0.88 && peakScale <= 1.30)).toBe(true);
    expect(plans.every(({ endScale }) => endScale >= 0.38 && endScale <= 0.76)).toBe(true);
    expect(new Set(plans.map(({ peakScale }) => peakScale.toFixed(3))).size).toBeGreaterThan(6);
    expect(new Set(plans.map(({ rotationTravel }) => Math.sign(rotationTravel)))).toEqual(new Set([-1, 1]));
    const freeDebrisDelays = plans
      .filter((_, index) => ![0, 1, 12].includes(index))
      .map(({ delay }) => delay);
    expect(freeDebrisDelays.slice(1).every((delay, index) => delay > freeDebrisDelays[index])).toBe(true);
  });

  test('renders dice inside Pixi smoke layers only for original TNT and owns cleanup', () => {
    const tntSource = read('src/modules/tnt-animation.ts');
    const appCoreSource = read('src/modules/app-core.ts');

    expect(tntSource).toContain("const TNT_DICE_TILE_SOURCE = './assets/tile.png'");
    expect(tntSource).toContain('die.zIndex = plan.depth');
    expect(tntSource).toContain('container.addChild(die)');
    expect(tntSource).toContain('TNT smoke frames occupy integer z-depths 0...11');
    expect(tntSource).toContain('TNT_DICE_PIP_POSITIONS[plan.value]');
    expect(tntSource).toContain('foregroundBurstCleanups.push(dispose)');
    expect(tntSource).toContain('if (die.parent) die.parent.removeChild(die)');
    expect(tntSource).toContain('child.destroy({ texture: false, textureSource: false })');
    expect(appCoreSource).toContain('diceDebris: tntVariantForMerge == null');
    expect(appCoreSource).toContain('preloadTntFrames(tntAnimationOptionsForMerge)');
    expect(appCoreSource).toContain('...tntAnimationOptionsForMerge');
  });
});
