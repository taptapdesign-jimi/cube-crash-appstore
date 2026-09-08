import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import {
  acquireAnimatedSpecialArtworkLayer,
  doesAnimatedSpecialArtworkOverlapGameplayDrag,
  installAnimatedSpecialArtworkOverlapFootprint,
  setAnimatedSpecialArtworkDragging,
  type AnimatedSpecialArtworkFrame,
  type AnimatedSpecialArtworkLayerLease,
} from './animated-special-artwork-layer.ts';
import {
  acquireAnimatedSvgPhase,
  type AnimatedSvgPhaseLease,
} from './animated-svg-phase-scheduler.ts';
import { releaseAnimatedSpecialArtworkFamily } from './animated-special-artwork-mode.ts';

export const MUSHROOM_BOUNCY_SVG_URL = './assets/shop/mushroom/mushroom.svg';
export const MUSHROOM_BOUNCY_VIEWBOX = Object.freeze({ x: -26, y: -34, width: 180, height: 180 });
export const MUSHROOM_BOUNCY_REST_ART = Object.freeze({ centerX: 64, centerY: 64, size: 128 });
export const MUSHROOM_BOUNCY_DISPLAY_SIZE = 128;
export const MUSHROOM_BOUNCY_DRAG_Z_INDEX = 12001;
export const MUSHROOM_BOUNCY_CYCLE_MS = 2000;

const DISPLAY_SCALE = MUSHROOM_BOUNCY_DISPLAY_SIZE / MUSHROOM_BOUNCY_REST_ART.size;
const DISPLAY_WIDTH = MUSHROOM_BOUNCY_VIEWBOX.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = MUSHROOM_BOUNCY_VIEWBOX.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = (
  MUSHROOM_BOUNCY_REST_ART.centerX - MUSHROOM_BOUNCY_VIEWBOX.x
) / MUSHROOM_BOUNCY_VIEWBOX.width;
const DISPLAY_ANCHOR_Y = (
  MUSHROOM_BOUNCY_REST_ART.centerY - MUSHROOM_BOUNCY_VIEWBOX.y
) / MUSHROOM_BOUNCY_VIEWBOX.height;

type MushroomBouncyController = {
  tile: any;
  base: any;
  host: any;
  wrapper: HTMLDivElement;
  image: HTMLImageElement;
  baseRenderable: boolean;
  dragging: boolean;
  ready: boolean;
  disposed: boolean;
  phaseLease: AnimatedSvgPhaseLease | null;
};

const controllers = new Map<any, MushroomBouncyController>();
let runtimeLease: AnimatedSpecialArtworkLayerLease | null = null;

export function isMushroomBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'mushroom';
}

export function getMushroomBouncyDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: MUSHROOM_BOUNCY_REST_ART.size * DISPLAY_SCALE,
    restingArtworkHeight: MUSHROOM_BOUNCY_REST_ART.size * DISPLAY_SCALE,
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

function disposeController(controller: MushroomBouncyController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccMushroomBouncyArtwork === controller) {
    delete controller.tile._ccMushroomBouncyArtwork;
  }
  controller.phaseLease?.release();
  controller.phaseLease = null;
  try {
    controller.image.onload = null;
    controller.image.onerror = null;
    controller.wrapper.remove();
  } catch {}
  if (controller.base && !controller.base.destroyed) {
    try { controller.base.renderable = controller.baseRenderable; } catch {}
  }
  if (controllers.size === 0 && runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

function syncController(
  controller: MushroomBouncyController,
  frame: AnimatedSpecialArtworkFrame,
): void {
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
    || !isMushroomBouncyTile(tile)
  ) {
    disposeController(controller);
    return;
  }

  if (
    frame.gameplayDragActive
    && !controller.dragging
    && doesAnimatedSpecialArtworkOverlapGameplayDrag(wrapper, frame.gameplayDragBounds)
  ) {
    wrapper.style.visibility = 'hidden';
    try { base.renderable = controller.baseRenderable; } catch {}
    return;
  }

  if (controller.dragging) {
    wrapper.style.visibility = 'hidden';
    try { base.renderable = true; } catch {}
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

  try { base.renderable = false; } catch {}
  wrapper.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  wrapper.style.opacity = String(getPixiBranchAlpha(base) * canvasOpacity);
  wrapper.style.zIndex = String(Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0);
  wrapper.style.visibility = 'visible';
}

function updateMushroomBouncyArtwork(frame: AnimatedSpecialArtworkFrame): void {
  controllers.forEach((controller) => syncController(controller, frame));
}

function ensureRuntimeLease(): AnimatedSpecialArtworkLayerLease | null {
  if (!runtimeLease) runtimeLease = acquireAnimatedSpecialArtworkLayer(updateMushroomBouncyArtwork);
  return runtimeLease;
}

function createController(
  tile: any,
  base: any,
  host: any,
  root: HTMLDivElement,
): MushroomBouncyController {
  const wrapper = document.createElement('div');
  wrapper.className = 'mushroom-bouncy-artwork';
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

  installAnimatedSpecialArtworkOverlapFootprint(wrapper, {
    left: (MUSHROOM_BOUNCY_REST_ART.centerX - MUSHROOM_BOUNCY_VIEWBOX.x - MUSHROOM_BOUNCY_REST_ART.size / 2) * DISPLAY_SCALE,
    top: (MUSHROOM_BOUNCY_REST_ART.centerY - MUSHROOM_BOUNCY_VIEWBOX.y - MUSHROOM_BOUNCY_REST_ART.size / 2) * DISPLAY_SCALE,
    width: MUSHROOM_BOUNCY_DISPLAY_SIZE,
    height: MUSHROOM_BOUNCY_DISPLAY_SIZE,
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

  const controller: MushroomBouncyController = {
    tile,
    base,
    host,
    wrapper,
    image,
    baseRenderable: base.renderable !== false,
    dragging: false,
    ready: false,
    disposed: false,
    phaseLease: null,
  };
  image.onload = () => {
    if (controller.disposed || !isMushroomBouncyTile(tile)) return;
    controller.ready = true;
    runtimeLease?.requestSync();
  };
  image.onerror = () => {
    controller.ready = false;
    try { base.renderable = controller.baseRenderable; } catch {}
    wrapper.style.visibility = 'hidden';
  };
  controller.phaseLease = acquireAnimatedSvgPhase(
    MUSHROOM_BOUNCY_SVG_URL,
    MUSHROOM_BOUNCY_CYCLE_MS,
    [{ image, url: MUSHROOM_BOUNCY_SVG_URL }],
  );
  return controller;
}

export function startMushroomBouncyArtwork(tile: any): MushroomBouncyController | null {
  if (!isMushroomBouncyTile(tile) || tile.destroyed) {
    stopMushroomBouncyArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccMushroomBouncyArtwork;
  if (existing && !existing.disposed) {
    existing.dragging = false;
    ensureRuntimeLease()?.requestSync();
    return existing;
  }
  const base = tile.base;
  const host = tile.rotG || tile;
  if (!base || base.destroyed || !host || host.destroyed) return null;
  const lease = ensureRuntimeLease();
  if (!lease) return null;
  const controller = createController(tile, base, host, lease.root);
  controllers.set(tile, controller);
  tile._ccMushroomBouncyArtwork = controller;
  lease.requestSync();
  return controller;
}

export function stopMushroomBouncyArtwork(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccMushroomBouncyArtwork;
  if (controller) disposeController(controller);
}

export function setMushroomBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = controllers.get(tile) || tile?._ccMushroomBouncyArtwork;
  if (!controller || controller.disposed || !isMushroomBouncyTile(tile)) return false;
  controller.dragging = dragging;
  setAnimatedSpecialArtworkDragging(controller.wrapper, dragging);
  controller.wrapper.style.zIndex = String(
    dragging
      ? MUSHROOM_BOUNCY_DRAG_Z_INDEX
      : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  if (dragging) {
    controller.wrapper.style.visibility = 'hidden';
    try { controller.base.renderable = true; } catch {}
  } else {
    runtimeLease?.requestSync();
  }
  return true;
}

export function destroyMushroomBouncyArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  releaseAnimatedSpecialArtworkFamily('mushroom');
  if (runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

export function getMushroomBouncyRuntimeStats() {
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
