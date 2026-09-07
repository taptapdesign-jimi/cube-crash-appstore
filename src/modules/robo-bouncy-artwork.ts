import { Assets, type Texture } from 'pixi.js';
import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.ts';
import {
  isUsablePixiImageTexture,
  pinPixiImageTexture,
} from '../utils/pixi-image-texture-health.ts';
import {
  acquireAnimatedSpecialArtworkLayer,
  type AnimatedSpecialArtworkFrame,
  type AnimatedSpecialArtworkLayerLease,
} from './animated-special-artwork-layer.ts';
import {
  acquireAnimatedSvgPhase,
  type AnimatedSvgPhaseLease,
} from './animated-svg-phase-scheduler.ts';

export const ROBO_BOUNCY_SVG_URL = './assets/shop/robo/robo-bouncy.svg';
export const ROBO_BOUNCY_VIEWBOX = Object.freeze({ width: 390, height: 440 });
export const ROBO_BOUNCY_REST_ART = Object.freeze({ centerX: 195, centerY: 239, size: 256 });
export const ROBO_BOUNCY_DISPLAY_SIZE = 128;
export const ROBO_BOUNCY_DRAG_Z_INDEX = 12001;
export const ROBO_BOUNCY_CYCLE_MS = 2400;

const DISPLAY_SCALE = ROBO_BOUNCY_DISPLAY_SIZE / ROBO_BOUNCY_REST_ART.size;
const DISPLAY_WIDTH = ROBO_BOUNCY_VIEWBOX.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = ROBO_BOUNCY_VIEWBOX.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = ROBO_BOUNCY_REST_ART.centerX / ROBO_BOUNCY_VIEWBOX.width;
const DISPLAY_ANCHOR_Y = ROBO_BOUNCY_REST_ART.centerY / ROBO_BOUNCY_VIEWBOX.height;
const PRELOAD_BATCH_SIZE = 3;

type RoboBouncyController = {
  tile: any;
  base: any;
  host: any;
  wrapper: HTMLDivElement;
  image: HTMLImageElement;
  originalTexture: Texture | null;
  dragTexture: Texture | null;
  paintedWidth: number;
  paintedHeight: number;
  baseRenderable: boolean;
  dragging: boolean;
  ready: boolean;
  disposed: boolean;
  phaseLease: AnimatedSvgPhaseLease | null;
};

const controllers = new Map<any, RoboBouncyController>();
let runtimeLease: AnimatedSpecialArtworkLayerLease | null = null;

export function isRoboBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'robo-cube';
}

export function getRoboBouncyDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: ROBO_BOUNCY_REST_ART.size * DISPLAY_SCALE,
    restingArtworkHeight: ROBO_BOUNCY_REST_ART.size * DISPLAY_SCALE,
  };
}

function isPixiBranchVisible(displayObject: any): boolean {
  let current = displayObject;
  while (current) {
    if (current.destroyed || current.visible === false || current.renderable === false) return false;
    if (typeof current.alpha === 'number' && current.alpha <= 0.001) return false;
    current = current.parent;
  }
  return true;
}

function getPixiBranchAlpha(displayObject: any): number {
  let alpha = 1;
  let current = displayObject;
  while (current) {
    if (typeof current.alpha === 'number') alpha *= current.alpha;
    current = current.parent;
  }
  return Math.max(0, Math.min(1, alpha));
}

function restoreOriginalTexture(controller: RoboBouncyController): void {
  const { base, dragTexture, originalTexture, paintedWidth, paintedHeight } = controller;
  if (!base || base.destroyed || !originalTexture || base.texture !== dragTexture) return;
  base.texture = originalTexture;
  base.width = paintedWidth;
  base.height = paintedHeight;
  applyGameplayTextureFiltering(base.texture);
}

function paintDragFallback(controller: RoboBouncyController): void {
  const { base, dragTexture, paintedWidth, paintedHeight } = controller;
  if (!base || base.destroyed || !dragTexture || !isUsablePixiImageTexture(dragTexture)) return;
  base.texture = dragTexture;
  base.width = paintedWidth;
  base.height = paintedHeight;
  applyGameplayTextureFiltering(base.texture);
}

function disposeController(controller: RoboBouncyController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccRoboBouncyArtwork === controller) {
    delete controller.tile._ccRoboBouncyArtwork;
  }
  controller.phaseLease?.release();
  controller.phaseLease = null;
  try {
    controller.image.onload = null;
    controller.image.onerror = null;
    controller.wrapper.remove();
  } catch {}
  restoreOriginalTexture(controller);
  if (controller.base && !controller.base.destroyed) {
    try { controller.base.renderable = controller.baseRenderable; } catch {}
  }
  if (controllers.size === 0 && runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

function syncController(controller: RoboBouncyController, frame: AnimatedSpecialArtworkFrame): void {
  const { tile, base, host, wrapper } = controller;
  const { canvasRect, rootRect, screenWidth, screenHeight, canvasOpacity } = frame;
  if (
    controller.disposed
    || !tile
    || tile.destroyed
    || !base
    || base.destroyed
    || !host
    || host.destroyed
    || !isRoboBouncyTile(tile)
  ) {
    disposeController(controller);
    return;
  }

  if (controller.dragging) {
    wrapper.style.visibility = 'hidden';
    try { base.renderable = true; } catch {}
    paintDragFallback(controller);
    return;
  }

  const visible = controller.ready
    && base.visible !== false
    && isPixiBranchVisible(host)
    && canvasRect.width > 0
    && canvasRect.height > 0;
  if (!visible) {
    try { base.renderable = controller.baseRenderable; } catch {}
    wrapper.style.visibility = 'hidden';
    return;
  }

  const transform = host.worldTransform;
  if (!transform) {
    wrapper.style.visibility = 'hidden';
    return;
  }
  const scaleX = canvasRect.width / Math.max(1, screenWidth);
  const scaleY = canvasRect.height / Math.max(1, screenHeight);
  const anchorOffsetX = DISPLAY_WIDTH * DISPLAY_ANCHOR_X;
  const anchorOffsetY = DISPLAY_HEIGHT * DISPLAY_ANCHOR_Y;
  const a = transform.a * scaleX;
  const b = transform.b * scaleY;
  const c = transform.c * scaleX;
  const d = transform.d * scaleY;
  const e = canvasRect.left - rootRect.left
    + (transform.tx - transform.a * anchorOffsetX - transform.c * anchorOffsetY) * scaleX;
  const f = canvasRect.top - rootRect.top
    + (transform.ty - transform.b * anchorOffsetX - transform.d * anchorOffsetY) * scaleY;

  restoreOriginalTexture(controller);
  try { base.renderable = false; } catch {}
  wrapper.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  wrapper.style.opacity = String(getPixiBranchAlpha(base) * canvasOpacity);
  wrapper.style.zIndex = String(Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0);
  wrapper.style.visibility = 'visible';
}

function updateRoboBouncyArtwork(frame: AnimatedSpecialArtworkFrame): void {
  controllers.forEach((controller) => syncController(controller, frame));
}

function ensureRuntimeLease(): AnimatedSpecialArtworkLayerLease | null {
  if (!runtimeLease) runtimeLease = acquireAnimatedSpecialArtworkLayer(updateRoboBouncyArtwork);
  return runtimeLease;
}

async function warmFinaleInBoundedBatches(controller: RoboBouncyController, sources: string[]): Promise<void> {
  for (let index = 0; index < sources.length && !controller.disposed; index += PRELOAD_BATCH_SIZE) {
    await Promise.allSettled(
      sources.slice(index, index + PRELOAD_BATCH_SIZE).map((source) => Assets.load(source)),
    );
  }
}

function createController(
  tile: any,
  base: any,
  host: any,
  root: HTMLDivElement,
  dragTextureSource: string | null,
  finalePreloadSources: string[],
): RoboBouncyController {
  const wrapper = document.createElement('div');
  wrapper.className = 'robo-bouncy-artwork';
  Object.assign(wrapper.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${DISPLAY_WIDTH}px`,
    height: `${DISPLAY_HEIGHT}px`,
    overflow: 'hidden',
    pointerEvents: 'none',
    transformOrigin: '0 0',
    visibility: 'hidden',
    willChange: 'transform',
  });

  const image = new Image();
  image.alt = '';
  image.draggable = false;
  image.decoding = 'async';
  image.setAttribute('aria-hidden', 'true');
  Object.assign(image.style, {
    position: 'absolute',
    inset: '0',
    width: `${DISPLAY_WIDTH}px`,
    height: `${DISPLAY_HEIGHT}px`,
    maxWidth: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
  });
  wrapper.appendChild(image);
  root.appendChild(wrapper);

  const controller: RoboBouncyController = {
    tile,
    base,
    host,
    wrapper,
    image,
    originalTexture: base.texture ?? null,
    dragTexture: null,
    paintedWidth: base.width,
    paintedHeight: base.height,
    baseRenderable: base.renderable !== false,
    dragging: false,
    ready: false,
    disposed: false,
    phaseLease: null,
  };
  image.onload = () => {
    if (controller.disposed || !isRoboBouncyTile(tile)) return;
    controller.ready = true;
    runtimeLease?.requestSync();
    void warmFinaleInBoundedBatches(controller, finalePreloadSources);
  };
  image.onerror = () => {
    controller.ready = false;
    if (controller.dragging) paintDragFallback(controller);
    else restoreOriginalTexture(controller);
    try { base.renderable = controller.baseRenderable; } catch {}
    wrapper.style.visibility = 'hidden';
  };
  controller.phaseLease = acquireAnimatedSvgPhase(
    ROBO_BOUNCY_SVG_URL,
    ROBO_BOUNCY_CYCLE_MS,
    [{ image, url: ROBO_BOUNCY_SVG_URL }],
  );

  if (dragTextureSource) {
    void Assets.load(dragTextureSource)
      .then((texture) => {
        if (controller.disposed || !isUsablePixiImageTexture(texture)) return;
        controller.dragTexture = texture;
        pinPixiImageTexture(texture);
        if (controller.dragging) paintDragFallback(controller);
      })
      .catch(() => {
        // The canonical first Robo frame remains a safe drag fallback.
      });
  }
  return controller;
}

export function startRoboBouncyArtwork(
  tile: any,
  idleFrameSources: string[] = [],
  finalePreloadSources: string[] = [],
): RoboBouncyController | null {
  if (!isRoboBouncyTile(tile) || tile.destroyed) {
    stopRoboBouncyArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccRoboBouncyArtwork;
  if (existing && !existing.disposed) {
    ensureRuntimeLease()?.requestSync();
    return existing;
  }
  const base = tile.base;
  const host = tile.rotG || tile;
  if (!base || base.destroyed || !host || host.destroyed) return null;
  const lease = ensureRuntimeLease();
  if (!lease) return null;
  const dragTextureSource = idleFrameSources[1] ?? idleFrameSources[0] ?? null;
  const controller = createController(
    tile,
    base,
    host,
    lease.root,
    dragTextureSource,
    finalePreloadSources,
  );
  controllers.set(tile, controller);
  tile._ccRoboBouncyArtwork = controller;
  lease.requestSync();
  return controller;
}

export function stopRoboBouncyArtwork(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccRoboBouncyArtwork;
  if (controller) disposeController(controller);
}

export function setRoboBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = controllers.get(tile) || tile?._ccRoboBouncyArtwork;
  if (!controller || controller.disposed || !isRoboBouncyTile(tile)) return false;
  controller.dragging = dragging;
  controller.wrapper.style.zIndex = String(
    dragging ? ROBO_BOUNCY_DRAG_Z_INDEX : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  if (dragging) {
    controller.wrapper.style.visibility = 'hidden';
    try { controller.base.renderable = true; } catch {}
    paintDragFallback(controller);
  } else {
    restoreOriginalTexture(controller);
    runtimeLease?.requestSync();
  }
  return true;
}

export function destroyRoboBouncyArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  if (runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

export function getRoboBouncyRuntimeStats() {
  let ready = 0;
  controllers.forEach((controller) => {
    if (controller.ready && !controller.disposed) ready += 1;
  });
  return {
    controllers: controllers.size,
    ready,
    runtimeAttached: runtimeLease !== null,
    overlayAttached: runtimeLease?.root.isConnected === true,
  };
}
