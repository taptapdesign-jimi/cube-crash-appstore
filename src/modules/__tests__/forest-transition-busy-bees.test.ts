import {
  FOREST_BUSY_BEE_RISE_SEPARATION_MULTIPLIER,
  createForestBusyBeePlans,
  sampleForestBusyBeeCross,
  sampleForestBusyBeeScale,
} from '../forest-transition-busy-bees';

function seededRandom(seed = 17): () => number {
  let state = seed >>> 0;
  return () => {
    state = ((state * 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('Forest Busy Bee plans', () => {
  test('creates fourteen separated regular bees fully below the viewport', () => {
    const plans = createForestBusyBeePlans(14, 390, 844, seededRandom());
    expect(plans).toHaveLength(14);
    expect(Math.min(...plans.map((plan) => plan.leftPercent))).toBeGreaterThanOrEqual(1.8);
    expect(Math.max(...plans.map((plan) => plan.leftPercent))).toBeLessThanOrEqual(83.2);
    expect(new Set(plans.map((plan) => plan.leftPercent.toFixed(3))).size).toBe(14);
    expect(plans.every((plan) => plan.restViewportRatio >= 0.24 && plan.restViewportRatio <= 0.65)).toBe(true);
    expect(plans.every((plan) => plan.origin === 'bottom')).toBe(true);
    expect(new Set(plans.map((plan) => plan.initialScaleRatio.toFixed(4))).size).toBe(14);
    expect(plans.every((plan) => plan.initialScaleRatio >= 0.56 && plan.initialScaleRatio <= 0.86)).toBe(true);
    expect(plans.every((plan) => plan.riseScaleRatio >= 0.40 && plan.riseScaleRatio <= 0.88)).toBe(true);
    expect(plans.some((plan) => plan.riseScaleRatio <= 0.46)).toBe(true);
    expect(FOREST_BUSY_BEE_RISE_SEPARATION_MULTIPLIER).toBe(8);
    plans.forEach((plan) => {
      const renderedHalfSize = 70 * plan.initialScaleRatio * 0.5;
      const startCenterY = plan.restViewportRatio * 844 + plan.startOffsetY;
      expect(startCenterY - renderedHalfSize).toBeCloseTo(849, 5);
    });
    expect(plans.filter((plan) => plan.loopsPine)).toHaveLength(9);
    expect(plans.every((plan) => plan.bounceDuration >= 0.44 && plan.bounceDuration <= 0.56)).toBe(true);
    expect(plans.every((plan) => plan.crossDuration >= 1.02 / 0.70 && plan.crossDuration <= 1.20 / 0.70)).toBe(true);
    expect(plans.every((plan) => Math.abs(plan.endOffsetY) <= 844 * 0.055)).toBe(true);
    expect(plans.filter((plan) => plan.pineDepth === 'behind-front-pines')).toHaveLength(7);
    expect(plans.filter((plan) => plan.pineDepth === 'behind-rear-pines')).toHaveLength(7);
    expect(plans.filter((plan) => plan.frontFenceHold)).toHaveLength(3);
  });

  test('keeps the wobbly cross continuous at both endpoints', () => {
    const plan = createForestBusyBeePlans(1, 390, 844, seededRandom(23))[0];
    const output = new Float32Array(2);
    expect(sampleForestBusyBeeCross(plan, 0, output)).toBe(output);
    expect(output[0]).toBeCloseTo(plan.startOffsetX, 4);
    expect(output[1]).toBeCloseTo(plan.startOffsetY, 4);
    const firstFrame = new Float32Array(2);
    sampleForestBusyBeeCross(plan, 0.001, firstFrame);
    expect(Math.hypot(firstFrame[0] - output[0], firstFrame[1] - output[1])).toBeLessThan(5);
    sampleForestBusyBeeCross(plan, 1, output);
    expect(output[0]).toBeCloseTo(plan.endOffsetX, 4);
    expect(output[1]).toBeCloseTo(plan.endOffsetY, 4);
    sampleForestBusyBeeCross(plan, 0.5, output);
    expect(Math.hypot(output[0], output[1])).toBeGreaterThan(5);
  });

  test('gives every visible bee flight and bounce motion from the first phase', () => {
    const plans = createForestBusyBeePlans(14, 390, 844, seededRandom(41));
    const output = new Float32Array(2);
    plans.forEach((plan) => {
      const earlyProgress = 0.20 / plan.crossDuration;
      sampleForestBusyBeeCross(plan, earlyProgress, output);
      expect(Math.hypot(output[0], output[1])).toBeGreaterThan(1);
      expect(sampleForestBusyBeeScale(plan, 0)).toBeCloseTo(plan.initialScaleRatio, 6);
      expect(sampleForestBusyBeeScale(plan, earlyProgress)).not.toBeCloseTo(plan.initialScaleRatio, 3);
      expect(sampleForestBusyBeeScale(plan, 1)).toBeCloseTo(plan.riseScaleRatio, 6);
    });
  });
});
