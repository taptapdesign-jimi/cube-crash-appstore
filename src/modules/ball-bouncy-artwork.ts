import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import {
  acquireAnimatedSpecialArtworkLayer,
  setAnimatedSpecialArtworkDragging,
  setAnimatedSpecialArtworkPinnedForeground,
  type AnimatedSpecialArtworkFrame,
  type AnimatedSpecialArtworkLayerLease,
} from './animated-special-artwork-layer.ts';
import {
  acquireAnimatedSvgPhase,
  type AnimatedSvgPhaseLease,
} from './animated-svg-phase-scheduler.ts';
import { releaseAnimatedSpecialArtworkFamily } from './animated-special-artwork-mode.ts';

export const BALL_BOUNCY_SVG_URL = './assets/shop/ball/ball-bouncy.svg';
export const BALL_BOUNCY_VIEWBOX = Object.freeze({ width: 390, height: 440 });
export const BALL_BOUNCY_REST_ART = Object.freeze({ centerX: 195, centerY: 354, size: 148 });
export const BALL_BOUNCY_DISPLAY_SIZE = 128;
export const BALL_BOUNCY_IDLE_OFFSET_Y = 56;
export const BALL_BOUNCY_BUBBLE_ORIGIN_COMPENSATION_Y = -BALL_BOUNCY_IDLE_OFFSET_Y;
export const BALL_BOUNCY_DRAG_Z_INDEX = 12001;
export const BALL_BOUNCY_CYCLE_MS = 1400;

const DISPLAY_SCALE = BALL_BOUNCY_DISPLAY_SIZE / BALL_BOUNCY_REST_ART.size;
const DISPLAY_WIDTH = BALL_BOUNCY_VIEWBOX.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = BALL_BOUNCY_VIEWBOX.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = BALL_BOUNCY_REST_ART.centerX / BALL_BOUNCY_VIEWBOX.width;
const DISPLAY_ANCHOR_Y = BALL_BOUNCY_REST_ART.centerY / BALL_BOUNCY_VIEWBOX.height;

type BallBouncyController = {
  tile: any;
  base: any;
  host: any;
  wrapper: HTMLDivElement;
  image: HTMLImageElement;
  bubbleLayer: HTMLDivElement;
  bubbleNodes: Map<any, HTMLDivElement>;
  bubbleSystem: any | null;
  baseRenderable: boolean;
  dragging: boolean;
  ready: boolean;
  disposed: boolean;
  phaseLease: AnimatedSvgPhaseLease | null;
};

type BallIdleBubblePaint = {
  radius: number;
  color: number;
};

const controllers = new Map<any, BallBouncyController>();
let runtimeLease: AnimatedSpecialArtworkLayerLease | null = null;

export function isBeachBallBouncyTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'beach-ball';
}

export function getBallBouncyDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: BALL_BOUNCY_REST_ART.size * DISPLAY_SCALE,
    restingArtworkHeight: BALL_BOUNCY_REST_ART.size * DISPLAY_SCALE,
    idleOffsetY: BALL_BOUNCY_IDLE_OFFSET_Y,
  };
}

function colorToCss(color: number, alpha: number): string {
  const safeColor = Number.isFinite(color) ? Math.max(0, Math.min(0xFFFFFF, color | 0)) : 0xFFFFFF;
  const red = (safeColor >> 16) & 0xFF;
  const green = (safeColor >> 8) & 0xFF;
  const blue = safeColor & 0xFF;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clearFrontBubbleNodes(controller: BallBouncyController): void {
  controller.bubbleNodes.forEach((node) => {
    try { node.remove(); } catch {}
  });
  controller.bubbleNodes.clear();
}

function releaseFrontBubbleSystem(controller: BallBouncyController): void {
  const system = controller.bubbleSystem;
  if (system?._ccBallFrontBubbleOwner === controller) {
    if (system.container && !system.container.destroyed) {
      system.container.renderable = system._ccBallFrontBubbleRenderableBefore !== false;
    }
    delete system._ccBallFrontBubbleOwner;
    delete system._ccBallFrontBubbleRenderableBefore;
  }
  controller.bubbleSystem = null;
  clearFrontBubbleNodes(controller);
  controller.bubbleLayer.style.visibility = 'hidden';
}

function createFrontBubbleNode(paint: BallIdleBubblePaint): HTMLDivElement {
  const node = document.createElement('div');
  const diameter = paint.radius * 2;
  Object.assign(node.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${diameter}px`,
    height: `${diameter}px`,
    borderRadius: '50%',
    boxSizing: 'border-box',
    background: colorToCss(paint.color, 0.6),
    border: `1px solid ${colorToCss(paint.color, 0.4)}`,
    pointerEvents: 'none',
    transformOrigin: '50% 50%',
    willChange: 'transform, opacity',
  });
  const highlight = document.createElement('span');
  Object.assign(highlight.style, {
    position: 'absolute',
    left: '20%',
    top: '20%',
    width: '30%',
    height: '30%',
    borderRadius: '50%',
    background: colorToCss(paint.color, 0.8),
    pointerEvents: 'none',
  });
  node.appendChild(highlight);
  return node;
}

function syncFrontBubbles(controller: BallBouncyController): void {
  const system = controller.tile?._wildJuiceBubbleSystem;
  if (
    !controller.ready
    || controller.dragging
    || !system
    || system.disposed
    || !system.container
    || system.container.destroyed
    || !Array.isArray(system.bubbles)
  ) {
    releaseFrontBubbleSystem(controller);
    return;
  }

  if (controller.bubbleSystem !== system) {
    releaseFrontBubbleSystem(controller);
    controller.bubbleSystem = system;
    system._ccBallFrontBubbleOwner = controller;
    system._ccBallFrontBubbleRenderableBefore = system.container.renderable !== false;
  }
  // Keep the established Pixi emitter/tweens as the only motion owner. Only
  // redirect their live paint above the DOM SVG while the Ball is idle.
  system.container.renderable = false;
  controller.bubbleLayer.style.visibility = 'visible';

  const liveBubbles = new Set<any>();
  const anchorX = DISPLAY_WIDTH * DISPLAY_ANCHOR_X;
  const anchorY = DISPLAY_HEIGHT * DISPLAY_ANCHOR_Y;
  system.bubbles.forEach((bubble: any) => {
    const paint = bubble?._ccIdleBubblePaint as BallIdleBubblePaint | undefined;
    if (!bubble || bubble.destroyed || !paint) return;
    liveBubbles.add(bubble);
    let node = controller.bubbleNodes.get(bubble);
    if (!node) {
      node = createFrontBubbleNode(paint);
      controller.bubbleNodes.set(bubble, node);
      controller.bubbleLayer.appendChild(node);
    }
    const x = anchorX + (Number(bubble.x) || 0) - paint.radius;
    // The Ball artwork is intentionally lowered, but the established Pixi
    // emitter still owns coordinates around the canonical static PNG centre.
    // Cancel only the artwork offset so bubbles keep that original origin.
    const y = anchorY
      + (Number(bubble.y) || 0)
      - paint.radius
      + BALL_BOUNCY_BUBBLE_ORIGIN_COMPENSATION_Y;
    const scaleX = Number(bubble.scale?.x) || 0;
    const scaleY = Number(bubble.scale?.y) || 0;
    node.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`;
    node.style.opacity = String(Math.max(0, Math.min(1, Number(bubble.alpha) || 0)));
    node.style.visibility = bubble.visible === false || bubble.renderable === false ? 'hidden' : 'visible';
  });

  controller.bubbleNodes.forEach((node, bubble) => {
    if (liveBubbles.has(bubble)) return;
    try { node.remove(); } catch {}
    controller.bubbleNodes.delete(bubble);
  });
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

function disposeController(controller: BallBouncyController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccBallBouncyArtwork === controller) {
    delete controller.tile._ccBallBouncyArtwork;
  }
  releaseFrontBubbleSystem(controller);
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

function syncController(controller: BallBouncyController, frame: AnimatedSpecialArtworkFrame): void {
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
    || !isBeachBallBouncyTile(tile)
  ) {
    disposeController(controller);
    return;
  }

  if (!controller.dragging) {
    setAnimatedSpecialArtworkPinnedForeground(wrapper, true);
  }

  if (controller.dragging) {
    releaseFrontBubbleSystem(controller);
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
    + (transform.tx - transform.a * anchorOffsetX
      - transform.c * (anchorOffsetY - BALL_BOUNCY_IDLE_OFFSET_Y)) * scaleX;
  const f = canvasRect.top - rootRect.top
    + (transform.ty - transform.b * anchorOffsetX
      - transform.d * (anchorOffsetY - BALL_BOUNCY_IDLE_OFFSET_Y)) * scaleY;

  try { base.renderable = false; } catch {}
  wrapper.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  wrapper.style.opacity = String(getPixiBranchAlpha(base) * canvasOpacity);
  wrapper.style.zIndex = String(
    controller.dragging
      ? BALL_BOUNCY_DRAG_Z_INDEX
      : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  syncFrontBubbles(controller);
  wrapper.style.visibility = 'visible';
}

function updateBallBouncyArtwork(frame: AnimatedSpecialArtworkFrame): void {
  controllers.forEach((controller) => syncController(controller, frame));
}

function ensureRuntimeLease(): AnimatedSpecialArtworkLayerLease | null {
  if (!runtimeLease) runtimeLease = acquireAnimatedSpecialArtworkLayer(updateBallBouncyArtwork);
  return runtimeLease;
}

function createController(
  tile: any,
  base: any,
  host: any,
  root: HTMLDivElement,
): BallBouncyController {
  const wrapper = document.createElement('div');
  wrapper.className = 'ball-bouncy-artwork';
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
    zIndex: '1',
  });

  const bubbleLayer = document.createElement('div');
  bubbleLayer.className = 'ball-bouncy-front-bubbles';
  Object.assign(bubbleLayer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'visible',
    pointerEvents: 'none',
    visibility: 'hidden',
    zIndex: '2',
  });
  wrapper.appendChild(image);
  wrapper.appendChild(bubbleLayer);
  root.appendChild(wrapper);

  const controller: BallBouncyController = {
    tile,
    base,
    host,
    wrapper,
    image,
    bubbleLayer,
    bubbleNodes: new Map(),
    bubbleSystem: null,
    baseRenderable: base.renderable !== false,
    dragging: false,
    ready: false,
    disposed: false,
    phaseLease: null,
  };
  image.onload = () => {
    if (controller.disposed || !isBeachBallBouncyTile(tile)) return;
    controller.ready = true;
    runtimeLease?.requestSync();
  };
  image.onerror = () => {
    controller.ready = false;
    releaseFrontBubbleSystem(controller);
    try { base.renderable = controller.baseRenderable; } catch {}
    wrapper.style.visibility = 'hidden';
  };
  controller.phaseLease = acquireAnimatedSvgPhase(
    BALL_BOUNCY_SVG_URL,
    BALL_BOUNCY_CYCLE_MS,
    [{ image, url: BALL_BOUNCY_SVG_URL }],
  );
  return controller;
}

export function startBallBouncyArtwork(tile: any): BallBouncyController | null {
  if (!isBeachBallBouncyTile(tile) || tile.destroyed) {
    stopBallBouncyArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccBallBouncyArtwork;
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
  tile._ccBallBouncyArtwork = controller;
  lease.requestSync();
  return controller;
}

export function stopBallBouncyArtwork(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccBallBouncyArtwork;
  if (controller) disposeController(controller);
}

export function setBallBouncyArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = controllers.get(tile) || tile?._ccBallBouncyArtwork;
  if (!controller || controller.disposed || !isBeachBallBouncyTile(tile)) return false;
  controller.dragging = dragging;
  if (dragging) {
    setAnimatedSpecialArtworkDragging(controller.wrapper, true);
  } else {
    setAnimatedSpecialArtworkPinnedForeground(controller.wrapper, true);
  }
  controller.wrapper.style.zIndex = String(
    dragging ? BALL_BOUNCY_DRAG_Z_INDEX : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  if (dragging) {
    // Pointer acquisition must swap renderers synchronously; waiting for the
    // next ticker frame can leave one visible SVG frame attached to the hand.
    releaseFrontBubbleSystem(controller);
    controller.wrapper.style.visibility = 'hidden';
    try { controller.base.renderable = true; } catch {}
  } else {
    runtimeLease?.requestSync();
  }
  return true;
}

export function releaseBallBouncyFrontBubbles(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccBallBouncyArtwork;
  if (controller && !controller.disposed) releaseFrontBubbleSystem(controller);
}

export function destroyBallBouncyArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  releaseAnimatedSpecialArtworkFamily('ball');
  if (runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

export function getBallBouncyRuntimeStats() {
  return {
    controllers: controllers.size,
    ready: Array.from(controllers.values()).filter((controller) => controller.ready).length,
    runtimeAttached: runtimeLease !== null,
    overlayAttached: runtimeLease?.root.isConnected === true,
  };
}
