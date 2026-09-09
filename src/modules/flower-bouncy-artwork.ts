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
import {
  acquireAnimatedSvgPhase,
  type AnimatedSvgPhaseLease,
} from './animated-svg-phase-scheduler.ts';
import { releaseAnimatedSpecialArtworkFamily } from './animated-special-artwork-mode.ts';

export const FLOWER_BOUNCY_SVG_URL = './assets/shop/bush/flower.svg';
export const FLOWER_BOUNCY_VIEWBOX = Object.freeze({ x: 0, y: 0, width: 160, height: 160 });
export const FLOWER_BOUNCY_REST_ART = Object.freeze({ centerX: 79.33, centerY: 74.78, size: 108.36 });
export const FLOWER_BOUNCY_DISPLAY_SIZE = 128;
export const FLOWER_BOUNCY_DRAG_Z_INDEX = 12001;
export const FLOWER_BOUNCY_CYCLE_MS = 1600;

const DISPLAY_SCALE = FLOWER_BOUNCY_DISPLAY_SIZE / FLOWER_BOUNCY_REST_ART.size;
const DISPLAY_WIDTH = FLOWER_BOUNCY_VIEWBOX.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = FLOWER_BOUNCY_VIEWBOX.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = (
  FLOWER_BOUNCY_REST_ART.centerX - FLOWER_BOUNCY_VIEWBOX.x
) / FLOWER_BOUNCY_VIEWBOX.width;
const DISPLAY_ANCHOR_Y = (
  FLOWER_BOUNCY_REST_ART.centerY - FLOWER_BOUNCY_VIEWBOX.y
) / FLOWER_BOUNCY_VIEWBOX.height;

type FlowerBouncyController = {
  tile: any;
  base: any;
  host: any;
  wrapper: HTMLDivElement;
  image: HTMLImageElement;
  pollenLayer: HTMLDivElement;
  pollenNodes: Map<any, SVGSVGElement>;
  baseRenderable: boolean;
  dragging: boolean;
  ready: boolean;
  disposed: boolean;
  phaseLease: AnimatedSvgPhaseLease | null;
};

type FlowerPollenPaint =
  | {
      kind: 'ellipse';
      color: number;
      fillAlpha: number;
      width: number;
      height: number;
    }
  | {
      kind: 'polygon';
      color: number;
      fillAlpha: number;
      points: number[];
    }
  | {
      kind: 'double-ellipse';
      color: number;
      fillAlpha: number;
      radius: number;
    };

const controllers = new Map<any, FlowerBouncyController>();
let runtimeLease: AnimatedSpecialArtworkLayerLease | null = null;

export function isFlowerBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'flower';
}

export function getFlowerBouncyDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: FLOWER_BOUNCY_REST_ART.size * DISPLAY_SCALE,
    restingArtworkHeight: FLOWER_BOUNCY_REST_ART.size * DISPLAY_SCALE,
  };
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function colorToCss(color: number): string {
  const safeColor = Number.isFinite(color) ? Math.max(0, Math.min(0xFFFFFF, color | 0)) : 0xFFFFFF;
  return `#${safeColor.toString(16).padStart(6, '0')}`;
}

function releaseFrontPollenParticle(controller: FlowerBouncyController, particle: any): void {
  const node = controller.pollenNodes.get(particle);
  if (node) {
    try { node.remove(); } catch {}
    controller.pollenNodes.delete(particle);
  }
  if (particle?._ccFlowerFrontPollenOwner !== controller) return;
  if (!particle.destroyed) {
    try { particle.renderable = particle._ccFlowerFrontPollenRenderableBefore !== false; } catch {}
  }
  delete particle._ccFlowerFrontPollenOwner;
  delete particle._ccFlowerFrontPollenRenderableBefore;
}

function releaseFrontPollenSystem(controller: FlowerBouncyController): void {
  Array.from(controller.pollenNodes.keys()).forEach((particle) => {
    releaseFrontPollenParticle(controller, particle);
  });
  controller.pollenLayer.style.visibility = 'hidden';
}

function createSvgEllipse(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  fill: string,
  fillAlpha: number,
): SVGEllipseElement {
  const ellipse = document.createElementNS(SVG_NAMESPACE, 'ellipse');
  ellipse.setAttribute('cx', String(centerX));
  ellipse.setAttribute('cy', String(centerY));
  ellipse.setAttribute('rx', String(radiusX));
  ellipse.setAttribute('ry', String(radiusY));
  ellipse.setAttribute('fill', fill);
  ellipse.setAttribute('fill-opacity', String(fillAlpha));
  return ellipse;
}

function createFrontPollenNode(paint: FlowerPollenPaint): SVGSVGElement {
  const node = document.createElementNS(SVG_NAMESPACE, 'svg');
  node.setAttribute('width', '1');
  node.setAttribute('height', '1');
  node.setAttribute('aria-hidden', 'true');
  Object.assign(node.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '1px',
    height: '1px',
    overflow: 'visible',
    pointerEvents: 'none',
    transformOrigin: '0 0',
    willChange: 'transform, opacity',
  });
  const fill = colorToCss(paint.color);
  if (paint.kind === 'ellipse') {
    node.appendChild(createSvgEllipse(0, 0, paint.width, paint.height, fill, paint.fillAlpha));
  } else if (paint.kind === 'polygon') {
    const polygon = document.createElementNS(SVG_NAMESPACE, 'polygon');
    const points = Array.from({ length: Math.floor(paint.points.length / 2) }, (_, index) => (
      `${paint.points[index * 2]},${paint.points[index * 2 + 1]}`
    )).join(' ');
    polygon.setAttribute('points', points);
    polygon.setAttribute('fill', fill);
    polygon.setAttribute('fill-opacity', String(paint.fillAlpha));
    node.appendChild(polygon);
  } else {
    node.appendChild(createSvgEllipse(
      -paint.radius * 0.3,
      0,
      paint.radius * 0.72,
      paint.radius * 0.42,
      fill,
      paint.fillAlpha,
    ));
    node.appendChild(createSvgEllipse(
      paint.radius * 0.5,
      paint.radius * 0.12,
      paint.radius * 0.4,
      paint.radius * 0.25,
      fill,
      paint.fillAlpha,
    ));
  }
  return node;
}

function getParticleMatrixRelativeToHost(hostMatrix: any, particleMatrix: any) {
  if (!hostMatrix || !particleMatrix) return null;
  const determinant = hostMatrix.a * hostMatrix.d - hostMatrix.b * hostMatrix.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.000001) return null;
  const inverseA = hostMatrix.d / determinant;
  const inverseB = -hostMatrix.b / determinant;
  const inverseC = -hostMatrix.c / determinant;
  const inverseD = hostMatrix.a / determinant;
  const inverseTx = -(inverseA * hostMatrix.tx + inverseC * hostMatrix.ty);
  const inverseTy = -(inverseB * hostMatrix.tx + inverseD * hostMatrix.ty);
  return {
    a: inverseA * particleMatrix.a + inverseC * particleMatrix.b,
    b: inverseB * particleMatrix.a + inverseD * particleMatrix.b,
    c: inverseA * particleMatrix.c + inverseC * particleMatrix.d,
    d: inverseB * particleMatrix.c + inverseD * particleMatrix.d,
    tx: inverseA * particleMatrix.tx + inverseC * particleMatrix.ty + inverseTx,
    ty: inverseB * particleMatrix.tx + inverseD * particleMatrix.ty + inverseTy,
  };
}

function getLiveFlowerPollenWorldMatrix(particle: any) {
  const rotation = Number(particle?.rotation) || 0;
  const scaleX = Number(particle?.scale?.x);
  const scaleY = Number(particle?.scale?.y);
  const localA = Math.cos(rotation) * (Number.isFinite(scaleX) ? scaleX : 1);
  const localB = Math.sin(rotation) * (Number.isFinite(scaleX) ? scaleX : 1);
  const localC = -Math.sin(rotation) * (Number.isFinite(scaleY) ? scaleY : 1);
  const localD = Math.cos(rotation) * (Number.isFinite(scaleY) ? scaleY : 1);
  const localTx = Number(particle?.x) || 0;
  const localTy = Number(particle?.y) || 0;
  const parent = particle?.parent?.worldTransform;
  if (!parent) {
    return { a: localA, b: localB, c: localC, d: localD, tx: localTx, ty: localTy };
  }
  return {
    a: parent.a * localA + parent.c * localB,
    b: parent.b * localA + parent.d * localB,
    c: parent.a * localC + parent.c * localD,
    d: parent.b * localC + parent.d * localD,
    tx: parent.a * localTx + parent.c * localTy + parent.tx,
    ty: parent.b * localTx + parent.d * localTy + parent.ty,
  };
}

function syncFrontPollen(controller: FlowerBouncyController): void {
  const owned = controller.tile?._flowerPollenParticles;
  if (!controller.ready || controller.dragging || !(owned instanceof Set)) {
    releaseFrontPollenSystem(controller);
    return;
  }

  const liveParticles = new Set<any>();
  const anchorX = DISPLAY_WIDTH * DISPLAY_ANCHOR_X;
  const anchorY = DISPLAY_HEIGHT * DISPLAY_ANCHOR_Y;
  owned.forEach((particle: any) => {
    const paint = particle?._ccFlowerPollenPaint as FlowerPollenPaint | undefined;
    if (!particle || particle.destroyed || !paint) return;
    const currentOwner = particle._ccFlowerFrontPollenOwner;
    if (currentOwner && currentOwner !== controller) return;
    liveParticles.add(particle);
    let node = controller.pollenNodes.get(particle);
    if (!node) {
      node = createFrontPollenNode(paint);
      controller.pollenNodes.set(particle, node);
      controller.pollenLayer.appendChild(node);
    }
    if (!currentOwner) {
      particle._ccFlowerFrontPollenOwner = controller;
      particle._ccFlowerFrontPollenRenderableBefore = particle.renderable !== false;
    }
    const relative = getParticleMatrixRelativeToHost(
      controller.host.worldTransform,
      getLiveFlowerPollenWorldMatrix(particle),
    );
    if (!relative) {
      node.style.visibility = 'hidden';
      return;
    }
    particle.renderable = false;
    node.style.transform = `matrix(${relative.a}, ${relative.b}, ${relative.c}, ${relative.d}, ${anchorX + relative.tx}, ${anchorY + relative.ty})`;
    node.style.opacity = String(Math.max(0, Math.min(1, Number(particle.alpha) || 0)));
    node.style.visibility = particle.visible === false
      || particle._ccFlowerFrontPollenRenderableBefore === false
      ? 'hidden'
      : 'visible';
  });

  controller.pollenNodes.forEach((_node, particle) => {
    if (liveParticles.has(particle)) return;
    releaseFrontPollenParticle(controller, particle);
  });
  controller.pollenLayer.style.visibility = liveParticles.size > 0 ? 'visible' : 'hidden';
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

function disposeController(controller: FlowerBouncyController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccFlowerBouncyArtwork === controller) {
    delete controller.tile._ccFlowerBouncyArtwork;
  }
  releaseFrontPollenSystem(controller);
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
  controller: FlowerBouncyController,
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
    || !isFlowerBouncyTile(tile)
  ) {
    disposeController(controller);
    return;
  }

  const occludedByGameplayDrag = frame.gameplayDragActive
    && !controller.dragging
    && doesAnimatedSpecialArtworkOverlapGameplayDrag(wrapper, frame.gameplayDragBounds);
  if (!controller.dragging) {
    setAnimatedSpecialArtworkOccluded(wrapper, occludedByGameplayDrag);
  }

  if (controller.dragging) {
    releaseFrontPollenSystem(controller);
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
    releaseFrontPollenSystem(controller);
    try { base.renderable = controller.baseRenderable; } catch {}
    wrapper.style.visibility = 'hidden';
    return;
  }

  const transform = host.worldTransform;
  if (!transform) {
    releaseFrontPollenSystem(controller);
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
  syncFrontPollen(controller);
  wrapper.style.visibility = 'visible';
}

function updateFlowerBouncyArtwork(frame: AnimatedSpecialArtworkFrame): void {
  controllers.forEach((controller) => syncController(controller, frame));
}

function ensureRuntimeLease(): AnimatedSpecialArtworkLayerLease | null {
  if (!runtimeLease) runtimeLease = acquireAnimatedSpecialArtworkLayer(updateFlowerBouncyArtwork);
  return runtimeLease;
}

function createController(
  tile: any,
  base: any,
  host: any,
  root: HTMLDivElement,
): FlowerBouncyController {
  const wrapper = document.createElement('div');
  wrapper.className = 'flower-bouncy-artwork';
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
    left: (FLOWER_BOUNCY_REST_ART.centerX - FLOWER_BOUNCY_VIEWBOX.x - FLOWER_BOUNCY_REST_ART.size / 2) * DISPLAY_SCALE,
    top: (FLOWER_BOUNCY_REST_ART.centerY - FLOWER_BOUNCY_VIEWBOX.y - FLOWER_BOUNCY_REST_ART.size / 2) * DISPLAY_SCALE,
    width: FLOWER_BOUNCY_DISPLAY_SIZE,
    height: FLOWER_BOUNCY_DISPLAY_SIZE,
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

  const pollenLayer = document.createElement('div');
  pollenLayer.className = 'flower-bouncy-front-pollen';
  Object.assign(pollenLayer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'visible',
    pointerEvents: 'none',
    visibility: 'hidden',
    zIndex: '2',
  });
  wrapper.appendChild(image);
  wrapper.appendChild(pollenLayer);
  root.appendChild(wrapper);

  const controller: FlowerBouncyController = {
    tile,
    base,
    host,
    wrapper,
    image,
    pollenLayer,
    pollenNodes: new Map(),
    baseRenderable: base.renderable !== false,
    dragging: false,
    ready: false,
    disposed: false,
    phaseLease: null,
  };
  image.onload = () => {
    if (controller.disposed || !isFlowerBouncyTile(tile)) return;
    controller.ready = true;
    runtimeLease?.requestSync();
  };
  image.onerror = () => {
    controller.ready = false;
    releaseFrontPollenSystem(controller);
    try { base.renderable = controller.baseRenderable; } catch {}
    wrapper.style.visibility = 'hidden';
  };
  controller.phaseLease = acquireAnimatedSvgPhase(
    FLOWER_BOUNCY_SVG_URL,
    FLOWER_BOUNCY_CYCLE_MS,
    [{ image, url: FLOWER_BOUNCY_SVG_URL }],
  );
  return controller;
}

export function startFlowerBouncyArtwork(tile: any): FlowerBouncyController | null {
  if (!isFlowerBouncyTile(tile) || tile.destroyed) {
    stopFlowerBouncyArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccFlowerBouncyArtwork;
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
  tile._ccFlowerBouncyArtwork = controller;
  lease.requestSync();
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
  setAnimatedSpecialArtworkDragging(controller.wrapper, dragging);
  controller.wrapper.style.zIndex = String(
    dragging
      ? FLOWER_BOUNCY_DRAG_Z_INDEX
      : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  if (dragging) {
    releaseFrontPollenSystem(controller);
    controller.wrapper.style.visibility = 'hidden';
    try { controller.base.renderable = true; } catch {}
  } else {
    runtimeLease?.requestSync();
  }
  return true;
}

export function destroyFlowerBouncyArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  releaseAnimatedSpecialArtworkFamily('flower');
  if (runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

export function getFlowerBouncyRuntimeStats() {
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
