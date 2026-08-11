/** @jest-environment jsdom */

import { Container } from 'pixi.js';
import animationManager from '../animation-manager';
import { startSpecialDiceIdleMotion, stopSpecialDiceIdleMotion } from '../special-dice-idle';

describe('special-dice idle lifecycle', () => {
  beforeEach(() => animationManager.killAll());
  afterEach(() => animationManager.killAll());

  test('explicit tile cleanup releases its infinite timeline from the manager', () => {
    const tile: any = {
      rotG: new Container(),
      destroyed: false,
      _ccSpecialDiceVariant: 'cubero',
    };
    const baseline = animationManager.getStats().activeTimelines;

    startSpecialDiceIdleMotion(tile);
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);

    stopSpecialDiceIdleMotion(tile);
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
    expect(tile._ccSpecialDiceIdleTl).toBeNull();
  });
});
