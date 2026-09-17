import { UPDATE_PRIORITY, type Ticker } from 'pixi.js';
import { STATE } from './app-state.ts';

export type AnimatedSpecialArtworkFrame = {
  canvasRect: DOMRect;
  rootRect: DOMRect;
  screenWidth: number;
  screenHeight: number;
  canvasOpacity: number;
  gameplayDragActive: boolean;
};

export type AnimatedSpecialArtworkLayerLease = {
  root: HTMLDivElement;
  requestSync: () => void;
  release: () => void;
};

type FrameOwner = (frame: AnimatedSpecialArtworkFrame) => void;

export type AnimatedSpecialArtworkPinnedForegroundOptions = {
  preserveDuringFinale?: boolean;
};


const frameOwners = new Set<FrameOwner>();
const suspensionOwners = new Map<FrameOwner, (suspended: boolean) => void>();
let layerSuspended = false;
let overlayRoot: HTMLDivElement | null = null;
let occludedOverlayRoot: HTMLDivElement | null = null;
let dragOverlayRoot: HTMLDivElement | null = null;
let pinnedForegroundOverlayRoot: HTMLDivElement | null = null;
let finalePersistentForegroundOverlayRoot: HTMLDivElement | null = null;
let carrierForegroundOverlayRoot: HTMLDivElement | null = null;
let spawnedDieForegroundOverlayRoot: HTMLDivElement | null = null;
let ticker: Ticker | null = null;
let finaleDepthOwners = 0;
let lastDragDepthDiagnostic = '';

function isGameplayDragActive(): boolean {
  try {
    return (window as any).__ccGameplayDragActive === true
      || document.body?.classList.contains('gameplay-drag-active') === true;
  } catch {
    return false;
  }
}

function getLiveTicker(): Ticker | null {
  const candidate = STATE.app?.ticker as Ticker | null | undefined;
  return candidate && !(candidate as any).destroyed ? candidate : null;
}

function setLayerStyle(root: HTMLElement, property: 'zIndex' | 'visibility' | 'display', value: string): void {
  if (root.style[property] !== value) root.style[property] = value;
}

function syncOverlayZIndex(
  root: HTMLDivElement,
  canvas: HTMLCanvasElement,
  canvasStyle = getComputedStyle(canvas),
): void {
  const parsedCanvasZIndex = Number.parseFloat(canvasStyle.zIndex || '1');
  const canvasZIndex = Number.isFinite(parsedCanvasZIndex) ? parsedCanvasZIndex : 1;
  // Direct-DOM dice normally paint above Pixi. During a merge-6 finale the
  // canvas must instead own the complete foreground so its Pixi particles,
  // debris and characters can cross every SVG die. The renderer is explicitly
  // transparent, so lowering this sibling preserves the dice themselves.
  const gameplayDragActive = isGameplayDragActive();
  setLayerStyle(root, 'zIndex', finaleDepthOwners > 0 && !gameplayDragActive
    ? String(Math.max(0, canvasZIndex - 1))
    : String(Math.max(11, canvasZIndex + 1)));
  if (occludedOverlayRoot) {
    // Keep a live idle SVG immediately below the transparent Pixi canvas only
    // while a dragged die crosses it. Moving the same wrapper preserves the
    // SVG playhead; the canvas still paints the active drag above it.
    setLayerStyle(occludedOverlayRoot, 'zIndex', String(Math.max(0, canvasZIndex - 1)));
  }
  if (dragOverlayRoot) {
    // A real pointer owner is always the highest paint owner. Finale/input
    // locks normally prevent overlap, but a stale or interrupted finale lease
    // must never force a live dragged SVG beneath the Pixi HUD.
    setLayerStyle(dragOverlayRoot, 'zIndex', gameplayDragActive
      ? String(Math.max(12_001, canvasZIndex + 1))
      : String(finaleDepthOwners > 0
        ? Math.max(0, canvasZIndex - 1)
        : Math.max(11, canvasZIndex + 1)));
  }
  if (pinnedForegroundOverlayRoot) {
    // Ordinary pinned artwork still yields to a merge-6 finale so the Pixi
    // canvas can own its complete particle foreground.
    setLayerStyle(pinnedForegroundOverlayRoot, 'zIndex', finaleDepthOwners > 0 && !gameplayDragActive
      ? String(Math.max(0, canvasZIndex - 1))
      : String(gameplayDragActive
        ? Math.max(12_002, canvasZIndex + 2)
        : Math.max(12, canvasZIndex + 2)));
  }
  if (finalePersistentForegroundOverlayRoot) {
    // Beach Ball is a bounded exception: its wide authored idle hop must not
    // fall below board ghosts just because a different Special owns a finale.
    // Ball's own idle wrapper is disposed before its merge-6 finale begins.
    setLayerStyle(finalePersistentForegroundOverlayRoot, 'zIndex', gameplayDragActive
      ? String(Math.max(12_002, canvasZIndex + 2))
      : String(Math.max(12, canvasZIndex + 2)));
  }
  if (carrierForegroundOverlayRoot) {
    setLayerStyle(carrierForegroundOverlayRoot, 'zIndex', String(Math.max(12_003, canvasZIndex + 3)));
  }
  if (spawnedDieForegroundOverlayRoot) {
    setLayerStyle(spawnedDieForegroundOverlayRoot, 'zIndex', String(Math.max(12_004, canvasZIndex + 4)));
  }
  try {
    if ((window as any).__ccDragDepthDiagnostics === true) {
      const payload = {
        gameplayDragActive,
        finaleDepthOwners,
        canvasZIndex,
        idleSvgRootZIndex: Number(root.style.zIndex),
        dragSvgRootZIndex: dragOverlayRoot ? Number(dragOverlayRoot.style.zIndex) : null,
        draggedSvgWrappers: dragOverlayRoot?.childElementCount ?? 0,
      };
      const signature = JSON.stringify(payload);
      if (signature !== lastDragDepthDiagnostic) {
        lastDragDepthDiagnostic = signature;
        console.info('[CC_DRAG_DEPTH]', payload);
      }
    }
  } catch {}
}

function ensureOccludedOverlayRoot(): HTMLDivElement | null {
  const root = ensureOverlayRoot();
  const parent = root?.parentElement;
  if (!root || !parent) return null;
  if (!occludedOverlayRoot) {
    occludedOverlayRoot = document.createElement('div');
    occludedOverlayRoot.className = 'animated-special-artwork-occluded-layer';
    occludedOverlayRoot.setAttribute('aria-hidden', 'true');
    Object.assign(occludedOverlayRoot.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '0',
    });
  }
  if (occludedOverlayRoot.parentElement !== parent) parent.appendChild(occludedOverlayRoot);
  const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
  if (canvas) syncOverlayZIndex(root, canvas);
  return occludedOverlayRoot;
}

function ensureOverlayRoot(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
  const parent = canvas?.parentElement;
  if (!canvas || !parent) return null;
  let shouldSyncZIndex = false;
  if (!overlayRoot) {
    overlayRoot = document.createElement('div');
    overlayRoot.className = 'animated-special-artwork-layer';
    overlayRoot.setAttribute('aria-hidden', 'true');
    Object.assign(overlayRoot.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '11',
    });
    shouldSyncZIndex = true;
  }
  if (overlayRoot.parentElement !== parent) {
    parent.appendChild(overlayRoot);
    shouldSyncZIndex = true;
  }
  // The ticker update below already performs the per-frame style read. Only
  // synchronize here when the root is newly created/reparented so we do not
  // double getComputedStyle() work on every animation frame.
  if (shouldSyncZIndex) syncOverlayZIndex(overlayRoot, canvas);
  return overlayRoot;
}

function ensureDragOverlayRoot(): HTMLDivElement | null {
  const root = ensureOverlayRoot();
  const parent = root?.parentElement;
  if (!root || !parent) return null;
  if (!dragOverlayRoot) {
    dragOverlayRoot = document.createElement('div');
    dragOverlayRoot.className = 'animated-special-artwork-drag-layer';
    dragOverlayRoot.setAttribute('aria-hidden', 'true');
    Object.assign(dragOverlayRoot.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '12001',
    });
  }
  if (dragOverlayRoot.parentElement !== parent) parent.appendChild(dragOverlayRoot);
  const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
  if (canvas) syncOverlayZIndex(root, canvas);
  return dragOverlayRoot;
}

function ensurePinnedForegroundOverlayRoot(): HTMLDivElement | null {
  const root = ensureOverlayRoot();
  const parent = root?.parentElement;
  if (!root || !parent) return null;
  let shouldSyncZIndex = false;
  if (!pinnedForegroundOverlayRoot) {
    pinnedForegroundOverlayRoot = document.createElement('div');
    pinnedForegroundOverlayRoot.className = 'animated-special-artwork-pinned-foreground-layer';
    pinnedForegroundOverlayRoot.setAttribute('aria-hidden', 'true');
    Object.assign(pinnedForegroundOverlayRoot.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '12',
    });
    shouldSyncZIndex = true;
  }
  if (pinnedForegroundOverlayRoot.parentElement !== parent) {
    parent.appendChild(pinnedForegroundOverlayRoot);
    shouldSyncZIndex = true;
  }
  // Fish owners ask for this same root on every frame. The shared layer has
  // already synchronized depth before invoking them; another computed-style
  // read here would run after each preceding Fish's DOM transform writes.
  // New/reparented roots still synchronize immediately, as do explicit
  // finale/drag depth changes through their established refresh owners.
  if (shouldSyncZIndex) {
    const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
    if (canvas) syncOverlayZIndex(root, canvas);
  }
  return pinnedForegroundOverlayRoot;
}

function ensureFinalePersistentForegroundOverlayRoot(): HTMLDivElement | null {
  const root = ensureOverlayRoot();
  const parent = root?.parentElement;
  if (!root || !parent) return null;
  if (!finalePersistentForegroundOverlayRoot) {
    finalePersistentForegroundOverlayRoot = document.createElement('div');
    finalePersistentForegroundOverlayRoot.className = 'animated-special-artwork-finale-persistent-foreground-layer';
    finalePersistentForegroundOverlayRoot.setAttribute('aria-hidden', 'true');
    Object.assign(finalePersistentForegroundOverlayRoot.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '12',
    });
  }
  if (finalePersistentForegroundOverlayRoot.parentElement !== parent) {
    parent.appendChild(finalePersistentForegroundOverlayRoot);
  }
  const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
  if (canvas) syncOverlayZIndex(root, canvas);
  return finalePersistentForegroundOverlayRoot;
}

export function getAnimatedSpecialArtworkCarrierForegroundRoot(): HTMLDivElement | null {
  const root = ensureOverlayRoot();
  const parent = root?.parentElement;
  if (!root || !parent) return null;
  if (!carrierForegroundOverlayRoot) {
    carrierForegroundOverlayRoot = document.createElement('div');
    carrierForegroundOverlayRoot.className = 'animated-special-artwork-carrier-foreground-layer';
    carrierForegroundOverlayRoot.setAttribute('aria-hidden', 'true');
    Object.assign(carrierForegroundOverlayRoot.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '12003',
    });
  }
  if (carrierForegroundOverlayRoot.parentElement !== parent) parent.appendChild(carrierForegroundOverlayRoot);
  const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
  if (canvas) syncOverlayZIndex(root, canvas);
  return carrierForegroundOverlayRoot;
}

export function getAnimatedSpecialArtworkSpawnedDieForegroundRoot(): HTMLDivElement | null {
  const root = ensureOverlayRoot();
  const parent = root?.parentElement;
  if (!root || !parent) return null;
  if (!spawnedDieForegroundOverlayRoot) {
    spawnedDieForegroundOverlayRoot = document.createElement('div');
    spawnedDieForegroundOverlayRoot.className = 'animated-special-artwork-spawned-die-foreground-layer';
    spawnedDieForegroundOverlayRoot.setAttribute('aria-hidden', 'true');
    Object.assign(spawnedDieForegroundOverlayRoot.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '12004',
    });
  }
  if (spawnedDieForegroundOverlayRoot.parentElement !== parent) parent.appendChild(spawnedDieForegroundOverlayRoot);
  const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
  if (canvas) syncOverlayZIndex(root, canvas);
  return spawnedDieForegroundOverlayRoot;
}

function detachTicker(): void {
  if (!ticker) return;
  try { ticker.remove(updateAnimatedSpecialArtworkLayer); } catch {}
  ticker = null;
}

function ensureTicker(): void {
  const nextTicker = getLiveTicker();
  if (ticker === nextTicker) return;
  detachTicker();
  if (!nextTicker) return;
  ticker = nextTicker;
  // Run after Pixi's transform pass so DOM artwork follows the exact canvas
  // pose during drag, board motion and cleanup without starting another RAF.
  ticker.add(updateAnimatedSpecialArtworkLayer, undefined, UPDATE_PRIORITY.LOW - 1);
}

function releaseRuntimeWhenUnused(): void {
  if (frameOwners.size > 0) return;
  document.removeEventListener('visibilitychange', updateAnimatedSpecialArtworkLayer);
  layerSuspended = false;
  detachTicker();
  if (overlayRoot) {
    try { overlayRoot.remove(); } catch {}
    overlayRoot = null;
  }
  if (occludedOverlayRoot) {
    try { occludedOverlayRoot.remove(); } catch {}
    occludedOverlayRoot = null;
  }
  if (dragOverlayRoot) {
    try { dragOverlayRoot.remove(); } catch {}
    dragOverlayRoot = null;
  }
  if (pinnedForegroundOverlayRoot) {
    try { pinnedForegroundOverlayRoot.remove(); } catch {}
    pinnedForegroundOverlayRoot = null;
  }
  if (finalePersistentForegroundOverlayRoot) {
    try { finalePersistentForegroundOverlayRoot.remove(); } catch {}
    finalePersistentForegroundOverlayRoot = null;
  }
  if (carrierForegroundOverlayRoot) {
    try { carrierForegroundOverlayRoot.remove(); } catch {}
    carrierForegroundOverlayRoot = null;
  }
  if (spawnedDieForegroundOverlayRoot) {
    try { spawnedDieForegroundOverlayRoot.remove(); } catch {}
    spawnedDieForegroundOverlayRoot = null;
  }
  lastDragDepthDiagnostic = '';
}

function publishLayerSuspension(suspended: boolean): void {
  if (layerSuspended === suspended) return;
  layerSuspended = suspended;
  suspensionOwners.forEach((owner) => { try { owner(suspended); } catch {} });
}

function setLayerRootsPaintable(paintable: boolean): void {
  [overlayRoot, occludedOverlayRoot, dragOverlayRoot, pinnedForegroundOverlayRoot,
    finalePersistentForegroundOverlayRoot, carrierForegroundOverlayRoot, spawnedDieForegroundOverlayRoot]
    .forEach((root) => {
      if (!root) return;
      // visibility is overridable by animated descendants; display is not.
      setLayerStyle(root, 'visibility', paintable ? 'visible' : 'hidden');
      setLayerStyle(root, 'display', paintable ? '' : 'none');
    });
}

function updateAnimatedSpecialArtworkLayer(): void {
  const root = ensureOverlayRoot();
  const app = STATE.app;
  const canvas = app?.canvas as HTMLCanvasElement | null | undefined;
  if (document.hidden || !root || !canvas || !app?.renderer) {
    publishLayerSuspension(true);
    setLayerRootsPaintable(false);
    return;
  }

  const canvasStyle = getComputedStyle(canvas);
  const parsedOpacity = Number.parseFloat(canvasStyle.opacity || '1');
  const canvasOpacity = Number.isFinite(parsedOpacity) ? parsedOpacity : 1;
  syncOverlayZIndex(root, canvas, canvasStyle);
  const canvasPaintable = canvasStyle.display !== 'none'
    && canvasStyle.visibility !== 'hidden'
    && canvasOpacity > 0.001;
  if (!canvasPaintable) {
    publishLayerSuspension(true);
    setLayerRootsPaintable(false);
    return;
  }
  publishLayerSuspension(false);
  setLayerRootsPaintable(true);

  const canvasRect = canvas.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const screen = app.renderer.screen;
  const frame: AnimatedSpecialArtworkFrame = {
    canvasRect,
    rootRect,
    screenWidth: screen.width,
    screenHeight: screen.height,
    canvasOpacity,
    gameplayDragActive: isGameplayDragActive(),
  };
  Array.from(frameOwners).forEach((owner) => {
    try { owner(frame); } catch {}
  });
}

/**
 * Keep authored SVG/video pixels inside their declared motion canvas without
 * clipping sibling FX (for example idle bubbles that intentionally rise above
 * the die). The outer transformed wrapper must remain overflow-visible.
 */
export function createAnimatedSpecialArtworkClip(wrapper: HTMLElement): HTMLDivElement {
  const clip = document.createElement('div');
  clip.className = 'animated-special-artwork-clip';
  Object.assign(clip.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '1',
  });
  wrapper.appendChild(clip);
  return clip;
}

export function acquireAnimatedSpecialArtworkFinaleDepth(): () => void {
  finaleDepthOwners += 1;
  const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
  if (overlayRoot && canvas) syncOverlayZIndex(overlayRoot, canvas);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    finaleDepthOwners = Math.max(0, finaleDepthOwners - 1);
    const liveCanvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
    if (overlayRoot && liveCanvas) syncOverlayZIndex(overlayRoot, liveCanvas);
  };
}

/**
 * Moves only the actively dragged SVG wrapper into a sibling foreground root.
 * The normal SVG root remains live above Pixi; each overlapping idle owner
 * selects its scoped occlusion policy while the active wrapper stays above
 * every canvas-rendered die.
 */
export function setAnimatedSpecialArtworkDragging(
  wrapper: HTMLDivElement,
  dragging: boolean,
): void {
  if (!wrapper) return;
  const destination = dragging ? ensureDragOverlayRoot() : ensureOverlayRoot();
  if (destination && wrapper.parentElement !== destination) destination.appendChild(wrapper);
  refreshAnimatedSpecialArtworkDepth();
}

/**
 * Keeps an idle direct-SVG owner alive while the Pixi drag crosses it. The
 * same DOM wrapper moves below the transparent canvas instead of switching to
 * a static PNG fallback, so its internal SMIL clock never stops or restarts.
 */
export function setAnimatedSpecialArtworkOccluded(
  wrapper: HTMLDivElement,
  occluded: boolean,
): void {
  if (!wrapper) return;
  const destination = occluded ? ensureOccludedOverlayRoot() : ensureOverlayRoot();
  if (destination && wrapper.parentElement !== destination) destination.appendChild(wrapper);
}

/**
 * Pins an authored idle SVG above every gameplay die/ghost and active SVG drag.
 * This is intentionally separate from the pointer-owned drag portal so the
 * artwork can keep its idle playhead without claiming gameplay input.
 */
export function setAnimatedSpecialArtworkPinnedForeground(
  wrapper: HTMLDivElement,
  pinned: boolean,
  options: AnimatedSpecialArtworkPinnedForegroundOptions = {},
): void {
  if (!wrapper) return;
  const destination = pinned
    ? options.preserveDuringFinale
      ? ensureFinalePersistentForegroundOverlayRoot()
      : ensurePinnedForegroundOverlayRoot()
    : ensureOverlayRoot();
  if (destination && wrapper.parentElement !== destination) destination.appendChild(wrapper);
}

export function refreshAnimatedSpecialArtworkDepth(): void {
  const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
  if (overlayRoot && canvas) syncOverlayZIndex(overlayRoot, canvas);
  // Drag acquisition/release and bounds updates happen between Pixi ticker
  // frames. Repaint every direct-SVG owner synchronously so overlap depth
  // changes cannot lag one frame behind the pointer.
  if (frameOwners.size > 0) updateAnimatedSpecialArtworkLayer();
}

export function acquireAnimatedSpecialArtworkLayer(
  owner: FrameOwner,
  onSuspension?: (suspended: boolean) => void,
): AnimatedSpecialArtworkLayerLease | null {
  const root = ensureOverlayRoot();
  if (!root) return null;
  if (frameOwners.size === 0) document.addEventListener('visibilitychange', updateAnimatedSpecialArtworkLayer);
  frameOwners.add(owner);
  if (onSuspension) {
    suspensionOwners.set(owner, onSuspension);
    onSuspension(layerSuspended || document.hidden);
  }
  ensureTicker();
  let released = false;
  return {
    root,
    requestSync: () => {
      if (released) return;
      ensureTicker();
      updateAnimatedSpecialArtworkLayer();
    },
    release: () => {
      if (released) return;
      released = true;
      frameOwners.delete(owner);
      suspensionOwners.delete(owner);
      releaseRuntimeWhenUnused();
    },
  };
}

export function getAnimatedSpecialArtworkLayerStats() {
  return {
    owners: frameOwners.size,
    tickerAttached: ticker !== null,
    overlayAttached: overlayRoot?.isConnected === true,
  };
}
