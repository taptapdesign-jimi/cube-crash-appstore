/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { STATE } from '../app-state';
import {
  BALL_BOUNCY_CYCLE_MS,
  BALL_BOUNCY_DISPLAY_SIZE,
  BALL_BOUNCY_FRAME_COUNT,
  BALL_BOUNCY_IDLE_OFFSET_Y,
  BALL_BOUNCY_SHEET_URL,
  destroyBallBouncyArtworkRuntime,
  getBallBouncyDisplayGeometry,
  getBallBouncyRuntimeStats,
  isBeachBallBouncyTile,
  setBallBouncyArtworkDragging,
  startBallBouncyArtwork,
  stopBallBouncyArtwork,
} from '../ball-bouncy-artwork';

function makeSheet(): Texture {
  return new Texture({
    source: new TextureSource({
      resource: { width: 4048, height: 840 } as any,
      width: 4048,
      height: 840,
    }),
  });
}

function makeTile() {
  const base = new Sprite(Texture.WHITE);
  base.width = 128;
  base.height = 128;
  const rotG = new Container();
  rotG.addChild(base);
  const bubbleContainer = new Container();
  bubbleContainer.renderable = true;
  rotG.addChild(bubbleContainer);
  const tile: any = {
    special: 'wild-tnt',
    _ccSpecialDiceVariant: 'beach-ball',
    destroyed: false,
    base,
    rotG,
    _wildJuiceBubbleSystem: { disposed: false, container: bubbleContainer, bubbles: [] },
  };
  return { tile, base, rotG, bubbleContainer };
}

describe('Beach Ball shared Pixi sheet artwork', () => {
  let sheet: Texture;
  let loadSpy: jest.SpiedFunction<typeof Assets.load>;
  let getSpy: jest.SpiedFunction<typeof Assets.get>;
  let unloadSpy: jest.SpiedFunction<typeof Assets.unload>;
  let callbacks: Set<(ticker: any) => void>;
  let ticker: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    sheet = makeSheet();
    getSpy = jest.spyOn(Assets, 'get').mockReturnValue(undefined as any);
    loadSpy = jest.spyOn(Assets, 'load').mockResolvedValue(sheet as any);
    unloadSpy = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);
    callbacks = new Set();
    ticker = {
      elapsedMS: 0,
      add: jest.fn((callback: (liveTicker: any) => void) => callbacks.add(callback)),
      remove: jest.fn((callback: (liveTicker: any) => void) => callbacks.delete(callback)),
    };
    STATE.app = { ticker } as any;
  });

  afterEach(() => {
    destroyBallBouncyArtworkRuntime();
    STATE.app = null;
    loadSpy.mockRestore();
    getSpy.mockRestore();
    unloadSpy.mockRestore();
    try { sheet.destroy(true); } catch {}
    jest.useRealTimers();
    document.body.replaceChildren();
  });

  const flush = async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  };

  const tick = (elapsedMS: number) => {
    ticker.elapsedMS = elapsedMS;
    Array.from(callbacks).forEach((callback) => callback(ticker));
  };

  test('keeps accepted geometry and exact 1.4-second 60fps source animation', () => {
    const geometry = getBallBouncyDisplayGeometry();
    expect(geometry).toMatchObject({
      width: 176,
      height: 210,
      restingArtworkWidth: BALL_BOUNCY_DISPLAY_SIZE,
      restingArtworkHeight: BALL_BOUNCY_DISPLAY_SIZE,
      idleOffsetY: BALL_BOUNCY_IDLE_OFFSET_Y,
    });
    expect(geometry.anchorX).toBeCloseTo(88.5 / 176, 8);
    expect(geometry.anchorY).toBeCloseTo(149.65 / 210, 8);
    expect(BALL_BOUNCY_CYCLE_MS).toBe(1400);
    expect(BALL_BOUNCY_FRAME_COUNT).toBe(84);

    const svg = fs.readFileSync(path.resolve('assets/shop/ball/ball-bouncy.svg'), 'utf8');
    expect(svg).toContain('viewBox="0 0 390 440"');
    expect(svg).toContain('dur="1.4s"');
  });

  test('owns only Beach Ball', () => {
    expect(isBeachBallBouncyTile({ special: 'wild-tnt', _ccSpecialDiceVariant: 'beach-ball' })).toBe(true);
    expect(isBeachBallBouncyTile({ special: 'wild-tnt' })).toBe(false);
    expect(isBeachBallBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'bottle' })).toBe(false);
  });

  test('shares one source, gives copies independent clocks, and leaves Pixi bubbles untouched', async () => {
    const first = makeTile();
    const second = makeTile();
    const firstController = startBallBouncyArtwork(first.tile)!;
    const secondController = startBallBouncyArtwork(second.tile)!;
    await flush();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith(BALL_BOUNCY_SHEET_URL);
    expect(firstController.sprite?.texture.source).toBe(secondController.sprite?.texture.source);
    expect(firstController.phaseLease?.phaseSlot).not.toBe(secondController.phaseLease?.phaseSlot);
    expect(first.bubbleContainer.renderable).toBe(true);
    expect(second.bubbleContainer.renderable).toBe(true);
    expect(document.querySelector('.ball-bouncy-artwork')).toBeNull();
    expect(firstController.sprite?.zIndex).toBeLessThan(first.base.zIndex);

    const delay = secondController.phaseLease?.delayMs ?? 0;
    tick(delay);
    jest.advanceTimersByTime(delay);
    tick(100);
    expect(firstController.elapsedMs).not.toBe(secondController.elapsedMs);
    expect(getBallBouncyRuntimeStats()).toMatchObject({
      controllers: 2,
      ready: 2,
      sourceTextures: 1,
      frames: 84,
      refs: 2,
      runtimeAttached: true,
      overlayAttached: false,
    });
  });

  test('uses ball.png synchronously during drag and resumes the same clock', async () => {
    const { tile, base } = makeTile();
    const controller = startBallBouncyArtwork(tile)!;
    await flush();
    tick(240);
    const elapsedBeforeDrag = controller.elapsedMs;

    expect(base.renderable).toBe(false);
    expect(setBallBouncyArtworkDragging(tile, true)).toBe(true);
    expect(base.renderable).toBe(true);
    expect(controller.sprite?.renderable).toBe(false);
    tick(120);
    expect(controller.elapsedMs).toBeGreaterThan(elapsedBeforeDrag);

    expect(setBallBouncyArtworkDragging(tile, false)).toBe(true);
    expect(base.renderable).toBe(false);
    expect(controller.sprite?.renderable).toBe(true);
    expect(controller.elapsedMs).toBeGreaterThan(elapsedBeforeDrag);

    stopBallBouncyArtwork(tile);
    expect(base.renderable).toBe(true);
    expect(tile._ccBallBouncyArtwork).toBeUndefined();
    expect(ticker.remove).toHaveBeenCalledTimes(1);
  });
});
