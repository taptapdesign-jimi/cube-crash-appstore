/** @jest-environment jsdom */

import { Container, Sprite, Texture } from 'pixi.js';
import animationManager from '../animation-manager';
import { graphicsPool } from '../object-pool';
import {
  getKantaIdleCompositeCenterCorrectionX,
  KANTA_IDLE_FRONT_OFFSET_X_PX,
} from '../kanta-dice-idle';
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

  test('Kanta owns one bottom-centre frame-04 squeeze controller and restores the board sprite', () => {
    const base = new Sprite(Texture.WHITE);
    base.anchor.set(0.5);
    base.position.set(2, -3);
    base.width = 96;
    base.height = 128;
    const rotG = new Container();
    rotG.addChild(base);
    const tile: any = {
      base,
      rotG,
      destroyed: false,
      _ccSpecialDiceVariant: 'kanta',
    };
    const baseline = animationManager.getStats().activeTimelines;

    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccKantaDiceIdle;
    expect(controller).toBeTruthy();
    expect(base.anchor).toMatchObject({ x: 0.5, y: 1 });
    const displayedWidth = 128 * (128 / 171);
    expect(base.x).toBeCloseTo(
      2 + KANTA_IDLE_FRONT_OFFSET_X_PX + getKantaIdleCompositeCenterCorrectionX(displayedWidth, -1),
      6,
    );
    expect(base.y).toBe(61);
    expect(base.width).toBeCloseTo(128 * (128 / 171), 6);
    expect(base.height).toBeCloseTo(128, 6);
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);
    const bubbleContainer = rotG.getChildByLabel('kanta-idle-top-bubbles') as Container;
    const backBubbleContainer = rotG.getChildByLabel('kanta-idle-back-bubbles') as Container;
    expect(bubbleContainer).toBeTruthy();
    expect(backBubbleContainer).toBeTruthy();
    expect(bubbleContainer.children).toHaveLength(2);
    expect(backBubbleContainer.children).toHaveLength(1);
    const bubbles = [...bubbleContainer.children, ...backBubbleContainer.children] as any[];
    expect(bubbles.every((bubble) => !graphicsPool.isInPool(bubble))).toBe(true);

    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    startSpecialDiceIdleMotion(tile);
    expect(tile._ccKantaDiceIdle).toBe(controller);
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);

    stopSpecialDiceIdleMotion(tile);
    expect(tile._ccKantaDiceIdle).toBeUndefined();
    expect(base.anchor).toMatchObject({ x: 0.5, y: 0.5 });
    expect(base.position).toMatchObject({ x: 2, y: -3 });
    expect(base.width).toBeCloseTo(128 * (128 / 171), 6);
    expect(base.height).toBeCloseTo(128, 6);
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
    expect(rotG.getChildByLabel('kanta-idle-top-bubbles')).toBeNull();
    expect(rotG.getChildByLabel('kanta-idle-back-bubbles')).toBeNull();
    expect(bubbles.every((bubble) => graphicsPool.isInPool(bubble))).toBe(true);

    // A stale squeeze-scale from a prior board must not become the new neutral
    // geometry when the same logical Kanta is reconstructed.
    base.width = 44;
    base.height = 82;
    startSpecialDiceIdleMotion(tile);
    expect(base.width).toBeCloseTo(128 * (128 / 171), 6);
    expect(base.height).toBeCloseTo(128, 6);
    stopSpecialDiceIdleMotion(tile);
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

  test('Bee keeps its frame owner during drag without taking ownership of drag tilt', () => {
    const tile: any = {
      base: new Sprite(Texture.WHITE),
      rotG: new Container(),
      destroyed: false,
      _ccSpecialDiceVariant: 'bee',
    };

    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccBeeDiceIdle;
    expect(controller).toBeTruthy();
    expect(keepsSpecialDiceIdleRunningDuringDrag(tile)).toBe(false);
    tile.rotG.position.set(3, -5);
    tile.rotG.rotation = 0.2;
    tile.rotG.scale.set(1.04, 0.96);
    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    expect(tile.rotG.position.x).toBe(0);
    expect(tile.rotG.position.y).toBe(0);
    expect(tile.rotG.rotation).toBe(0);
    expect(tile.rotG.scale.x).toBe(1);
    expect(tile.rotG.scale.y).toBe(1);
    expect(tile._ccBeeDiceIdle).toBe(controller);

    startSpecialDiceIdleMotion(tile);
    expect(tile._ccBeeDiceIdle).toBe(controller);
    stopSpecialDiceIdleMotion(tile);
    expect(tile._ccBeeDiceIdle).toBeUndefined();
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
