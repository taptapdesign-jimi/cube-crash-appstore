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

export const JUICE_BOUNCE_SVG_URL = './assets/shop/juice/juice-bounce.svg';

/**
 * The authored SVG has a tall transparent stage so its 2s jump can travel
 * above the resting cup. Crop only guaranteed-empty margin; never crop motion.
 */
export const JUICE_BOUNCE_VIEWBOX = Object.freeze({ width: 390, height: 800 });
export const JUICE_BOUNCE_CROP = Object.freeze({ x: 20, y: 110, width: 350, height: 460 });
export const JUICE_BOUNCE_REST_ART = Object.freeze({
  centerX: 53 + (384 * 0.78) / 2,
  centerY: 239 + (384 * 0.78) / 2,
  size: 384 * 0.78,
});
export const JUICE_BOUNCE_DISPLAY_SIZE = 128;
export const JUICE_BOUNCE_DRAG_Z_INDEX = 12001;
export const JUICE_BOUNCE_CYCLE_MS = 2000;

const DISPLAY_SCALE = JUICE_BOUNCE_DISPLAY_SIZE / JUICE_BOUNCE_REST_ART.size;
const DISPLAY_WIDTH = JUICE_BOUNCE_CROP.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = JUICE_BOUNCE_CROP.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = (JUICE_BOUNCE_REST_ART.centerX - JUICE_BOUNCE_CROP.x)
  / JUICE_BOUNCE_CROP.width;
const DISPLAY_ANCHOR_Y = (JUICE_BOUNCE_REST_ART.centerY - JUICE_BOUNCE_CROP.y)
  / JUICE_BOUNCE_CROP.height;

type JuiceBounceController = {
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

type JuiceIdleBubblePaint = {
  radius: number;
  color: number;
};

const controllers = new Map<any, JuiceBounceController>();
let runtimeLease: AnimatedSpecialArtworkLayerLease | null = null;

export function isPlainJuiceBounceTile(tile: any): boolean {
  return !!tile
    && tile.special === 'wild-juice'
    && getSpecialDiceVariantForTile(tile) === null;
}

export function getJuiceBounceDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: JUICE_BOUNCE_REST_ART.size * DISPLAY_SCALE,
    restingArtworkHeight: JUICE_BOUNCE_REST_ART.size * DISPLAY_SCALE,
  };
}

function colorToCss(color: number, alpha: number): string {
  const safeColor = Number.isFinite(color) ? Math.max(0, Math.min(0xFFFFFF, color | 0)) : 0xFFFFFF;
  const red = (safeColor >> 16) & 0xFF;
  const green = (safeColor >> 8) & 0xFF;
  const blue = safeColor & 0xFF;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clearFrontBubbleNodes(controller: JuiceBounceController): void {
  controller.bubbleNodes.forEach((node) => {
    try { node.remove(); } catch {}
  });
  controller.bubbleNodes.clear();
}

function releaseFrontBubbleSystem(controller: JuiceBounceController): void {
  const system = controller.bubbleSystem;
  if (system?._ccJuiceFrontBubbleOwner === controller) {
    if (system.container && !system.container.destroyed) {
      system.container.renderable = system._ccJuiceFrontBubbleRenderableBefore !== false;
    }
    delete system._ccJuiceFrontBubbleOwner;
    delete system._ccJuiceFrontBubbleRenderableBefore;
  }
  controller.bubbleSystem = null;
  clearFrontBubbleNodes(controller);
  controller.bubbleLayer.style.visibility = 'hidden';
}

function createFrontBubbleNode(paint: JuiceIdleBubblePaint): HTMLDivElement {
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

function syncFrontBubbles(controller: JuiceBounceController): void {
  const system = controller.tile?._wildJuiceBubbleSystem;
  if (
    !controller.ready
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
    system._ccJuiceFrontBubbleOwner = controller;
    system._ccJuiceFrontBubbleRenderableBefore = system.container.renderable !== false;
  }
  // The same animation system continues to own every bubble and tween. Only
  // its paint target moves above the live SVG so there is never a duplicate.
  system.container.renderable = false;
  controller.bubbleLayer.style.visibility = 'visible';

  const liveBubbles = new Set<any>();
  const anchorX = DISPLAY_WIDTH * DISPLAY_ANCHOR_X;
  const anchorY = DISPLAY_HEIGHT * DISPLAY_ANCHOR_Y;
  system.bubbles.forEach((bubble: any) => {
    const paint = bubble?._ccIdleBubblePaint as JuiceIdleBubblePaint | undefined;
    if (!bubble || bubble.destroyed || !paint) return;
    liveBubbles.add(bubble);
    let node = controller.bubbleNodes.get(bubble);
    if (!node) {
      node = createFrontBubbleNode(paint);
      controller.bubbleNodes.set(bubble, node);
      controller.bubbleLayer.appendChild(node);
    }
    const x = anchorX + (Number(bubble.x) || 0) - paint.radius;
    const y = anchorY + (Number(bubble.y) || 0) - paint.radius;
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

function disposeController(controller: JuiceBounceController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccJuiceBounceArtwork === controller) {
    delete controller.tile._ccJuiceBounceArtwork;
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
  if (controllers.size === 0) {
    runtimeLease?.release();
    runtimeLease = null;
  }
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

function syncController(
  controller: JuiceBounceController,
  canvasRect: DOMRect,
  rootRect: DOMRect,
  screenWidth: number,
  screenHeight: number,
  canvasOpacity: number,
  gameplayDragActive: boolean,
  gameplayDragBounds: AnimatedSpecialArtworkFrame['gameplayDragBounds'],
): void {
  const { tile, base, host, wrapper } = controller;
  if (
    controller.disposed
    || !tile
    || tile.destroyed
    || !base
    || base.destroyed
    || !host
    || host.destroyed
    || !isPlainJuiceBounceTile(tile)
  ) {
    disposeController(controller);
    return;
  }

  // The shared canvas moves above the idle DOM-SVG root during any drag. An
  // SVG that is not itself being dragged must therefore swap to its proven
  // Pixi PNG fallback; otherwise it visibly bounces underneath grid ghosts.
  if (
    gameplayDragActive
    && !controller.dragging
    && doesAnimatedSpecialArtworkOverlapGameplayDrag(wrapper, gameplayDragBounds)
  ) {
    releaseFrontBubbleSystem(controller);
    try { base.renderable = controller.baseRenderable; } catch {}
    wrapper.style.visibility = 'hidden';
    return;
  }

  const visible = controller.ready
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
  wrapper.style.zIndex = String(
    controller.dragging
      ? JUICE_BOUNCE_DRAG_Z_INDEX
      : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  syncFrontBubbles(controller);
  wrapper.style.visibility = 'visible';
}

function updateJuiceBounceArtwork(frame: AnimatedSpecialArtworkFrame): void {
  const {
    canvasRect,
    rootRect,
    screenWidth,
    screenHeight,
    canvasOpacity,
    gameplayDragActive,
    gameplayDragBounds,
  } = frame;
  controllers.forEach((controller) => syncController(
    controller,
    canvasRect,
    rootRect,
    screenWidth,
    screenHeight,
    canvasOpacity,
    gameplayDragActive,
    gameplayDragBounds,
  ));
}

function ensureRuntimeLease(): AnimatedSpecialArtworkLayerLease | null {
  if (!runtimeLease) runtimeLease = acquireAnimatedSpecialArtworkLayer(updateJuiceBounceArtwork);
  return runtimeLease;
}

function createController(tile: any, base: any, host: any, root: HTMLDivElement): JuiceBounceController {
  const wrapper = document.createElement('div');
  wrapper.className = 'juice-bounce-artwork';
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
    left: `${-JUICE_BOUNCE_CROP.x * DISPLAY_SCALE}px`,
    top: `${-JUICE_BOUNCE_CROP.y * DISPLAY_SCALE}px`,
    width: `${JUICE_BOUNCE_VIEWBOX.width * DISPLAY_SCALE}px`,
    height: `${JUICE_BOUNCE_VIEWBOX.height * DISPLAY_SCALE}px`,
    maxWidth: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: '1',
  });

  const bubbleLayer = document.createElement('div');
  bubbleLayer.className = 'juice-bounce-front-bubbles';
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

  const controller: JuiceBounceController = {
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
    if (controller.disposed || !isPlainJuiceBounceTile(tile)) return;
    controller.ready = true;
    base.renderable = false;
    runtimeLease?.requestSync();
  };
  image.onerror = () => {
    // The proven PNG remains visible because base rendering is disabled only
    // after a successful SVG load.
    controller.ready = false;
    wrapper.style.visibility = 'hidden';
  };
  controller.phaseLease = acquireAnimatedSvgPhase(
    JUICE_BOUNCE_SVG_URL,
    JUICE_BOUNCE_CYCLE_MS,
    [{ image, url: JUICE_BOUNCE_SVG_URL }],
  );
  return controller;
}

export function startJuiceBounceArtwork(tile: any): JuiceBounceController | null {
  if (!isPlainJuiceBounceTile(tile) || tile.destroyed) {
    stopJuiceBounceArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccJuiceBounceArtwork;
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
  tile._ccJuiceBounceArtwork = controller;
  lease.requestSync();
  return controller;
}

export function stopJuiceBounceArtwork(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccJuiceBounceArtwork;
  if (controller) disposeController(controller);
}

export function releaseJuiceBounceFrontBubbles(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccJuiceBounceArtwork;
  if (controller && !controller.disposed) releaseFrontBubbleSystem(controller);
}

export function setJuiceBounceArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = controllers.get(tile) || tile?._ccJuiceBounceArtwork;
  if (!controller || controller.disposed || !isPlainJuiceBounceTile(tile)) return false;
  controller.dragging = dragging;
  setAnimatedSpecialArtworkDragging(controller.wrapper, dragging);
  // A dragged Juice shares the canonical Pixi drag priority (12000), plus one
  // DOM step so its live SVG remains above every canvas-rendered die.
  controller.wrapper.style.zIndex = String(
    dragging ? JUICE_BOUNCE_DRAG_Z_INDEX : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  return true;
}

export function destroyJuiceBounceArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  if (runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

export function getJuiceBounceRuntimeStats() {
  return {
    controllers: controllers.size,
    ready: Array.from(controllers.values()).filter((controller) => controller.ready).length,
    tickerAttached: runtimeLease !== null,
    overlayAttached: runtimeLease?.root.isConnected === true,
  };
}
