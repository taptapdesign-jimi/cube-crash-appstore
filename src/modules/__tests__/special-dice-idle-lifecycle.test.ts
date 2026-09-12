/** @jest-environment jsdom */

import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import animationManager from '../animation-manager';
import { STATE } from '../app-state';
import { graphicsPool } from '../object-pool';
import {
  getKantaIdleCompositeCenterCorrectionX,
  KANTA_IDLE_FRONT_OFFSET_X_PX,
} from '../kanta-dice-idle';
import { startBeeDiceIdle } from '../bee-dice-idle';
import {
  keepsSpecialDiceIdleRunningDuringDrag,
  setSpecialDiceIdleDragging,
  startSpecialDiceIdleMotion,
  stopSpecialDiceIdleMotion,
} from '../special-dice-idle';

describe('special-dice idle lifecycle', () => {
  beforeEach(() => {
    animationManager.killAll();
    STATE.app = null;
  });
  afterEach(() => {
    animationManager.killAll();
    STATE.app = null;
  });

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
    const tickerAdd = jest.fn();
    const tickerRemove = jest.fn();
    STATE.app = { ticker: { add: tickerAdd, remove: tickerRemove } } as any;
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
    expect(tickerAdd).toHaveBeenCalledTimes(1);
    const bubbleTick = tickerAdd.mock.calls[0][0];
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
    expect(tickerRemove).toHaveBeenCalledTimes(1);
    expect(tickerRemove).toHaveBeenCalledWith(bubbleTick);
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

  test('Kanta mounts a 30%-smaller rear can behind the front and removes it on cleanup', async () => {
    const loadedSource = new TextureSource({
      resource: { width: 128, height: 171 } as any,
      width: 128,
      height: 171,
    });
    const loadedTexture = new Texture({ source: loadedSource });
    const loadSpy = jest.spyOn(Assets, 'load').mockImplementation(async () => loadedTexture as any);
    const base = new Sprite(loadedTexture);
    base.anchor.set(0.5);
    base.width = 96;
    base.height = 128;
    base.zIndex = 12;
    const rotG = new Container();
    rotG.sortableChildren = true;
    rotG.addChild(base);
    const tile: any = {
      base,
      rotG,
      destroyed: false,
      _ccSpecialDiceVariant: 'kanta',
    };

    try {
      startSpecialDiceIdleMotion(tile);
      await Promise.resolve();
      await Promise.resolve();

      // Freeze at the neutral authored pose before measuring the asynchronous
      // rear texture mount.
      expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
      const rear = rotG.getChildByLabel('kanta-idle-back') as Sprite;
      expect(rear).toBeTruthy();
      expect(rear.parent).toBe(rotG);
      expect(rear.width).toBeCloseTo(base.width * 0.70, 6);
      expect(rear.height).toBeCloseTo(base.height * 0.70, 6);
      expect(rear.y).toBeCloseTo(base.y - base.height * 0.14, 6);
      expect(rear.zIndex).toBeLessThan(base.zIndex);
      expect(rotG.getChildIndex(rear)).toBeLessThan(rotG.getChildIndex(base));

      stopSpecialDiceIdleMotion(tile);
      expect(rotG.getChildByLabel('kanta-idle-back')).toBeNull();
    } finally {
      stopSpecialDiceIdleMotion(tile);
      loadSpy.mockRestore();
      loadedTexture.destroy(true);
    }
  });

  test('Kanta keeps the rear can on one fixed side across taps and drags', async () => {
    const loadedSource = new TextureSource({
      resource: { width: 128, height: 171 } as any,
      width: 128,
      height: 171,
    });
    const loadedTexture = new Texture({ source: loadedSource });
    const loadSpy = jest.spyOn(Assets, 'load').mockImplementation(async () => loadedTexture as any);
    const base = new Sprite(loadedTexture);
    base.anchor.set(0.5);
    base.width = 96;
    base.height = 128;
    const rotG = new Container();
    rotG.x = window.innerWidth * 0.75;
    rotG.addChild(base);
    const tile: any = {
      base,
      rotG,
      destroyed: false,
      _ccSpecialDiceVariant: 'kanta',
    };

    try {
      startSpecialDiceIdleMotion(tile);
      await Promise.resolve();
      await Promise.resolve();

      const controller = tile._ccKantaDiceIdle;
      controller.setDragging(true);
      const rear = rotG.getChildByLabel('kanta-idle-back') as Sprite;
      const oldOffsetFromFront = rear.x - base.x;
      const oldOffsetFromFrontY = rear.y - base.y;
      const oldRotation = rear.rotation;
      expect(oldOffsetFromFront).toBeLessThan(0);
      expect(oldOffsetFromFrontY).toBeCloseTo(-base.height * 0.14, 6);
      expect(oldRotation).toBeGreaterThanOrEqual(3 * (Math.PI / 180));
      expect(oldRotation).toBeLessThanOrEqual(10 * (Math.PI / 180));

      controller.setDragging(false);
      controller.setDragging(true);
      expect(rear.x - base.x).toBeCloseTo(oldOffsetFromFront, 6);
      expect(rear.y - base.y).toBeCloseTo(oldOffsetFromFrontY, 6);
      expect(rear.rotation).toBeCloseTo(oldRotation, 6);
      expect(rear.width).toBeCloseTo(base.width * 0.70, 6);

      controller.setDragging(false);
      controller.setDragging(true);
      expect(rear.x - base.x).toBeCloseTo(oldOffsetFromFront, 6);
      expect(rear.y - base.y).toBeCloseTo(oldOffsetFromFrontY, 6);
      expect(rear.rotation).toBeCloseTo(oldRotation, 6);
      expect(rear.width).toBeCloseTo(base.width * 0.70, 6);
    } finally {
      stopSpecialDiceIdleMotion(tile);
      loadSpy.mockRestore();
      loadedTexture.destroy(true);
    }
  });

  test('Kanta rebases its neutral scale when the authored frame resolves after a restored 2x holder', async () => {
    const restoredSource = new TextureSource({
      resource: { width: 256, height: 256 } as any,
      width: 256,
      height: 256,
    });
    const restoredTexture = new Texture({ source: restoredSource });
    const kantaSource = new TextureSource({
      resource: { width: 128, height: 171 } as any,
      width: 128,
      height: 171,
    });
    const kantaTexture = new Texture({ source: kantaSource });
    let resolveTexture!: (texture: Texture) => void;
    const pendingTexture = new Promise<Texture>((resolve) => { resolveTexture = resolve; });
    const loadSpy = jest.spyOn(Assets, 'load').mockImplementation(() => pendingTexture as any);
    const base = new Sprite(restoredTexture);
    base.anchor.set(0.5);
    base.width = 128;
    base.height = 128;
    const rotG = new Container();
    rotG.addChild(base);
    const tile: any = {
      base,
      rotG,
      destroyed: false,
      _ccSpecialDiceVariant: 'kanta',
    };

    try {
      startSpecialDiceIdleMotion(tile);
      resolveTexture(kantaTexture);
      await Promise.resolve();
      await Promise.resolve();

      expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
      expect(base.width).toBeCloseTo(128 * (128 / 171), 6);
      expect(base.height).toBeCloseTo(128, 6);
      expect(base.scale.x).toBeCloseTo((128 * (128 / 171)) / 128, 6);
      expect(base.scale.y).toBeCloseTo(128 / 171, 6);
    } finally {
      stopSpecialDiceIdleMotion(tile);
      loadSpy.mockRestore();
      restoredTexture.destroy(true);
      kantaTexture.destroy(true);
    }
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

  test('Bee preserves square geometry when its first frame resolves after a cold restored holder', async () => {
    const restoredSource = new TextureSource({
      resource: { width: 512, height: 512 } as any,
      width: 512,
      height: 512,
    });
    const restoredTexture = new Texture({ source: restoredSource });
    const beeSource = new TextureSource({
      resource: { width: 128, height: 128 } as any,
      width: 128,
      height: 128,
    });
    const beeTexture = new Texture({ source: beeSource });
    const loadSpy = jest.spyOn(Assets, 'load').mockResolvedValue(beeTexture as any);
    const base = new Sprite(restoredTexture);
    base.anchor.set(0.5);
    base.width = 128;
    base.height = 128;
    const rotG = new Container();
    rotG.addChild(base);
    const tile: any = { base, rotG, destroyed: false };
    const controller = startBeeDiceIdle(tile, ['bee1', 'bee2', 'bee3', 'bee4']);
    tile._ccBeeDiceIdle = controller;

    try {
      expect(base.scale.x).toBeCloseTo(0.25, 6);
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 20));
      controller?.setDragging(true);

      expect(base.texture).toBe(beeTexture);
      expect(base.width).toBeCloseTo(128, 6);
      expect(base.height).toBeCloseTo(128, 6);
      expect(Math.abs(base.scale.x)).toBeCloseTo(1, 6);
      expect(Math.abs(base.scale.y)).toBeCloseTo(1, 6);
    } finally {
      controller?.dispose();
      delete tile._ccBeeDiceIdle;
      loadSpy.mockRestore();
      restoredTexture.destroy(true);
      beeTexture.destroy(true);
    }
  });

  test('Mushroom keeps one smoke master without the former GSAP pop timeline', () => {
    const rotG = new Container();
    const base = new Sprite(Texture.WHITE);
    rotG.addChild(base);
    const tile: any = {
      base,
      rotG,
      destroyed: false,
      _ccSpecialDiceVariant: 'mushroom',
    };
    const baseline = animationManager.getStats().activeTimelines;

    startSpecialDiceIdleMotion(tile);
    expect(tile._ccMushroomSmokeTimeline).toBeTruthy();
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);

    stopSpecialDiceIdleMotion(tile);
    expect(tile._ccMushroomSmokeTimeline).toBeUndefined();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });
});
