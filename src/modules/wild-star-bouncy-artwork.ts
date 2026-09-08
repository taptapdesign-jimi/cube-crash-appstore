import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import {
  acquireAnimatedSpecialArtworkLayer,
  doesAnimatedSpecialArtworkOverlapGameplayDrag,
  setAnimatedSpecialArtworkDragging,
  type AnimatedSpecialArtworkFrame,
  type AnimatedSpecialArtworkLayerLease,
} from './animated-special-artwork-layer.ts';
import {
  acquireAnimatedSvgPhase,
  type AnimatedSvgPhaseLease,
} from './animated-svg-phase-scheduler.ts';

export const WILD_STAR_BOUNCY_SVG_URL = './assets/shop/star/star.svg';
export const WILD_STAR_BOUNCY_VIEWBOX = Object.freeze({ width: 520, height: 560 });
export const WILD_STAR_BOUNCY_REST_ART = Object.freeze({
  centerX: 260,
  centerY: 465 + (-407 + 432 / 2) * 0.85,
  size: 432 * 0.85,
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
const DISPLAY_ANCHOR_OFFSET_X = DISPLAY_WIDTH * DISPLAY_ANCHOR_X;
const DISPLAY_ANCHOR_OFFSET_Y = DISPLAY_HEIGHT * DISPLAY_ANCHOR_Y;
const ORBIT_STAR_DISPLAY_SIZE = 40;
const ORBIT_STAR_HALF_SIZE = ORBIT_STAR_DISPLAY_SIZE / 2;

type WildStarOrbitPaintNode = {
  image: HTMLImageElement;
  ready: boolean;
  failed: boolean;
};

type Matrix2D = {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
};

type WildStarBouncyController = {
  tile: any;
  base: any;
  host: any;
  wrapper: HTMLDivElement;
  image: HTMLImageElement;
  orbitLayer: HTMLDivElement;
  orbitNodes: Map<any, WildStarOrbitPaintNode>;
  orbitSystem: any | null;
  baseRenderable: boolean;
  dragging: boolean;
  ready: boolean;
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
  controller.orbitNodes.forEach((node) => {
    node.image.onload = null;
    node.image.onerror = null;
    try { node.image.remove(); } catch {}
  });
  controller.orbitNodes.clear();
  controller.orbitLayer.style.visibility = 'hidden';
}

function createLocalMatrix(displayObject: any, baseWidth?: number, baseHeight?: number): Matrix2D {
  const rotation = Number(displayObject?.rotation) || 0;
  const scaleXFromSize = Number(baseWidth) > 0
    ? Number(displayObject?.width) / Number(baseWidth)
    : Number.NaN;
  const scaleYFromSize = Number(baseHeight) > 0
    ? Number(displayObject?.height) / Number(baseHeight)
    : Number.NaN;
  const rawScaleX = Number(displayObject?.scale?.x);
  const rawScaleY = Number(displayObject?.scale?.y);
  const scaleX = Number.isFinite(scaleXFromSize)
    ? scaleXFromSize
    : (Number.isFinite(rawScaleX) ? rawScaleX : 1);
  const scaleY = Number.isFinite(scaleYFromSize)
    ? scaleYFromSize
    : (Number.isFinite(rawScaleY) ? rawScaleY : 1);
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    a: cosine * scaleX,
    b: sine * scaleX,
    c: -sine * scaleY,
    d: cosine * scaleY,
    tx: Number(displayObject?.x) || 0,
    ty: Number(displayObject?.y) || 0,
  };
}

function multiplyMatrices(parent: Matrix2D, child: Matrix2D): Matrix2D {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    tx: parent.a * child.tx + parent.c * child.ty + parent.tx,
    ty: parent.b * child.tx + parent.d * child.ty + parent.ty,
  };
}

function createOrbitPaintNode(controller: WildStarBouncyController): WildStarOrbitPaintNode {
  const image = new Image();
  const node: WildStarOrbitPaintNode = { image, ready: false, failed: false };
  image.alt = '';
  image.draggable = false;
  image.decoding = 'async';
  image.setAttribute('aria-hidden', 'true');
  image.className = 'wild-star-orbit-star';
  Object.assign(image.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${ORBIT_STAR_DISPLAY_SIZE}px`,
    height: `${ORBIT_STAR_DISPLAY_SIZE}px`,
    maxWidth: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
    visibility: 'hidden',
    transformOrigin: '0 0',
    willChange: 'transform, opacity',
    mixBlendMode: 'screen',
  });
  image.onload = () => {
    if (controller.disposed) return;
    node.ready = true;
    node.failed = false;
    runtimeLease?.requestSync();
  };
  image.onerror = () => {
    if (controller.disposed) return;
    node.ready = false;
    node.failed = true;
    runtimeLease?.requestSync();
  };
  image.srcset = './assets/small-star.png 1x, ./assets/small-star@2x.png 2x, ./assets/small-star@3x.png 3x';
  image.src = './assets/small-star.png';
  controller.orbitLayer.appendChild(image);
  return node;
}

function syncOrbitArtwork(controller: WildStarBouncyController): boolean {
  const system = controller.tile?._wildStarSystem;
  if (
    !controller.ready
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
    if (system._ccWildStarArtworkOwner && system._ccWildStarArtworkOwner !== controller) {
      return false;
    }
    controller.orbitSystem = system;
    system._ccWildStarArtworkOwner = controller;
    system._ccWildStarArtworkRenderableBefore = system.container.renderable !== false;
  }

  const liveSprites = new Set<any>();
  system.stars.forEach((star: any) => {
    const sprite = star?.sprite;
    if (!sprite || sprite.destroyed) return;
    liveSprites.add(sprite);
    if (!controller.orbitNodes.has(sprite)) {
      controller.orbitNodes.set(sprite, createOrbitPaintNode(controller));
    }
  });
  controller.orbitNodes.forEach((node, sprite) => {
    if (liveSprites.has(sprite)) return;
    node.image.onload = null;
    node.image.onerror = null;
    try { node.image.remove(); } catch {}
    controller.orbitNodes.delete(sprite);
  });

  const nodes = Array.from(controller.orbitNodes.entries());
  if (
    nodes.length === 0
    || nodes.some(([, node]) => !node.ready || node.failed)
  ) {
    system.container.renderable = system._ccWildStarArtworkRenderableBefore !== false;
    controller.orbitLayer.style.visibility = 'hidden';
    return false;
  }

  const containerMatrix = createLocalMatrix(system.container);
  nodes.forEach(([sprite, node]) => {
    const spriteMatrix = createLocalMatrix(
      sprite,
      ORBIT_STAR_DISPLAY_SIZE,
      ORBIT_STAR_DISPLAY_SIZE,
    );
    const matrix = multiplyMatrices(containerMatrix, spriteMatrix);
    const e = DISPLAY_ANCHOR_OFFSET_X + matrix.tx
      - matrix.a * ORBIT_STAR_HALF_SIZE
      - matrix.c * ORBIT_STAR_HALF_SIZE;
    const f = DISPLAY_ANCHOR_OFFSET_Y + matrix.ty
      - matrix.b * ORBIT_STAR_HALF_SIZE
      - matrix.d * ORBIT_STAR_HALF_SIZE;
    node.image.style.transform = `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${e}, ${f})`;
    node.image.style.opacity = String(Math.max(
      0,
      Math.min(1, (Number(system.container.alpha) || 0) * (Number(sprite.alpha) || 0)),
    ));
    node.image.style.visibility = sprite.visible === false || sprite.renderable === false
      ? 'hidden'
      : 'visible';
  });

  // The established Pixi system remains the only owner of star count, orbit
  // motion, intro bounce and merge-to-HUD state. Once every small-star image is
  // load-ready, this layer mirrors only its paint above the direct star.svg.
  system.container.renderable = false;
  controller.orbitLayer.style.visibility = 'visible';
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

  if (
    frame.gameplayDragActive
    && !controller.dragging
    && doesAnimatedSpecialArtworkOverlapGameplayDrag(wrapper, frame.gameplayDragBounds)
  ) {
    releaseOrbitSystem(controller);
    try { base.renderable = controller.baseRenderable; } catch {}
    controller.image.style.visibility = 'hidden';
    wrapper.style.visibility = 'hidden';
    return;
  }

  const visible = controller.ready
    && base.visible !== false
    && isPixiBranchVisible(host)
    && canvasRect.width > 0
    && canvasRect.height > 0;
  if (!visible) {
    releaseOrbitSystem(controller);
    try { base.renderable = controller.baseRenderable; } catch {}
    controller.image.style.visibility = 'hidden';
    wrapper.style.visibility = 'hidden';
    return;
  }

  const transform = host.worldTransform;
  if (!transform) {
    releaseOrbitSystem(controller);
    controller.image.style.visibility = 'hidden';
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

  try { base.renderable = false; } catch {}
  controller.image.style.visibility = 'visible';
  wrapper.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  wrapper.style.opacity = String(getPixiBranchAlpha(base) * canvasOpacity);
  wrapper.style.zIndex = String(
    controller.dragging
      ? WILD_STAR_BOUNCY_DRAG_Z_INDEX
      : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  syncOrbitArtwork(controller);
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
    visibility: 'hidden',
    zIndex: '1',
  });

  const orbitLayer = document.createElement('div');
  orbitLayer.className = 'wild-star-orbit-artwork';
  Object.assign(orbitLayer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'visible',
    pointerEvents: 'none',
    visibility: 'hidden',
    zIndex: '2',
  });
  wrapper.appendChild(image);
  wrapper.appendChild(orbitLayer);
  root.appendChild(wrapper);

  const controller: WildStarBouncyController = {
    tile,
    base,
    host,
    wrapper,
    image,
    orbitLayer,
    orbitNodes: new Map(),
    orbitSystem: null,
    baseRenderable: base.renderable !== false,
    dragging: false,
    ready: false,
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
  controller.phaseLease = acquireAnimatedSvgPhase(
    WILD_STAR_BOUNCY_PHASE_GROUP,
    WILD_STAR_BOUNCY_CYCLE_MS,
    [{ image, url: WILD_STAR_BOUNCY_SVG_URL }],
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
  setAnimatedSpecialArtworkDragging(controller.wrapper, dragging);
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
    orbitBridged: Array.from(controllers.values()).filter((controller) => (
      controller.orbitSystem && controller.orbitLayer.style.visibility === 'visible'
    )).length,
    runtimeAttached: runtimeLease !== null,
    overlayAttached: runtimeLease?.root.isConnected === true,
  };
}
