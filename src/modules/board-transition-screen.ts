// @ts-nocheck
// Board Transition Screen
// Shows board number before starting next board (interim board flow)

import { gsap } from 'gsap';
import { logger } from '../core/logger.js';
import animationManager from './animation-manager.js';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { applyPaperBackground } from './ui-manager.js';
import { domElementPool } from './dom-element-pool.js';
import { sampleMemorySpike } from '../utils/memory-spike-tracker.js';

interface BoardTransitionOptions {
  boardNumber: number;
  onComplete: () => void;
  hideForest?: boolean;
  displayText?: string;
}

let isTransitionActive = false;
let currentOverlay: HTMLElement | null = null;
let activeTweens: gsap.core.Tween[] = [];
let enterTimeline: gsap.core.Timeline | null = null;
let exitTimeline: gsap.core.Timeline | null = null;
let pauseTimeline: gsap.core.Timeline | null = null;
let activeCloudImages: HTMLImageElement[] = []; // 🔥 IMAGE POOLING: Track cloud image elements for cleanup
let cloudTimelines: gsap.core.Timeline[] = []; // 🔥 MEMORY LEAK FIX: Track all cloud timelines (bounce, enter, exit)
let cloudDelayedCalls: gsap.core.Tween[] = []; // 🔥 MEMORY LEAK FIX: Track all delayedCall instances for cleanup
let activeSceneImages: HTMLImageElement[] = []; // 🔥 IMAGE POOLING: Track scene image elements for cleanup
let activeSceneElements: HTMLElement[] = []; // Animated scene layer elements (hill wrappers + regular images)
let contentTimelines: gsap.core.Timeline[] = []; // 🔥 MEMORY LEAK FIX: Track scene and digit timelines
let isCleaningUp = false;

const TRANSITION_CLOUD_IMAGES = [
  './assets/board transition/oblak+srednji.png', // ~103KB - consider compressing if memory critical
  './assets/board transition/oblak mali desno.png',
  './assets/board transition/oblak mali ljevo.png',
  './assets/board transition/oblak veliki ljevo dole.png'
];

const CLOUD_CSS_STYLES = `
@keyframes cc-cloud-enter {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0) rotate(var(--cloud-rot, 0deg)); }
  70% { opacity: 1; transform: translate(-50%, -50%) scale(1.2) rotate(var(--cloud-rot, 0deg)); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(var(--cloud-scale, 0.4)) rotate(var(--cloud-rot, 0deg)); }
}
@keyframes cc-cloud-move {
  0% { transform: translate(-50%, -50%) scale(var(--cloud-scale, 0.4)) rotate(var(--cloud-rot, 0deg)); }
  100% { transform: translate(var(--move-end, -50%), -50%) scale(var(--cloud-scale, 0.4)) rotate(var(--cloud-rot, 0deg)); }
}
@keyframes cc-cloud-exit {
  0% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--move-end, -50%), -50%) scale(0) rotate(var(--cloud-rot, 0deg)); }
}
.cc-board-transition-cloud.cc-cloud-exit {
  animation: cc-cloud-exit 0.35s ease-in forwards !important;
}
`;
const TRANSITION_SCENE_LAYERS = [
  {
    key: 'mountain',
    src: './assets/journey assets/forest/mountain.png',
    alt: 'Mountain',
    style: [
      'left: 50%',
      'bottom: 142px',
      'width: auto',
      'z-index: 0',
      'transform-origin: center bottom',
      '--scene-base-scale: 1.18404'
    ]
  },
  {
    key: 'hill2',
    src: './assets/journey assets/forest/hill2.png',
    alt: 'Hill 2',
    style: [
      'left: calc(50% - 10px)',
      'bottom: 3px',
      'width: auto',
      'z-index: 20',
      'transform-origin: center bottom',
      '--scene-base-scale: 1.45152'
    ]
  },
  {
    key: 'hill1',
    src: './assets/journey assets/forest/hill1.png',
    alt: 'Hill 1',
    style: [
      'left: 50%',
      'bottom: 88px',
      'width: auto',
      'z-index: 10',
      'transform-origin: center bottom',
      '--scene-base-scale: 1.39104'
    ]
  },
  {
    key: 'pine1',
    src: './assets/journey assets/pine1.png',
    alt: 'Pine 1',
    style: [
      'left: 10%',
      'bottom: 66px',
      'width: min(34vw, 138px)',
      'z-index: 34',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'pine2',
    src: './assets/journey assets/pine2.png',
    alt: 'Pine 2',
    style: [
      'left: 31%',
      'bottom: 46px',
      'width: min(58vw, 236px)',
      'z-index: 36',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'pine3',
    src: './assets/journey assets/pine3.png',
    alt: 'Pine 3',
    style: [
      'left: 61%',
      'bottom: 64px',
      'width: min(43vw, 176px)',
      'z-index: 34',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'pine4',
    src: './assets/journey assets/pine4.png',
    alt: 'Pine 4',
    style: [
      'left: 78%',
      'bottom: 40px',
      'width: min(43vw, 176px)',
      'z-index: 36',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'pine5',
    src: './assets/journey assets/pine5.png',
    alt: 'Pine 5',
    style: [
      'left: 86%',
      'bottom: 110px',
      'width: min(26vw, 108px)',
      'z-index: 34',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'fence-left',
    src: './assets/journey assets/fence.left.png',
    alt: 'Fence left',
    style: [
      'left: calc(17% + 20px)',
      'bottom: 44px',
      'width: min(46vw, 180px)',
      'z-index: 38',
      'transform-origin: center bottom'
    ]
  },
  {
    key: 'fence-right',
    src: './assets/journey assets/fence.right.png',
    alt: 'Fence right',
    style: [
      'left: calc(79% + 20px)',
      'bottom: 44px',
      'width: min(46vw, 180px)',
      'z-index: 38',
      'transform-origin: center bottom'
    ]
  }
];
const TRANSITION_SCENE_ENTER_ORDER = [
  'hill2',
  'hill1',
  'mountain',
  'pine1',
  'pine4',
  'pine3',
  'pine5',
  'pine2',
  'fence-left',
  'fence-right'
];
const preloadedTransitionAssetUrls = new Set<string>();
let assetsPreloadPromise: Promise<void> | null = null;
let memSampleInterval: number | null = null;
let memSamplePeak = 0;
let memSampleStart = 0;
let memSampleStartTs = 0;

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));

function isTransitionHillLayer(layerKey: string): boolean {
  return layerKey === 'mountain' || layerKey === 'hill1' || layerKey === 'hill2';
}

function getTransitionHillParallaxX(layerKey: string): number {
  if (layerKey === 'hill2') return 84;
  if (layerKey === 'hill1') return -67;
  if (layerKey === 'mountain') return 50;
  return 0;
}

function getTransitionHillBaseScale(layerKey: string): number {
  if (layerKey === 'mountain') return 1.42085;
  if (layerKey === 'hill1') return 1.39104;
  if (layerKey === 'hill2') return 1.45152;
  return 1;
}

function getTransitionHillParallaxDuration(layerKey: string): number {
  if (layerKey === 'mountain') return 5.8;
  if (layerKey === 'hill1') return 5.5;
  if (layerKey === 'hill2') return 5.2;
  return 5.4;
}

function getTransitionHillParallaxScale(layerKey: string): number {
  return getTransitionHillBaseScale(layerKey) * 1.17;
}

function getTransitionHillDriftTarget(layerKey: string): { x: number; scale: number } {
  return {
    x: getTransitionHillBaseX(layerKey) + getTransitionHillParallaxX(layerKey),
    scale: getTransitionHillParallaxScale(layerKey),
  };
}

function getTransitionHillNaturalSize(layerKey: string): { width: number; height: number } {
  if (layerKey === 'mountain') return { width: 390, height: 328 };
  if (layerKey === 'hill1') return { width: 390, height: 197 };
  if (layerKey === 'hill2') return { width: 390, height: 122 };
  return { width: 390, height: 240 };
}

function getTransitionHillExitConfig(layerKey: string): {
  dropY: number;
  scale: number;
  duration: number;
  ease: string;
} {
  if (layerKey === 'mountain') {
    return { dropY: 210, scale: 0.94, duration: 0.44, ease: 'back.in(1.18)' };
  }
  if (layerKey === 'hill1') {
    return { dropY: 210, scale: 0.96, duration: 0.38, ease: 'back.in(1.05)' };
  }
  return { dropY: 220, scale: 0.96, duration: 0.38, ease: 'back.in(1.05)' };
}

function getTransitionHillBaseX(layerKey: string): number {
  if (layerKey === 'hill2') return -20;
  if (layerKey === 'hill1') return -32;
  if (layerKey === 'mountain') return -72;
  return 0;
}

function resetPooledImage(img: HTMLImageElement): void {
  try { gsap.killTweensOf(img); } catch {}
  try { gsap.set(img, { clearProps: 'all' }); } catch {}
  img.removeAttribute('style');
  img.removeAttribute('class');
  img.removeAttribute('data-scene-layer');
  img.removeAttribute('fetchpriority');
  img.style.animation = 'none';
  img.draggable = false;
}

const lifecycle = createScreenLifecycle('board-transition-screen');
const TRANSITION_HAPTIC_FIRST_DELAY = 0.1;
const TRANSITION_HAPTIC_OTHER_DELAY = 0.25;
const TRANSITION_EXIT_HAPTIC_FIRST_DELAY = 0.3;
const TRANSITION_EXIT_HAPTIC_SECOND_GAP = 0.3;

function ensureCloudStyles(): void {
  if (document.getElementById('cc-board-transition-cloud-styles')) return;
  const style = document.createElement('style');
  style.id = 'cc-board-transition-cloud-styles';
  style.textContent = CLOUD_CSS_STYLES;
  document.head.appendChild(style);
}

async function preloadTransitionAssets(includeForest: boolean = true): Promise<void> {
  const urls = includeForest
    ? [...TRANSITION_CLOUD_IMAGES, ...TRANSITION_SCENE_LAYERS.map((layer) => layer.src)]
    : [...TRANSITION_CLOUD_IMAGES];
  const missingUrls = urls.filter((src) => !preloadedTransitionAssetUrls.has(src));
  if (missingUrls.length === 0) return;
  if (assetsPreloadPromise) {
    await assetsPreloadPromise;
    return preloadTransitionAssets(includeForest);
  }
  assetsPreloadPromise = (async () => {
    try {
      logger.info('🧩 board-transition-screen: Preloading transition assets...');
      await Promise.all(missingUrls.map((src) => new Promise<void>((resolve) => {
        const img = new Image();
        img.src = src;
        if (typeof img.decode === 'function') {
          img.decode().then(() => resolve()).catch(() => resolve());
        } else {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }
      })));
      missingUrls.forEach((src) => preloadedTransitionAssetUrls.add(src));
      logger.info('✅ board-transition-screen: Transition assets preloaded');
    } finally {
      assetsPreloadPromise = null;
    }
  })();
  return assetsPreloadPromise;
}

function startMemSampling(): void {
  const mem = (performance as any)?.memory;
  if (!mem || typeof mem.usedJSHeapSize !== 'number') {
    console.log('📊 board-transition-screen: Memory sampling not available (performance.memory only in Chrome)');
    return;
  }
  if (memSampleInterval) {
    clearInterval(memSampleInterval);
    memSampleInterval = null;
  }
  memSampleStart = mem.usedJSHeapSize;
  memSamplePeak = memSampleStart;
  memSampleStartTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  memSampleInterval = window.setInterval(() => {
    const m = (performance as any)?.memory;
    if (m && typeof m.usedJSHeapSize === 'number') {
      if (m.usedJSHeapSize > memSamplePeak) memSamplePeak = m.usedJSHeapSize;
    }
  }, 120);
  console.log('📊 board-transition-screen: Memory sampling started', { startUsedJSHeapSize: memSampleStart });
}

function stopMemSampling(label: string): void {
  if (!memSampleInterval) return;
  clearInterval(memSampleInterval);
  memSampleInterval = null;
  const mem = (performance as any)?.memory;
  const end = mem && typeof mem.usedJSHeapSize === 'number' ? mem.usedJSHeapSize : null;
  const duration = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - memSampleStartTs;
  const payload = {
    startUsedJSHeapSize: memSampleStart,
    peakUsedJSHeapSize: memSamplePeak,
    endUsedJSHeapSize: end,
    peakDelta: memSamplePeak - memSampleStart,
    durationMs: Math.round(duration)
  };
  console.log(`📊 board-transition-screen: Memory sampling ${label}`, payload);
}

/**
 * Show board transition screen with animated board number
 * @param options - Board number and completion callback
 */
export async function showBoardTransitionScreen(options: BoardTransitionOptions): Promise<void> {
  const { boardNumber, onComplete, hideForest = false, displayText } = options;

  // 🔥 CRITICAL FIX: Validate boardNumber
  if (!Number.isFinite(boardNumber) || boardNumber < 1) {
    logger.error(`❌ board-transition-screen: Invalid boardNumber ${boardNumber}, using fallback 1`);
    // Don't return - use fallback instead
    const validBoardNumber = 1;
    return showBoardTransitionScreen({ ...options, boardNumber: validBoardNumber });
  }

  logger.info(`🎯 board-transition-screen: Showing transition for board ${boardNumber}`, {
    hideForest,
    displayText
  });

  // Prevent duplicate calls
  if (isTransitionActive) {
    logger.warn('⚠️ board-transition-screen: Already active, skipping duplicate call');
    return;
  }

  isTransitionActive = true;
  logger.info('✅ board-transition-screen: isTransitionActive set to true, starting transition');

            // Defensive cleanup is handled centrally in endgame-flow before transition

  // Fade out menu soundtrack over 2s when board transition starts (board game has its own melody)
  try {
    const { fadeOutAndPause } = await import('./soundtrack-manager.js');
    fadeOutAndPause(2000);
  } catch (_) { /* ignore */ }

  // Preload in the background; do not block the transition overlay on image decode.
  preloadTransitionAssets(!hideForest).catch((error) => {
    logger.warn('⚠️ board-transition-screen: Background preload failed:', error);
  });
  import('../utils/board-asset-warmup.js')
    .then(({ warmBoardGameAssetsSoon }) => {
      warmBoardGameAssetsSoon({
        mode: 'journey',
        boardNumber,
        reason: 'board-transition-screen',
        timeoutMs: 1800,
      });
    })
    .catch((error) => {
      logger.warn('⚠️ board-transition-screen: Board asset warmup import failed:', error);
    });
  
  // Cleanup any existing overlay (preserve DOM for reuse)
  cleanup({ preserveDom: true });
  
  // 🔥 USER REQUEST: Reset paper background when transition screen closes
  // This will be called in cleanup() after transition completes

  return new Promise((resolve, reject) => {
    let finished = false;
    const finishOnce = () => {
      if (finished) return;
      finished = true;
      try { sampleMemorySpike('4_transition_complete'); } catch {}
      stopMemSampling('finished');
      resolve();
      try {
        onComplete();
      } catch (onCompleteError) {
        logger.error('❌ board-transition-screen: onComplete callback failed:', onCompleteError);
      }
    };
    // 🔥 iOS APP STORE: Wrap in try-catch for error handling
    try {
      startMemSampling();
      // 🔥 USER REQUEST: Apply paper background with same opacity as board game (35%)
      // This replaces the gray overlay with paper texture
      applyPaperBackground('0.35');
    } catch (error) {
      logger.error('❌ board-transition-screen: Failed to apply paper background:', error);
      // Continue anyway - non-critical
    }
    
    try {
    
    const reuseOverlay = !!currentOverlay && currentOverlay.isConnected;
    let overlay: HTMLElement;
    let container: HTMLElement;
    let numberContainer: HTMLElement;
    let cloudContainer: HTMLElement | null = null;
    let cloudBehindHillContainer: HTMLElement | null = null;
    let cloudMidContainer: HTMLElement | null = null;
    let cloudFrontContainer: HTMLElement | null = null;
    let forestContainer: HTMLElement | null = null;
    if (reuseOverlay) {
      logger.info('♻️ board-transition-screen: Reusing existing transition overlay');
      overlay = currentOverlay as HTMLElement;
      overlay.style.display = 'flex';
      overlay.style.visibility = 'visible';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      container = overlay.querySelector('.cc-board-transition-container') as HTMLElement;
      numberContainer = overlay.querySelector('.cc-board-transition-number') as HTMLElement;
      cloudContainer = overlay.querySelector('.cc-board-transition-clouds') as HTMLElement | null;
      cloudBehindHillContainer = overlay.querySelector('.cc-board-transition-clouds-behind-hill') as HTMLElement | null;
      cloudMidContainer = overlay.querySelector('.cc-board-transition-clouds-mid') as HTMLElement | null;
      cloudFrontContainer = overlay.querySelector('.cc-board-transition-clouds-front') as HTMLElement | null;
      forestContainer = overlay.querySelector('.cc-board-transition-forest') as HTMLElement | null;
      try { sampleMemorySpike('3_transition_overlay_shown'); } catch {}
    } else {
      logger.info('🧱 board-transition-screen: Building transition overlay (first-time)');
      // Create overlay (transparent - paper bg shows through)
      overlay = document.createElement('div');
      overlay.id = 'cc-board-transition-overlay';
      overlay.style.cssText = [
        'position: fixed',
        'inset: 0',
        'background: transparent', // 🔥 USER REQUEST: Transparent so paper bg shows through
        'z-index: 99999',
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'justify-content: center',
        'padding: 0', // 🔥 CRITICAL FIX: Remove padding that could affect centering
        'opacity: 0',
        'pointer-events: none',
        'overflow: visible',
        'visibility: visible' // 🔥 CRITICAL FIX: Ensure overlay is visible even when opacity is 0
      ].join(';');

      // Create container with 3D perspective
      container = document.createElement('div');
      container.className = 'cc-board-transition-container';
      container.style.cssText = [
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'justify-content: center',
        'width: 100%',
        'gap: 0',
        // 🔥 USER REQUEST: 3D perspective for container
        'perspective: 1000px',
        'transform-style: preserve-3d',
        'position: relative',
        'z-index: 10' // Keep board number above scene and clouds.
      ].join(';');

      // Create board number container
      numberContainer = document.createElement('div');
      numberContainer.className = 'cc-board-transition-number';
      numberContainer.style.cssText = [
        'display: flex',
        'flex-direction: row',
        'align-items: center',
        'justify-content: center',
        'gap: 0px', // 🔥 USER REQUEST: No gap - digits should be very close together
        'margin-top: -8px', // 🔥 USER REQUEST: Reduced by 16px (from 8px to -8px) to bring closer to "board" text
        // 🔥 CRITICAL FIX: Remove all margins - will be positioned absolutely
        'margin-left: 0',
        'margin-right: 0',
        'margin-bottom: 0',
        'padding: 0',
        'width: fit-content', // Fit content exactly - no extra width
        'min-width: 0', // Prevent flex from adding extra width
        'max-width: 100%', // Prevent overflow
        'box-sizing: border-box', // Include padding/border in width calculation
        'position: relative'
      ].join(';');
    }

    // Format board number as string (01, 02, etc.)
    const transitionText = (typeof displayText === 'string' && displayText.trim().length > 0)
      ? displayText.trim().toUpperCase()
      : boardNumber.toString().padStart(2, '0');
    const digits = Array.from(transitionText);
    
    logger.info(`🎯 board-transition-screen: Formatting transition text "${transitionText}" with ${digits.length} characters`);

    // 🔥 CRITICAL FIX: Validate digits array is not empty
    if (digits.length === 0) {
      logger.error(`❌ board-transition-screen: No digits to display for board number ${boardNumber}`);
      cleanup();
      isTransitionActive = false;
      finishOnce();
      return;
    }

    // Create or reuse digit elements with 3D extrusion effect
    const digitElements: HTMLElement[] = [];
    const existingDigits = Array.from(numberContainer.querySelectorAll('.cc-board-transition-digit')) as HTMLElement[];
    if (existingDigits.length === digits.length) {
      existingDigits.forEach((digitEl, index) => {
        digitEl.textContent = digits[index];
        digitEl.style.filter = 'none';
        digitElements.push(digitEl);
      });
    } else {
      numberContainer.innerHTML = '';
      digits.forEach((digit, index) => {
        // 🔥 CRITICAL FIX: Create wrapper for digit
        const digitWrapper = document.createElement('div');
        digitWrapper.className = 'journey-board-card-wrapper';
        digitWrapper.style.cssText = [
          'display: inline-flex !important', // Override CSS class
          'align-items: center',
          'justify-content: center',
          'width: auto', // 🔥 CRITICAL FIX: Let content determine width - no min-width in layout
          'height: auto', // 🔥 CRITICAL FIX: Let content determine height
          'position: relative !important', // 🔥 CRITICAL FIX: Override absolute from CSS class
          // 🔥 CRITICAL FIX: Remove all spacing that could affect centering
          'margin: 0 !important',
          'padding: 0 !important',
          'border: 0 !important',
          'outline: 0 !important',
          'vertical-align: top', // Align to top to prevent baseline spacing
          'z-index: 10'
        ].join(';');
        
        const digitEl = document.createElement('span');
        digitEl.textContent = digit;
        digitEl.className = 'cc-board-transition-digit'; // For cleanup identification
        
        const dropShadow = 'none';
        
        digitEl.style.cssText = [
          'font-family: "Baloo2", system-ui, -apple-system, sans-serif',
          'font-weight: 800',
          'font-size: 166px', // 🔥 USER REQUEST: Increased by 15% (144px * 1.15 = 165.6px ≈ 166px)
          'line-height: 1',
          'color: #e77449',
          'text-align: center',
          'opacity: 0',
          'transform: scale(0) perspective(1000px) translateZ(0)',
          'display: inline-block',
          'visibility: visible', // 🔥 CRITICAL FIX: Ensure element is visible
          'pointer-events: none',
          // 🔥 CRITICAL FIX: Remove all spacing that could affect centering
          'margin: 0',
          'padding: 0',
          'border: 0',
          'outline: 0',
          'vertical-align: top', // Align to top to prevent baseline spacing
          // 🔥 USER REQUEST: Remove drop shadow/filter effects
          `filter: ${dropShadow}`,
          'transform-style: preserve-3d',
          'backface-visibility: hidden',
          '-webkit-font-smoothing: antialiased',
          '-moz-osx-font-smoothing: grayscale',
          'text-rendering: optimizeLegibility',
          'font-variant-numeric: tabular-nums', // Stabilize digit widths for better centering
          'font-feature-settings: "tnum" 1',
          // 🔥 CRITICAL FIX: Set transform origin to center to prevent position shifts
          'transform-origin: center center',
          'position: relative',
          'z-index: 10'
        ].join(';');
        
        digitWrapper.appendChild(digitEl);
        numberContainer.appendChild(digitWrapper);
        digitElements.push(digitEl);
        logger.info(`✅ board-transition-screen: Created digit element ${index} with text "${digit}" and 3D extrusion`);
      });
    }
    
    // 🔥 CRITICAL FIX: Validate digit elements were created
    if (digitElements.length === 0) {
      logger.error(`❌ board-transition-screen: Failed to create digit elements for board number ${boardNumber}`);
      cleanup();
      isTransitionActive = false;
      resolve();
      onComplete();
      return;
    }

    // Clouds are prepared up front, then each cloud enters with a staggered pop-in.
    if (!cloudContainer) {
      cloudContainer = document.createElement('div');
      cloudContainer.className = 'cc-board-transition-clouds';
      cloudContainer.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'z-index: 1',
        'overflow: visible'
      ].join(';');
    }
    if (!cloudBehindHillContainer) {
      cloudBehindHillContainer = document.createElement('div');
      cloudBehindHillContainer.className = 'cc-board-transition-clouds-behind-hill';
      cloudBehindHillContainer.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'z-index: 2',
        'overflow: visible'
      ].join(';');
    }
    if (!cloudMidContainer) {
      cloudMidContainer = document.createElement('div');
      cloudMidContainer.className = 'cc-board-transition-clouds-mid';
      cloudMidContainer.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'z-index: 30',
        'overflow: visible'
      ].join(';');
    }
    if (!cloudFrontContainer) {
      cloudFrontContainer = document.createElement('div');
      cloudFrontContainer.className = 'cc-board-transition-clouds-front';
      cloudFrontContainer.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'z-index: 5',
        'overflow: visible'
      ].join(';');
    }
    ensureCloudStyles();
    cloudDelayedCalls.forEach((delayedCall) => {
      try { delayedCall?.kill?.(); } catch {}
    });
    cloudDelayedCalls = [];
    cloudTimelines.forEach((timeline) => {
      try { timeline?.kill?.(); } catch {}
    });
    cloudTimelines = [];
    activeCloudImages.forEach((cloudImg) => {
      try {
        resetPooledImage(cloudImg);
        domElementPool.release(cloudImg);
      } catch {}
    });
    cloudContainer.innerHTML = '';
    cloudBehindHillContainer.innerHTML = '';
    cloudMidContainer.innerHTML = '';
    cloudFrontContainer.innerHTML = '';
    activeCloudImages = [];

    const cloudImages = TRANSITION_CLOUD_IMAGES;
    const cloudSpawnTops = [15, 46, 24, 55, 21, 52, 43, 49];
    const totalClouds = cloudSpawnTops.length;
    const moveDuration = 1.8;
    const BOUNCE_REPEAT = 3;
    const CLOUD_STAGGER = 0.06; // faster cadence so drift starts sooner
    const CLOUD_ENTER_DURATION = 0.34;
    const CLOUD_SETTLE_DURATION = 0.14;
    const viewportW = Math.max(320, window.innerWidth || 390);
    const cloudBasePx = Math.min(240, Math.max(104, viewportW * 0.24));
    const cloudStepPx = Math.max(18, cloudBasePx * 0.16);
    const windStrength = 0.18; // stronger variance but still stable
    const driftDistanceMinPx = viewportW * 0.55;
    const driftDistanceMaxPx = viewportW * 0.95;
    const CLOUD_ASPECT = 1.15; // width:height - stable dimensions prevent layout jump on image load

    for (let i = 0; i < totalClouds; i++) {
      const spawnTop = cloudSpawnTops[i];
      const isLowerCloud = i >= totalClouds - 2;
      const isBehindHillCloud = !isLowerCloud && spawnTop < 32;
      let sizeBoost = 1;
      if (isLowerCloud) {
        sizeBoost = 1.15 + Math.random() * 0.14;
      } else if (spawnTop < 32 && Math.random() < 0.55) {
        sizeBoost = 1.25 + Math.random() * 0.22;
      } else if (spawnTop >= 32 && spawnTop < 64 && Math.random() < 0.4) {
        sizeBoost = 1.15 + Math.random() * 0.18;
      }
      const cloudSizePx = Math.round((cloudBasePx + (i % 3) * cloudStepPx) * sizeBoost);
      const cloudHeightPx = Math.round(cloudSizePx / CLOUD_ASPECT);
      const baseSize = isLowerCloud
        ? 1.1 + (i % 2) * 0.08
        : (0.92 + (i % 3) * 0.1) * Math.min(1.18, 0.98 + sizeBoost * 0.12);
      const spawnLeft = isLowerCloud ? (i === totalClouds - 2 ? 26 : 82) : 8 + (i * 9) % 84;
      const goesLeft = Math.random() < 0.5; // random side push
      const enterDelay = i * CLOUD_STAGGER;
      const rotation = (i % 5 - 2) * 6;
      const bounceAmount = 6 + (i % 3) * 3;
      const bounceSpeed = 0.45 + (i % 4) * 0.08;
      const windFactor = 1 + ((Math.random() * 2 - 1) * windStrength); // 0.82..1.18
      const windYOffset = (Math.random() * 2 - 1) * 10;
      const windDuration = (moveDuration * 0.72 + 0.32) * windFactor;
      const driftDistancePx = (driftDistanceMinPx + Math.random() * (driftDistanceMaxPx - driftDistanceMinPx)) * (goesLeft ? -1 : 1);
      const initialYOffset = isLowerCloud ? -40 : 0;
      const driftStartDelay = 0.06;

      const cloudImg = domElementPool.acquire('img') as HTMLImageElement;
      resetPooledImage(cloudImg);
      cloudImg.src = cloudImages[i % cloudImages.length];
      cloudImg.className = 'cc-board-transition-cloud';
      cloudImg.alt = '';
      cloudImg.style.cssText = [
        'position: absolute',
        'pointer-events: none',
        'will-change: transform, opacity',
        `width: ${cloudSizePx}px`,
        `height: ${cloudHeightPx}px`,
        'object-fit: contain',
        `max-width: ${Math.round(viewportW * 0.74)}px`,
        `top: ${spawnTop}%`,
        `left: ${spawnLeft}%`,
        'transform-origin: center center'
      ].join(';');

      activeCloudImages.push(cloudImg);
      gsap.set(cloudImg, {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: initialYOffset,
        scale: 0.12,
        opacity: 0,
        rotation,
        rotationX: 0,
        rotationY: 0,
        transformOrigin: 'center center'
      });

      const bounceTimeline = trackTimeline({ repeat: BOUNCE_REPEAT - 1, delay: enterDelay + 0.5 });
      bounceTimeline.to(cloudImg, { y: `+=${bounceAmount}px`, duration: bounceSpeed / 2, ease: 'sine.out' });
      bounceTimeline.to(cloudImg, { y: `-=${bounceAmount}px`, duration: bounceSpeed / 2, ease: 'sine.in' });
      cloudTimelines.push(bounceTimeline);

      const enterTl = trackTimeline({ delay: enterDelay });
      // Phase 1: visible one-by-one pop-in at spawn point (no horizontal movement yet)
      enterTl.to(cloudImg, {
        opacity: 1,
        scale: baseSize * 1.22,
        duration: CLOUD_ENTER_DURATION,
        ease: 'back.out(2.2)'
      });
      // Phase 2: settle from pop-in overshoot
      enterTl.to(cloudImg, {
        scale: baseSize,
        duration: CLOUD_SETTLE_DURATION,
        ease: 'power2.out'
      }, '>0');
      // Phase 2: Visible lateral drift in viewport pixels (not element-relative percentages).
      enterTl.to(cloudImg, { x: driftDistancePx, duration: windDuration, ease: 'sine.inOut' }, driftStartDelay);
      enterTl.to(cloudImg, { y: `+=${windYOffset}px`, duration: windDuration * 0.55, ease: 'sine.inOut' }, driftStartDelay);
      cloudTimelines.push(enterTl);

      const exitStartTime = enterDelay + 0.55 + windDuration * (isLowerCloud ? 0.95 : 0.82);
      const delayedCall = trackDelayedCall(exitStartTime, () => {
        if (!activeCloudImages.includes(cloudImg)) return;
        bounceTimeline.kill();
        const exitTl = trackTimeline();
        exitTl.to(cloudImg, { opacity: 0, scale: 0, duration: 0.25, ease: 'power2.in' });
        cloudTimelines.push(exitTl);
      });
      cloudDelayedCalls.push(delayedCall);

      const isFrontCloud = i % 3 === 1;
      (isBehindHillCloud ? cloudBehindHillContainer : isLowerCloud ? cloudMidContainer : isFrontCloud ? cloudFrontContainer : cloudContainer).appendChild(cloudImg);
    }

    logger.info(`☁️ board-transition-screen: Clouds created (${totalClouds} total, stagger ${CLOUD_STAGGER}s, pop-in enabled)`);
    overlay.appendChild(cloudContainer);
    overlay.appendChild(cloudBehindHillContainer);
    overlay.appendChild(cloudFrontContainer);

    // 🔥 USER REQUEST: Bottom scene at bottom, in front of clouds, behind digits
    const isIPad = (() => {
      const ua = navigator.userAgent || '';
      const isIPadUA = /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
      const vw = window.innerWidth || 0;
      return isIPadUA || (vw >= 769 && vw <= 1366);
    })();

    if (!hideForest) {
      if (!forestContainer) {
        forestContainer = document.createElement('div');
        forestContainer.className = 'cc-board-transition-forest cc-board-transition-scene';
      } else {
        forestContainer.className = 'cc-board-transition-forest cc-board-transition-scene';
      }
      forestContainer.style.cssText = [
        'position: absolute',
        'left: 0',
        'right: 0',
        'bottom: -52px',
        'width: 100%',
        'height: calc(min(44vh, 380px) + 120px)',
        'pointer-events: none',
        'z-index: 4',
        'overflow: visible',
        'transform-origin: center bottom',
        'contain: layout style'
      ].join(';');

      Array.from(forestContainer.querySelectorAll('img')).forEach((img) => {
        try {
          resetPooledImage(img as HTMLImageElement);
          domElementPool.release(img as HTMLImageElement);
        } catch {}
      });
      forestContainer.innerHTML = '';
      activeSceneImages = [];
      activeSceneElements = [];

      forestContainer.style.removeProperty('transform');
      forestContainer.style.bottom = isIPad ? '-76px' : '-52px';

      TRANSITION_SCENE_LAYERS.forEach((layer) => {
        const isHillLayer = isTransitionHillLayer(layer.key);
        const sceneImg = domElementPool.acquire('img') as HTMLImageElement;
        resetPooledImage(sceneImg);
        const sceneLayerStyle = isIPad && isTransitionHillLayer(layer.key)
          ? layer.style.map((styleRule) => {
              if (styleRule.startsWith('width:')) return 'width: auto';
              if (styleRule.startsWith('left:')) return 'left: 50%';
              if (styleRule.startsWith('bottom:')) {
                if (layer.key === 'mountain') return 'bottom: 140px';
                if (layer.key === 'hill2') return 'bottom: 13px';
                return 'bottom: 80px';
              }
              return styleRule;
            })
          : layer.style;
        sceneImg.src = layer.src;
        sceneImg.alt = layer.alt;
        sceneImg.loading = 'eager';
        sceneImg.setAttribute('fetchpriority', 'high');
        sceneImg.decoding = 'async';
        sceneImg.draggable = false;
        activeSceneImages.push(sceneImg);

        if (isHillLayer) {
          const naturalSize = getTransitionHillNaturalSize(layer.key);
          const sceneLayer = document.createElement('div');
          sceneLayer.className = 'cc-board-transition-scene-layer';
          sceneLayer.dataset.sceneLayer = layer.key;
          sceneLayer.style.cssText = [
            'position: absolute',
            `width: ${naturalSize.width}px`,
            `height: ${naturalSize.height}px`,
            'pointer-events: none',
            'will-change: transform, opacity',
            'backface-visibility: hidden',
            'transform-origin: center bottom',
            ...sceneLayerStyle.filter((rule) => !rule.trim().startsWith('width:'))
          ].join(';');
          sceneImg.style.cssText = [
            'width: 100%',
            'height: 100%',
            'object-fit: contain',
            'display: block',
            'pointer-events: none',
            'backface-visibility: hidden',
          ].join(';');
          sceneLayer.appendChild(sceneImg);
          activeSceneElements.push(sceneLayer);
          forestContainer.appendChild(sceneLayer);
        } else {
          sceneImg.dataset.sceneLayer = layer.key;
          sceneImg.style.cssText = [
            'position: absolute',
            'height: auto',
            'object-fit: contain',
            'display: block',
            'pointer-events: none',
            'will-change: transform, opacity',
            'backface-visibility: hidden',
            ...sceneLayerStyle
          ].join(';');
          activeSceneElements.push(sceneImg);
          forestContainer.appendChild(sceneImg);
        }
      });
      forestContainer.appendChild(cloudMidContainer);
      overlay.appendChild(forestContainer);
    } else {
      overlay.appendChild(cloudMidContainer);
      // Arcade variant: explicitly remove/disable scene layer if a reused overlay still has it.
      if (forestContainer && forestContainer.parentNode) {
        Array.from(forestContainer.querySelectorAll('img')).forEach((img) => {
          try {
            resetPooledImage(img as HTMLImageElement);
            domElementPool.release(img as HTMLImageElement);
          } catch {}
        });
        forestContainer.innerHTML = '';
        try { forestContainer.parentNode.removeChild(forestContainer); } catch {}
      }
      forestContainer = null;
      activeSceneImages = [];
    }

    // Assemble DOM
    container.appendChild(numberContainer);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    currentOverlay = overlay;
    try { sampleMemorySpike('3_transition_overlay_shown'); } catch {}
    
    logger.info(`🎯 board-transition-screen: Overlay added to DOM`);
    
    logger.info(`🎯 board-transition-screen: Created ${digitElements.length} digit elements`);
    
    // Kill any existing tweens and timelines
    activeTweens.forEach(tween => {
      try { tween.kill(); } catch {}
    });
    activeTweens = [];

    if (enterTimeline) {
      try { enterTimeline.kill(); } catch {}
      enterTimeline = null;
    }
    
    if (exitTimeline) {
      try { exitTimeline.kill(); } catch {}
      exitTimeline = null;
    }
    
    if (pauseTimeline) {
      try { pauseTimeline.kill(); } catch {}
      pauseTimeline = null;
    }

    // ENTER ANIMATION - exit will start after last digit completes
    enterTimeline = trackTimeline({
      onStart: () => {
        logger.info('✅ board-transition-screen: Enter timeline started');
      },
      onComplete: () => {
        logger.info('✅ board-transition-screen: Enter timeline completed');
      }
    });

    // Step 1: Fade in overlay (0.2s - faster)
    enterTimeline.to(overlay, {
      opacity: 1,
      duration: 0.2,
      ease: 'power2.out'
    }, 0);

    // 🔥 USER REQUEST: Screen shake at start of enter animation (0.3s earlier than before)
    enterTimeline.call(() => {
      try {
        // Screen shake effect at start of enter animation
        // 🔥 CRITICAL FIX: Only kill x, y transforms, not opacity (preserve overlay fade-in)
        gsap.killTweensOf(overlay, 'x,y');
        const shakeStrength = 15;
        const shakeDuration = 0.5;
        const shakeSteps = 20;
        
        const shakeTimeline = trackTimeline({
          onStart: () => {
            // Only set x, y to 0, don't touch opacity
            gsap.set(overlay, { x: 0, y: 0 });
          }
        });
        
        // 🔥 MEMORY LEAK FIX: Track shake timeline for cleanup
        activeTweens.push(shakeTimeline);
        
        for (let i = 0; i < shakeSteps; i++) {
          const progress = i / shakeSteps;
          const intensity = shakeStrength * (1 - progress);
          const shakeX = (Math.random() - 0.5) * intensity * 2;
          const shakeY = (Math.random() - 0.5) * intensity * 2;
          
          shakeTimeline.to(overlay, {
            x: shakeX,
            y: shakeY,
            duration: shakeDuration / shakeSteps,
            ease: 'none'
          });
        }
        
        shakeTimeline.to(overlay, {
          x: 0,
          y: 0,
          duration: 0.1,
          ease: 'power2.out'
        });
        
        logger.info('💥 Board transition screen shake triggered at start of enter animation (0.3s earlier)');
      } catch (shakeError) {
        logger.warn('⚠️ Error triggering screen shake:', shakeError);
      }
    }, null, 0);

    // 🔥 USER REQUEST: Scene enter animation, each layer gets the old forest pop-in treatment.
    if (forestContainer) {
      gsap.set(forestContainer, {
        opacity: 1,
        transformOrigin: 'center bottom'
      });

      const sceneImagesByKey = new Map(
        activeSceneElements.map((sceneImg) => [sceneImg.dataset.sceneLayer || '', sceneImg])
      );
      const orderedSceneImages = TRANSITION_SCENE_ENTER_ORDER
        .map((key) => sceneImagesByKey.get(key))
        .filter(Boolean) as HTMLImageElement[];

      orderedSceneImages.forEach((sceneImg, index) => {
        const direction = index % 2 === 0 ? -1 : 1;
        const layerKey = sceneImg.dataset.sceneLayer || '';
        const isHill = isTransitionHillLayer(layerKey);
        const hillParallaxX = getTransitionHillParallaxX(layerKey);
        const hillBaseScale = getTransitionHillBaseScale(layerKey);
        const hillBaseX = getTransitionHillBaseX(layerKey);
        const hillStartYOffset = Math.round(Math.min(window.innerHeight || 760, 760) * 0.4);
        gsap.set(sceneImg, {
          opacity: 0,
          xPercent: -50,
          yPercent: 0,
          x: isHill ? hillBaseX - hillParallaxX * 0.18 : 0,
          y: isHill ? hillStartYOffset : 14,
          scale: isHill ? hillBaseScale * 0.68 : 0,
          scaleX: isHill ? hillBaseScale * 0.68 : 0,
          scaleY: isHill ? hillBaseScale * 0.68 : 0,
          rotation: isHill ? 0 : direction * 8,
          rotationX: 0,
          rotationY: 0,
          transformOrigin: 'center bottom',
          force3D: false
        });

        const sceneEnterTimeline = trackTimeline();
        contentTimelines.push(sceneEnterTimeline);
        if (isHill) {
          sceneEnterTimeline.to(sceneImg, {
            opacity: 1,
            x: hillBaseX,
            y: -6,
            scale: hillBaseScale * 1.12,
            scaleX: hillBaseScale * 1.12,
            scaleY: hillBaseScale * 1.12,
            duration: 0.34,
            ease: 'power2.out'
          });
          sceneEnterTimeline.to(sceneImg, {
            x: hillBaseX,
            y: 3,
            scale: hillBaseScale * 0.98,
            scaleX: hillBaseScale * 0.98,
            scaleY: hillBaseScale * 0.98,
            duration: 0.14,
            ease: 'power2.inOut'
          });
          sceneEnterTimeline.to(sceneImg, {
            opacity: 1,
            x: hillBaseX,
            y: 0,
            scale: hillBaseScale,
            scaleX: hillBaseScale,
            scaleY: hillBaseScale,
            duration: 0.16,
            ease: 'back.out(1.8)',
            onComplete: () => {
              try { sceneImg.style.willChange = 'transform, opacity'; } catch {}
            }
          });
        } else {
          sceneEnterTimeline.to(sceneImg, {
            opacity: 1,
            scale: 1.04,
            y: 0,
            rotation: 0,
            duration: 0.3,
            ease: 'back.out(2.0)'
          });
          sceneEnterTimeline.to(sceneImg, {
            scale: 0.95,
            duration: 0.1,
            ease: 'power2.out'
          });
          sceneEnterTimeline.to(sceneImg, {
            opacity: 1,
            scale: 1.0,
            y: 0,
            duration: 0.12,
            ease: 'back.out(1.5)',
            onComplete: () => {
              try { sceneImg.style.willChange = 'auto'; } catch {}
            }
          });
        }
        enterTimeline.add(sceneEnterTimeline, 0.05 + index * 0.045);
      });
    }

    // Step 3: Animate digits with bounce animation (staggered)
    digitElements.forEach((digitEl, index) => {
      const delay = 0.3 + (index * 0.3); // Stagger by 0.3s per digit
      const digitHapticLocalDelay = index === 0 ? TRANSITION_HAPTIC_FIRST_DELAY : TRANSITION_HAPTIC_OTHER_DELAY;
      const digitHapticDelay = delay + digitHapticLocalDelay;

      if (typeof (window as any).triggerHapticImpact === 'function') {
        const hapticCall = trackDelayedCall(digitHapticDelay, () => {
          try { (window as any).triggerHapticImpact?.('light'); } catch {}
        });
        activeTweens.push(hapticCall as any);
      }
      
      // 🔥 USER REQUEST: Generate random rotation with opposite poles for adjacent digits
      // First digit: random between -8 and +8, second digit: opposite sign (always -+ or +-)
      const baseRotation = -8 + Math.random() * 16; // Random between -8 and +8
      // If index is even (0, 2, 4...), use baseRotation; if odd (1, 3, 5...), use opposite sign
      const randomRotation = index % 2 === 0 
        ? baseRotation 
        : -baseRotation; // Opposite sign for adjacent digits (always -+ or +-)
      
      // Set initial state (hidden)
      // 🔥 CRITICAL FIX: Ensure no transform properties that could affect horizontal position
      // 🔥 PERFORMANCE FIX: Add will-change and GPU acceleration BEFORE animation starts
      // This prevents layout reflow when properties change during animation
      digitEl.style.willChange = 'transform, opacity';
      digitEl.style.transform = 'translateZ(0)'; // Force GPU acceleration
      digitEl.style.backfaceVisibility = 'hidden'; // Better rendering performance
      digitEl.style.webkitBackfaceVisibility = 'hidden'; // iOS Safari
      // 🔥 PERFORMANCE FIX: Use contain to prevent layout interference
      digitEl.style.contain = 'layout style paint';
      
      gsap.set(digitEl, {
        opacity: 0,
        scale: 0,
        x: 0, // Explicitly set x to 0 to prevent horizontal offset
        y: 0, // Explicitly set y to 0
        rotation: randomRotation, // 🔥 USER REQUEST: Random rotation between -4 and +4 degrees
        rotationX: 0, // Ensure no rotation that could affect layout
        rotationY: 0,
        z: 0,
        force3D: true // Force 3D acceleration for better performance
      });

      // Beautiful bounce animation for each digit
      const digitTimeline = trackTimeline();
      contentTimelines.push(digitTimeline); // 🔥 FIX: Track for cleanup
      
      // First bounce: scale 0 → 1.2 with 3D rotation for depth
      digitTimeline.to(digitEl, {
          opacity: 1,
          scale: 1.2,
        rotation: randomRotation, // 🔥 USER REQUEST: Keep random rotation throughout animation
        rotationX: -5, // Slight 3D rotation for depth
        rotationY: 0,
        z: 20, // 3D depth
        x: 0, // 🔥 CRITICAL FIX: Explicitly ensure no horizontal movement
        y: 0, // 🔥 CRITICAL FIX: Explicitly ensure no vertical movement
        transformOrigin: 'center center', // 🔥 CRITICAL FIX: Ensure transform origin is center
          duration: 0.4,
          ease: 'back.out(2.0)'
        });
      
      // Settle: scale 1.2 → 0.95 with 3D return
      digitTimeline.to(digitEl, {
        scale: 0.95,
        rotation: randomRotation, // 🔥 USER REQUEST: Keep random rotation throughout animation
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0, // 🔥 CRITICAL FIX: Explicitly ensure no horizontal movement
        y: 0, // 🔥 CRITICAL FIX: Explicitly ensure no vertical movement
        transformOrigin: 'center center', // 🔥 CRITICAL FIX: Ensure transform origin is center
        duration: 0.15,
        ease: 'power2.out'
      });
      
      // Final settle: scale 0.95 → 1.0 with perfect 3D position
      digitTimeline.to(digitEl, {
        opacity: 1, // 🔥 CRITICAL FIX: Ensure full opacity in final state
        scale: 1.0,
        rotation: randomRotation, // 🔥 USER REQUEST: Keep random rotation throughout animation
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0, // 🔥 CRITICAL FIX: Explicitly ensure no horizontal offset
        y: 0, // 🔥 CRITICAL FIX: Explicitly ensure no vertical offset
        transformOrigin: 'center center', // 🔥 CRITICAL FIX: Ensure transform origin is center
        duration: 0.2,
        ease: 'back.out(1.5)',
        onComplete: () => {
          // 🔥 CRITICAL FIX: Add defensive null checks to prevent errors on destroyed elements
          try {
            // Check if digitEl still exists and is valid
            if (!digitEl || !digitEl.parentNode || digitEl.isConnected === false) {
              logger.warn('⚠️ board-transition-screen: Digit element destroyed before animation complete');
              return; // Element destroyed, skip cleanup
            }
            
            // 🔥 APP STORE: Cleanup will-change after animation completes
            if (digitEl.style) {
              digitEl.style.willChange = 'auto';
            }
            
            // 🔥 CRITICAL FIX: Start exit animation when LAST digit completes
            if (index === digitElements.length - 1) {
              logger.info('✅ board-transition-screen: All enter animations complete, starting exit');
              
              // Add a small pause before starting exit using GSAP timeline
              // 🔥 CRITICAL FIX: Store pauseTimeline for cleanup
              if (pauseTimeline) {
                try { pauseTimeline.kill(); } catch {}
              }
              
              pauseTimeline = trackTimeline({
                onComplete: () => {
                  pauseTimeline = null;
                  try {
                    // 🔥 FIX: Validate elements still exist before starting exit
                    if (!overlay || !overlay.isConnected || !container || !digitElements || digitElements.length === 0) {
                      logger.warn('⚠️ board-transition-screen: Elements destroyed before exit animation');
                      cleanup();
                      isTransitionActive = false;
                      finishOnce();
                      return;
                    }
                    
                    startExitAnimation(overlay, container, digitElements, forestContainer, () => {
                      cleanup({ preserveDom: true });
                      isTransitionActive = false;
                      // 🔥 USER REQUEST: Reset paper background when transition screen closes
                      // Note: This will be reset by the next screen (board game or journey)
                      finishOnce();
                    });
                  } catch (exitError) {
                    logger.error('❌ board-transition-screen: Failed to start exit animation:', exitError);
                    // Fallback: cleanup and resolve anyway
                    cleanup();
                    isTransitionActive = false;
                    finishOnce();
                  }
                }
              });
              
              pauseTimeline.to({}, {
                duration: 0.8,
                ease: 'none'
              });
            }
          } catch (error) {
            logger.warn('⚠️ board-transition-screen: Error in digit animation onComplete:', error);
          }
        }
      });
      
      enterTimeline.add(digitTimeline, delay);
    });
    
    // 🔥 CRITICAL FIX: Ensure timeline starts playing
    // GSAP timelines start automatically, but let's ensure it's playing
    if (enterTimeline && enterTimeline.paused()) {
      enterTimeline.play();
    }
    
    logger.info(`✅ board-transition-screen: Enter timeline created and started for board ${boardNumber}`);
    
    } catch (error) {
      logger.error('❌ board-transition-screen: Error in showBoardTransitionScreen:', error);
      // Cleanup and resolve on error
      cleanup();
      isTransitionActive = false;
      finishOnce();
    }
  });
}

/**
 * Start exit animation (reverse of enter)
 */
function startExitAnimation(
  overlay: HTMLElement,
  container: HTMLElement,
  digitElements: HTMLElement[],
  forestContainer: HTMLElement | null,
  onComplete: () => void
): void {
  // 🔥 CRITICAL FIX: Kill any existing exit timeline before creating new one
  if (exitTimeline) {
    try { exitTimeline.kill(); } catch {}
  }
  
  exitTimeline = trackTimeline({
    onComplete: () => {
      logger.info('✅ board-transition-screen: Exit animation complete');
      exitTimeline = null;
      // 🔥 Enter-animation mode: updateGhostVisibility will only hide ghosts until pop-in completes
      (window as any).__ccEnterAnimationActive = true;
      try {
        if (typeof (window as any).hideGhostPlaceholders === 'function') {
          (window as any).hideGhostPlaceholders();
        }
      } catch {}
      onComplete();
    }
  });

  // Start parallax first, then let the digits exit after the scene has already begun separating.
  const sceneParallaxLead = 1.0;

  // Replay same two digit haptics on exit (numbers disappearing), aligned with delayed digit exit.
  if (typeof (window as any).triggerHapticImpact === 'function') {
    const exitHapticDigits = Math.min(2, digitElements.length);
    for (let i = 0; i < exitHapticDigits; i++) {
      const exitDelay =
        i === 0
          ? sceneParallaxLead + TRANSITION_EXIT_HAPTIC_FIRST_DELAY
          : sceneParallaxLead + TRANSITION_EXIT_HAPTIC_FIRST_DELAY + TRANSITION_EXIT_HAPTIC_SECOND_GAP;
      const hapticCall = trackDelayedCall(exitDelay, () => {
        try { (window as any).triggerHapticImpact?.('light'); } catch {}
      });
      activeTweens.push(hapticCall as any);
    }
  }

  const digitExitDuration = 0.45;
  const digitExitStagger = 0.4;
  const digitExitEnd = digitElements.length > 0
    ? sceneParallaxLead + ((digitElements.length - 1) * digitExitStagger) + digitExitDuration
    : 0;

  // Step 1: Animate digits out with bounce (left-to-right, sequential)
    digitElements.forEach((digitEl, index) => {
      const delay = sceneParallaxLead + (index * digitExitStagger);
      
      const digitExitTimeline = trackTimeline();
      contentTimelines.push(digitExitTimeline); // 🔥 FIX: Track for cleanup
    
      // First: scale 1.0 → 1.1 (slight overshoot) with 3D depth
      digitExitTimeline.to(digitEl, {
        scale: 1.1,
      z: 30, // Push forward in 3D
        duration: 0.15,
        ease: 'power2.out'
      });
    
    // Then: scale 1.1 → 0 with 3D rotation and depth fade
      digitExitTimeline.to(digitEl, {
        opacity: 0,
        scale: 0,
        rotation: index % 2 === 0 ? 15 : -15,
      rotationX: index % 2 === 0 ? 45 : -45, // 3D rotation
      rotationY: index % 2 === 0 ? 30 : -30, // 3D rotation
      z: -100, // Pull back in 3D space
        duration: 0.3,
        ease: 'power2.in'
      });
    
      exitTimeline.add(digitExitTimeline, delay);
    });

  // Step 2: Scene exit animation
  let sceneFadeStart = digitExitEnd + 0.25;
  if (forestContainer) {
    const sceneImages = Array.from(forestContainer.querySelectorAll('[data-scene-layer]')) as HTMLElement[];
    const sceneExitStart = Math.max(0, digitExitEnd - 0.5);
    sceneImages.forEach((sceneImg) => {
      const layerKey = sceneImg.dataset.sceneLayer || '';
      const isHill = isTransitionHillLayer(layerKey);
      const isAggressiveDownPine = layerKey === 'pine2' || layerKey === 'pine4';
      const isPine3 = layerKey === 'pine3';
      const isLeftPine = layerKey === 'pine1' || layerKey === 'pine2';
      const isRightPine = layerKey === 'pine3' || layerKey === 'pine4' || layerKey === 'pine5';
      const isLeftFence = layerKey === 'fence-left';
      const isRightFence = layerKey === 'fence-right';
      if (isHill) {
        // Hills keep enter parallax until ordered exit — no second x/scale tween here (caused scale jerk).
        return;
      }
      if (!isHill && !isLeftPine && !isRightPine && !isLeftFence && !isRightFence) return;
      const pineDurationByLayer: Record<string, number> = {
        pine1: 1.55,
        pine2: 1.05,
        pine3: 1.68,
        pine4: 1.05,
        pine5: 1.42
      };
      const parallaxDuration = isLeftFence || isRightFence
          ? 0.9
          : pineDurationByLayer[layerKey] || Math.max(0.2, sceneExitStart + 0.25);

      const ambientTimeline = trackTimeline();
      contentTimelines.push(ambientTimeline);
      sceneImg.style.willChange = 'transform, opacity';
      ambientTimeline.to(sceneImg, {
        scale: isLeftFence || isRightFence ? 0.93 : 0.945,
        x: isLeftPine ? -59 : isPine3 ? 78 : isRightPine ? 59 : isLeftFence ? -140 : isRightFence ? 140 : 0,
        y: isAggressiveDownPine ? 55 : isPine3 ? 34 : isLeftPine || isRightPine ? 18 : isLeftFence || isRightFence ? 58 : 0,
        duration: parallaxDuration,
        ease: 'sine.inOut'
      });
      exitTimeline.add(ambientTimeline, 0);
    });

    const pine4ExitImage = sceneImages.find((sceneImg) => sceneImg.dataset.sceneLayer === 'pine4') || null;
    const pineExitImages = sceneImages
      .filter((sceneImg) => /^pine[1-5]$/.test(sceneImg.dataset.sceneLayer || '') && sceneImg.dataset.sceneLayer !== 'pine4')
      .sort(() => Math.random() - 0.5);
    const firstPineExitImages = [
      ...(pine4ExitImage ? [pine4ExitImage] : []),
      ...pineExitImages.slice(0, 1)
    ];
    const remainingPineExitImages = pineExitImages.slice(1);
    const fenceExitImages = sceneImages
      .filter((sceneImg) => /^fence-(left|right)$/.test(sceneImg.dataset.sceneLayer || ''))
      .sort(() => Math.random() - 0.5);
    const hillExitImages = ['mountain', 'hill1', 'hill2']
      .map((key) => sceneImages.find((sceneImg) => sceneImg.dataset.sceneLayer === key))
      .filter(Boolean) as HTMLImageElement[];
    const otherExitImages = sceneImages.filter((sceneImg) => {
      const key = sceneImg.dataset.sceneLayer || '';
      return !isTransitionHillLayer(key) && !/^pine[1-5]$/.test(key) && !/^fence-(left|right)$/.test(key);
    });
    const fenceExitStart = Math.max(0, sceneExitStart - 0.4);
    const hillDriftStart = -0.3;
    const hillExitBaseStart = sceneExitStart + 1.05;
    const orderedExitEntries = [
      ...fenceExitImages.map((sceneImg, index) => ({ sceneImg, start: fenceExitStart + index * 0.06, orderIndex: index })),
      ...firstPineExitImages.map((sceneImg, index) => ({ sceneImg, start: sceneExitStart + index * 0.05, orderIndex: fenceExitImages.length + index })),
      ...remainingPineExitImages.map((sceneImg, index) => ({ sceneImg, start: sceneExitStart + (firstPineExitImages.length + index) * 0.05, orderIndex: fenceExitImages.length + firstPineExitImages.length + index })),
      ...otherExitImages.map((sceneImg, index) => ({ sceneImg, start: sceneExitStart + (firstPineExitImages.length + remainingPineExitImages.length + index) * 0.05, orderIndex: fenceExitImages.length + firstPineExitImages.length + remainingPineExitImages.length + index })),
      ...hillExitImages.map((sceneImg, index) => ({ sceneImg, start: hillExitBaseStart + index * 0.2, orderIndex: fenceExitImages.length + firstPineExitImages.length + remainingPineExitImages.length + otherExitImages.length + index }))
    ];
    sceneFadeStart = Math.max(sceneFadeStart, hillExitBaseStart + (hillExitImages.length * 0.2) + 0.35);

    hillExitImages.forEach((sceneImg, index) => {
      const layerKey = sceneImg.dataset.sceneLayer || '';
      const hillExitStart = hillExitBaseStart + index * 0.2;
      const hillDriftTarget = getTransitionHillDriftTarget(layerKey);
      const hillDriftDuration = Math.max(0.9, hillExitStart - hillDriftStart - 0.04);
      const hillDriftTimeline = trackTimeline();
      contentTimelines.push(hillDriftTimeline);
      sceneImg.style.willChange = 'transform, opacity';
      gsap.set(sceneImg, {
        transformOrigin: 'center bottom',
        force3D: false,
      });
      hillDriftTimeline.to(sceneImg, {
        x: hillDriftTarget.x,
        scale: hillDriftTarget.scale,
        scaleX: hillDriftTarget.scale,
        scaleY: hillDriftTarget.scale,
        duration: hillDriftDuration,
        ease: 'power1.inOut',
        overwrite: 'auto',
        immediateRender: false,
      });
      exitTimeline.add(hillDriftTimeline, hillDriftStart);
    });

    orderedExitEntries.forEach(({ sceneImg, start, orderIndex }) => {
      const sceneExitTimeline = trackTimeline();
      contentTimelines.push(sceneExitTimeline);
      const layerKey = sceneImg.dataset.sceneLayer || '';
      const isHill = isTransitionHillLayer(layerKey);
      const isAggressiveDownPine = layerKey === 'pine2' || layerKey === 'pine4';
      sceneImg.style.willChange = 'transform, opacity';
      if (isHill) {
        const exitConfig = getTransitionHillExitConfig(layerKey);
        sceneExitTimeline.to(sceneImg, {
          opacity: 0,
          y: `+=${exitConfig.dropY}`,
          scale: `*=${exitConfig.scale}`,
          scaleX: `*=${exitConfig.scale}`,
          scaleY: `*=${exitConfig.scale}`,
          rotation: 0,
          duration: exitConfig.duration,
          ease: exitConfig.ease,
          overwrite: 'auto',
          immediateRender: false,
          onStart: () => {
            try {
              sceneImg.style.transformOrigin = 'center bottom';
              sceneImg.style.willChange = 'transform, opacity';
            } catch {}
          },
          onComplete: () => {
            try { sceneImg.style.willChange = 'auto'; } catch {}
          }
        });
      } else {
        sceneExitTimeline.to(sceneImg, {
          opacity: 0,
          scale: 0,
          y: isAggressiveDownPine ? 112 : 24,
          rotation: orderIndex % 2 === 0 ? 12 : -12,
          duration: 0.28,
          ease: 'power2.in',
          onComplete: () => {
            try { sceneImg.style.willChange = 'auto'; } catch {}
          }
        });
      }
      exitTimeline.add(sceneExitTimeline, start);
    });
  }

  // Step 3: Fade out overlay
  exitTimeline.to(overlay, {
    opacity: 0,
    duration: 0.3, // 🔥 USER REQUEST: Faster (0.4s → 0.3s)
    ease: 'power2.in'
  }, sceneFadeStart);

  // Store tweens for cleanup
  exitTimeline.getChildren().forEach(tween => {
    activeTweens.push(tween);
  });
}

/**
 * Cleanup function - iOS App Store ready
 * Ensures all animations, timelines, and DOM elements are properly cleaned up
 */
function cleanup(options: { preserveDom?: boolean } = {}): void {
  if (isCleaningUp) return;
  isCleaningUp = true;
  const preserveDom = options.preserveDom === true;
  try {
    lifecycle.cleanup();
    // 🔥 CRITICAL: Kill all active tweens
    activeTweens.forEach(tween => {
      try { 
        if (tween && typeof tween.kill === 'function') {
          tween.kill(); 
        }
      } catch (error) {
        logger.warn('⚠️ Error killing tween in cleanup:', error);
      }
    });
    activeTweens = [];

  // 🔥 CRITICAL: Kill all timelines
  if (enterTimeline) {
    try { 
      if (enterTimeline && typeof enterTimeline.kill === 'function') {
        enterTimeline.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing enterTimeline in cleanup:', error);
    }
    enterTimeline = null;
  }
  
  if (exitTimeline) {
    try { 
      if (exitTimeline && typeof exitTimeline.kill === 'function') {
        exitTimeline.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing exitTimeline in cleanup:', error);
    }
    exitTimeline = null;
  }
  
  if (pauseTimeline) {
    try { 
      if (pauseTimeline && typeof pauseTimeline.kill === 'function') {
        pauseTimeline.kill(); 
      }
    } catch (error) {
      logger.warn('⚠️ Error killing pauseTimeline in cleanup:', error);
    }
    pauseTimeline = null;
  }
  
  // 🔥 MEMORY LEAK FIX: Kill all delayedCall instances first (prevents callbacks from executing)
  cloudDelayedCalls.forEach(delayedCall => {
    try {
      if (delayedCall && typeof delayedCall.kill === 'function') {
        delayedCall.kill();
      }
    } catch (error) {
      logger.warn('⚠️ Error killing cloud delayedCall in cleanup:', error);
    }
  });
  cloudDelayedCalls = [];
  
  // 🔥 MEMORY SPIKE FIX: Stop CSS cloud animations (no GSAP timelines for clouds anymore)
  activeCloudImages.forEach(cloudImg => {
    try {
      cloudImg.style.animation = 'none';
      cloudImg.classList.remove('cc-cloud-exit');
    } catch {}
  });
  
  // 🔥 MEMORY LEAK FIX: Kill all cloud timelines (if any remain) with defensive checks
  cloudTimelines.forEach(timeline => {
    try {
      if (timeline && typeof timeline.kill === 'function') {
        // 🔥 FIX: Check timeline targets before killing to prevent null property errors
        const targets = (timeline as any).targets || [];
        const hasValidTarget = targets.length === 0 || targets.some((target: any) => 
          target && target !== null && target !== undefined && !target.destroyed
        );
        
        if (hasValidTarget || targets.length === 0) {
          timeline.kill();
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error killing cloud timeline in cleanup:', error);
    }
  });
  cloudTimelines = [];
  
  // 🔥 FIX: Kill all content timelines (forest, digits) with defensive checks
  contentTimelines.forEach(timeline => {
    try {
      if (timeline && typeof timeline.kill === 'function') {
        // 🔥 FIX: Check timeline targets before killing to prevent null property errors
        const targets = (timeline as any).targets || [];
        const hasValidTarget = targets.length === 0 || targets.some((target: any) => 
          target && target !== null && target !== undefined && !target.destroyed
        );
        
        if (hasValidTarget || targets.length === 0) {
          timeline.kill();
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error killing content timeline in cleanup:', error);
    }
  });
  contentTimelines = [];
  
  // Keep the overlay DOM reusable, but always return transient image elements to the pool.
  activeCloudImages.forEach(cloudImg => {
    try {
      resetPooledImage(cloudImg);
      domElementPool.release(cloudImg);
    } catch (error) {
      logger.warn('⚠️ Error releasing cloud image to pool:', error);
    }
  });
  activeCloudImages = [];

  activeSceneImages.forEach(sceneImg => {
    try {
      resetPooledImage(sceneImg);
      domElementPool.release(sceneImg);
    } catch (error) {
      logger.warn('⚠️ Error releasing scene image to pool:', error);
    }
  });
  activeSceneImages = [];

  activeSceneElements.forEach((sceneEl) => {
    try {
      if (!(sceneEl instanceof HTMLImageElement)) sceneEl.remove();
    } catch {}
  });
  activeSceneElements = [];

  // 🔥 APP STORE: Kill animations on scene container
  try {
    const sceneContainers = document.querySelectorAll('.cc-board-transition-forest, .cc-board-transition-scene');
    sceneContainers.forEach(container => {
      try {
        gsap.killTweensOf(container);
        container.querySelectorAll('img').forEach((img) => gsap.killTweensOf(img));
      } catch {}
    });
  } catch (error) {
    logger.warn('⚠️ Error cleaning up scene container:', error);
  }

  // 🔥 APP STORE: Clear any digit element references
  try {
    const digitElements = document.querySelectorAll('.cc-board-transition-digit');
    digitElements.forEach(digit => {
      try {
        // Kill any remaining animations
        gsap.killTweensOf(digit);
      } catch {}
    });
  } catch (error) {
    logger.warn('⚠️ Error cleaning up digit elements:', error);
  }

  // 🔥 CRITICAL: Remove overlay from DOM and cleanup all child elements
  if (currentOverlay) {
    try {
      // Kill all animations on overlay and children first
      gsap.killTweensOf(currentOverlay);
      const overlayChildren = currentOverlay.querySelectorAll('*');
      overlayChildren.forEach(child => {
        try {
          gsap.killTweensOf(child);
        } catch {}
      });
      
      if (preserveDom) {
        currentOverlay.style.opacity = '0';
        currentOverlay.style.visibility = 'hidden';
        currentOverlay.style.display = 'none';
      } else {
        // Remove from DOM
        if (currentOverlay.parentNode) {
          currentOverlay.parentNode.removeChild(currentOverlay);
        } else {
          currentOverlay.remove();
        }
        currentOverlay = null;
      }
    } catch (error) {
      logger.warn('⚠️ Error removing overlay:', error);
    }
  }

  if (!preserveDom) {
    // 🔥 CRITICAL: Also try to remove by ID (safety fallback)
    try {
      const existing = document.getElementById('cc-board-transition-overlay');
      if (existing) {
        // Kill animations before removing
        gsap.killTweensOf(existing);
        const existingChildren = existing.querySelectorAll('*');
        existingChildren.forEach(child => {
          try {
            gsap.killTweensOf(child);
          } catch {}
        });
        
        if (existing.parentNode) {
          existing.parentNode.removeChild(existing);
        } else {
          existing.remove();
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error removing overlay by ID:', error);
    }
  }
  
  if (!preserveDom) {
    // 🔥 APP STORE: Force garbage collection hints (iOS Safari)
    // Clear all references to help GC
    try {
      // Clear any remaining references
      if (typeof (window as any).gc === 'function') {
        // Only if explicit GC is available (dev mode)
        (window as any).gc();
      }
    } catch {}
  }
  
    logger.info('✅ board-transition-screen: Cleanup complete - all resources released');
  } finally {
    isCleaningUp = false;
  }
}

/**
 * Force cleanup (exported for emergency cleanup)
 * iOS App Store ready - ensures complete cleanup in case of errors
 */
export function cleanupBoardTransitionScreen(): void {
  try {
    // 🔥 APP STORE: Force cleanup - ensure everything is released
    cleanup();
    isTransitionActive = false;
    
    logger.info('✅ board-transition-screen: Force cleanup completed - all resources released');
  } catch (error) {
    logger.error('❌ board-transition-screen: Force cleanup failed:', error);
    // Fallback: at least reset the flags
    isTransitionActive = false;
    currentOverlay = null;
  }
}
