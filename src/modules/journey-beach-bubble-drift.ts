import { gsap } from 'gsap';

const DESIGN_WIDTH = 390;
const REFERENCE_HEIGHT = 844;
const BUBBLE_COUNT = 18;
const BOTTLE_RISE_MIN_SECONDS = 1.45;
const BOTTLE_RISE_RANGE_SECONDS = 0.45;
const BEACH_SLOWDOWN_MULTIPLIER = 1.84;
const BUBBLE_SIZE_SCALES = Object.freeze([2, 2.5, 3, 3.5, 4] as const);
const BUBBLE_OPACITIES = Object.freeze([0.2, 0.3, 0.4, 0.5, 0.6] as const);
const BEACH_EMITTER_BOARD_IDS = Object.freeze([11, 13, 14, 16, 17, 19, 20] as const);
const ASSET_BASE = './assets/shop/bottle/bottle animation pack';

type BubbleDepth = 'behind-clouds' | 'between-clouds-and-units' | 'birth-behind-card' | 'front';

interface BubbleTicker {
  time: number;
  add(callback: () => void): void;
  remove(callback: () => void): void;
}

export interface StartJourneyBeachBubbleDriftOptions {
  root: HTMLElement;
  scrollRoot?: HTMLElement | null;
  leftGutterPx?: number;
  random?: () => number;
  ticker?: BubbleTicker;
  observeVisibility?: boolean;
}

export interface JourneyBeachBubbleDriftController {
  dispose(): void;
  getSnapshot(): {
    disposed: boolean;
    bubbleCount: number;
    layerCount: number;
    tickerCount: number;
    visibleBubbleCount: number;
  };
}

interface LiveBubble {
  element: HTMLImageElement;
  depth: BubbleDepth;
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
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
}

function sample(random: () => number): number {
  return clamp01(random());
}

export function createBeachBubbleRiseDuration(
  sceneHeightPx: number,
  randomValue: number,
): number {
  const heightScale = Math.max(0.5, sceneHeightPx / REFERENCE_HEIGHT);
  const bottleDuration = BOTTLE_RISE_MIN_SECONDS
    + clamp01(randomValue) * BOTTLE_RISE_RANGE_SECONDS;
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
  return {
    startY,
    endY: -bubbleSize * 1.35,
  };
}

interface BeachBubbleEmitter {
  boardId: number;
  x: number;
  y: number;
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

function setLayerBase(layer: HTMLDivElement, className: string, zIndex: number): void {
  layer.className = className;
  layer.style.cssText = [
    'position:absolute',
    'overflow:hidden',
    'pointer-events:none',
    'contain:layout paint',
    `z-index:${zIndex}`,
  ].join(';');
}

export function startJourneyBeachBubbleDrift(
  options: StartJourneyBeachBubbleDriftOptions,
): JourneyBeachBubbleDriftController {
  const { root } = options;
  const random = options.random ?? Math.random;
  const ticker = options.ticker ?? gsap.ticker;
  const cloudLayer = root.querySelector<HTMLElement>('.journey-cloud-container');
  const backgroundLayer = root.querySelector<HTMLElement>('.journey-bg-container');
  const cardsLayer = root.querySelector<HTMLElement>('.journey-cards-container');
  const sceneHeight = resolveSceneHeight(root);
  const viewportWidth = window.innerWidth || root.getBoundingClientRect().width || DESIGN_WIDTH;
  const pxPerDesignUnit = viewportWidth / DESIGN_WIDTH;
  const leftGutter = options.leftGutterPx ?? 0;
  const layerLeft = Number.parseFloat(backgroundLayer?.style.left || '') || -leftGutter;
  const layerTop = Number.parseFloat(backgroundLayer?.style.top || '') || 0;
  const baseLayerHeight = Number.parseFloat(backgroundLayer?.style.height || '') || sceneHeight;
  const layerWidth = backgroundLayer?.style.width || `${viewportWidth}px`;

  const behindLayer = document.createElement('div');
  const betweenLayer = document.createElement('div');
  const birthLayer = document.createElement('div');
  const frontLayer = document.createElement('div');
  setLayerBase(behindLayer, 'journey-beach-bubble-layer journey-beach-bubble-layer--behind', 0);
  setLayerBase(betweenLayer, 'journey-beach-bubble-layer journey-beach-bubble-layer--between', 0);
  setLayerBase(birthLayer, 'journey-beach-bubble-layer journey-beach-bubble-layer--birth', 2);
  setLayerBase(frontLayer, 'journey-beach-bubble-layer journey-beach-bubble-layer--front', 7);
  [behindLayer, betweenLayer, birthLayer, frontLayer].forEach((layer) => {
    layer.style.left = `${layerLeft}px`;
    layer.style.top = `${layerTop}px`;
    layer.style.width = layerWidth;
    layer.style.height = `${baseLayerHeight}px`;
  });

  if (cloudLayer) root.insertBefore(behindLayer, cloudLayer);
  else root.prepend(behindLayer);
  if (backgroundLayer) root.insertBefore(betweenLayer, backgroundLayer);
  else root.appendChild(betweenLayer);
  if (cardsLayer) root.insertBefore(birthLayer, cardsLayer);
  else root.appendChild(birthLayer);
  root.appendChild(frontLayer);

  const layerByDepth: Record<BubbleDepth, HTMLDivElement> = {
    'behind-clouds': behindLayer,
    'between-clouds-and-units': betweenLayer,
    'birth-behind-card': birthLayer,
    front: frontLayer,
  };
  const depths: BubbleDepth[] = ['behind-clouds', 'between-clouds-and-units', 'front'];
  const bubbles: LiveBubble[] = [];

  const refreshLayerExtent = (): void => {
    const rootRect = root.getBoundingClientRect();
    const layerOriginY = rootRect.top + layerTop;
    const lowestArtBottom = BEACH_EMITTER_BOARD_IDS.reduce((lowest, boardId) => {
      const art = root.querySelector<HTMLElement>(
        `.journey-beach-island-art[data-journey-area-id="board-${boardId}"]`,
      );
      const rect = art?.getBoundingClientRect();
      return rect && rect.height > 0 ? Math.max(lowest, rect.bottom - layerOriginY) : lowest;
    }, baseLayerHeight);
    const visualHeight = Math.max(baseLayerHeight, lowestArtBottom);
    behindLayer.style.height = `${visualHeight}px`;
    betweenLayer.style.height = `${visualHeight}px`;
    birthLayer.style.height = `${visualHeight}px`;
    frontLayer.style.height = `${visualHeight}px`;
  };
  refreshLayerExtent();

  const resetBubble = (bubble: LiveBubble, index: number, initial = false): void => {
    refreshLayerExtent();
    const emitters = resolveBeachBubbleEmitters(
      root,
      layerLeft,
      layerTop,
      pxPerDesignUnit,
    );
    const isGuaranteedInitialEmitter = initial && index < emitters.length;
    const nextDepth = isGuaranteedInitialEmitter
      ? 'birth-behind-card'
      : depths[Math.min(depths.length - 1, Math.floor(sample(random) * depths.length))];
    bubble.depth = nextDepth;
    layerByDepth[nextDepth].appendChild(bubble.element);
    const emitter = emitters[index % emitters.length];
    bubble.emitterBoardId = emitter.boardId;
    bubble.element.dataset.beachBubbleEmitterBoard = String(emitter.boardId);
    bubble.element.dataset.beachBubbleEmitterX = String(emitter.x);
    bubble.element.dataset.beachBubbleEmitterY = String(emitter.y);
    const authoredSize = 10 + sample(random) * 22;
    bubble.size = authoredSize * getBeachBubbleSizeScale(index) * pxPerDesignUnit;
    bubble.startX = emitter.x - bubble.size * 0.5;
    bubble.startY = emitter.y - bubble.size * 0.5;
    bubble.endX = Math.min(viewportWidth - bubble.size, Math.max(0,
      bubble.startX + (-72 + sample(random) * 154) * pxPerDesignUnit));
    bubble.waveAmplitude = (16 + sample(random) * 38) * pxPerDesignUnit;
    bubble.waveCycles = 1.6 + sample(random) * 2;
    bubble.phase = sample(random) * Math.PI * 2;
    bubble.opacity = getBeachBubbleOpacity(index);
    bubble.element.dataset.beachBubbleOpacity = String(bubble.opacity);
    bubble.durationSeconds = createBeachBubbleRiseDuration(sceneHeight, sample(random));
    bubble.delaySeconds = initial
      ? (index < emitters.length
        ? 0
        : ((index - emitters.length + 1) / (BUBBLE_COUNT - emitters.length + 1)) * bubble.durationSeconds)
      : 0.45 + sample(random) * 1.8;
    bubble.elapsedSeconds = 0;
    bubble.element.src = `${ASSET_BASE}/bubble${1 + Math.floor(sample(random) * 6)}.png`;
    bubble.element.style.width = `${bubble.size}px`;
    bubble.element.style.transform = `translate3d(${bubble.startX}px,${bubble.startY}px,0)`;
    bubble.element.style.opacity = bubble.delaySeconds === 0 ? `${bubble.opacity}` : '0';
  };

  for (let index = 0; index < BUBBLE_COUNT; index += 1) {
    const element = document.createElement('img');
    element.className = 'journey-beach-drift-bubble';
    element.alt = '';
    element.draggable = false;
    element.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'height:auto',
      'pointer-events:none',
      'user-select:none',
      'will-change:transform,opacity',
      'backface-visibility:hidden',
    ].join(';');
    const bubble: LiveBubble = {
      element,
      depth: 'behind-clouds',
      durationSeconds: 1,
      delaySeconds: 0,
      elapsedSeconds: 0,
      emitterBoardId: 11,
      startX: 0,
      startY: 0,
      endX: 0,
      size: 1,
      opacity: 0,
      waveAmplitude: 0,
      waveCycles: 1,
      phase: 0,
    };
    resetBubble(bubble, index, true);
    bubbles.push(bubble);
  }

  let disposed = false;
  let sceneVisible = true;
  let previousTickerTime = ticker.time;
  const tick = (): void => {
    if (disposed || !sceneVisible) {
      previousTickerTime = ticker.time;
      return;
    }
    const deltaSeconds = Math.min(0.1, Math.max(0, ticker.time - previousTickerTime));
    previousTickerTime = ticker.time;
    bubbles.forEach((bubble, index) => {
      bubble.elapsedSeconds += deltaSeconds;
      if (bubble.elapsedSeconds < bubble.delaySeconds) return;
      const progress = (bubble.elapsedSeconds - bubble.delaySeconds) / bubble.durationSeconds;
      if (progress >= 1) {
        resetBubble(bubble, index);
        return;
      }
      const eased = Math.sin(progress * Math.PI * 0.5);
      const { startY, endY } = getBeachBubbleVerticalBounds(bubble.startY, bubble.size);
      const x = bubble.startX
        + (bubble.endX - bubble.startX) * eased
        + (Math.sin(progress * Math.PI * 2 * bubble.waveCycles + bubble.phase)
          - Math.sin(bubble.phase)) * bubble.waveAmplitude;
      const y = startY + (endY - startY) * eased;
      const edgeFade = Math.min(1, (1 - progress) * 8);
      bubble.element.style.opacity = `${bubble.opacity * Math.max(0, edgeFade)}`;
      bubble.element.style.transform = `translate3d(${x}px,${y}px,0)`;
    });
  };
  ticker.add(tick);

  let observer: IntersectionObserver | null = null;
  if (options.observeVisibility !== false && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => {
      sceneVisible = entries.some((entry) => entry.isIntersecting);
      previousTickerTime = ticker.time;
    }, { root: options.scrollRoot ?? null });
    observer.observe(root);
  }

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      ticker.remove(tick);
      observer?.disconnect();
      behindLayer.remove();
      betweenLayer.remove();
      birthLayer.remove();
      frontLayer.remove();
      bubbles.length = 0;
    },
    getSnapshot() {
      return {
        disposed,
        bubbleCount: bubbles.length,
        layerCount: disposed ? 0 : 4,
        tickerCount: disposed ? 0 : 1,
        visibleBubbleCount: bubbles.filter((bubble) => Number(bubble.element.style.opacity) > 0).length,
      };
    },
  };
}
