import { gsap } from 'gsap';
import {
  startJourneyAmbientCanvasRuntime,
  type JourneyAmbientCanvasDepth,
  type JourneyAmbientCanvasFrame,
  type JourneyAmbientTicker,
} from './journey-ambient-canvas-runtime.js';

const DESIGN_WIDTH = 390;
const REFERENCE_HEIGHT = 844;
const BUBBLE_COUNT = 18;
const BOTTLE_RISE_MIN_SECONDS = 1.45;
const BOTTLE_RISE_RANGE_SECONDS = 0.45;
const BEACH_SLOWDOWN_MULTIPLIER = 1.84;
const BUBBLE_SIZE_SCALES = Object.freeze([2, 2.5, 3, 3.5, 4] as const);
const BUBBLE_OPACITIES = Object.freeze([0.2, 0.3, 0.4, 0.5, 0.6] as const);
const BEACH_EMITTER_BOARD_IDS = Object.freeze([11, 13, 14, 16, 17, 19, 20] as const);
const BUBBLE_VISIBILITY_MARGIN_PX = 180;
const ASSET_BASE = './assets/shop/bottle/bottle animation pack';

export interface StartJourneyBeachBubbleDriftOptions {
  root: HTMLElement;
  scrollRoot?: HTMLElement | null;
  leftGutterPx?: number;
  random?: () => number;
  ticker?: JourneyAmbientTicker;
  observeVisibility?: boolean;
}

export interface JourneyBeachBubbleDriftController {
  setSuspended(suspended: boolean): void;
  dispose(): void;
  getSnapshot(): {
    disposed: boolean;
    bubbleCount: number;
    layerCount: number;
    tickerCount: number;
    visibleBubbleCount: number;
    renderer: 'canvas';
    domImageCount: number;
    emitterBoardIds: number[];
    emitterAnchors: Array<{ boardId: number; x: number; y: number }>;
    activeBubbleCount: number;
    behindBubbleCount: number;
    maxOpacity: number;
  };
}

interface LiveBubble {
  depth: JourneyAmbientCanvasDepth;
  durationSeconds: number;
  delaySeconds: number;
  elapsedSeconds: number;
  emitterBoardId: number;
  startX: number;
  startY: number;
  endX: number;
  size: number;
  opacity: number;
  waveAmplitude: number;
  waveCycles: number;
  phase: number;
  assetIndex: number;
  rendered: boolean;
}

interface BeachBubbleEmitter { boardId: number; x: number; y: number }

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
}

function sample(random: () => number): number {
  return clamp01(random());
}

export function createBeachBubbleRiseDuration(sceneHeightPx: number, randomValue: number): number {
  const heightScale = Math.max(0.5, sceneHeightPx / REFERENCE_HEIGHT);
  const bottleDuration = BOTTLE_RISE_MIN_SECONDS + clamp01(randomValue) * BOTTLE_RISE_RANGE_SECONDS;
  return bottleDuration * BEACH_SLOWDOWN_MULTIPLIER * heightScale;
}

export function getBeachBubbleSizeScale(index: number): number {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return BUBBLE_SIZE_SCALES[safeIndex % BUBBLE_SIZE_SCALES.length];
}

export function getBeachBubbleOpacity(index: number): number {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return BUBBLE_OPACITIES[safeIndex % BUBBLE_OPACITIES.length];
}

export function getBeachBubbleVerticalBounds(startY: number, bubbleSize: number): {
  startY: number;
  endY: number;
} {
  return { startY, endY: -bubbleSize * 1.35 };
}

function resolveBeachBubbleEmitters(
  root: HTMLElement,
  layerLeft: number,
  layerTop: number,
  pxPerDesignUnit: number,
): BeachBubbleEmitter[] {
  const rootRect = root.getBoundingClientRect();
  return BEACH_EMITTER_BOARD_IDS.map((boardId) => {
    const unitIndex = boardId - 11;
    const unitArt = root.querySelector<HTMLElement>(
      `.journey-beach-island-art[data-journey-area-id="board-${boardId}"]`,
    );
    const rect = unitArt?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return {
        boardId,
        x: rect.left + rect.width * 0.5 - rootRect.left - layerLeft,
        y: rect.top + rect.height * 0.5 - rootRect.top - layerTop,
      };
    }
    return {
      boardId,
      x: (unitIndex % 2 === 0 ? 112 : 278) * pxPerDesignUnit,
      y: (366 + unitIndex * 124 + 100) * pxPerDesignUnit,
    };
  });
}

function resolveSceneHeight(root: HTMLElement): number {
  const authoredHeight = Number.parseFloat(root.style.height || '');
  if (Number.isFinite(authoredHeight) && authoredHeight > 0) return authoredHeight;
  return Math.max(1, root.getBoundingClientRect().height || root.clientHeight || REFERENCE_HEIGHT);
}

function createBubbleAssets(): HTMLImageElement[] {
  if (typeof Image === 'undefined') return [];
  return Array.from({ length: 6 }, (_, index) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = `${ASSET_BASE}/bubble${index + 1}.png`;
    return image;
  });
}

function drawBubble(
  context: CanvasRenderingContext2D | null,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  size: number,
  opacity: number,
  canvasTop: number,
): void {
  if (!context || !image?.complete || image.naturalWidth <= 0 || opacity <= 0) return;
  context.save();
  context.globalAlpha = opacity;
  context.drawImage(image, x, y - canvasTop, size, size);
  context.restore();
}

export function startJourneyBeachBubbleDrift(
  options: StartJourneyBeachBubbleDriftOptions,
): JourneyBeachBubbleDriftController {
  const { root } = options;
  const random = options.random ?? Math.random;
  const ticker = options.ticker ?? gsap.ticker;
  const cloudLayer = root.querySelector<HTMLElement>('.journey-cloud-container');
  const backgroundLayer = root.querySelector<HTMLElement>('.journey-bg-container');
  const sceneHeight = resolveSceneHeight(root);
  const viewportWidth = window.innerWidth || root.getBoundingClientRect().width || DESIGN_WIDTH;
  const pxPerDesignUnit = viewportWidth / DESIGN_WIDTH;
  const leftGutter = options.leftGutterPx ?? 0;
  const layerLeft = Number.parseFloat(backgroundLayer?.style.left || '') || -leftGutter;
  const layerTop = 0;
  const layerWidth = Number.parseFloat(backgroundLayer?.style.width || '') || viewportWidth;
  const baseLayerHeight = Number.parseFloat(backgroundLayer?.style.height || '') || sceneHeight;
  const backgroundTop = Number.parseFloat(backgroundLayer?.style.top || '') || 0;
  const bubbleAssets = createBubbleAssets();
  const bubbles: LiveBubble[] = [];
  let disposed = false;
  let visualSceneHeight = baseLayerHeight + Math.max(0, backgroundTop - layerTop);

  const refreshVisualSceneHeight = (): number => {
    const rootRect = root.getBoundingClientRect();
    const layerOriginY = rootRect.top + layerTop;
    const lowestArtBottom = BEACH_EMITTER_BOARD_IDS.reduce((lowest, boardId) => {
      const art = root.querySelector<HTMLElement>(
        `.journey-beach-island-art[data-journey-area-id="board-${boardId}"]`,
      );
      const rect = art?.getBoundingClientRect();
      return rect && rect.height > 0 ? Math.max(lowest, rect.bottom - layerOriginY) : lowest;
    }, visualSceneHeight);
    visualSceneHeight = Math.max(sceneHeight, visualSceneHeight, lowestArtBottom);
    return visualSceneHeight;
  };
  refreshVisualSceneHeight();

  const resetBubble = (bubble: LiveBubble, index: number, initial = false): void => {
    const emitters = resolveBeachBubbleEmitters(root, layerLeft, layerTop, pxPerDesignUnit);
    const guaranteedEmitterBirth = initial && index < emitters.length;
    bubble.depth = guaranteedEmitterBirth || sample(random) < (2 / 3) ? 'behind' : 'front';
    const emitter = emitters[index % emitters.length];
    bubble.emitterBoardId = emitter.boardId;
    const authoredSize = 10 + sample(random) * 22;
    bubble.size = authoredSize * getBeachBubbleSizeScale(index) * pxPerDesignUnit;
    bubble.startX = emitter.x - bubble.size * 0.5;
    bubble.startY = emitter.y - bubble.size * 0.5;
    bubble.endX = Math.min(layerWidth - bubble.size, Math.max(0,
      bubble.startX + (-72 + sample(random) * 154) * pxPerDesignUnit));
    bubble.waveAmplitude = (16 + sample(random) * 38) * pxPerDesignUnit;
    bubble.waveCycles = 1.6 + sample(random) * 2;
    bubble.phase = sample(random) * Math.PI * 2;
    bubble.opacity = getBeachBubbleOpacity(index);
    bubble.durationSeconds = createBeachBubbleRiseDuration(sceneHeight, sample(random));
    bubble.delaySeconds = initial
      ? (index < emitters.length
        ? 0
        : ((index - emitters.length + 1) / (BUBBLE_COUNT - emitters.length + 1)) * bubble.durationSeconds)
      : 0.45 + sample(random) * 1.8;
    bubble.elapsedSeconds = 0;
    bubble.assetIndex = Math.floor(sample(random) * 6) % 6;
    bubble.rendered = false;
  };

  for (let index = 0; index < BUBBLE_COUNT; index += 1) {
    const bubble: LiveBubble = {
      depth: 'behind', durationSeconds: 1, delaySeconds: 0, elapsedSeconds: 0,
      emitterBoardId: 11, startX: 0, startY: 0, endX: 0, size: 1, opacity: 0,
      waveAmplitude: 0, waveCycles: 1, phase: 0, assetIndex: 0, rendered: false,
    };
    resetBubble(bubble, index, true);
    bubbles.push(bubble);
  }

  let runtime: ReturnType<typeof startJourneyAmbientCanvasRuntime>;
  const render = (frame: JourneyAmbientCanvasFrame): number => {
    let visibleCount = 0;
    bubbles.forEach((bubble, index) => {
      bubble.elapsedSeconds += frame.deltaSeconds;
      if (bubble.elapsedSeconds < bubble.delaySeconds) {
        bubble.rendered = false;
        return;
      }
      const progress = (bubble.elapsedSeconds - bubble.delaySeconds) / bubble.durationSeconds;
      if (progress >= 1) {
        resetBubble(bubble, index);
        runtime?.setSceneHeight(refreshVisualSceneHeight());
        return;
      }
      const eased = Math.sin(progress * Math.PI * 0.5);
      const { startY, endY } = getBeachBubbleVerticalBounds(bubble.startY, bubble.size);
      const x = bubble.startX
        + (bubble.endX - bubble.startX) * eased
        + (Math.sin(progress * Math.PI * 2 * bubble.waveCycles + bubble.phase)
          - Math.sin(bubble.phase)) * bubble.waveAmplitude;
      const y = startY + (endY - startY) * eased;
      const opacity = bubble.opacity * Math.max(0, Math.min(1, (1 - progress) * 8));
      bubble.rendered = y + bubble.size >= frame.viewportTop && y <= frame.viewportBottom;
      if (!bubble.rendered) return;
      visibleCount += 1;
      drawBubble(
        bubble.depth === 'front' ? frame.front : frame.behind,
        bubbleAssets[bubble.assetIndex], x, y, bubble.size, opacity, frame.viewportTop,
      );
    });
    return visibleCount;
  };

  runtime = startJourneyAmbientCanvasRuntime({
    root,
    scrollRoot: options.scrollRoot,
    ticker,
    sceneWidthPx: layerWidth,
    sceneHeightPx: visualSceneHeight,
    layerLeftPx: layerLeft,
    layerTopPx: layerTop,
    visibilityMarginPx: BUBBLE_VISIBILITY_MARGIN_PX,
    behindBefore: cloudLayer ?? backgroundLayer,
    behindZIndex: 0,
    frontZIndex: 7,
    className: 'journey-beach-bubble-canvas',
    observeVisibility: options.observeVisibility,
    render,
  });
  root.dataset.journeyBeachBubbleRenderer = 'canvas';

  return {
    setSuspended: (suspended) => runtime.setSuspended(suspended),
    dispose(): void {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
      bubbleAssets.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
      bubbles.length = 0;
      delete root.dataset.journeyBeachBubbleRenderer;
    },
    getSnapshot: () => {
      const runtimeSnapshot = runtime.getSnapshot();
      return {
        disposed,
        bubbleCount: bubbles.length,
        layerCount: runtimeSnapshot.canvasCount,
        tickerCount: runtimeSnapshot.tickerCount,
        visibleBubbleCount: runtimeSnapshot.visibleSpriteCount,
        renderer: 'canvas' as const,
        domImageCount: 0,
        emitterBoardIds: Array.from(new Set(bubbles.map((bubble) => bubble.emitterBoardId))),
        emitterAnchors: Array.from(new Map(bubbles.map((bubble) => [bubble.emitterBoardId, {
          boardId: bubble.emitterBoardId,
          x: bubble.startX + bubble.size * 0.5,
          y: bubble.startY + bubble.size * 0.5,
        }])).values()),
        activeBubbleCount: bubbles.filter((bubble) => bubble.elapsedSeconds >= bubble.delaySeconds).length,
        behindBubbleCount: bubbles.filter((bubble) => bubble.depth === 'behind').length,
        maxOpacity: bubbles.length > 0 ? Math.max(...bubbles.map((bubble) => bubble.opacity)) : 0,
      };
    },
  };
}
