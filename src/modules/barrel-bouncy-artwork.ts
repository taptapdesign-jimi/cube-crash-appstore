import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import {
  acquireAnimatedSpecialArtworkLayer,
  doesAnimatedSpecialArtworkOverlapGameplayDrag,
  installAnimatedSpecialArtworkOverlapFootprint,
  setAnimatedSpecialArtworkDragging,
  setAnimatedSpecialArtworkOccluded,
  type AnimatedSpecialArtworkFrame,
  type AnimatedSpecialArtworkLayerLease,
} from './animated-special-artwork-layer.ts';
import { acquireAnimatedSvgPhase, type AnimatedSvgPhaseLease } from './animated-svg-phase-scheduler.ts';
import { releaseAnimatedSpecialArtworkFamily } from './animated-special-artwork-mode.ts';

export const BARREL_BOUNCY_SVG_URL = './assets/shop/barell/barell.svg';
export const BARREL_BOUNCY_VIEWBOX = Object.freeze({ width: 270, height: 351 });
export const BARREL_BOUNCY_REST_ART = Object.freeze({ centerX: 135, centerY: 221, size: 194 });
export const BARREL_BOUNCY_DISPLAY_SIZE = 115.2;
export const BARREL_BOUNCY_CYCLE_MS = 821.428571;

const DISPLAY_SCALE = BARREL_BOUNCY_DISPLAY_SIZE / BARREL_BOUNCY_REST_ART.size;
const DISPLAY_WIDTH = BARREL_BOUNCY_VIEWBOX.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = BARREL_BOUNCY_VIEWBOX.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = BARREL_BOUNCY_REST_ART.centerX / BARREL_BOUNCY_VIEWBOX.width;
const DISPLAY_ANCHOR_Y = BARREL_BOUNCY_REST_ART.centerY / BARREL_BOUNCY_VIEWBOX.height;

type BarrelController = {
  tile: any;
  base: any;
  host: any;
  wrapper: HTMLDivElement;
  image: HTMLImageElement;
  originalRenderable: boolean;
  dragging: boolean;
  ready: boolean;
  disposed: boolean;
  phaseLease: AnimatedSvgPhaseLease | null;
};

const controllers = new Map<any, BarrelController>();
let runtimeLease: AnimatedSpecialArtworkLayerLease | null = null;

export function isBarrelBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'barell';
}

export function getBarrelBouncyDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: BARREL_BOUNCY_DISPLAY_SIZE,
    restingArtworkHeight: BARREL_BOUNCY_DISPLAY_SIZE,
  };
}

function isPixiBranchVisible(displayObject: any): boolean {
  for (let current = displayObject; current; current = current.parent) {
    if (current.destroyed || current.visible === false || current.renderable === false) return false;
    if (typeof current.alpha === 'number' && current.alpha <= 0.001) return false;
  }
  return true;
}

function getPixiBranchAlpha(displayObject: any): number {
  let alpha = 1;
  for (let current = displayObject; current; current = current.parent) {
    if (typeof current.alpha === 'number') alpha *= current.alpha;
  }
  return Math.max(0, Math.min(1, alpha));
}

function disposeController(controller: BarrelController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccBarrelBouncyArtwork === controller) delete controller.tile._ccBarrelBouncyArtwork;
  controller.phaseLease?.release();
  controller.phaseLease = null;
  controller.image.onload = null;
  controller.image.onerror = null;
  controller.wrapper.remove();
  if (controller.base && !controller.base.destroyed) {
    controller.base.renderable = controller.originalRenderable;
  }
  if (controllers.size === 0 && runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

function syncController(controller: BarrelController, frame: AnimatedSpecialArtworkFrame): void {
  const { tile, base, host, wrapper } = controller;
  const { canvasRect, rootRect, screenWidth, screenHeight, canvasOpacity } = frame;
  if (controller.disposed || tile?.destroyed || base?.destroyed || host?.destroyed || !isBarrelBouncyTile(tile)) {
    disposeController(controller);
    return;
  }
  const occluded = frame.gameplayDragActive && !controller.dragging
    && doesAnimatedSpecialArtworkOverlapGameplayDrag(wrapper, frame.gameplayDragBounds);
  if (!controller.dragging) setAnimatedSpecialArtworkOccluded(wrapper, occluded);
  const visible = controller.ready && base.visible !== false && isPixiBranchVisible(host)
    && canvasRect.width > 0 && canvasRect.height > 0;
  if (!visible) {
    base.renderable = controller.originalRenderable;
    wrapper.style.visibility = 'hidden';
    return;
  }
  const transform = host.worldTransform;
  if (!transform) {
    base.renderable = controller.originalRenderable;
    wrapper.style.visibility = 'hidden';
    return;
  }
  const scaleX = canvasRect.width / Math.max(1, screenWidth);
  const scaleY = canvasRect.height / Math.max(1, screenHeight);
  const anchorX = DISPLAY_WIDTH * DISPLAY_ANCHOR_X;
  const anchorY = DISPLAY_HEIGHT * DISPLAY_ANCHOR_Y;
  const a = transform.a * scaleX;
  const b = transform.b * scaleY;
  const c = transform.c * scaleX;
  const d = transform.d * scaleY;
  const e = canvasRect.left - rootRect.left
    + (transform.tx - transform.a * anchorX - transform.c * anchorY) * scaleX;
  const f = canvasRect.top - rootRect.top
    + (transform.ty - transform.b * anchorX - transform.d * anchorY) * scaleY;
  base.renderable = false;
  wrapper.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  wrapper.style.opacity = String(getPixiBranchAlpha(base) * canvasOpacity);
  wrapper.style.zIndex = String(controller.dragging ? 12001 : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0));
  wrapper.style.visibility = 'visible';
}

function ensureRuntimeLease(): AnimatedSpecialArtworkLayerLease | null {
  if (!runtimeLease) runtimeLease = acquireAnimatedSpecialArtworkLayer((frame) => {
    controllers.forEach((controller) => syncController(controller, frame));
  });
  return runtimeLease;
}

export function startBarrelBouncyArtwork(tile: any): BarrelController | null {
  if (!isBarrelBouncyTile(tile) || tile.destroyed) {
    stopBarrelBouncyArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccBarrelBouncyArtwork;
  if (existing && !existing.disposed) {
    existing.dragging = false;
    setAnimatedSpecialArtworkDragging(existing.wrapper, false);
    ensureRuntimeLease()?.requestSync();
    return existing;
  }
  const base = tile.base;
  const host = tile.rotG || tile;
  if (!base || base.destroyed || !host || host.destroyed) return null;
  const lease = ensureRuntimeLease();
  if (!lease) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'barrel-bouncy-artwork';
  Object.assign(wrapper.style, {
    position: 'absolute', left: '0', top: '0', width: `${DISPLAY_WIDTH}px`,
    height: `${DISPLAY_HEIGHT}px`, overflow: 'hidden', pointerEvents: 'none',
    transformOrigin: '0 0', visibility: 'hidden', willChange: 'transform',
  });
  installAnimatedSpecialArtworkOverlapFootprint(wrapper, {
    left: (BARREL_BOUNCY_REST_ART.centerX - BARREL_BOUNCY_REST_ART.size / 2) * DISPLAY_SCALE,
    top: (BARREL_BOUNCY_REST_ART.centerY - BARREL_BOUNCY_REST_ART.size / 2) * DISPLAY_SCALE,
    width: BARREL_BOUNCY_DISPLAY_SIZE,
    height: BARREL_BOUNCY_DISPLAY_SIZE,
  });
  const image = new Image();
  image.alt = '';
  image.draggable = false;
  image.decoding = 'async';
  image.setAttribute('aria-hidden', 'true');
  Object.assign(image.style, {
    position: 'absolute', inset: '0', width: `${DISPLAY_WIDTH}px`,
    height: `${DISPLAY_HEIGHT}px`, maxWidth: 'none', pointerEvents: 'none', userSelect: 'none',
  });
  wrapper.appendChild(image);
  lease.root.appendChild(wrapper);
  const controller: BarrelController = {
    tile, base, host, wrapper, image, originalRenderable: base.renderable !== false,
    dragging: false, ready: false, disposed: false, phaseLease: null,
  };
  image.onload = () => {
    if (controller.disposed || !isBarrelBouncyTile(tile)) return;
    controller.ready = true;
    runtimeLease?.requestSync();
  };
  image.onerror = () => {
    controller.ready = false;
    base.renderable = controller.originalRenderable;
    wrapper.style.visibility = 'hidden';
  };
  controller.phaseLease = acquireAnimatedSvgPhase(BARREL_BOUNCY_SVG_URL, BARREL_BOUNCY_CYCLE_MS, [
    { image, url: BARREL_BOUNCY_SVG_URL },
  ]);
  controllers.set(tile, controller);
  tile._ccBarrelBouncyArtwork = controller;
  lease.requestSync();
  return controller;
}

export function stopBarrelBouncyArtwork(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccBarrelBouncyArtwork;
  if (controller) disposeController(controller);
}

export function setBarrelBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = controllers.get(tile) || tile?._ccBarrelBouncyArtwork;
  if (!controller || controller.disposed || !isBarrelBouncyTile(tile)) return false;
  controller.dragging = dragging;
  setAnimatedSpecialArtworkDragging(controller.wrapper, dragging);
  runtimeLease?.requestSync();
  return true;
}

export function destroyBarrelBouncyArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  releaseAnimatedSpecialArtworkFamily('barell');
  runtimeLease?.release();
  runtimeLease = null;
}

export function getBarrelBouncyRuntimeStats() {
  return { controllers: controllers.size, runtimeAttached: runtimeLease !== null };
}
