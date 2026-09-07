import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import {
  acquireAnimatedSpecialArtworkLayer,
  type AnimatedSpecialArtworkFrame,
  type AnimatedSpecialArtworkLayerLease,
} from './animated-special-artwork-layer.ts';
import {
  acquireAnimatedSvgPhase,
  type AnimatedSvgPhaseLease,
} from './animated-svg-phase-scheduler.ts';

export const WILD_STAR_BOUNCY_SVG_URL = './assets/shop/star/star.svg';
export const WILD_STAR_ORBIT_SVG_URL = './assets/shop/star/stars.svg';
export const WILD_STAR_BOUNCY_VIEWBOX = Object.freeze({ width: 520, height: 560 });
export const WILD_STAR_BOUNCY_REST_ART = Object.freeze({
  centerX: 260,
  centerY: 465 + (-407 + 432 / 2) * 0.85,
  size: 432 * 0.85,
});
export const WILD_STAR_ORBIT_REST_ART = Object.freeze({
  centerX: 260,
  centerY: 492 + (-407 + 432 / 2) * 0.73,
  size: 432 * 0.73,
});
export const WILD_STAR_BOUNCY_DISPLAY_SIZE = 128;
export const WILD_STAR_BOUNCY_DRAG_Z_INDEX = 12001;
export const WILD_STAR_BOUNCY_CYCLE_MS = 2000;
export const WILD_STAR_BOUNCY_PHASE_GROUP = 'wild-star-composition';

const DISPLAY_SCALE = WILD_STAR_BOUNCY_DISPLAY_SIZE / WILD_STAR_BOUNCY_REST_ART.size;
const DISPLAY_WIDTH = WILD_STAR_BOUNCY_VIEWBOX.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = WILD_STAR_BOUNCY_VIEWBOX.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = WILD_STAR_BOUNCY_REST_ART.centerX / WILD_STAR_BOUNCY_VIEWBOX.width;
const DISPLAY_ANCHOR_Y = WILD_STAR_BOUNCY_REST_ART.centerY / WILD_STAR_BOUNCY_VIEWBOX.height;
const ORBIT_DISPLAY_SCALE = WILD_STAR_BOUNCY_DISPLAY_SIZE / WILD_STAR_ORBIT_REST_ART.size;
const ORBIT_DISPLAY_WIDTH = WILD_STAR_BOUNCY_VIEWBOX.width * ORBIT_DISPLAY_SCALE;
const ORBIT_DISPLAY_HEIGHT = WILD_STAR_BOUNCY_VIEWBOX.height * ORBIT_DISPLAY_SCALE;
const ORBIT_DISPLAY_ANCHOR_X = WILD_STAR_ORBIT_REST_ART.centerX / WILD_STAR_BOUNCY_VIEWBOX.width;
const ORBIT_DISPLAY_ANCHOR_Y = WILD_STAR_ORBIT_REST_ART.centerY / WILD_STAR_BOUNCY_VIEWBOX.height;
const DISPLAY_ANCHOR_OFFSET_X = DISPLAY_WIDTH * DISPLAY_ANCHOR_X;
const DISPLAY_ANCHOR_OFFSET_Y = DISPLAY_HEIGHT * DISPLAY_ANCHOR_Y;

type WildStarBouncyController = {
  tile: any;
  base: any;
  host: any;
  wrapper: HTMLDivElement;
  image: HTMLImageElement;
  orbitImage: HTMLImageElement;
  orbitSystem: any | null;
  baseRenderable: boolean;
  dragging: boolean;
  ready: boolean;
  orbitReady: boolean;
  disposed: boolean;
  phaseLease: AnimatedSvgPhaseLease | null;
};

const controllers = new Map<any, WildStarBouncyController>();
let runtimeLease: AnimatedSpecialArtworkLayerLease | null = null;

export function isPlainWildStarBouncyTile(tile: any): boolean {
  return !!tile
    && tile.special === 'wild'
    && getSpecialDiceVariantForTile(tile) === null;
}

export function getWildStarBouncyDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: WILD_STAR_BOUNCY_REST_ART.size * DISPLAY_SCALE,
    restingArtworkHeight: WILD_STAR_BOUNCY_REST_ART.size * DISPLAY_SCALE,
  };
}

export function getWildStarOrbitDisplayGeometry() {
  return {
    width: ORBIT_DISPLAY_WIDTH,
    height: ORBIT_DISPLAY_HEIGHT,
    anchorX: ORBIT_DISPLAY_ANCHOR_X,
    anchorY: ORBIT_DISPLAY_ANCHOR_Y,
    left: DISPLAY_ANCHOR_OFFSET_X - ORBIT_DISPLAY_WIDTH * ORBIT_DISPLAY_ANCHOR_X,
    top: DISPLAY_ANCHOR_OFFSET_Y - ORBIT_DISPLAY_HEIGHT * ORBIT_DISPLAY_ANCHOR_Y,
    restingArtworkWidth: WILD_STAR_ORBIT_REST_ART.size * ORBIT_DISPLAY_SCALE,
    restingArtworkHeight: WILD_STAR_ORBIT_REST_ART.size * ORBIT_DISPLAY_SCALE,
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

function releaseOrbitSystem(controller: WildStarBouncyController): void {
  const system = controller.orbitSystem;
  if (system?._ccWildStarArtworkOwner === controller) {
    if (system.container && !system.container.destroyed) {
      system.container.renderable = system._ccWildStarArtworkRenderableBefore !== false;
    }
    delete system._ccWildStarArtworkOwner;
    delete system._ccWildStarArtworkRenderableBefore;
  }
  controller.orbitSystem = null;
  controller.orbitImage.style.visibility = 'hidden';
  controller.image.style.visibility = controller.ready ? 'visible' : 'hidden';
}

function syncOrbitArtwork(controller: WildStarBouncyController): boolean {
  const system = controller.tile?._wildStarSystem;
  if (
    !controller.orbitReady
    || !system
    || system.disposed
    || !system.container
    || system.container.destroyed
    || !Array.isArray(system.stars)
    || system.stars.length === 0
    || system.container.visible === false
    || (typeof system.container.alpha === 'number' && system.container.alpha <= 0.001)
  ) {
    releaseOrbitSystem(controller);
    return false;
  }

  if (controller.orbitSystem !== system) {
    releaseOrbitSystem(controller);
    controller.orbitSystem = system;
    system._ccWildStarArtworkOwner = controller;
    system._ccWildStarArtworkRenderableBefore = system.container.renderable !== false;
  }

  // The existing Pixi system stays alive as the gameplay/merge-to-HUD owner.
  // While it is active, the supplied three-star SVG owns the complete visible
  // composition, including its foreground star, so star.svg must not be
  // painted underneath it.
  system.container.renderable = false;
  controller.image.style.visibility = 'hidden';
  controller.orbitImage.style.visibility = 'visible';
  return true;
}

function disposeController(controller: WildStarBouncyController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccWildStarBouncyArtwork === controller) {
    delete controller.tile._ccWildStarBouncyArtwork;
  }
  releaseOrbitSystem(controller);
  controller.phaseLease?.release();
  controller.phaseLease = null;
  try {
    controller.image.onload = null;
    controller.image.onerror = null;
    controller.orbitImage.onload = null;
    controller.orbitImage.onerror = null;
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

function syncController(controller: WildStarBouncyController, frame: AnimatedSpecialArtworkFrame): void {
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
    || !isPlainWildStarBouncyTile(tile)
  ) {
    disposeController(controller);
    return;
  }

  const usingOrbitArtwork = syncOrbitArtwork(controller);
  const artworkReady = usingOrbitArtwork || controller.ready;
  try { base.renderable = artworkReady ? false : controller.baseRenderable; } catch {}
  const visible = artworkReady
    && base.visible !== false
    && isPixiBranchVisible(host)
    && canvasRect.width > 0
    && canvasRect.height > 0;
  if (!visible) {
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
  const a = transform.a * scaleX;
  const b = transform.b * scaleY;
  const c = transform.c * scaleX;
  const d = transform.d * scaleY;
  const e = canvasRect.left - rootRect.left
    + (transform.tx - transform.a * DISPLAY_ANCHOR_OFFSET_X - transform.c * DISPLAY_ANCHOR_OFFSET_Y) * scaleX;
  const f = canvasRect.top - rootRect.top
    + (transform.ty - transform.b * DISPLAY_ANCHOR_OFFSET_X - transform.d * DISPLAY_ANCHOR_OFFSET_Y) * scaleY;

  wrapper.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  wrapper.style.opacity = String(getPixiBranchAlpha(base) * canvasOpacity);
  wrapper.style.zIndex = String(
    controller.dragging
      ? WILD_STAR_BOUNCY_DRAG_Z_INDEX
      : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  wrapper.style.visibility = 'visible';
}

function updateWildStarBouncyArtwork(frame: AnimatedSpecialArtworkFrame): void {
  controllers.forEach((controller) => syncController(controller, frame));
}

function ensureRuntimeLease(): AnimatedSpecialArtworkLayerLease | null {
  if (!runtimeLease) runtimeLease = acquireAnimatedSpecialArtworkLayer(updateWildStarBouncyArtwork);
  return runtimeLease;
}

function createController(
  tile: any,
  base: any,
  host: any,
  root: HTMLDivElement,
): WildStarBouncyController {
  const wrapper = document.createElement('div');
  wrapper.className = 'wild-star-bouncy-artwork';
  Object.assign(wrapper.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${DISPLAY_WIDTH}px`,
    height: `${DISPLAY_HEIGHT}px`,
    overflow: 'visible',
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
    zIndex: '1',
  });

  const orbitGeometry = getWildStarOrbitDisplayGeometry();
  const orbitImage = new Image();
  orbitImage.alt = '';
  orbitImage.draggable = false;
  orbitImage.decoding = 'async';
  orbitImage.setAttribute('aria-hidden', 'true');
  orbitImage.className = 'wild-star-orbit-artwork';
  Object.assign(orbitImage.style, {
    position: 'absolute',
    left: `${orbitGeometry.left}px`,
    top: `${orbitGeometry.top}px`,
    width: `${orbitGeometry.width}px`,
    height: `${orbitGeometry.height}px`,
    maxWidth: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
    visibility: 'hidden',
    zIndex: '2',
  });
  wrapper.appendChild(image);
  wrapper.appendChild(orbitImage);
  root.appendChild(wrapper);

  const controller: WildStarBouncyController = {
    tile,
    base,
    host,
    wrapper,
    image,
    orbitImage,
    orbitSystem: null,
    baseRenderable: base.renderable !== false,
    dragging: false,
    ready: false,
    orbitReady: false,
    disposed: false,
    phaseLease: null,
  };
  image.onload = () => {
    if (controller.disposed || !isPlainWildStarBouncyTile(tile)) return;
    controller.ready = true;
    runtimeLease?.requestSync();
  };
  image.onerror = () => {
    controller.ready = false;
    runtimeLease?.requestSync();
  };
  orbitImage.onload = () => {
    if (controller.disposed) return;
    controller.orbitReady = true;
    runtimeLease?.requestSync();
  };
  orbitImage.onerror = () => {
    if (controller.disposed) return;
    controller.orbitReady = false;
    releaseOrbitSystem(controller);
    runtimeLease?.requestSync();
  };
  // Both mutually exclusive Star compositions start on the same clock, while
  // another Star tile receives a different clock from the shared scheduler.
  controller.phaseLease = acquireAnimatedSvgPhase(
    WILD_STAR_BOUNCY_PHASE_GROUP,
    WILD_STAR_BOUNCY_CYCLE_MS,
    [
      { image, url: WILD_STAR_BOUNCY_SVG_URL },
      { image: orbitImage, url: WILD_STAR_ORBIT_SVG_URL },
    ],
  );
  return controller;
}

export function startWildStarBouncyArtwork(tile: any): WildStarBouncyController | null {
  if (!isPlainWildStarBouncyTile(tile) || tile.destroyed) {
    stopWildStarBouncyArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccWildStarBouncyArtwork;
  if (existing && !existing.disposed) {
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
  tile._ccWildStarBouncyArtwork = controller;
  lease.requestSync();
  return controller;
}

export function stopWildStarBouncyArtwork(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccWildStarBouncyArtwork;
  if (controller) disposeController(controller);
}

export function setWildStarBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = controllers.get(tile) || tile?._ccWildStarBouncyArtwork;
  if (!controller || controller.disposed || !isPlainWildStarBouncyTile(tile)) return false;
  controller.dragging = dragging;
  controller.wrapper.style.zIndex = String(
    dragging
      ? WILD_STAR_BOUNCY_DRAG_Z_INDEX
      : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  return true;
}

export function destroyWildStarBouncyArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  if (runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

export function getWildStarBouncyRuntimeStats() {
  return {
    controllers: controllers.size,
    ready: Array.from(controllers.values()).filter((controller) => controller.ready).length,
    orbitBridged: Array.from(controllers.values()).filter((controller) => controller.orbitSystem).length,
    runtimeAttached: runtimeLease !== null,
    overlayAttached: runtimeLease?.root.isConnected === true,
  };
}
