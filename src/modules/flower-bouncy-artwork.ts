import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import { STATE } from './app-state.ts';
import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import {
  acquireAnimatedTimelinePhase,
  type AnimatedSvgPhaseLease,
} from './animated-svg-phase-scheduler.ts';
import { releaseAnimatedSpecialArtworkFamily } from './animated-special-artwork-mode.ts';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.ts';
import { reloadPixiImageTexture } from '../utils/pixi-image-texture-health.ts';

// flower.svg remains the authored source of truth. Its artwork is one bitmap
// under three spline transforms, so reproducing those transforms in Pixi is
// both more exact and far smaller than baking a full frame atlas.
export const FLOWER_BOUNCY_SVG_URL = './assets/shop/bush/flower.svg';
export const FLOWER_BOUNCY_TEXTURE_URL = './assets/shop/bush/flower-pixi-source.png';
export const FLOWER_BOUNCY_VIEWBOX = Object.freeze({ x: 0, y: 0, width: 160, height: 160 });
export const FLOWER_BOUNCY_REST_ART = Object.freeze({ centerX: 79.33, centerY: 74.78, size: 108.36 });
export const FLOWER_BOUNCY_DISPLAY_SIZE = 128;
export const FLOWER_BOUNCY_DRAG_Z_INDEX = 12001;
export const FLOWER_BOUNCY_CYCLE_MS = 1600;

const DISPLAY_SCALE = FLOWER_BOUNCY_DISPLAY_SIZE / FLOWER_BOUNCY_REST_ART.size;
const DISPLAY_WIDTH = FLOWER_BOUNCY_VIEWBOX.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = FLOWER_BOUNCY_VIEWBOX.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = FLOWER_BOUNCY_REST_ART.centerX / FLOWER_BOUNCY_VIEWBOX.width;
const DISPLAY_ANCHOR_Y = FLOWER_BOUNCY_REST_ART.centerY / FLOWER_BOUNCY_VIEWBOX.height;

type Spline = readonly [number, number, number, number];
type FlowerPose = {
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotationDegrees: number;
};

type FlowerBouncyController = {
  tile: any;
  base: any;
  host: any;
  canvas: Container | null;
  animatedRoot: Container | null;
  scalePivot: Container | null;
  rotationPivot: Container | null;
  artwork: Sprite | null;
  originalRenderable: boolean;
  dragging: boolean;
  ready: boolean;
  running: boolean;
  disposed: boolean;
  elapsedMs: number;
  phaseLease: AnimatedSvgPhaseLease | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
};

const TRANSLATE_TIMES = [0, 0.15, 0.43, 0.79, 0.87, 0.95, 1] as const;
const TRANSLATE_VALUES = [0, 0, -10, 0, -2, 0, 0] as const;
const TRANSLATE_SPLINES: readonly Spline[] = [
  [0.42, 0, 0.58, 1], [0.18, 0.65, 0.35, 1], [0.45, 0, 0.8, 0.4],
  [0.18, 0.65, 0.35, 1], [0.4, 0, 0.8, 0.6], [0.42, 0, 0.58, 1],
];
const SCALE_TIMES = [0, 0.15, 0.25, 0.39, 0.72, 0.8, 0.89, 1] as const;
const SCALE_X_VALUES = [1, 1.08, 0.95, 1, 1, 1.065, 0.985, 1] as const;
const SCALE_Y_VALUES = [1, 0.87, 1.07, 1, 1, 0.91, 1.025, 1] as const;
const SCALE_SPLINES: readonly Spline[] = [
  [0.42, 0, 0.58, 1], [0.18, 0.65, 0.35, 1], [0.42, 0, 0.58, 1],
  [0.42, 0, 0.58, 1], [0.42, 0, 0.58, 1], [0.18, 0.65, 0.35, 1],
  [0.42, 0, 0.58, 1],
];
const ROTATION_TIMES = [0, 0.15, 0.43, 0.69, 0.95, 1] as const;
const ROTATION_VALUES = [0, -4, -20, 20, 0, 0] as const;
const ROTATION_SPLINES: readonly Spline[] = [
  [0.42, 0, 0.58, 1], [0.18, 0.65, 0.35, 1], [0.42, 0, 0.58, 1],
  [0.25, 0.1, 0.5, 1], [0.42, 0, 0.58, 1],
];

const controllers = new Map<any, FlowerBouncyController>();
let sharedTexture: Texture | null = null;
let sharedTexturePromise: Promise<Texture> | null = null;
let runtimeTicker: any = null;

function cubicCoordinate(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
}

function solveSplineProgress(progress: number, spline: Spline): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 18; index += 1) {
    const middle = (low + high) / 2;
    if (cubicCoordinate(middle, spline[0], spline[2]) < progress) low = middle;
    else high = middle;
  }
  return cubicCoordinate((low + high) / 2, spline[1], spline[3]);
}

function sampleSplineTrack(
  progress: number,
  times: readonly number[],
  values: readonly number[],
  splines: readonly Spline[],
): number {
  if (progress <= times[0]) return values[0];
  if (progress >= times[times.length - 1]) return values[values.length - 1];
  let interval = 0;
  while (interval + 1 < times.length && progress > times[interval + 1]) interval += 1;
  const start = times[interval];
  const end = times[interval + 1];
  const local = solveSplineProgress((progress - start) / (end - start), splines[interval]);
  return values[interval] + (values[interval + 1] - values[interval]) * local;
}

export function getFlowerBouncyPose(elapsedMs: number): FlowerPose {
  const safeElapsed = Math.max(0, Number(elapsedMs) || 0) % FLOWER_BOUNCY_CYCLE_MS;
  const progress = safeElapsed / FLOWER_BOUNCY_CYCLE_MS;
  return {
    translateY: sampleSplineTrack(progress, TRANSLATE_TIMES, TRANSLATE_VALUES, TRANSLATE_SPLINES),
    scaleX: sampleSplineTrack(progress, SCALE_TIMES, SCALE_X_VALUES, SCALE_SPLINES),
    scaleY: sampleSplineTrack(progress, SCALE_TIMES, SCALE_Y_VALUES, SCALE_SPLINES),
    rotationDegrees: sampleSplineTrack(progress, ROTATION_TIMES, ROTATION_VALUES, ROTATION_SPLINES),
  };
}

export function isFlowerBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'flower';
}

export function getFlowerBouncyDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: FLOWER_BOUNCY_DISPLAY_SIZE,
    restingArtworkHeight: FLOWER_BOUNCY_DISPLAY_SIZE,
  };
}

function isPixiBranchVisible(displayObject: any): boolean {
  for (let current = displayObject; current; current = current.parent) {
    if (current.destroyed || current.visible === false || current.renderable === false) return false;
    if (typeof current.alpha === 'number' && current.alpha <= 0.001) return false;
  }
  return true;
}

async function loadSharedTexture(): Promise<Texture> {
  if (sharedTexture && !sharedTexture.destroyed) return sharedTexture;
  if (sharedTexturePromise) return sharedTexturePromise;
  sharedTexturePromise = (async () => {
    let texture = (Assets.get(FLOWER_BOUNCY_TEXTURE_URL) || null) as Texture | null;
    if (!texture || texture.destroyed || Number(texture.source?.width || 0) <= 1) {
      try {
        texture = await Assets.load<Texture>(FLOWER_BOUNCY_TEXTURE_URL);
      } catch {
        texture = await reloadPixiImageTexture(FLOWER_BOUNCY_TEXTURE_URL);
      }
    }
    if (!texture || texture.destroyed) throw new Error('Flower Pixi texture did not produce a live texture');
    applyGameplayTextureFiltering(texture);
    sharedTexture = texture;
    return texture;
  })().then((texture) => {
    sharedTexturePromise = null;
    return texture;
  }).catch((error) => {
    sharedTexturePromise = null;
    throw error;
  });
  return sharedTexturePromise;
}

function getLiveTicker(): any {
  return STATE.app?.ticker
    || (globalThis as any)?.window?.CC?.getPixiApp?.()?.ticker
    || (globalThis as any)?.window?.__PIXI_APP__?.ticker
    || (globalThis as any)?.window?.app?.ticker
    || null;
}

function detachTicker(): void {
  if (!runtimeTicker) return;
  try { runtimeTicker.remove(updateAllControllers); } catch {}
  runtimeTicker = null;
}

function ensureTicker(fallback?: any): void {
  const next = fallback?.add && fallback?.remove ? fallback : getLiveTicker();
  if (!next || runtimeTicker === next) return;
  detachTicker();
  runtimeTicker = next;
  runtimeTicker.add(updateAllControllers);
}

function findTileTicker(tile: any): any {
  return tile?._ccPixiApp?.ticker || tile?.parent?._ccPixiApp?.ticker || getLiveTicker();
}

function disposeController(controller: FlowerBouncyController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccFlowerBouncyArtwork === controller) delete controller.tile._ccFlowerBouncyArtwork;
  controller.phaseLease?.release();
  controller.phaseLease = null;
  if (controller.retryTimer !== null) clearTimeout(controller.retryTimer);
  controller.retryTimer = null;
  if (controller.canvas) {
    try { controller.canvas.parent?.removeChild(controller.canvas); } catch {}
    try { controller.canvas.destroy({ children: true, texture: false, textureSource: false }); } catch {}
  }
  controller.canvas = null;
  controller.animatedRoot = null;
  controller.scalePivot = null;
  controller.rotationPivot = null;
  controller.artwork = null;
  if (controller.base && !controller.base.destroyed) controller.base.renderable = controller.originalRenderable;
  if (controllers.size === 0) detachTicker();
}

function updateController(controller: FlowerBouncyController, deltaMs: number): void {
  const { tile, base, host, canvas, animatedRoot, scalePivot, rotationPivot, artwork } = controller;
  if (controller.disposed || tile?.destroyed || base?.destroyed || host?.destroyed || !isFlowerBouncyTile(tile)) {
    disposeController(controller);
    return;
  }
  if (!canvas || !animatedRoot || !scalePivot || !rotationPivot || !artwork || !controller.ready || !controller.running) {
    base.renderable = controller.originalRenderable;
    if (canvas) canvas.renderable = false;
    return;
  }
  controller.elapsedMs = (controller.elapsedMs + Math.max(0, deltaMs)) % FLOWER_BOUNCY_CYCLE_MS;
  const visible = !controller.dragging && base.visible !== false && isPixiBranchVisible(host);
  canvas.visible = visible;
  canvas.renderable = visible;
  if (!visible) {
    base.renderable = controller.originalRenderable;
    return;
  }
  const pose = getFlowerBouncyPose(controller.elapsedMs);
  animatedRoot.y = pose.translateY;
  scalePivot.scale.set(pose.scaleX, pose.scaleY);
  rotationPivot.rotation = pose.rotationDegrees * Math.PI / 180;
  canvas.alpha = typeof base.alpha === 'number' ? base.alpha : 1;
  artwork.tint = base.tint ?? 0xFFFFFF;
  base.renderable = false;
}

function updateAllControllers(ticker?: any): void {
  const rawDeltaMs = Number(ticker?.elapsedMS);
  const deltaMs = Number.isFinite(rawDeltaMs) && rawDeltaMs >= 0 ? Math.min(100, rawDeltaMs) : 1000 / 60;
  Array.from(controllers.values()).forEach((controller) => updateController(controller, deltaMs));
}

function mountFlowerArtwork(controller: FlowerBouncyController, retry = 0): void {
  void loadSharedTexture().then((texture) => {
    const { tile, base, host } = controller;
    if (controller.disposed || tile.destroyed || !isFlowerBouncyTile(tile)) return;
    const canvas = new Container();
    canvas.label = 'flower-bouncy-pixi';
    canvas.eventMode = 'none';
    canvas.position.set(-FLOWER_BOUNCY_REST_ART.centerX * DISPLAY_SCALE, -FLOWER_BOUNCY_REST_ART.centerY * DISPLAY_SCALE);
    canvas.scale.set(DISPLAY_SCALE);
    canvas.zIndex = (Number(base.zIndex) || 0) + 0.01;

    const animatedRoot = new Container();
    const scalePivot = new Container();
    scalePivot.position.set(80, 117);
    const rotationPivot = new Container();
    rotationPivot.position.set(0, -42);
    const artwork = new Sprite(texture);
    artwork.label = 'flower-bouncy-art';
    artwork.eventMode = 'none';
    artwork.position.set(-80 + 25.15, -75 + 20.6);
    artwork.width = FLOWER_BOUNCY_REST_ART.size;
    artwork.height = FLOWER_BOUNCY_REST_ART.size;
    rotationPivot.addChild(artwork);
    scalePivot.addChild(rotationPivot);
    animatedRoot.addChild(scalePivot);
    canvas.addChild(animatedRoot);
    canvas.visible = false;
    canvas.renderable = false;
    host.sortableChildren = true;
    host.addChild(canvas);

    controller.canvas = canvas;
    controller.animatedRoot = animatedRoot;
    controller.scalePivot = scalePivot;
    controller.rotationPivot = rotationPivot;
    controller.artwork = artwork;
    controller.ready = true;
    ensureTicker(findTileTicker(tile));
    controller.phaseLease = acquireAnimatedTimelinePhase('flower-bouncy-pixi', FLOWER_BOUNCY_CYCLE_MS, [{
      start: () => {
        if (controller.disposed || !controller.ready) return;
        controller.running = true;
        controller.elapsedMs = 0;
        updateController(controller, 0);
      },
    }]);
  }).catch(() => {
    if (controller.disposed) return;
    if (retry === 0) {
      controller.retryTimer = setTimeout(() => {
        controller.retryTimer = null;
        if (!controller.disposed) mountFlowerArtwork(controller, 1);
      }, 750);
      return;
    }
    disposeController(controller);
  });
}

export function startFlowerBouncyArtwork(tile: any): FlowerBouncyController | null {
  if (!isFlowerBouncyTile(tile) || tile.destroyed) {
    stopFlowerBouncyArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccFlowerBouncyArtwork;
  if (existing && !existing.disposed) {
    existing.dragging = false;
    ensureTicker(findTileTicker(tile));
    updateController(existing, 0);
    return existing;
  }
  const base = tile.base;
  const host = tile.rotG || tile;
  if (!base || base.destroyed || !host || host.destroyed) return null;
  const controller: FlowerBouncyController = {
    tile,
    base,
    host,
    canvas: null,
    animatedRoot: null,
    scalePivot: null,
    rotationPivot: null,
    artwork: null,
    originalRenderable: base.renderable !== false,
    dragging: false,
    ready: false,
    running: false,
    disposed: false,
    elapsedMs: 0,
    phaseLease: null,
    retryTimer: null,
  };
  controllers.set(tile, controller);
  tile._ccFlowerBouncyArtwork = controller;
  mountFlowerArtwork(controller);
  return controller;
}

export function stopFlowerBouncyArtwork(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccFlowerBouncyArtwork;
  if (controller) disposeController(controller);
}

export function setFlowerBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = controllers.get(tile) || tile?._ccFlowerBouncyArtwork;
  if (!controller || controller.disposed || !isFlowerBouncyTile(tile)) return false;
  controller.dragging = dragging;
  updateController(controller, 0);
  return true;
}

export function destroyFlowerBouncyArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  releaseAnimatedSpecialArtworkFamily('flower');
  detachTicker();
}

export function getFlowerBouncyRuntimeStats() {
  const values = Array.from(controllers.values());
  return {
    controllers: controllers.size,
    ready: values.filter((controller) => controller.ready).length,
    running: values.filter((controller) => controller.running).length,
    sourceTextures: sharedTexture && !sharedTexture.destroyed ? 1 : 0,
    tickerAttached: runtimeTicker !== null,
  };
}
