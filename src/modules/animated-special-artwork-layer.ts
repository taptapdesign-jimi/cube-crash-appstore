import { UPDATE_PRIORITY, type Ticker } from 'pixi.js';
import { STATE } from './app-state.ts';
import type { GameplayDragBounds } from './gameplay-drag-foreground-owner.ts';

export type AnimatedSpecialArtworkFrame = {
  canvasRect: DOMRect;
  rootRect: DOMRect;
  screenWidth: number;
  screenHeight: number;
  canvasOpacity: number;
  gameplayDragActive: boolean;
  gameplayDragBounds: GameplayDragBounds | null;
};

export type AnimatedSpecialArtworkLayerLease = {
  root: HTMLDivElement;
  requestSync: () => void;
  release: () => void;
};

type FrameOwner = (frame: AnimatedSpecialArtworkFrame) => void;

export type AnimatedSpecialArtworkFootprint = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const OVERLAP_FOOTPRINT_ATTRIBUTE = 'data-animated-special-artwork-overlap-footprint';

const frameOwners = new Set<FrameOwner>();
let overlayRoot: HTMLDivElement | null = null;
let occludedOverlayRoot: HTMLDivElement | null = null;
let dragOverlayRoot: HTMLDivElement | null = null;
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
  root.style.zIndex = finaleDepthOwners > 0 && !gameplayDragActive
    ? String(Math.max(0, canvasZIndex - 1))
    : String(Math.max(11, canvasZIndex + 1));
  if (occludedOverlayRoot) {
    // Keep a live idle SVG immediately below the transparent Pixi canvas only
    // while a dragged die crosses it. Moving the same wrapper preserves the
    // SVG playhead; the canvas still paints the active drag above it.
    occludedOverlayRoot.style.zIndex = String(Math.max(0, canvasZIndex - 1));
  }
  if (dragOverlayRoot) {
    // A real pointer owner is always the highest paint owner. Finale/input
    // locks normally prevent overlap, but a stale or interrupted finale lease
    // must never force a live dragged SVG beneath the Pixi HUD.
    dragOverlayRoot.style.zIndex = gameplayDragActive
      ? String(Math.max(12_001, canvasZIndex + 1))
      : String(finaleDepthOwners > 0
        ? Math.max(0, canvasZIndex - 1)
        : Math.max(11, canvasZIndex + 1));
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
  lastDragDepthDiagnostic = '';
}

function updateAnimatedSpecialArtworkLayer(): void {
  const root = ensureOverlayRoot();
  const app = STATE.app;
  const canvas = app?.canvas as HTMLCanvasElement | null | undefined;
  if (!root || !canvas || !app?.renderer) {
    if (root) root.style.visibility = 'hidden';
    if (occludedOverlayRoot) occludedOverlayRoot.style.visibility = 'hidden';
    if (dragOverlayRoot) dragOverlayRoot.style.visibility = 'hidden';
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
    root.style.visibility = 'hidden';
    if (occludedOverlayRoot) occludedOverlayRoot.style.visibility = 'hidden';
    if (dragOverlayRoot) dragOverlayRoot.style.visibility = 'hidden';
    return;
  }
  root.style.visibility = 'visible';
  if (occludedOverlayRoot) occludedOverlayRoot.style.visibility = 'visible';
  if (dragOverlayRoot) dragOverlayRoot.style.visibility = 'visible';

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
    gameplayDragBounds: ((window as any).__ccGameplayDragBounds as GameplayDragBounds | null) ?? null,
  };
  Array.from(frameOwners).forEach((owner) => {
    try { owner(frame); } catch {}
  });
}

export function doesAnimatedSpecialArtworkOverlapGameplayDrag(
  wrapper: HTMLElement,
  dragBounds: GameplayDragBounds | null,
): boolean {
  if (!wrapper || !dragBounds) return false;
  try {
    // The wrapper preserves the complete authored SVG motion corridor and can
    // be much larger than the visible die. Collision ownership belongs to the
    // explicit 128px resting-art footprint, not those transparent margins.
    const footprint = wrapper.querySelector<HTMLElement>(`[${OVERLAP_FOOTPRINT_ATTRIBUTE}]`);
    const artworkBounds = (footprint ?? wrapper).getBoundingClientRect();
    if (artworkBounds.width <= 0 || artworkBounds.height <= 0) return false;
    const dragRight = dragBounds.x + dragBounds.width;
    const dragBottom = dragBounds.y + dragBounds.height;
    return artworkBounds.left < dragRight
      && artworkBounds.right > dragBounds.x
      && artworkBounds.top < dragBottom
      && artworkBounds.bottom > dragBounds.y;
  } catch {
    return false;
  }
}

export function installAnimatedSpecialArtworkOverlapFootprint(
  wrapper: HTMLElement,
  footprint: AnimatedSpecialArtworkFootprint,
): HTMLDivElement {
  const node = document.createElement('div');
  node.setAttribute(OVERLAP_FOOTPRINT_ATTRIBUTE, 'true');
  Object.assign(node.style, {
    position: 'absolute',
    left: `${footprint.left}px`,
    top: `${footprint.top}px`,
    width: `${footprint.width}px`,
    height: `${footprint.height}px`,
    pointerEvents: 'none',
    visibility: 'hidden',
  });
  wrapper.appendChild(node);
  return node;
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
): AnimatedSpecialArtworkLayerLease | null {
  const root = ensureOverlayRoot();
  if (!root) return null;
  frameOwners.add(owner);
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
