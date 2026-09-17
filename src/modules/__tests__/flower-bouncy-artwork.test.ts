/** @jest-environment jsdom */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { STATE } from '../app-state';
import {
  destroyFlowerBouncyArtworkRuntime,
  FLOWER_BOUNCY_CYCLE_MS,
  FLOWER_BOUNCY_TEXTURE_URL,
  getFlowerBouncyDisplayGeometry,
  getFlowerBouncyPose,
  getFlowerBouncyRuntimeStats,
  isFlowerBouncyTile,
  setFlowerBouncyArtworkDragging,
  startFlowerBouncyArtwork,
  stopFlowerBouncyArtwork,
} from '../flower-bouncy-artwork';

function makeTexture(): Texture {
  return new Texture({
    source: new TextureSource({
      resource: { width: 256, height: 256 } as any,
      width: 256,
      height: 256,
    }),
  });
}

function makeTile(variant = 'flower') {
  const base = new Sprite(Texture.WHITE);
  const rotG = new Container();
  rotG.addChild(base);
  return {
    tile: {
      special: 'wild-tnt',
      _ccSpecialDiceVariant: variant,
      destroyed: false,
      zIndex: 7,
      base,
      rotG,
    } as any,
    base,
    rotG,
  };
}

describe('Flower procedural Pixi artwork', () => {
  let texture: Texture;
  let callbacks: Set<(ticker: any) => void>;
  let ticker: any;
  let loadSpy: jest.SpiedFunction<typeof Assets.load>;
  let getSpy: jest.SpiedFunction<typeof Assets.get>;
  let stage: Container;

  const flush = async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
    destroyFlowerBouncyArtworkRuntime();
    texture = makeTexture();
    getSpy = jest.spyOn(Assets, 'get').mockReturnValue(undefined as any);
    loadSpy = jest.spyOn(Assets, 'load').mockResolvedValue(texture as any);
    callbacks = new Set();
    ticker = {
      elapsedMS: 0,
      add: jest.fn((callback: (value: any) => void) => callbacks.add(callback)),
      remove: jest.fn((callback: (value: any) => void) => callbacks.delete(callback)),
    };
    stage = new Container();
    stage.sortableChildren = true;
    STATE.app = { ticker, stage } as any;
  });

  afterEach(() => {
    destroyFlowerBouncyArtworkRuntime();
    STATE.app = null;
    loadSpy.mockRestore();
    getSpy.mockRestore();
    try { texture.destroy(true); } catch {}
    jest.useRealTimers();
  });

  const tick = (elapsedMS: number) => {
    ticker.elapsedMS = elapsedMS;
    callbacks.forEach((callback) => callback(ticker));
  };

  test('uses one small source texture and preserves the accepted board geometry', () => {
    const geometry = getFlowerBouncyDisplayGeometry();
    expect(geometry.restingArtworkWidth).toBe(128);
    expect(geometry.restingArtworkHeight).toBe(128);
    expect(geometry.width).toBeCloseTo(188.9996, 4);
    expect(geometry.height).toBeCloseTo(188.9996, 4);
    const bytes = fs.readFileSync(path.resolve(process.cwd(), FLOWER_BOUNCY_TEXTURE_URL));
    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe('7476fb3784b8279a7a54f280bfde60d63bc07e21beb40512eafcad92f3164239');
    expect(bytes.byteLength).toBeLessThan(50_000);
  });

  test('reproduces the exact authored 1.6-second SVG key poses', () => {
    expect(FLOWER_BOUNCY_CYCLE_MS).toBe(1600);
    expect(getFlowerBouncyPose(0)).toEqual({
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotationDegrees: 0,
    });
    expect(getFlowerBouncyPose(1600 * 0.15)).toEqual({
      translateY: 0,
      scaleX: 1.08,
      scaleY: 0.87,
      rotationDegrees: -4,
    });
    expect(getFlowerBouncyPose(1600 * 0.43)).toMatchObject({
      translateY: -10,
      rotationDegrees: -20,
    });
    expect(getFlowerBouncyPose(1600 * 0.69).rotationDegrees).toBe(20);
    expect(getFlowerBouncyPose(1600)).toEqual(getFlowerBouncyPose(0));
  });

  test('owns only the exact Flower registry variant', () => {
    expect(isFlowerBouncyTile({ special: 'wild-tnt', _ccSpecialDiceVariant: 'flower' })).toBe(true);
    expect(isFlowerBouncyTile({ special: 'wild-tnt' })).toBe(false);
    expect(isFlowerBouncyTile({ special: 'wild-juice', _ccSpecialDiceVariant: 'robo-cube' })).toBe(false);
  });

  test('matches the prior independent-track sampler across the authored SVG cycle and key boundaries', () => {
    const svg = new DOMParser().parseFromString(
      fs.readFileSync(path.resolve(process.cwd(), 'assets/shop/bush/flower.svg'), 'utf8'),
      'image/svg+xml',
    );
    const coordinate = (t: number, first: number, second: number) => {
      const inverse = 1 - t;
      return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
    };
    const tracks = ['translate', 'scale', 'rotate'].map((type) => {
      const node = svg.querySelector(`animateTransform[type="${type}"]`)!;
      return {
        times: node.getAttribute('keyTimes')!.split(';').map(Number),
        values: node.getAttribute('values')!.split(';').map(value => value.trim().split(/\s+/).map(Number)),
        splines: node.getAttribute('keySplines')!.split(';').map(value => value.trim().split(/\s+/).map(Number)),
      };
    });
    const sample = (track: typeof tracks[number], axis: number, progress: number) => {
      if (progress <= track.times[0]) return track.values[0][axis];
      let interval = 0;
      while (interval + 1 < track.times.length && progress > track.times[interval + 1]) interval += 1;
      const local = (progress - track.times[interval]) / (track.times[interval + 1] - track.times[interval]);
      const spline = track.splines[interval];
      let low = 0, high = 1;
      for (let i = 0; i < 18; i++) {
        const middle = (low + high) / 2;
        if (coordinate(middle, spline[0], spline[2]) < local) low = middle;
        else high = middle;
      }
      const eased = local <= 0 ? 0 : local >= 1 ? 1 : coordinate((low + high) / 2, spline[1], spline[3]);
      return track.values[interval][axis] + (track.values[interval + 1][axis] - track.values[interval][axis]) * eased;
    };
    const times = [0, -10, 1600, 3200, ...Array.from({ length: 230 }, (_, i) => i * 7)];
    tracks.forEach(track => track.times.forEach(time => {
      times.push(time * 1600 - 0.000001, time * 1600, time * 1600 + 0.000001);
    }));
    times.forEach(time => {
      const progress = (Math.max(0, time) % 1600) / 1600;
      expect(getFlowerBouncyPose(time)).toEqual({
        translateY: sample(tracks[0], 1, progress),
        scaleX: sample(tracks[1], 0, progress),
        scaleY: sample(tracks[1], 1, progress),
        rotationDegrees: sample(tracks[2], 0, progress),
      });
    });
  });

  test.each(['tile', 'variant', 'base', 'host'])('releases an owner invalidated during loading: %s', async (invalidated) => {
    let resolveLoad!: (value: Texture) => void;
    loadSpy.mockImplementationOnce(() => new Promise((resolve) => { resolveLoad = resolve as any; }) as any);
    const { tile, base, rotG } = makeTile();
    const controller = startFlowerBouncyArtwork(tile) as any;
    if (invalidated === 'tile') tile.destroyed = true;
    if (invalidated === 'variant') tile._ccSpecialDiceVariant = null;
    if (invalidated === 'base') base.destroy();
    if (invalidated === 'host') rotG.destroy();
    resolveLoad(texture);
    await flush();
    expect(controller.disposed).toBe(true);
    expect(getFlowerBouncyRuntimeStats()).toMatchObject({ controllers: 0, tickerAttached: false });
    expect(ticker.add).not.toHaveBeenCalled();
  });

  test('shares one source while every Flower keeps a separate timeline', async () => {
    const first = makeTile();
    const second = makeTile();
    const firstController = startFlowerBouncyArtwork(first.tile) as any;
    const secondController = startFlowerBouncyArtwork(second.tile) as any;
    await flush();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith(FLOWER_BOUNCY_TEXTURE_URL);
    expect(firstController.artwork.texture.source).toBe(secondController.artwork.texture.source);
    expect(firstController.canvas.parent?.label).toBe('ANIMATED_DICE_HUD_FOREGROUND');
    expect(firstController.canvas.parent?.zIndex).toBe(10_001);
    expect(firstController.running).toBe(true);
    expect(secondController.running).toBe(false);
    expect(first.base.renderable).toBe(false);
    expect(second.base.renderable).toBe(true);
    expect(ticker.add).toHaveBeenCalledTimes(1);

    tick(secondController.phaseLease.delayMs);
    jest.advanceTimersByTime(secondController.phaseLease.delayMs);
    tick(100);
    expect(secondController.running).toBe(true);
    expect(firstController.elapsedMs).not.toBe(secondController.elapsedMs);

    stopFlowerBouncyArtwork(first.tile);
    stopFlowerBouncyArtwork(second.tile);
    expect(first.base.renderable).toBe(true);
    expect(second.base.renderable).toBe(true);
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    expect(getFlowerBouncyRuntimeStats()).toMatchObject({ controllers: 0, tickerAttached: false });
  });

  test('uses the static fallback during drag and leaves Pixi pollen under its original owner', async () => {
    const { tile, base } = makeTile();
    const pollen = { renderable: true };
    tile._flowerPollenParticles = new Set([pollen]);
    const controller = startFlowerBouncyArtwork(tile) as any;
    await flush();

    expect(controller.canvas.renderable).toBe(true);
    expect(base.renderable).toBe(false);
    expect(pollen.renderable).toBe(true);

    expect(setFlowerBouncyArtworkDragging(tile, true)).toBe(true);
    expect(controller.canvas.renderable).toBe(false);
    expect(base.renderable).toBe(true);
    expect(pollen.renderable).toBe(true);

    expect(setFlowerBouncyArtworkDragging(tile, false)).toBe(true);
    expect(controller.canvas.renderable).toBe(true);
    expect(base.renderable).toBe(false);
    expect(pollen.renderable).toBe(true);
  });
});
