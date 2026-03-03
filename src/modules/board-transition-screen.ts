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
let activeForestImages: HTMLImageElement[] = []; // 🔥 IMAGE POOLING: Track forest image for cleanup
let contentTimelines: gsap.core.Timeline[] = []; // 🔥 MEMORY LEAK FIX: Track forest and digit timelines
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
const TRANSITION_FOREST_IMAGE = './assets/journey assets/forest.png';
let assetsPreloaded = false;
let assetsPreloadPromise: Promise<void> | null = null;
let memSampleInterval: number | null = null;
let memSamplePeak = 0;
let memSampleStart = 0;
let memSampleStartTs = 0;

const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));

const lifecycle = createScreenLifecycle('board-transition-screen');

function ensureCloudStyles(): void {
  if (document.getElementById('cc-board-transition-cloud-styles')) return;
  const style = document.createElement('style');
  style.id = 'cc-board-transition-cloud-styles';
  style.textContent = CLOUD_CSS_STYLES;
  document.head.appendChild(style);
}

async function preloadTransitionAssets(): Promise<void> {
  if (assetsPreloaded) return;
  if (assetsPreloadPromise) return assetsPreloadPromise;
  assetsPreloadPromise = (async () => {
    try {
      logger.info('🧩 board-transition-screen: Preloading transition assets...');
      const urls = [...TRANSITION_CLOUD_IMAGES, TRANSITION_FOREST_IMAGE];
      await Promise.all(urls.map((src) => new Promise<void>((resolve) => {
        const img = new Image();
        img.src = src;
        if (typeof img.decode === 'function') {
          img.decode().then(() => resolve()).catch(() => resolve());
        } else {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }
      })));
      logger.info('✅ board-transition-screen: Transition assets preloaded');
    } finally {
      assetsPreloaded = true;
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
  const { boardNumber, onComplete } = options;

  // 🔥 CRITICAL FIX: Validate boardNumber
  if (!Number.isFinite(boardNumber) || boardNumber < 1) {
    logger.error(`❌ board-transition-screen: Invalid boardNumber ${boardNumber}, using fallback 1`);
    // Don't return - use fallback instead
    const validBoardNumber = 1;
    return showBoardTransitionScreen({ boardNumber: validBoardNumber, onComplete });
  }

  logger.info(`🎯 board-transition-screen: Showing transition for board ${boardNumber}`);

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

  // Preload transition assets (clouds, forest) - required for transition to display correctly
  await preloadTransitionAssets();
  
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
        'z-index: 2' // 🔥 CRITICAL FIX: Ensure container (numbers) is above clouds (z-index: -1)
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
    const boardNumberStr = boardNumber.toString().padStart(2, '0');
    const digits = boardNumberStr.split('');
    
    logger.info(`🎯 board-transition-screen: Formatting board number ${boardNumber} as "${boardNumberStr}" with ${digits.length} digits`);

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
          'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
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
        'z-index: -1',
        'overflow: hidden'
      ].join(';');
    }
    ensureCloudStyles();
    cloudContainer.innerHTML = '';
    activeCloudImages = [];
    cloudTimelines = [];
    cloudDelayedCalls = [];

    const cloudImages = TRANSITION_CLOUD_IMAGES;
    const totalClouds = 10;
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
      const spawnTop = 15 + (i % 3) * 28 + (i * 3) % 12;
      let sizeBoost = 1;
      if (spawnTop < 32 && Math.random() < 0.55) {
        sizeBoost = 1.25 + Math.random() * 0.22;
      } else if (spawnTop >= 32 && spawnTop < 64 && Math.random() < 0.4) {
        sizeBoost = 1.15 + Math.random() * 0.18;
      }
      const cloudSizePx = Math.round((cloudBasePx + (i % 3) * cloudStepPx) * sizeBoost);
      const cloudHeightPx = Math.round(cloudSizePx / CLOUD_ASPECT);
      const baseSize = (0.92 + (i % 3) * 0.1) * Math.min(1.18, 0.98 + sizeBoost * 0.12);
      const spawnLeft = 8 + (i * 9) % 84;
      const goesLeft = Math.random() < 0.5; // random side push
      const enterDelay = i * CLOUD_STAGGER;
      const rotation = (i % 5 - 2) * 6;
      const bounceAmount = 6 + (i % 3) * 3;
      const bounceSpeed = 0.45 + (i % 4) * 0.08;
      const windFactor = 1 + ((Math.random() * 2 - 1) * windStrength); // 0.82..1.18
      const windYOffset = (Math.random() * 2 - 1) * 10;
      // Slowest clouds are ~2x faster than before.
      const windDuration = (moveDuration * 0.52 + 0.22) * windFactor;
      const driftDistancePx = (driftDistanceMinPx + Math.random() * (driftDistanceMaxPx - driftDistanceMinPx)) * (goesLeft ? -1 : 1);
      const driftStartDelay = 0.06;

      const cloudImg = domElementPool.acquire('img') as HTMLImageElement;
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
      gsap.set(cloudImg, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0.12, opacity: 0, rotation });

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

      const exitStartTime = enterDelay + 0.5 + windDuration * 0.5;
      const delayedCall = trackDelayedCall(exitStartTime, () => {
        if (!activeCloudImages.includes(cloudImg)) return;
        bounceTimeline.kill();
        const exitTl = trackTimeline();
        exitTl.to(cloudImg, { opacity: 0, scale: 0, duration: 0.25, ease: 'power2.in' });
        cloudTimelines.push(exitTl);
      });
      cloudDelayedCalls.push(delayedCall);

      cloudContainer.appendChild(cloudImg);
    }

    logger.info(`☁️ board-transition-screen: Clouds created (${totalClouds} total, stagger ${CLOUD_STAGGER}s, pop-in enabled)`);
    overlay.appendChild(cloudContainer);

    // 🔥 USER REQUEST: Forest at bottom (-150px below viewport), in front of clouds, behind digits
    const isIPad = (() => {
      const ua = navigator.userAgent || '';
      const isIPadUA = /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
      const vw = window.innerWidth || 0;
      return isIPadUA || (vw >= 769 && vw <= 1366);
    })();

    if (!forestContainer) {
      forestContainer = document.createElement('div');
      forestContainer.className = 'cc-board-transition-forest';
      forestContainer.style.cssText = [
        'position: absolute',
        'left: 0',
        'right: 0',
        'bottom: -190px',
        'width: 100%',
        'height: 42vh',
        'pointer-events: none',
        'z-index: 0',
        'overflow: hidden',
        'transform-origin: center bottom',
        'transform-style: preserve-3d',
        'will-change: transform, opacity',
        'contain: layout paint' // Rasterize forest layer for cheaper transforms
      ].join(';');
    }
    const existingForestImg = forestContainer.querySelector('img') as HTMLImageElement | null;
    const forestImg = existingForestImg || (domElementPool.acquire('img') as HTMLImageElement);
    forestImg.src = TRANSITION_FOREST_IMAGE;
    forestImg.alt = 'Forest';
    forestImg.style.cssText = [
      'position: absolute',
      'left: 0',
      'bottom: 0',
      'width: 100%',
      'height: 100%',
      'object-fit: cover',
      'object-position: bottom center',
      'display: block',
      'pointer-events: none',
      'transform: translateZ(0)',
      'backface-visibility: hidden'
    ].join(';');
    // iPad: move forest down by 40%
    forestContainer.style.transform = isIPad ? 'translateY(40%)' : 'translateY(0)';
    activeForestImages = [forestImg];
    if (!forestImg.parentNode) {
      forestContainer.appendChild(forestImg);
    }
    overlay.appendChild(forestContainer);

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

    // 🔥 USER REQUEST: Forest enter animation, transform-origin center bottom
    gsap.set(forestContainer, {
      opacity: 0,
      scale: 0,
      rotation: -15,
      transformOrigin: 'center bottom'
    });
    const forestEnterTimeline = trackTimeline();
    contentTimelines.push(forestEnterTimeline); // 🔥 FIX: Track for cleanup
    forestEnterTimeline.to(forestContainer, {
      opacity: 1,
      scale: 1.01, // 🔥 USER REQUEST: Minimal bounce overshoot
      rotation: 0,
      z: 10,
      duration: 0.4,
      ease: 'back.out(2.0)'
    });
    forestEnterTimeline.to(forestContainer, {
      scale: 0.95,
      z: 0,
      duration: 0.15,
      ease: 'power2.out'
    });
    forestEnterTimeline.to(forestContainer, {
      opacity: 1,
      scale: 1.0,
      z: 0,
      duration: 0.2,
      ease: 'back.out(1.5)'
    });
    enterTimeline.add(forestEnterTimeline, 0.1);

    // Step 3: Animate digits with bounce animation (staggered)
    digitElements.forEach((digitEl, index) => {
      const delay = 0.3 + (index * 0.3); // Stagger by 0.3s per digit
      
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
                duration: 0.2, // Start text/number exit 500ms earlier
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

  // Reverse order: digits first (last to first), then forest, then overlay

  // Step 1: Animate digits out with bounce (left-to-right, sequential)
    digitElements.forEach((digitEl, index) => {
      const delay = index * 0.4; // Stagger by 400ms per digit
      
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

  // Step 2: Forest exit animation
  if (forestContainer) {
    const forestExitTimeline = trackTimeline();
    contentTimelines.push(forestExitTimeline); // 🔥 FIX: Track for cleanup
    forestExitTimeline.to(forestContainer, {
      scale: 1.01,
      z: 20,
      duration: 0.15,
      ease: 'power2.out'
    });
    forestExitTimeline.to(forestContainer, {
      opacity: 0,
      scale: 0,
      rotation: 15,
      rotationX: 45,
      rotationY: 15,
      z: -50,
      duration: 0.3,
      ease: 'power2.in'
    });
    exitTimeline.add(forestExitTimeline, 0.1);
  }

  // Step 3: Fade out overlay
  exitTimeline.to(overlay, {
    opacity: 0,
    duration: 0.3, // 🔥 USER REQUEST: Faster (0.4s → 0.3s)
    ease: 'power2.in'
  }, 0.25);

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
  
  if (!preserveDom) {
    // 🔥 IMAGE POOLING: Release all cloud images back to pool (stop CSS animations first)
    activeCloudImages.forEach(cloudImg => {
      try {
        gsap.killTweensOf(cloudImg);
        cloudImg.style.animation = 'none';
        cloudImg.classList.remove('cc-cloud-exit');
        domElementPool.release(cloudImg);
      } catch (error) {
        logger.warn('⚠️ Error releasing cloud image to pool:', error);
      }
    });
    activeCloudImages = [];

    // 🔥 IMAGE POOLING: Release forest image back to pool
    activeForestImages.forEach(forestImg => {
      try {
        gsap.killTweensOf(forestImg);
        domElementPool.release(forestImg);
      } catch (error) {
        logger.warn('⚠️ Error releasing forest image to pool:', error);
      }
    });
    activeForestImages = [];
  }

  // 🔥 APP STORE: Kill animations on forest container
  try {
    const forestContainers = document.querySelectorAll('.cc-board-transition-forest');
    forestContainers.forEach(container => {
      try {
        gsap.killTweensOf(container);
      } catch {}
    });
  } catch (error) {
    logger.warn('⚠️ Error cleaning up forest container:', error);
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
