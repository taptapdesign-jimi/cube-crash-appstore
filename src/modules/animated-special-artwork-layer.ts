import { UPDATE_PRIORITY, type Ticker } from 'pixi.js';
import { STATE } from './app-state.ts';

export type AnimatedSpecialArtworkFrame = {
  canvasRect: DOMRect;
  rootRect: DOMRect;
  screenWidth: number;
  screenHeight: number;
  canvasOpacity: number;
};

export type AnimatedSpecialArtworkLayerLease = {
  root: HTMLDivElement;
  requestSync: () => void;
  release: () => void;
};

type FrameOwner = (frame: AnimatedSpecialArtworkFrame) => void;

const frameOwners = new Set<FrameOwner>();
let overlayRoot: HTMLDivElement | null = null;
let ticker: Ticker | null = null;

function getLiveTicker(): Ticker | null {
  const candidate = STATE.app?.ticker as Ticker | null | undefined;
  return candidate && !(candidate as any).destroyed ? candidate : null;
}

function ensureOverlayRoot(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = STATE.app?.canvas as HTMLCanvasElement | null | undefined;
  const parent = canvas?.parentElement;
  if (!canvas || !parent) return null;
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
  }
  if (overlayRoot.parentElement !== parent) parent.appendChild(overlayRoot);
  return overlayRoot;
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
}

function updateAnimatedSpecialArtworkLayer(): void {
  const root = ensureOverlayRoot();
  const app = STATE.app;
  const canvas = app?.canvas as HTMLCanvasElement | null | undefined;
  if (!root || !canvas || !app?.renderer) {
    if (root) root.style.visibility = 'hidden';
    return;
  }

  const canvasStyle = getComputedStyle(canvas);
  const parsedOpacity = Number.parseFloat(canvasStyle.opacity || '1');
  const canvasOpacity = Number.isFinite(parsedOpacity) ? parsedOpacity : 1;
  const canvasZIndex = Number.parseFloat(canvasStyle.zIndex || '10');
  root.style.zIndex = String(Math.max(11, Number.isFinite(canvasZIndex) ? canvasZIndex + 1 : 11));
  const canvasPaintable = canvasStyle.display !== 'none'
    && canvasStyle.visibility !== 'hidden'
    && canvasOpacity > 0.001;
  if (!canvasPaintable) {
    root.style.visibility = 'hidden';
    return;
  }
  root.style.visibility = 'visible';

  const canvasRect = canvas.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const screen = app.renderer.screen;
  const frame: AnimatedSpecialArtworkFrame = {
    canvasRect,
    rootRect,
    screenWidth: screen.width,
    screenHeight: screen.height,
    canvasOpacity,
  };
  Array.from(frameOwners).forEach((owner) => {
    try { owner(frame); } catch {}
  });
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
