const DEFAULT_VISIBILITY_MARGIN_PX = 180;
const MAX_CANVAS_PIXEL_RATIO = 2;

export interface JourneyAmbientTicker {
  time: number;
  add(callback: () => void): void;
  remove(callback: () => void): void;
}

export type JourneyAmbientCanvasDepth = 'behind' | 'front';

export interface JourneyAmbientCanvasFrame {
  deltaSeconds: number;
  viewportTop: number;
  viewportBottom: number;
  width: number;
  height: number;
  behind: CanvasRenderingContext2D | null;
  front: CanvasRenderingContext2D | null;
}

export interface JourneyAmbientCanvasRuntimeOptions {
  root: HTMLElement;
  scrollRoot?: HTMLElement | null;
  ticker: JourneyAmbientTicker;
  sceneWidthPx: number;
  sceneHeightPx: number;
  layerLeftPx?: number;
  layerTopPx?: number;
  visibilityMarginPx?: number;
  pixelRatioCap?: number;
  maxFramesPerSecond?: number;
  behindBefore?: Element | null;
  frontBefore?: Element | null;
  behindZIndex?: number;
  frontZIndex?: number;
  className: string;
  observeVisibility?: boolean;
  render(frame: JourneyAmbientCanvasFrame): number | void;
}

export interface JourneyAmbientCanvasRuntime {
  setSuspended(suspended: boolean): void;
  fadeIn(durationMs: number): void;
  fadeOut(durationMs: number, onComplete?: () => void): void;
  refreshGeometry(): void;
  setSceneHeight(sceneHeightPx: number): void;
  dispose(): void;
  getSnapshot(): {
    disposed: boolean;
    canvasCount: number;
    tickerCount: number;
    visibleSpriteCount: number;
    pixelRatio: number;
    bitmapPixels: number;
    maxFramesPerSecond: number;
    visibilityMarginPx: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function insertLayer(root: HTMLElement, layer: HTMLCanvasElement, before?: Element | null): void {
  if (before?.parentElement === root) root.insertBefore(layer, before);
  else root.appendChild(layer);
}

function configureCanvas(
  canvas: HTMLCanvasElement,
  className: string,
  depth: JourneyAmbientCanvasDepth,
  left: number,
  top: number,
  zIndex: number,
): void {
  canvas.className = `${className} ${className}--${depth}`;
  canvas.dataset.journeyAmbientCanvasDepth = depth;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = [
    'position:absolute',
    `left:${left}px`,
    `top:${top}px`,
    'display:block',
    'pointer-events:none',
    'user-select:none',
    'overflow:hidden',
    'contain:strict',
    'transform:translate3d(0,0,0)',
    'transform-origin:0 0',
    'backface-visibility:hidden',
    `z-index:${zIndex}`,
  ].join(';');
}

/**
 * Shared Journey ambient compositor for every current and future World.
 *
 * It keeps only two viewport-sized GPU surfaces alive. Logical ambient owners
 * update their pooled flight plans and paint into these surfaces instead of
 * promoting every sprite to an independent DOM/compositor layer.
 */
export function startJourneyAmbientCanvasRuntime(
  options: JourneyAmbientCanvasRuntimeOptions,
): JourneyAmbientCanvasRuntime {
  const behindCanvas = document.createElement('canvas');
  const frontCanvas = document.createElement('canvas');
  const layerLeft = options.layerLeftPx ?? 0;
  const layerTop = options.layerTopPx ?? 0;
  configureCanvas(
    behindCanvas,
    options.className,
    'behind',
    layerLeft,
    layerTop,
    options.behindZIndex ?? 0,
  );
  configureCanvas(
    frontCanvas,
    options.className,
    'front',
    layerLeft,
    layerTop,
    options.frontZIndex ?? 7,
  );
  insertLayer(options.root, behindCanvas, options.behindBefore);
  insertLayer(options.root, frontCanvas, options.frontBefore);

  const behindContext = behindCanvas.getContext('2d', { alpha: true });
  const frontContext = frontCanvas.getContext('2d', { alpha: true });
  const scrollRoot = options.scrollRoot ?? null;
  const visibilityMargin = Math.max(0, options.visibilityMarginPx ?? DEFAULT_VISIBILITY_MARGIN_PX);
  const pixelRatioCap = clamp(
    Number.isFinite(options.pixelRatioCap) ? Number(options.pixelRatioCap) : MAX_CANVAS_PIXEL_RATIO,
    1,
    MAX_CANVAS_PIXEL_RATIO,
  );
  const pixelRatio = clamp(window.devicePixelRatio || 1, 1, pixelRatioCap);
  const maxFramesPerSecond = Number.isFinite(options.maxFramesPerSecond)
    ? clamp(Number(options.maxFramesPerSecond), 0, 60)
    : 0;
  const minimumFrameDeltaSeconds = maxFramesPerSecond > 0 ? 1 / maxFramesPerSecond : 0;
  let sceneWidth = Math.max(1, options.sceneWidthPx);
  let sceneHeight = Math.max(1, options.sceneHeightPx);
  let canvasHeight = 1;
  let rootContentTop = 0;
  let viewportTop = 0;
  let canvasSceneTop = 0;
  let visibleSpriteCount = 0;
  let disposed = false;
  let suspended = false;
  let sceneVisible = true;
  let lastRenderTime = options.ticker.time - minimumFrameDeltaSeconds;
  let observer: IntersectionObserver | null = null;
  let fadeFrame = 0;
  let fadeTimeout = 0;

  const clearFadeOwnership = (): void => {
    if (fadeFrame) cancelAnimationFrame(fadeFrame);
    if (fadeTimeout) window.clearTimeout(fadeTimeout);
    fadeFrame = 0;
    fadeTimeout = 0;
  };

  const setLayerFade = (opacity: number, durationMs: number): void => {
    [behindCanvas, frontCanvas].forEach((canvas) => {
      canvas.style.transition = durationMs > 0 ? `opacity ${durationMs}ms ease-out` : 'none';
      canvas.style.opacity = String(opacity);
      canvas.style.willChange = durationMs > 0 ? 'transform, opacity' : 'transform';
    });
  };

  const resizeBitmaps = (): void => {
    const viewportHeight = scrollRoot?.clientHeight || window.innerHeight || sceneHeight;
    canvasHeight = Math.max(1, Math.min(sceneHeight, viewportHeight + (visibilityMargin * 2)));
    const bitmapWidth = Math.max(1, Math.ceil(sceneWidth * pixelRatio));
    const bitmapHeight = Math.max(1, Math.ceil(canvasHeight * pixelRatio));
    [behindCanvas, frontCanvas].forEach((canvas) => {
      if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
      if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
      canvas.style.width = `${sceneWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
    });
    behindContext?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    frontContext?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const refreshGeometry = (): void => {
    if (disposed) return;
    if (scrollRoot) {
      const rootRect = options.root.getBoundingClientRect();
      const scrollRect = scrollRoot.getBoundingClientRect();
      rootContentTop = rootRect.top - scrollRect.top + scrollRoot.scrollTop + layerTop;
    } else {
      rootContentTop = layerTop;
    }
    resizeBitmaps();
  };

  const updateViewport = (): void => {
    viewportTop = scrollRoot
      ? scrollRoot.scrollTop - rootContentTop
      : Math.max(0, -options.root.getBoundingClientRect().top - layerTop);
    const desiredTop = viewportTop - visibilityMargin;
    canvasSceneTop = clamp(desiredTop, 0, Math.max(0, sceneHeight - canvasHeight));
    const transform = `translate3d(0,${canvasSceneTop}px,0)`;
    if (behindCanvas.style.transform !== transform) behindCanvas.style.transform = transform;
    if (frontCanvas.style.transform !== transform) frontCanvas.style.transform = transform;
  };

  const clearCanvases = (): void => {
    behindContext?.clearRect(0, 0, sceneWidth, canvasHeight);
    frontContext?.clearRect(0, 0, sceneWidth, canvasHeight);
  };

  const tick = (): void => {
    if (disposed) return;
    const now = options.ticker.time;
    if (!options.root.isConnected) {
      controller.dispose();
      return;
    }
    if (suspended || !sceneVisible || (typeof document !== 'undefined' && document.hidden)) {
      lastRenderTime = now;
      return;
    }
    const elapsedSinceRender = Math.max(0, now - lastRenderTime);
    // GSAP's ticker commonly lands a fraction below the exact 30 Hz boundary.
    // A small tolerance keeps the cadence at every second 60 Hz tick instead
    // of producing an uneven 20/30 Hz pattern while still bounding the work.
    if (
      minimumFrameDeltaSeconds > 0
      && elapsedSinceRender + 0.0005 < minimumFrameDeltaSeconds
    ) return;
    const deltaSeconds = clamp(elapsedSinceRender, 0, 0.12);
    lastRenderTime = now;
    updateViewport();
    clearCanvases();
    const renderedCount = options.render({
      deltaSeconds,
      viewportTop: canvasSceneTop,
      viewportBottom: canvasSceneTop + canvasHeight,
      width: sceneWidth,
      height: canvasHeight,
      behind: behindContext,
      front: frontContext,
    });
    visibleSpriteCount = typeof renderedCount === 'number' ? renderedCount : 0;
  };

  // Do not reposition the scene window directly from the scroll event. The
  // absolute canvases already travel with native scrolling; moving them before
  // their bitmap is repainted exposes one stale scene slice in WKWebView. The
  // bounded ticker updates transform and pixels together before the next paint.
  const handleResize = (): void => refreshGeometry();
  window.addEventListener('resize', handleResize, { passive: true });

  const controller: JourneyAmbientCanvasRuntime = {
    setSuspended(nextSuspended): void {
      if (disposed || suspended === nextSuspended) return;
      suspended = nextSuspended;
      lastRenderTime = options.ticker.time;
      const willChange = suspended ? 'auto' : 'transform';
      behindCanvas.style.willChange = willChange;
      frontCanvas.style.willChange = willChange;
    },
    fadeIn(durationMs): void {
      if (disposed) return;
      clearFadeOwnership();
      setLayerFade(0, 0);
      fadeFrame = requestAnimationFrame(() => {
        fadeFrame = 0;
        if (disposed) return;
        setLayerFade(1, Math.max(0, durationMs));
        fadeTimeout = window.setTimeout(() => {
          fadeTimeout = 0;
          if (disposed) return;
          [behindCanvas, frontCanvas].forEach((canvas) => {
            canvas.style.transition = 'none';
            canvas.style.willChange = suspended ? 'auto' : 'transform';
          });
        }, Math.max(0, durationMs));
      });
    },
    fadeOut(durationMs, onComplete): void {
      if (disposed) return;
      clearFadeOwnership();
      setLayerFade(0, Math.max(0, durationMs));
      fadeTimeout = window.setTimeout(() => {
        fadeTimeout = 0;
        if (disposed) return;
        if (onComplete) onComplete();
        else controller.dispose();
      }, Math.max(0, durationMs));
    },
    refreshGeometry,
    setSceneHeight(nextSceneHeight): void {
      if (disposed) return;
      const boundedHeight = Math.max(1, nextSceneHeight);
      if (boundedHeight === sceneHeight) return;
      sceneHeight = boundedHeight;
      resizeBitmaps();
      updateViewport();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearFadeOwnership();
      options.ticker.remove(tick);
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
      observer = null;
      behindCanvas.style.willChange = 'auto';
      frontCanvas.style.willChange = 'auto';
      // Release both backing stores immediately. Waiting for WebKit GC here can
      // retain several megabytes across repeated Forest/Beach route changes.
      behindCanvas.width = 1;
      behindCanvas.height = 1;
      frontCanvas.width = 1;
      frontCanvas.height = 1;
      behindCanvas.remove();
      frontCanvas.remove();
      visibleSpriteCount = 0;
    },
    getSnapshot: () => ({
      disposed,
      canvasCount: disposed ? 0 : 2,
      tickerCount: disposed ? 0 : 1,
      visibleSpriteCount: disposed ? 0 : visibleSpriteCount,
      pixelRatio,
      bitmapPixels: disposed ? 0 : behindCanvas.width * behindCanvas.height * 2,
      maxFramesPerSecond,
      visibilityMarginPx: visibilityMargin,
    }),
  };

  if (options.observeVisibility !== false && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => {
      const record = entries.find((entry) => entry.target === options.root);
      if (!record) return;
      sceneVisible = record.isIntersecting;
      lastRenderTime = options.ticker.time;
    }, {
      root: scrollRoot,
      rootMargin: `${visibilityMargin}px 0px`,
      threshold: 0,
    });
    observer.observe(options.root);
  }

  refreshGeometry();
  updateViewport();
  behindCanvas.style.willChange = 'transform';
  frontCanvas.style.willChange = 'transform';
  options.ticker.add(tick);
  tick();
  return controller;
}
