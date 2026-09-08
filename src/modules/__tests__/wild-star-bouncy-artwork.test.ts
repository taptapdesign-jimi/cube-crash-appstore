/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import { applyWildSkinLocalCore } from '../app-core-wild-skin';
import { getAnimatedSpecialArtworkLayerStats } from '../animated-special-artwork-layer';
import {
  destroyWildStarBouncyArtworkRuntime,
  getWildStarBouncyDisplayGeometry,
  getWildStarBouncyRuntimeStats,
  isPlainWildStarBouncyTile,
  WILD_STAR_BOUNCY_DISPLAY_SIZE,
  WILD_STAR_BOUNCY_DRAG_Z_INDEX,
  WILD_STAR_BOUNCY_REST_ART,
} from '../wild-star-bouncy-artwork';
import {
  setSpecialDiceIdleDragging,
  startSpecialDiceIdleMotion,
  stopSpecialDiceIdleMotion,
} from '../special-dice-idle';
import { acquireGameplayDragForeground } from '../gameplay-drag-foreground-owner';

function makeTile(special = 'wild', variant?: string) {
  const base = new Sprite(Texture.WHITE);
  base.width = 128;
  base.height = 128;
  const rotG = new Container();
  rotG.addChild(base);
  const tile: any = {
    special,
    destroyed: false,
    zIndex: 7,
    base,
    rotG,
  };
  if (variant) tile._ccSpecialDiceVariant = variant;
  return { tile, base, rotG };
}

function attachOrbitSystem(tile: any, rotG: Container) {
  const container = new Container();
  container.renderable = true;
  const sprite = new Sprite(Texture.WHITE);
  sprite.width = 56;
  sprite.height = 56;
  sprite.x = 42;
  sprite.y = -18;
  sprite.rotation = 0.12;
  container.addChild(sprite);
  rotG.addChild(container);
  const system = {
    disposed: false,
    container,
    stars: [{ sprite }],
  };
  tile._wildStarSystem = system;
  return { system, container, sprite };
}

describe('Wild Star animated SVG board artwork', () => {
  beforeEach(() => {
    const host = document.createElement('div');
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 390,
      bottom: 844,
      width: 390,
      height: 844,
      toJSON: () => ({}),
    });
    document.body.appendChild(host);
    STATE.app = {
      canvas,
      renderer: { screen: { width: 390, height: 844 } },
      ticker: { add: jest.fn(), remove: jest.fn() },
    } as any;
  });

  afterEach(() => {
    destroyWildStarBouncyArtworkRuntime();
    STATE.app = null;
    document.body.replaceChildren();
  });

  test('maps the nominal authored star to the existing 128px footprint without cropping motion', () => {
    const geometry = getWildStarBouncyDisplayGeometry();
    expect(geometry.restingArtworkWidth).toBeCloseTo(WILD_STAR_BOUNCY_DISPLAY_SIZE, 8);
    expect(geometry.restingArtworkHeight).toBeCloseTo(WILD_STAR_BOUNCY_DISPLAY_SIZE, 8);
    expect(WILD_STAR_BOUNCY_REST_ART.centerX).toBe(260);
    expect(WILD_STAR_BOUNCY_REST_ART.centerY).toBeCloseTo(302.65, 8);
    expect(geometry.width).toBeGreaterThan(WILD_STAR_BOUNCY_DISPLAY_SIZE);
    expect(geometry.height).toBeGreaterThan(WILD_STAR_BOUNCY_DISPLAY_SIZE);
    expect(geometry.anchorX).toBeGreaterThan(0);
    expect(geometry.anchorX).toBeLessThan(1);
    expect(geometry.anchorY).toBeGreaterThan(0);
    expect(geometry.anchorY).toBeLessThan(1);
  });

  test('uses the supplied optimized two-second self-contained SMIL asset', () => {
    const svg = fs.readFileSync(
      path.resolve(process.cwd(), 'assets/shop/star/star.svg'),
      'utf8',
    );
    const animateCount = svg.match(/<animate(?=\s)/g)?.length ?? 0;
    const animateTransformCount = svg.match(/<animateTransform(?=\s)/g)?.length ?? 0;
    const embeddedPng = svg.match(/<image[^>]+href="data:image\/png;base64,([^"]+)"[^>]+id="star-art"/s)?.[1];

    expect(Buffer.byteLength(svg, 'utf8')).toBeLessThanOrEqual(250_000);
    expect(svg).toContain('viewBox="0 0 520 560"');
    expect(svg).toContain('transform="translate(260 465) scale(.85)"');
    expect(svg).toContain('x="-216" y="-407" width="432" height="432"');
    expect(svg).toContain('dur="2s"');
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).toContain('href="data:image/png;base64,');
    expect(animateCount).toBe(28);
    expect(animateTransformCount).toBe(34);
    expect(embeddedPng).toBeDefined();
    expect(Buffer.from(embeddedPng || '', 'base64')).toEqual(
      fs.readFileSync(path.resolve(process.cwd(), 'assets/wild@3x.png')),
    );
    expect(svg).not.toMatch(/<(?:script|foreignObject|filter)\b/);
  });

  test('preserves stars.svg as an unused asset and excludes it from runtime and preload paths', () => {
    const retiredUrl = './assets/shop/star/stars.svg';
    const artworkSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/wild-star-bouncy-artwork.ts'),
      'utf8',
    );
    const assetPreloaderSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/asset-preloader.ts'),
      'utf8',
    );
    const comprehensivePreloaderSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/utils/comprehensive-image-preloader.ts'),
      'utf8',
    );

    expect(fs.existsSync(path.resolve(process.cwd(), 'assets/shop/star/stars.svg'))).toBe(true);
    expect(artworkSource).not.toContain(retiredUrl);
    expect(assetPreloaderSource).not.toContain(retiredUrl);
    expect(comprehensivePreloaderSource).not.toContain(retiredUrl);
  });

  test('owns only the generic Wild Star and rejects registry-backed Star archetypes', () => {
    expect(isPlainWildStarBouncyTile({ special: 'wild' })).toBe(true);
    expect(isPlainWildStarBouncyTile({ special: 'wild', _ccSpecialDiceVariant: 'bee' })).toBe(false);
    expect(isPlainWildStarBouncyTile({ special: 'wild', _ccSpecialDiceVariant: 'kanta' })).toBe(false);
    expect(isPlainWildStarBouncyTile({ special: 'wild-juice' })).toBe(false);
    expect(isPlainWildStarBouncyTile({ special: 'wild-tnt' })).toBe(false);
  });

  test('deduplicates, mirrors the original Pixi orbit above star.svg, survives drag, and restores every fallback', () => {
    const { tile, base, rotG } = makeTile();
    const { container, sprite } = attachOrbitSystem(tile, rotG);

    startSpecialDiceIdleMotion(tile);
    const first = tile._ccWildStarBouncyArtwork;
    startSpecialDiceIdleMotion(tile);
    const second = tile._ccWildStarBouncyArtwork;
    expect(first).toBe(second);
    expect(base.renderable).toBe(true);

    (first as any).image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect(container.renderable).toBe(true);
    expect((first as any).image.style.visibility).toBe('visible');
    expect((first as any).orbitLayer.style.visibility).toBe('hidden');

    const orbitNode = (first as any).orbitNodes.get(sprite);
    expect(orbitNode).toBeDefined();
    expect(orbitNode.image.src).toContain('/assets/small-star.png');
    expect(orbitNode.image.srcset).toContain('/assets/small-star@3x.png 3x');
    orbitNode.image.onload(new Event('load'));
    expect(container.renderable).toBe(false);
    expect((first as any).image.style.zIndex).toBe('1');
    expect((first as any).image.style.visibility).not.toBe('hidden');
    expect((first as any).orbitLayer.style.zIndex).toBe('2');
    expect((first as any).orbitLayer.style.visibility).toBe('visible');
    expect(orbitNode.image.style.visibility).toBe('visible');
    expect(orbitNode.image.style.transform).toMatch(/^matrix\(/);
    expect((first as any).wrapper.querySelectorAll('img')).toHaveLength(2);
    expect(getWildStarBouncyRuntimeStats()).toMatchObject({
      controllers: 1,
      ready: 1,
      orbitBridged: 1,
      runtimeAttached: true,
      overlayAttached: true,
    });
    expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
    expect((first as any).wrapper.style.zIndex).toBe(String(WILD_STAR_BOUNCY_DRAG_Z_INDEX));

    stopSpecialDiceIdleMotion(tile);
    expect(base.renderable).toBe(true);
    expect(container.renderable).toBe(true);
    expect(tile._ccWildStarBouncyArtwork).toBeUndefined();
    expect(getWildStarBouncyRuntimeStats()).toEqual({
      controllers: 0,
      ready: 0,
      orbitBridged: 0,
      runtimeAttached: false,
      overlayAttached: false,
    });
  });

  test('keeps idle Wild Star live during another drag and portals only the owned Star', () => {
    const { tile, base } = makeTile();
    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccWildStarBouncyArtwork;
    (controller as any).image.onload(new Event('load'));
    expect(base.renderable).toBe(false);

    const releaseForeground = acquireGameplayDragForeground();
    try {
      expect((controller as any).wrapper.style.visibility).toBe('visible');
      expect(base.renderable).toBe(false);

      expect(setSpecialDiceIdleDragging(tile, true)).toBe(true);
      expect((controller as any).wrapper.parentElement?.className)
        .toBe('animated-special-artwork-drag-layer');
      expect((controller as any).wrapper.style.visibility).toBe('visible');
      expect(base.renderable).toBe(false);

      expect(setSpecialDiceIdleDragging(tile, false)).toBe(true);
      expect((controller as any).wrapper.parentElement?.className)
        .toBe('animated-special-artwork-layer');
      expect((controller as any).wrapper.style.visibility).toBe('visible');
      expect(base.renderable).toBe(false);
    } finally {
      releaseForeground();
    }
    expect((controller as any).wrapper.style.visibility).toBe('visible');
    expect(base.renderable).toBe(false);
  });

  test('keeps the static/Pixi fallbacks until both the main SVG and orbit paint are load-safe', () => {
    const { tile, base, rotG } = makeTile();
    const { container, sprite } = attachOrbitSystem(tile, rotG);
    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccWildStarBouncyArtwork;

    (controller as any).image.onerror(new Event('error'));
    expect(base.renderable).toBe(true);
    expect(container.renderable).toBe(true);

    (controller as any).image.onload(new Event('load'));
    expect(base.renderable).toBe(false);
    expect(container.renderable).toBe(true);
    const orbitNode = (controller as any).orbitNodes.get(sprite);
    expect(orbitNode).toBeDefined();

    orbitNode.image.onerror(new Event('error'));
    expect(base.renderable).toBe(false);
    expect(container.renderable).toBe(true);
    expect((controller as any).orbitLayer.style.visibility).toBe('hidden');

    orbitNode.image.onload(new Event('load'));
    expect(container.renderable).toBe(false);
    expect((controller as any).orbitLayer.style.visibility).toBe('visible');
  });

  test('a late SVG load cannot resurrect a disposed owner', () => {
    const { tile, base } = makeTile();
    startSpecialDiceIdleMotion(tile);
    const controller = tile._ccWildStarBouncyArtwork;
    const lateLoad = (controller as any).image.onload;

    stopSpecialDiceIdleMotion(tile);
    lateLoad(new Event('load'));

    expect(base.renderable).toBe(true);
    expect(tile._ccWildStarBouncyArtwork).toBeUndefined();
    expect(getAnimatedSpecialArtworkLayerStats()).toEqual({
      owners: 0,
      tickerAttached: false,
      overlayAttached: false,
    });
  });

  test('generic Wild skin skips the superseded Pixi shimmer but retains orbit ownership', () => {
    const { tile } = makeTile();
    const startWildShimmer = jest.fn();
    const startWildStars = jest.fn();
    applyWildSkinLocalCore(tile, {
      Assets: { get: () => Texture.WHITE },
      Texture,
      Rectangle,
      ASSET_WILD: './assets/wild.png',
      ASSET_WILD_MAGNET: './assets/wild-magnet.png',
      ASSET_WILD_JUICE: './assets/wild-juice.png',
      ASSET_WILD_TNT: './assets/shop/explosion pack/tnt.png',
      TILE: 128,
      startWildShimmer,
      startWildJuiceBubbles: jest.fn(),
      startWildStars,
      startMagnetIdleParticles: jest.fn(),
      startTntIdleParticles: jest.fn(),
      startTntIdleShake: jest.fn(),
      stopTntIdleParticles: jest.fn(),
      stopTntIdleShake: jest.fn(),
      trackAppAnimationFrame: jest.fn(),
      devWarn: jest.fn(),
    });

    expect(startWildShimmer).not.toHaveBeenCalled();
    expect(startWildStars).toHaveBeenCalledWith(tile);
    expect(tile._ccWildStarBouncyArtwork).toBeDefined();
  });
});
