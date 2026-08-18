import animationManager from '../animation-manager.js';
import { attachBottleFinaleScene } from '../bottle-finale-scene.js';
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
    expect(animationManager.getStats().activeTimelines).toBeGreaterThan(baseline.activeTimelines);

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
});
