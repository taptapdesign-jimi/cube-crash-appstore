/** @jest-environment jsdom */

import { Container } from 'pixi.js';
import animationManager from '../animation-manager';
import {
  keepsSpecialDiceIdleRunningDuringDrag,
  setSpecialDiceIdleDragging,
  startSpecialDiceIdleMotion,
  stopSpecialDiceIdleMotion,
} from '../special-dice-idle';

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

  test('Bottle rocks around the artwork bottom centre and restores its original anchor', () => {
    const anchor = {
      x: 0.5,
      y: 0.5,
      set(x: number, y: number) {
        this.x = x;
        this.y = y;
      },
    };
    const base: any = {
      anchor,
      destroyed: false,
      x: 0,
      y: 0,
      width: 120,
      height: 120,
      rotation: 0,
      scale: { x: 1, y: 1, set: jest.fn() },
    };
    const tile: any = {
      base,
      rotG: new Container(),
      destroyed: false,
      _ccSpecialDiceVariant: 'bottle',
    };

    startSpecialDiceIdleMotion(tile);
    expect(tile._ccSpecialDiceIdleHost).toBe(base);
    expect(anchor).toMatchObject({ x: 0.5, y: 1 });
    expect(base.y).toBe(60);

    stopSpecialDiceIdleMotion(tile);
    expect(anchor).toMatchObject({ x: 0.5, y: 0.5 });
    expect(base.y).toBe(0);
  });

  test('Spaceship hover owns rotG and restores its exact board pose on cleanup', () => {
    const rotG = new Container();
    rotG.position.set(8, -6);
    rotG.rotation = 0.12;
    const tile: any = {
      rotG,
      destroyed: false,
      _ccSpecialDiceVariant: 'spaceship',
    };
    const baseline = animationManager.getStats().activeTimelines;

    startSpecialDiceIdleMotion(tile);
    expect(tile._ccSpecialDiceIdleHost).toBe(rotG);
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);

    stopSpecialDiceIdleMotion(tile);
    expect(rotG).toMatchObject({ x: 8, y: -6, rotation: 0.12 });
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });

  test('Spaceship keeps the same idle owner alive throughout drag and defensive restart calls', () => {
    const tile: any = {
      rotG: new Container(),
      destroyed: false,
      _ccSpecialDiceVariant: 'spaceship',
    };
    const baseline = animationManager.getStats().activeTimelines;

    startSpecialDiceIdleMotion(tile);
    const idleTimeline = tile._ccSpecialDiceIdleTl;

    expect(keepsSpecialDiceIdleRunningDuringDrag(tile)).toBe(true);
    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    expect(tile._ccSpecialDiceIdleTl).toBe(idleTimeline);

    startSpecialDiceIdleMotion(tile);
    expect(tile._ccSpecialDiceIdleTl).toBe(idleTimeline);
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);

    expect(setSpecialDiceIdleDragging(tile, false)).toBe(true);
    expect(tile._ccSpecialDiceIdleTl).toBe(idleTimeline);

    stopSpecialDiceIdleMotion(tile);
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });

  test('Mushroom owns one smoke master plus its existing pop timeline', () => {
    const rotG = new Container();
    const tile: any = {
      rotG,
      destroyed: false,
      _ccSpecialDiceVariant: 'mushroom',
    };
    const baseline = animationManager.getStats().activeTimelines;

    startSpecialDiceIdleMotion(tile);
    expect(tile._ccMushroomSmokeTimeline).toBeTruthy();
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 2);

    stopSpecialDiceIdleMotion(tile);
    expect(tile._ccMushroomSmokeTimeline).toBeUndefined();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });
});
