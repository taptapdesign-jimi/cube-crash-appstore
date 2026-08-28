import animationManager from '../animation-manager.js';
import { gsap } from 'gsap';
import {
  attachBottleFinaleScene,
  createBottleHorizontalMotionPlan,
  createBottleSinkWeaveOffsets,
  createMixedBottleBubbleOpacities,
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
    expect(overlay.querySelectorAll('img').length).toBe(103);
    // 9 hero bottle owners + 1 shared trail clock + 40 foreground bubbles.
    // The 60 trail particles must never return to one root timeline each.
    expect(animationManager.getStats().activeTimelines).toBe(baseline.activeTimelines + 50);

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

    expect(bottles).toHaveLength(3);
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

  test('randomizes each bottle inside a separated lane without crossing the screen edge', () => {
    const viewportWidth = 390;
    const samples = [0, 1, 0.22, 0.84, 0.48, 0.51];
    let sampleIndex = 0;
    const random = () => samples[sampleIndex++ % samples.length];
    const layers = [
      { width: 30, lane: [18, 30] as const },
      { width: 36, lane: [42, 58] as const },
      { width: 27, lane: [70, 82] as const },
    ];

    const plans = layers.map((layer) => createBottleHorizontalMotionPlan(
      layer.width,
      layer.lane,
      viewportWidth,
      random,
    ));

    plans.forEach((plan, index) => {
      const { width, lane } = layers[index];
      const rotatedHalfWidth = width * 0.66;
      expect(plan.leftPercent).toBeGreaterThanOrEqual(rotatedHalfWidth + 2);
      expect(plan.endCenterPercent).toBeGreaterThanOrEqual(rotatedHalfWidth + 2);
      expect(plan.leftPercent).toBeLessThanOrEqual(100 - rotatedHalfWidth - 2);
      expect(plan.endCenterPercent).toBeLessThanOrEqual(100 - rotatedHalfWidth - 2);
      expect(plan.leftPercent).toBeGreaterThanOrEqual(lane[0]);
      expect(plan.leftPercent).toBeLessThanOrEqual(lane[1]);
      expect(plan.endCenterPercent).toBeGreaterThanOrEqual(lane[0]);
      expect(plan.endCenterPercent).toBeLessThanOrEqual(lane[1]);
      expect(plan.driftPx).toBeCloseTo(
        ((plan.endCenterPercent - plan.leftPercent) / 100) * viewportWidth,
      );
    });

    expect(plans[0].leftPercent).toBeLessThan(plans[1].leftPercent);
    expect(plans[1].leftPercent).toBeLessThan(plans[2].leftPercent);
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

  test('strengthens bottle weave while bounding every phase to ten percent of viewport width', () => {
    const viewportWidth = 390;
    const maxOffset = viewportWidth * 0.1;
    const rightFirst = createBottleSinkWeaveOffsets(viewportWidth, 50, 30, 22, 1);
    const leftFirst = createBottleSinkWeaveOffsets(viewportWidth, 50, 30, -18, -1);

    expect(rightFirst).toHaveLength(5);
    expect(leftFirst).toHaveLength(5);
    [...rightFirst, ...leftFirst].forEach((offset) => {
      expect(offset).toBeGreaterThanOrEqual(-maxOffset);
      expect(offset).toBeLessThanOrEqual(maxOffset);
    });
    expect(rightFirst.some((offset) => offset > 0)).toBe(true);
    expect(rightFirst.some((offset) => offset < 0)).toBe(true);
    expect(leftFirst.some((offset) => offset > 0)).toBe(true);
    expect(leftFirst.some((offset) => offset < 0)).toBe(true);
    expect(Math.abs(rightFirst[4])).toBeCloseTo(22 * 1.3);
  });

  test('keeps every scaled weave phase inside the screen for all three bottle lanes', () => {
    const viewportWidth = 390;
    const phaseScales = [0.98, 1.08, 1.16, 1.22, 1.26];
    const cases = [
      { center: 22, width: 30, drift: -38, direction: -1 as const },
      { center: 50, width: 36, drift: 34, direction: 1 as const },
      { center: 80, width: 27, drift: 38, direction: 1 as const },
    ];

    cases.forEach(({ center, width, drift, direction }) => {
      const offsets = createBottleSinkWeaveOffsets(
        viewportWidth,
        center,
        width,
        drift,
        direction,
      );
      offsets.forEach((offset, index) => {
        const centerAtPhase = center + (offset / viewportWidth) * 100;
        const halfEnvelope = width * 0.7 * phaseScales[index];
        expect(centerAtPhase).toBeGreaterThanOrEqual(halfEnvelope + 2);
        expect(centerAtPhase).toBeLessThanOrEqual(100 - halfEnvelope - 2);
      });
    });
  });
});
