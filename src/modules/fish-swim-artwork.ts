import { isSpecialDiceIdlePaintable } from './special-dice-idle-visibility.ts';
import { retireFailedSpecialTickerOwner } from './special-ticker-error.ts';
import { getSpecialDiceVariantForTile } from './special-dice-registry.ts';
import {
  acquireAnimatedSpecialArtworkLayer,
  createAnimatedSpecialArtworkClip,
  setAnimatedSpecialArtworkDragging,
  setAnimatedSpecialArtworkPinnedForeground,
  type AnimatedSpecialArtworkFrame,
  type AnimatedSpecialArtworkLayerLease,
} from './animated-special-artwork-layer.ts';
import {
  acquireAnimatedTimelinePhase,
  acquireAnimatedSvgPhase,
  type AnimatedSvgPhaseLease,
} from './animated-svg-phase-scheduler.ts';
import { releaseAnimatedSpecialArtworkFamily } from './animated-special-artwork-mode.ts';
import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.ts';

export const FISH_SWIM_PNG_URL = './assets/shop/fish/fish.png';
export const FISH_SWIM_SVG_URL = './assets/shop/fish/fish.svg';
export const FISH_SWIM_HEVC_URL = './assets/shop/fish/fish-mobile-hevc.mov';
export const FISH_SWIM_VIEWBOX = Object.freeze({ minX: -24, minY: -28, width: 272, height: 280 });
export const FISH_SWIM_REST_ART = Object.freeze({ centerX: 112, centerY: 112, size: 224 });
export const FISH_SWIM_DISPLAY_SIZE = 128;
export const FISH_SWIM_CYCLE_MS = 1125;
export const FISH_SWIM_DRAG_Z_INDEX = 12001;

const DISPLAY_SCALE = FISH_SWIM_DISPLAY_SIZE / FISH_SWIM_REST_ART.size;
const DISPLAY_WIDTH = FISH_SWIM_VIEWBOX.width * DISPLAY_SCALE;
const DISPLAY_HEIGHT = FISH_SWIM_VIEWBOX.height * DISPLAY_SCALE;
const DISPLAY_ANCHOR_X = (FISH_SWIM_REST_ART.centerX - FISH_SWIM_VIEWBOX.minX)
  / FISH_SWIM_VIEWBOX.width;
const DISPLAY_ANCHOR_Y = (FISH_SWIM_REST_ART.centerY - FISH_SWIM_VIEWBOX.minY)
  / FISH_SWIM_VIEWBOX.height;
const ARTWORK_LEFT = (0 - FISH_SWIM_VIEWBOX.minX) * DISPLAY_SCALE;
const ARTWORK_TOP = (0 - FISH_SWIM_VIEWBOX.minY) * DISPLAY_SCALE;

type FishSwimController = {
  tile: any;
  base: any;
  host: any;
  wrapper: HTMLDivElement;
  artworkClip: HTMLDivElement;
  image: HTMLImageElement | null;
  video: HTMLVideoElement | null;
  mediaStarted: boolean;
  mediaSuspended: boolean;
  mediaGeneration: number;
  bubbleLayer: HTMLDivElement;
  bubbleNodes: Map<any, SVGSVGElement>;
  bubbleSystem: any | null;
  baseRenderable: boolean;
  baseScaleX: number;
  dragging: boolean;
  ready: boolean;
  disposed: boolean;
  phaseLease: AnimatedSvgPhaseLease | null;
  presentationValid: boolean;
  presentation: {
    canvasLeft: number;
    canvasTop: number;
    canvasWidth: number;
    canvasHeight: number;
    rootLeft: number;
    rootTop: number;
    screenWidth: number;
    screenHeight: number;
    canvasOpacity: number;
    a: number;
    b: number;
    c: number;
    d: number;
    tx: number;
    ty: number;
    anchorOffsetX: number;
    anchorOffsetY: number;
    branchAlpha: number;
    zIndex: number;
    parentElement: HTMLElement | null;
    transformStyle: string;
    opacityStyle: string;
    zIndexStyle: string;
  };
};

type FishIdleBubblePaint = {
  radius: number;
  color: number;
};

const controllers = new Map<any, FishSwimController>();
let runtimeLease: AnimatedSpecialArtworkLayerLease | null = null;
let fishHevcUnavailable = false;
let layerSuspended = false;

export function isFishSwimTile(tile: any): boolean {
  return !!tile && getSpecialDiceVariantForTile(tile)?.id === 'fish';
}

export function shouldFlipFishForViewport(
  globalCenterX: number,
  viewportWidth: number,
): boolean {
  return Number.isFinite(globalCenterX)
    && Number.isFinite(viewportWidth)
    && viewportWidth > 0
    && globalCenterX > viewportWidth * 0.5;
}

function applyFishDragFacing(controller: FishSwimController): void {
  const { base } = controller;
  if (!base || base.destroyed || !base.scale) return;
  if (!controller.dragging) {
    base.scale.x = controller.baseScaleX;
    return;
  }
  let globalCenterX = Number.NaN;
  try { globalCenterX = base.getGlobalPosition().x; } catch {}
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const magnitude = Math.abs(controller.baseScaleX);
  base.scale.x = shouldFlipFishForViewport(globalCenterX, viewportWidth)
    ? -magnitude
    : magnitude;
}

function colorToCss(color: number, alpha: number): string {
  const safeColor = Number.isFinite(color) ? Math.max(0, Math.min(0xFFFFFF, color | 0)) : 0xFFFFFF;
  const red = (safeColor >> 16) & 0xFF;
  const green = (safeColor >> 8) & 0xFF;
  const blue = safeColor & 0xFF;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clearFrontBubbleNodes(controller: FishSwimController): void {
  controller.bubbleNodes.forEach((node) => {
    try { node.remove(); } catch {}
  });
  controller.bubbleNodes.clear();
}

function releaseFrontBubbleSystem(controller: FishSwimController): void {
  const system = controller.bubbleSystem;
  if (system?._ccFishFrontBubbleOwner === controller) {
    if (system.container && !system.container.destroyed) {
      system.container.renderable = system._ccFishFrontBubbleRenderableBefore !== false;
    }
    delete system._ccFishFrontBubbleOwner;
    delete system._ccFishFrontBubbleRenderableBefore;
  }
  controller.bubbleSystem = null;
  clearFrontBubbleNodes(controller);
  setFishStyle(controller.bubbleLayer, 'visibility', 'hidden');
}

function createFrontBubbleNode(paint: FishIdleBubblePaint): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(namespace, 'svg');
  const radius = paint.radius;
  const diameter = radius * 2;
  node.setAttribute('viewBox', `${-radius} ${-radius} ${diameter} ${diameter}`);
  node.setAttribute('aria-hidden', 'true');
  Object.assign(node.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${diameter}px`,
    height: `${diameter}px`,
    overflow: 'visible',
    pointerEvents: 'none',
    transformOrigin: '50% 50%',
    willChange: 'transform, opacity',
  });
  // Match the Ball emitter's three Pixi draw operations exactly, including
  // the centred stroke and highlight overlap, instead of a CSS approximation.
  const circle = (x: number, y: number, r: number, alpha: number, stroke = false) => {
    const shape = document.createElementNS(namespace, 'circle');
    shape.setAttribute('cx', String(x));
    shape.setAttribute('cy', String(y));
    shape.setAttribute('r', String(r));
    shape.setAttribute('fill', stroke ? 'none' : colorToCss(paint.color, alpha));
    if (stroke) {
      shape.setAttribute('stroke', colorToCss(paint.color, alpha));
      shape.setAttribute('stroke-width', '1');
    }
    node.appendChild(shape);
  };
  circle(0, 0, radius, 0.6);
  circle(-radius * 0.2, -radius * 0.2, radius * 0.3, 0.8);
  circle(0, 0, radius, 0.4, true);
  return node;
}

function syncFrontBubbles(controller: FishSwimController): void {
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
    system._ccFishFrontBubbleOwner = controller;
    system._ccFishFrontBubbleRenderableBefore = system.container.renderable !== false;
  }
  // The established Ball/juice Pixi emitter remains the only motion owner;
  // only its live paint is mirrored over the direct Fish artwork.
  system.container.renderable = false;
  setFishStyle(controller.bubbleLayer, 'visibility', 'visible');

  const liveBubbles = new Set<any>();
  const anchorX = DISPLAY_WIDTH * DISPLAY_ANCHOR_X;
  const anchorY = DISPLAY_HEIGHT * DISPLAY_ANCHOR_Y;
  system.bubbles.forEach((bubble: any) => {
    const paint = bubble?._ccIdleBubblePaint as FishIdleBubblePaint | undefined;
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
    setFishStyle(node, 'transform', `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`);
    setFishStyle(node, 'opacity', String(Math.max(0, Math.min(1, Number(bubble.alpha) || 0))));
    setFishStyle(node, 'visibility', bubble.visible === false || bubble.renderable === false ? 'hidden' : 'visible');
  });

  controller.bubbleNodes.forEach((node, bubble) => {
    if (liveBubbles.has(bubble)) return;
    try { node.remove(); } catch {}
    controller.bubbleNodes.delete(bubble);
  });
}

export function getFishSwimDisplayGeometry() {
  return {
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    anchorX: DISPLAY_ANCHOR_X,
    anchorY: DISPLAY_ANCHOR_Y,
    restingArtworkWidth: FISH_SWIM_REST_ART.size * DISPLAY_SCALE,
    restingArtworkHeight: FISH_SWIM_REST_ART.size * DISPLAY_SCALE,
    artworkLeft: ARTWORK_LEFT,
    artworkTop: ARTWORK_TOP,
  };
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

function disposeController(controller: FishSwimController): void {
  if (controller.disposed) return;
  controller.disposed = true;
  controllers.delete(controller.tile);
  if (controller.tile?._ccFishSwimArtwork === controller) {
    delete controller.tile._ccFishSwimArtwork;
  }
  try { controller.phaseLease?.release(); } catch {}
  controller.phaseLease = null;
  try { releaseFrontBubbleSystem(controller); } catch {}
  if (controller.image) {
    controller.image.onload = null;
    controller.image.onerror = null;
    try { controller.image.remove(); } catch {}
    controller.image = null;
  }
  if (controller.video) {
    controller.video.onloadeddata = null;
    controller.video.onerror = null;
    try {
      controller.video.pause();
      controller.video.removeAttribute('src');
      controller.video.load();
    } catch {}
    try { controller.video.remove(); } catch {}
    controller.video = null;
  }
  try { controller.wrapper.remove(); } catch {}
  if (controller.base && !controller.base.destroyed) {
    try { controller.base.renderable = controller.baseRenderable; } catch {}
    try { controller.base.scale.x = controller.baseScaleX; } catch {}
  }
  if (controllers.size === 0 && runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

function suspendFishMedia(controller: FishSwimController): void {
  controller.wrapper.style.display = 'none';
  controller.presentationValid = false;
  if (controller.mediaSuspended) return;
  controller.mediaSuspended = true;
  controller.mediaGeneration++;
  try { controller.video?.pause(); } catch {}
}

function resumeFishMedia(controller: FishSwimController): void {
  const video = controller.video;
  if (!video || !controller.mediaStarted || !controller.mediaSuspended || layerSuspended) return;
  controller.mediaSuspended = false;
  const generation = ++controller.mediaGeneration;
  void video.play().then(() => {
    if (controller.disposed || controller.video !== video || generation !== controller.mediaGeneration) return;
    controller.ready = true;
    runtimeLease?.requestSync();
  }).catch(() => {
    if (controller.disposed || controller.video !== video || generation !== controller.mediaGeneration) return;
    attachSvgFallback(controller);
  });
}

function onLayerSuspension(suspended: boolean): void {
  layerSuspended = suspended;
  if (suspended) controllers.forEach(controller => {
    try { suspendFishMedia(controller); }
    catch (error) { retireFailedSpecialTickerOwner('fish', error, () => disposeController(controller)); }
  });
}

function syncController(controller: FishSwimController, frame: AnimatedSpecialArtworkFrame): void {
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
    || !isFishSwimTile(tile)
  ) {
    disposeController(controller);
    return;
  }

  if (!controller.dragging) setAnimatedSpecialArtworkPinnedForeground(wrapper, true);
  if (controller.dragging) {
    controller.presentationValid = false;
    suspendFishMedia(controller);
    releaseFrontBubbleSystem(controller);
    setFishStyle(wrapper, 'visibility', 'hidden');
    try { base.renderable = true; } catch {}
    return;
  }

  const paintable = !layerSuspended && base.visible !== false
    && isSpecialDiceIdlePaintable(tile) && canvasRect.width > 0 && canvasRect.height > 0;
  if (paintable) resumeFishMedia(controller);
  else suspendFishMedia(controller);
  const visible = controller.ready && paintable;
  if (!visible) {
    controller.presentationValid = false;
    try { base.renderable = controller.baseRenderable; } catch {}
    setFishStyle(wrapper, 'visibility', 'hidden');
    return;
  }

  const transform = host.worldTransform;
  if (!transform) {
    controller.presentationValid = false;
    suspendFishMedia(controller);
    setFishStyle(wrapper, 'visibility', 'hidden');
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
  const branchAlpha = getPixiBranchAlpha(base);
  const zIndex = Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0;
  const previous = controller.presentation;
  const presentationChanged = !controller.presentationValid
    || previous.canvasLeft !== canvasRect.left
    || previous.canvasTop !== canvasRect.top
    || previous.canvasWidth !== canvasRect.width
    || previous.canvasHeight !== canvasRect.height
    || previous.rootLeft !== rootRect.left
    || previous.rootTop !== rootRect.top
    || previous.screenWidth !== screenWidth
    || previous.screenHeight !== screenHeight
    || previous.canvasOpacity !== canvasOpacity
    || previous.a !== transform.a
    || previous.b !== transform.b
    || previous.c !== transform.c
    || previous.d !== transform.d
    || previous.tx !== transform.tx
    || previous.ty !== transform.ty
    || previous.anchorOffsetX !== anchorOffsetX
    || previous.anchorOffsetY !== anchorOffsetY
    || previous.branchAlpha !== branchAlpha
    || previous.zIndex !== zIndex
    || previous.parentElement !== wrapper.parentElement;

  try { base.renderable = false; } catch {}
  if (presentationChanged) {
    previous.canvasLeft = canvasRect.left;
    previous.canvasTop = canvasRect.top;
    previous.canvasWidth = canvasRect.width;
    previous.canvasHeight = canvasRect.height;
    previous.rootLeft = rootRect.left;
    previous.rootTop = rootRect.top;
    previous.screenWidth = screenWidth;
    previous.screenHeight = screenHeight;
    previous.canvasOpacity = canvasOpacity;
    previous.a = transform.a;
    previous.b = transform.b;
    previous.c = transform.c;
    previous.d = transform.d;
    previous.tx = transform.tx;
    previous.ty = transform.ty;
    previous.anchorOffsetX = anchorOffsetX;
    previous.anchorOffsetY = anchorOffsetY;
    previous.branchAlpha = branchAlpha;
    previous.zIndex = zIndex;
    previous.parentElement = wrapper.parentElement;
    previous.transformStyle = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
    previous.opacityStyle = String(branchAlpha * canvasOpacity);
    previous.zIndexStyle = String(zIndex);
    controller.presentationValid = true;
  }
  // Keep external style repair lossless without recreating transform/opacity
  // strings on settled frames. This protects resume/reparent owners that may
  // temporarily overwrite inline presentation between shared ticker ticks.
  if (wrapper.style.transform !== previous.transformStyle) {
    setFishStyle(wrapper, 'transform', previous.transformStyle);
  }
  if (wrapper.style.opacity !== previous.opacityStyle) {
    setFishStyle(wrapper, 'opacity', previous.opacityStyle);
  }
  if (wrapper.style.zIndex !== previous.zIndexStyle) {
    setFishStyle(wrapper, 'zIndex', previous.zIndexStyle);
  }
  syncFrontBubbles(controller);
  setFishStyle(wrapper, 'display', '');
  setFishStyle(wrapper, 'visibility', 'visible');
}

function setFishStyle(node: HTMLElement | SVGElement, property: 'transform' | 'opacity' | 'zIndex' | 'display' | 'visibility', value: string): void {
  if (node.style[property] !== value) node.style[property] = value;
}

function updateFishSwimArtwork(frame: AnimatedSpecialArtworkFrame): void {
  controllers.forEach((controller) => {
    try { syncController(controller, frame); }
    catch (error) { retireFailedSpecialTickerOwner('fish', error, () => disposeController(controller)); }
  });
}

function ensureRuntimeLease(): AnimatedSpecialArtworkLayerLease | null {
  if (!runtimeLease) runtimeLease = acquireAnimatedSpecialArtworkLayer(
    updateFishSwimArtwork, onLayerSuspension, destroyFishSwimArtworkRuntime,
  );
  return runtimeLease;
}

function configureMediaElement(media: HTMLImageElement | HTMLVideoElement): void {
  Object.assign(media.style, {
    position: 'absolute',
    inset: '0',
    width: `${DISPLAY_WIDTH}px`,
    height: `${DISPLAY_HEIGHT}px`,
    maxWidth: 'none',
    objectFit: 'contain',
    objectPosition: 'center',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: '1',
  });
  media.setAttribute('aria-hidden', 'true');
}

function attachSvgFallback(controller: FishSwimController): void {
  if (controller.disposed || controller.image) return;
  controller.ready = false;
  controller.mediaGeneration++;
  controller.wrapper.style.display = 'none';
  try { controller.base.renderable = controller.baseRenderable; } catch {}
  controller.phaseLease?.release();
  controller.phaseLease = null;
  if (controller.video) {
    controller.video.onloadeddata = null;
    controller.video.onerror = null;
    try { controller.video.pause(); } catch {}
    try { controller.video.removeAttribute('src'); controller.video.load(); } catch {}
    controller.video.remove();
    controller.video = null;
  }
  const image = new Image();
  image.alt = '';
  image.draggable = false;
  image.decoding = 'async';
  image.dataset.fishSwimSource = 'svg-fallback';
  configureMediaElement(image);
  controller.image = image;
  controller.artworkClip.appendChild(image);
  image.onload = () => {
    if (controller.disposed || controller.image !== image || !isFishSwimTile(controller.tile)) return;
    controller.ready = true;
    runtimeLease?.requestSync();
  };
  image.onerror = () => {
    if (controller.disposed || controller.image !== image) return;
    controller.ready = false;
    suspendFishMedia(controller);
    try { controller.base.renderable = controller.baseRenderable; } catch {}
    controller.wrapper.style.visibility = 'hidden';
  };
  controller.phaseLease = acquireAnimatedSvgPhase(
    'fish-swim-composition',
    FISH_SWIM_CYCLE_MS,
    [{ image, url: FISH_SWIM_SVG_URL }],
  );
}

function attachIosHevc(controller: FishSwimController): void {
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = false;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.disablePictureInPicture = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.dataset.fishSwimSource = 'hevc-alpha';
  configureMediaElement(video);
  controller.video = video;
  controller.artworkClip.appendChild(video);
  video.onloadeddata = () => {
    if (
      controller.disposed
      || controller.video !== video
      || !isFishSwimTile(controller.tile)
      || controller.phaseLease
    ) return;
    controller.phaseLease = acquireAnimatedTimelinePhase(
      'fish-swim-composition',
      FISH_SWIM_CYCLE_MS,
      [{
        element: video,
        start: () => {
          if (controller.disposed || controller.video !== video || !isFishSwimTile(controller.tile)) return;
          try { video.currentTime = 0; } catch {}
          controller.mediaStarted = true;
          runtimeLease?.requestSync();
        },
      }],
    );
  };
  video.onerror = () => {
    if (controller.disposed || controller.video !== video) return;
    fishHevcUnavailable = true;
    controller.ready = false;
    attachSvgFallback(controller);
  };
  video.src = FISH_SWIM_HEVC_URL;
  try { video.load(); } catch {
    fishHevcUnavailable = true;
    attachSvgFallback(controller);
  }
}

function createController(
  tile: any,
  base: any,
  host: any,
  root: HTMLDivElement,
): FishSwimController {
  const wrapper = document.createElement('div');
  wrapper.className = 'fish-swim-artwork';
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
  const artworkClip = createAnimatedSpecialArtworkClip(wrapper);
  const bubbleLayer = document.createElement('div');
  bubbleLayer.className = 'fish-swim-front-bubbles';
  Object.assign(bubbleLayer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'visible',
    pointerEvents: 'none',
    visibility: 'hidden',
    zIndex: '2',
  });
  wrapper.appendChild(bubbleLayer);
  root.appendChild(wrapper);

  const controller: FishSwimController = {
    tile,
    base,
    host,
    wrapper,
    artworkClip,
    image: null,
    video: null,
    mediaStarted: false,
    mediaSuspended: true,
    mediaGeneration: 0,
    bubbleLayer,
    bubbleNodes: new Map(),
    bubbleSystem: null,
    baseRenderable: base.renderable !== false,
    baseScaleX: base.scale?.x ?? 1,
    dragging: false,
    ready: false,
    disposed: false,
    phaseLease: null,
    presentationValid: false,
    presentation: {
      canvasLeft: 0,
      canvasTop: 0,
      canvasWidth: 0,
      canvasHeight: 0,
      rootLeft: 0,
      rootTop: 0,
      screenWidth: 0,
      screenHeight: 0,
      canvasOpacity: 0,
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      tx: 0,
      ty: 0,
      anchorOffsetX: 0,
      anchorOffsetY: 0,
      branchAlpha: 0,
      zIndex: 0,
      parentElement: null,
      transformStyle: '',
      opacityStyle: '',
      zIndexStyle: '',
    },
  };
  if (MOBILE_RUNTIME_PROFILE.platform === 'ios' && !fishHevcUnavailable) {
    attachIosHevc(controller);
  } else {
    attachSvgFallback(controller);
  }
  return controller;
}

export function startFishSwimArtwork(tile: any): FishSwimController | null {
  if (!isFishSwimTile(tile) || tile.destroyed) {
    stopFishSwimArtwork(tile);
    return null;
  }
  const existing = controllers.get(tile) || tile._ccFishSwimArtwork;
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
  tile._ccFishSwimArtwork = controller;
  lease.requestSync();
  return controller;
}

export function stopFishSwimArtwork(tile: any): void {
  if (!tile) return;
  const controller = controllers.get(tile) || tile._ccFishSwimArtwork;
  if (controller) disposeController(controller);
}

export function setFishSwimArtworkDragging(tile: any, dragging: boolean): boolean {
  const controller = controllers.get(tile) || tile?._ccFishSwimArtwork;
  if (!controller || controller.disposed || !isFishSwimTile(tile)) return false;
  controller.dragging = dragging;
  applyFishDragFacing(controller);
  if (dragging) {
    suspendFishMedia(controller);
    releaseFrontBubbleSystem(controller);
    setAnimatedSpecialArtworkDragging(controller.wrapper, true);
    controller.wrapper.style.visibility = 'hidden';
    try { controller.base.renderable = true; } catch {}
  } else {
    setAnimatedSpecialArtworkPinnedForeground(controller.wrapper, true);
    runtimeLease?.requestSync();
  }
  controller.wrapper.style.zIndex = String(
    dragging ? FISH_SWIM_DRAG_Z_INDEX : (Number.isFinite(tile.zIndex) ? Math.round(tile.zIndex) : 0),
  );
  return true;
}

export function refreshFishSwimArtworkDragFacing(tile: any): void {
  const controller = controllers.get(tile) || tile?._ccFishSwimArtwork;
  if (!controller || controller.disposed || !isFishSwimTile(tile)) return;
  applyFishDragFacing(controller);
}

export function destroyFishSwimArtworkRuntime(): void {
  Array.from(controllers.values()).forEach(disposeController);
  releaseAnimatedSpecialArtworkFamily('fish');
  if (runtimeLease) {
    runtimeLease.release();
    runtimeLease = null;
  }
}

export function getFishSwimRuntimeStats() {
  return {
    controllers: controllers.size,
    ready: Array.from(controllers.values()).filter((controller) => controller.ready).length,
    hevc: Array.from(controllers.values()).filter((controller) => controller.video !== null).length,
    svg: Array.from(controllers.values()).filter((controller) => controller.image !== null).length,
    runtimeAttached: runtimeLease !== null,
    overlayAttached: runtimeLease?.root.isConnected === true,
  };
}
