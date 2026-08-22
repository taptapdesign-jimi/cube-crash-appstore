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
  const pixelRatio = clamp(window.devicePixelRatio || 1, 1, MAX_CANVAS_PIXEL_RATIO);
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
  let lastTickerTime = options.ticker.time;
  let observer: IntersectionObserver | null = null;

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
      lastTickerTime = now;
      return;
    }
    const deltaSeconds = clamp(now - lastTickerTime, 0, 0.12);
    lastTickerTime = now;
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

  const handleScroll = (): void => updateViewport();
  const handleResize = (): void => refreshGeometry();
  scrollRoot?.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });

  const controller: JourneyAmbientCanvasRuntime = {
    setSuspended(nextSuspended): void {
      if (disposed || suspended === nextSuspended) return;
      suspended = nextSuspended;
      lastTickerTime = options.ticker.time;
      const willChange = suspended ? 'auto' : 'transform';
      behindCanvas.style.willChange = willChange;
      frontCanvas.style.willChange = willChange;
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
      options.ticker.remove(tick);
      scrollRoot?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
      observer = null;
      behindCanvas.style.willChange = 'auto';
      frontCanvas.style.willChange = 'auto';
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
    }),
  };

  if (options.observeVisibility !== false && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => {
      const record = entries.find((entry) => entry.target === options.root);
      if (!record) return;
      sceneVisible = record.isIntersecting;
      lastTickerTime = options.ticker.time;
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
