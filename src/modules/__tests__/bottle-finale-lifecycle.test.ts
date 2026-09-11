import animationManager from '../animation-manager.js';
import { gsap } from 'gsap';
import {
  attachBottleFinaleScene,
  createBottleCrossingSinkPlans,
  createMixedBottleBubbleOpacities,
  sampleBottleCrossingCenterPercent,
} from '../bottle-finale-scene.js';
import { domElementPool } from '../dom-element-pool.js';

describe('Bottle finale lifecycle ownership', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    domElementPool.clear();
  });

  test('releases every tracked timeline and pooled image on repeated cleanup', () => {
    domElementPool.clear();
    const baseline = animationManager.getStats();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);

    const cleanup = attachBottleFinaleScene(overlay, 1, 0.3);

    expect(overlay.querySelectorAll('.cc-bottle-finale-scene').length).toBe(1);
    expect(overlay.querySelectorAll('img').length).toBe(105);
    // 15 hero bottle owners + 1 shared trail clock + 1 shared sound clock
    // + 40 foreground bubbles.
    // The 60 trail particles must never return to one root timeline each.
    expect(animationManager.getStats().activeTimelines).toBe(baseline.activeTimelines + 57);

    cleanup();
    cleanup();

    expect(overlay.querySelector('.cc-bottle-finale-scene')).toBeNull();
    expect(animationManager.getStats().activeTimelines).toBe(baseline.activeTimelines);
    expect(domElementPool.getStats().poolSize).toBe(100);
  });

  test('keeps timeline and DOM ownership bounded across repeated interrupted finales', () => {
    domElementPool.clear();
    const baseline = animationManager.getStats();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const cleanup = attachBottleFinaleScene(overlay, 1, 0.3);
      cleanup.startExit?.();
      cleanup();
      cleanup();

      expect(overlay.querySelector('.cc-bottle-finale-scene')).toBeNull();
      expect(animationManager.getStats().activeTimelines).toBe(baseline.activeTimelines);
      expect(domElementPool.getStats().poolSize).toBeLessThanOrEqual(100);
    }
  });

  test('keeps hero bottles fresh across runs and fully primes their transform state', () => {
    domElementPool.clear();
    const contaminatedImages: HTMLImageElement[] = [];
    for (let index = 0; index < 100; index += 1) {
      const image = domElementPool.acquire('img') as HTMLImageElement;
      gsap.set(image, {
        x: 900 + index,
        y: -700 - index,
        xPercent: -50,
        yPercent: -50,
        scale: 0,
        rotationX: 35,
        rotationY: -40,
        opacity: 0,
        visibility: 'hidden',
      });
      contaminatedImages.push(image);
    }
    contaminatedImages.forEach((image) => domElementPool.release(image));

    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const firstCleanup = attachBottleFinaleScene(overlay, 1, 0.3);
    const firstBottles = Array.from(
      overlay.querySelectorAll<HTMLImageElement>('[data-bottle-layer]'),
    );
    const firstBubbles = new Set(
      overlay.querySelectorAll<HTMLImageElement>('.cc-bottle-finale-bubble'),
    );
    firstCleanup();

    const cleanup = attachBottleFinaleScene(overlay, 1, 0.3);
    const bottles = Array.from(
      overlay.querySelectorAll<HTMLImageElement>('[data-bottle-layer]'),
    );
    const secondBubbles = Array.from(
      overlay.querySelectorAll<HTMLImageElement>('.cc-bottle-finale-bubble'),
    );

    expect(bottles).toHaveLength(5);
    bottles.forEach((bottle) => expect(firstBottles).not.toContain(bottle));
    expect(secondBubbles.some((bubble) => firstBubbles.has(bubble))).toBe(true);
    bottles.forEach((bottle) => {
      expect(Number(gsap.getProperty(bottle, 'x'))).toBe(0);
      expect(Number(gsap.getProperty(bottle, 'y'))).toBe(0);
      expect(Number(gsap.getProperty(bottle, 'xPercent'))).toBe(0);
      expect(Number(gsap.getProperty(bottle, 'yPercent'))).toBe(0);
      expect(Number(gsap.getProperty(bottle, 'scale'))).toBe(1);
      expect(Number(gsap.getProperty(bottle, 'rotationX'))).toBe(0);
      expect(Number(gsap.getProperty(bottle, 'rotationY'))).toBe(0);
      expect(Number(gsap.getProperty(bottle, 'opacity'))).toBe(1);
      expect(bottle.style.visibility).toBe('visible');
    });

    cleanup();
  });

  test('crosses three bottle pairs continuously at separate points in the gravity fall', () => {
    const viewportHeight = 844;
    const plans = createBottleCrossingSinkPlans(viewportHeight);

    expect(plans).toHaveLength(5);
    expect(plans.map((plan) => plan.startYPx)).toEqual([
      -viewportHeight * 0.07,
      -viewportHeight * 0.23,
      viewportHeight * 0.03,
      -viewportHeight * 0.17,
      viewportHeight * 0.1,
    ]);
    const collisionCases = [
      { first: 'botle1', second: 'botle4', progress: 0.25 },
      { first: 'botle5', second: 'botle3', progress: 0.5 },
      { first: 'botle4', second: 'botle2', progress: 0.75 },
    ];
    collisionCases.forEach(({ first, second, progress }) => {
      const firstPlan = plans.find((plan) => plan.key === first)!;
      const secondPlan = plans.find((plan) => plan.key === second)!;
      const sample = (plan: typeof firstPlan, at: number): number => (
        sampleBottleCrossingCenterPercent(plan.centerPathPercents, at)
      );
      expect(sample(firstPlan, progress)).toBeCloseTo(sample(secondPlan, progress));
      const separationBefore = sample(firstPlan, progress - 0.02)
        - sample(secondPlan, progress - 0.02);
      const separationAfter = sample(firstPlan, progress + 0.02)
        - sample(secondPlan, progress + 0.02);
      expect(separationBefore * separationAfter).toBeLessThan(0);
    });

    plans.forEach((plan) => {
      const samples = Array.from({ length: 241 }, (_, index) => (
        sampleBottleCrossingCenterPercent(plan.centerPathPercents, index / 240)
      ));
      const largestFrameStep = Math.max(
        ...samples.slice(1).map((value, index) => Math.abs(value - samples[index])),
      );
      expect(largestFrameStep).toBeLessThan(0.5);
    });
  });

  test('mixes every bubble opacity individually across the full 20-to-70-percent range', () => {
    const samples = [0.02, 0.91, 0.18, 0.77, 0.36, 0.64, 0.49];
    let sampleIndex = 0;
    const values = createMixedBottleBubbleOpacities(
      100,
      () => samples[sampleIndex++ % samples.length],
    );

    expect(values).toHaveLength(100);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.2);
    expect(Math.min(...values)).toBeLessThan(0.21);
    expect(Math.max(...values)).toBeLessThanOrEqual(0.7);
    expect(Math.max(...values)).toBeGreaterThan(0.69);
    expect(new Set(values.map((value) => value.toFixed(3))).size).toBeGreaterThan(80);
    expect(values.slice(0, 12)).not.toEqual([...values.slice(0, 12)].sort((a, b) => a - b));
  });

});
