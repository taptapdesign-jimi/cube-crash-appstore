// @ts-nocheck
// public/src/modules/clean-board-modal.ts
// DOM-based overlay (design-first), Board cleared + bonus + Continue

// Keep CSS-based pop-in like homepage slide 1

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { allowConfettiSpawns, createConfettiExplosion } from './confetti-system.js';
import { statsService } from '../services/stats-service.js';
import { boardStatsService } from '../services/board-stats-service.js';
import { arcadeStatsService } from '../services/arcade-stats-service.js';
import { pickRandom } from './clean-board-utils.js';
import { formatScoreSimple } from './hud-utils.js';
import { clearPendingCleanBoard } from './board-recovery.js';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { getOriginalGsapTo, getOriginalGsapTimeline } from './drag-core.js';
import { getRunMode, isArcadeHomeRunMode, RUN_MODE_JOURNEY } from './run-mode.js';
import { isJourneyInterimOriginActive, markJourneyGameOrigin } from './journey-origin-state.js';
import { applyAppPaperSurfaceToElement } from '../utils/app-paper-background.js';
import { formatGameplayProgressLabel } from './gameplay-terminology.ts';
import { getJourneyEarnedStars } from './journey-stage-balance.ts';
import { ctaMotion, exitCtaPair, getRegisteredCta, registerCta, type CtaController } from './cta-system.ts';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.ts';

const HEADLINES = [
  'Outstanding!', 'Amazing!', 'Excellent!', 'Fantastic!', 'Incredible!',
  'Perfect!', 'Brilliant!', 'Superb!', 'Awesome!', 'Spectacular!',
  'Magnificent!', 'Phenomenal!', 'Marvelous!', 'Exceptional!', 'Stellar!',
  'Remarkable!', 'Impressive!', 'Unbelievable!', 'Wonderful!', 'Fabulous!',
  'Sensational!', 'Terrific!', 'Splendid!', 'Exquisite!', 'Divine!',
  'Glorious!', 'Masterful!', 'Flawless!', 'Supreme!', 'Epic!',
  'Legendary!', 'Radiant!', 'Majestic!', 'Unstoppable!', 'Victorious!',
  'Triumphant!', 'Dominant!', 'Epicness!', 'Powerful!', 'Heroic!',
  'Gorgeous!', 'Sparkling!', 'Blazing!', 'Vibrant!', 'Shining!',
  'Golden!', 'Prime!', 'Royal!', 'Ace!', 'Infinite!',
  'Titanic!', 'Grand!', 'Mythic!', 'Immortal!', 'Mega!',
  'Ultra!', 'Primeval!', 'Booming!'
];

// 🔥 CRITICAL FIX: Use original GSAP functions to prevent infinite recursion
const trackTimeline = (options: any = {}) => {
  const origTimeline = getOriginalGsapTimeline();
  return animationManager.trackExternalTimeline(origTimeline(options));
};

const trackTween = (target: any, vars: any) => {
  const origTo = getOriginalGsapTo();
  return animationManager.trackExternalTween(origTo(target, vars));
};


const lifecycle = createScreenLifecycle('clean-board-modal');

interface ShowCleanBoardModalParams {
  app?: any;
  stage?: any;
  getScore?: () => number;
  setScore?: (score: number) => void;
  animateScore?: (score: number, duration?: number) => void;
  updateHUD?: () => void;
  bonus?: number; // Legacy support - if provided, split into combo (50%) and efficiency (50%)
  comboBonus?: number; // 🎯 NEW: Combo bonus (combo count × 50)
  efficiencyBonus?: number; // 🎯 NEW: Efficiency bonus (stack + efficiency + special + clean)
  scoreCap?: number;
  boardNumber?: number;
  forcedStars?: number;
  devMode?: boolean; // 🧪 DEV: Enable dev mode for testing board transition screen
  isFromInterimBoardOverride?: boolean;
  arcadeRunReached?: boolean;
}

// 🔥 REFACTORED: Koristimo pickRandom iz clean-board-utils.ts umjesto lokalne verzije

// 🔥 MEMORY LEAK FIX: Track all timeouts for cleanup
const _modalTimeouts: Set<NodeJS.Timeout> = new Set();
// 🔥 MEMORY LEAK FIX: Track all requestAnimationFrame callbacks for cleanup
const _modalAnimationFrames: Set<number> = new Set();
let _modalCleanupInProgress = false;
const CLEAN_BOARD_COUNTER_HAPTIC_INTERVAL_MS = 65;

function triggerHapticImpactSafe(kind: 'light' | 'medium' | 'heavy'): void {
  try {
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact(kind);
    }
  } catch {}
}

function getAppCanvasSafely(app: any): HTMLCanvasElement | null {
  // Pixi v8 exposes `canvas` through a renderer-backed getter. During the
  // narrow win -> X -> Exit race the renderer may already be detached, and
  // merely reading app.canvas can throw before Clean Board CTA cleanup runs.
  try {
    const canvas = app?.canvas;
    if (canvas instanceof HTMLCanvasElement) return canvas;
  } catch (error) {
    console.warn('⚠️ clean-board-modal: app.canvas unavailable during handoff', error);
  }
  try {
    const view = app?.view;
    if (view instanceof HTMLCanvasElement) return view;
  } catch {}
  return document.querySelector('#app canvas');
}

function createCounterLightHapticTrigger(minIntervalMs = CLEAN_BOARD_COUNTER_HAPTIC_INTERVAL_MS) {
  let lastAt = 0;
  let lastValue = Number.NaN;
  return (value: number) => {
    const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
    if (safeValue === lastValue) return;
    lastValue = safeValue;
    const now = Date.now();
    if (now - lastAt < minIntervalMs) return;
    lastAt = now;
    triggerHapticImpactSafe('light');
  };
}

function trackTimeout(callback: () => void, delay: number): NodeJS.Timeout {
  if (_modalCleanupInProgress) {
    const noop = setTimeout(() => {}, 0);
    clearTimeout(noop);
    return noop;
  }
  const timeout = setTimeout(() => {
    callback();
    _modalTimeouts.delete(timeout);
  }, delay);
  _modalTimeouts.add(timeout);
  return timeout;
}

function trackAnimationFrame(callback: FrameRequestCallback): number {
  if (_modalCleanupInProgress) return 0;
  const rafId = requestAnimationFrame((now: number) => {
    callback(now);
    _modalAnimationFrames.delete(rafId);
  });
  _modalAnimationFrames.add(rafId);
  return rafId;
}

export function clearAllModalTimeouts() {
  console.log(`🧹 Clearing ${_modalTimeouts.size} pending timeouts from clean-board-modal`);
  _modalTimeouts.forEach(timeout => clearTimeout(timeout));
  _modalTimeouts.clear();
}

export function clearAllModalAnimationFrames() {
  console.log(`🧹 Clearing ${_modalAnimationFrames.size} pending animation frames from clean-board-modal`);
  _modalAnimationFrames.forEach(rafId => cancelAnimationFrame(rafId));
  _modalAnimationFrames.clear();
}

export function cleanupCleanBoardModalLifecycle() {
  try {
    _modalCleanupInProgress = true;
    clearAllModalTimeouts();
    clearAllModalAnimationFrames();
  } catch {}
  lifecycle.cleanup();
  _navigationCleanupAttached = false;
}

// 🔥 FIX: Add navigation/visibility cleanup to prevent memory leaks
// When user navigates away or page becomes hidden, clean up all pending operations
let _navigationCleanupAttached = false;

function attachNavigationCleanup(): void {
  if (_navigationCleanupAttached) return;
  _navigationCleanupAttached = true;
  
  // Full cleanup: remove overlay, clear timeouts, etc. (for beforeunload, cc-navigation)
  const fullCleanup = () => {
    _modalCleanupInProgress = true;
    console.log('🧹 Clean board modal: Navigation/visibility cleanup triggered');
    clearAllModalTimeouts();
    clearAllModalAnimationFrames();
    try {
      const overlay = document.getElementById('cc-clean-board-overlay');
      if (overlay) {
        overlay.setAttribute('data-clean-board-exiting', 'true');
        (overlay as HTMLElement).style.pointerEvents = 'none';
        (overlay as HTMLElement).style.opacity = '0';
        overlay.remove();
        console.log('🧹 Clean board modal: Overlay removed during navigation cleanup');
      }
    } catch {}
    try {
      const styleTag = document.getElementById('clean-board-star-animations');
      if (styleTag) {
        styleTag.remove();
        console.log('🧹 Clean board modal: Style tag removed during navigation cleanup');
      }
    } catch {}
  };
  
  // On visibility hidden: only clear timeouts/animations, do NOT remove overlay
  // User may have switched tabs briefly – when they return, modal should still be visible
  lifecycle.trackListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const overlay = document.getElementById('cc-clean-board-overlay');
      if (overlay?.getAttribute('data-clean-board-exiting') === 'true') {
        // Exit promises are driven by these tracked timers/frames. Cancelling
        // them while iOS backgrounds the app would strand the sole exit owner
        // and leave the next foreground session between Arcade and Homepage.
        return;
      }
      clearAllModalTimeouts();
      clearAllModalAnimationFrames();
      // Don't remove overlay – user will see modal when they come back
    }
  });
  
  // Clean up when page is unloaded
  lifecycle.trackListener(window, 'beforeunload', fullCleanup);
  
  // Clean up when navigating within app (custom event)
  lifecycle.trackListener(window, 'cc-navigation', fullCleanup);
}

// Attach cleanup handlers on module load
attachNavigationCleanup();

export async function showCleanBoardModal({
  app, 
  stage, 
  getScore, 
  setScore, 
  animateScore, 
  updateHUD, 
  bonus = 500, // Legacy support - if provided, split into combo (50%) and efficiency (50%)
  comboBonus, // NEW: Combo bonus (combo count × 50)
  efficiencyBonus, // NEW: Efficiency bonus (stack + efficiency + special + clean)
  scoreCap = 999999, 
  boardNumber = 1,
  forcedStars,
  devMode = false, // 🧪 DEV: Enable dev mode for testing board transition screen
  isFromInterimBoardOverride,
  arcadeRunReached = false
}: ShowCleanBoardModalParams = {}): Promise<{ action: string }> {
  return new Promise((resolve) => {
    _modalCleanupInProgress = false;
    attachNavigationCleanup();
    let settled = false;
    let navigationAbortHandler: (() => void) | null = null;
    let abortStarAnimations: () => void = () => {};
    let resolveNavigationAbort!: () => void;
    const navigationAbortPromise = new Promise<void>((resolveAbort) => {
      resolveNavigationAbort = resolveAbort;
    });
    const safeResolve = (action: string = 'continue') => {
      if (settled) return;
      settled = true;
      if (navigationAbortHandler) {
        try { window.removeEventListener('cc-navigation', navigationAbortHandler); } catch {}
        navigationAbortHandler = null;
      }
      try { resolve({ action }); } catch {}
    };
    navigationAbortHandler = () => {
      // Navigation owns the destination now. Resolve the modal promise as an
      // abort so the suspended endgame flow cannot resume later when the card
      // modal closes and reveal a stale Clean Board final state.
      resolveNavigationAbort();
      try { abortStarAnimations(); } catch {}
      try { cleanupCleanBoardModalLifecycle(); } catch {}
      try { document.getElementById('cc-clean-board-overlay')?.remove(); } catch {}
      safeResolve('__navigation-abort__');
    };
    window.addEventListener('cc-navigation', navigationAbortHandler, { once: true });
    const run = async () => {
      try {
    const stopConfettiSpawnsSafe = () => {
      try {
        import('./confetti-system.js').then(confettiModule => {
          if (confettiModule && typeof confettiModule.stopConfettiSpawns === 'function') {
            confettiModule.stopConfettiSpawns();
          }
        }).catch(() => {});
      } catch {}
    };
    // 🌟 Add CSS animations for star breathing
    if (!document.getElementById('clean-board-star-animations')) {
      const style = document.createElement('style');
      style.id = 'clean-board-star-animations';
      style.textContent = `
        /* 🌟 Breathing animation for filled stars (inhale/exhale like lungs) - 25% stronger! */
        @keyframes starBreathing {
          0%, 100% {
            transform: scale(0.88); /* Shrink by 12% (inhale) */
          }
          50% {
            transform: scale(1.25); /* Expand by 25% (exhale) - much more dramatic! */
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // 🎯 NEW: Calculate 2-step bonus system
    // Get longest combo for this board
    const boardStats = boardStatsService?.getBoardStats?.(boardNumber) || {};
    const longestCombo = boardStats.longestCombo || 0;
    
    // Calculate combo bonus: longestCombo × 50
    const calculatedComboBonus = longestCombo * 50;
    
    // If comboBonus/efficiencyBonus not provided, calculate them
    // Combo: Always use calculated value (longestCombo × 50)
    // Efficiency: Use legacy bonus if not provided explicitly
    const safeComboBonus = Math.max(0, (comboBonus !== undefined ? comboBonus : calculatedComboBonus) | 0);
    const safeEfficiencyBonus = Math.max(0, (efficiencyBonus !== undefined ? efficiencyBonus : (bonus || 500)) | 0);
    const totalBonus = safeComboBonus + safeEfficiencyBonus;
    
    console.log('🎯 Bonus calculation:', {
      longestCombo,
      calculatedComboBonus,
      finalComboBonus: safeComboBonus,
      efficiencyBonus: safeEfficiencyBonus,
      totalBonus
    });
    
    // Calculate score values
    const rawCurrent = typeof getScore === 'function' ? (getScore()|0) : 0;
    const currentScore = Math.max(0, rawCurrent);
    const scoreAfterCombo = Math.min(scoreCap, currentScore + safeComboBonus);
    const finalScore = Math.min(scoreCap, scoreAfterCombo + safeEfficiencyBonus);
    
    const isArcadeHomeRun = isArcadeHomeRunMode();

    // Get previous best score (mode-specific).
    const getBestScore = (): number => {
      if (isArcadeHomeRun) {
        try {
          const arcadeHighScore = arcadeStatsService.getStats().highScore;
          if (Number.isFinite(arcadeHighScore)) return arcadeHighScore | 0;
        } catch (error) {
          console.warn('⚠️ Failed to read arcade high score:', error);
        }
      }

      try {
        const boardStats = boardStatsService?.getBoardStats?.(boardNumber);
        const boardHighScore = boardStats?.highScore;
        if (Number.isFinite(boardHighScore)) {
          return boardHighScore | 0;
        }
      } catch (boardError) {
        console.warn('⚠️ Failed to read board high score:', boardError);
      }

      try {
        if (statsService && typeof statsService.getStats === 'function') {
          const stats = statsService.getStats();
          const highScore = stats?.highScore;
          if (Number.isFinite(highScore)) {
            return highScore | 0;
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to read high score from statsService:', error);
      }
      try {
        const legacy = localStorage.getItem('cc_best_score_v1');
        if (legacy) {
          return parseInt(legacy, 10) || 0;
        }
      } catch (legacyError) {
        console.warn('⚠️ Failed to read legacy high score key:', legacyError);
      }
      return 0;
    };
    const previousBestScore = getBestScore();
    const highScoreJustUpdated = isArcadeHomeRun
      ? arcadeStatsService.wasHighScoreJustUpdated(finalScore)
      : typeof statsService?.wasHighScoreJustUpdated === 'function'
        ? statsService.wasHighScoreJustUpdated(finalScore)
        : false;
    // Use final score (includes bonus) against board-specific high score
    const isNewHighScore = finalScore > previousBestScore || highScoreJustUpdated;
    
    console.log('🏆 High score check:', {
      currentScore,
      comboBonus: safeComboBonus,
      efficiencyBonus: safeEfficiencyBonus,
      totalBonus,
      previousBestScore,
      finalScore,
      isNewHighScore
    });
    
    const overlayId = 'cc-clean-board-overlay';
    const old = document.getElementById(overlayId);
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = overlayId;
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:10000000000000',
      'opacity:0',
      'transition:opacity .2s ease',
      'overflow:visible' // Allow particles to float freely
    ].join(';');
    applyAppPaperSurfaceToElement(el);

    // Card
    const card = document.createElement('div');
    card.style.cssText = [
      'background:transparent',
      'border-radius:40px',
      'padding:40px 32px',
      'text-align:center',
      'font-family:"Baloo2", system-ui, -apple-system, sans-serif',
      'transform:scale(0.9)',
      'transition:transform .34s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .2s ease',
      'opacity:0',
      'max-width:min(340px,88vw)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:40px',
      'overflow:visible' // Allow particles to float freely
    ].join(';');

    // 🌟 NEW: Stars Container (3 stars: empty + filled on top based on score)
    const starsContainer = document.createElement('div');
    starsContainer.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:16px', // 🌟 16px razmak između zvjezdica
      'width:min(280px,80vw)',
      'height:auto',
      'margin:0 auto',
      'overflow:visible' // Allow particles to float outside container
    ].join(';');
    
    // Journey thresholds follow the local 1-10 difficulty arc in every world.
    // Keep the established fixed thresholds outside Journey.
    const computedStars = getRunMode() === RUN_MODE_JOURNEY
      ? getJourneyEarnedStars(finalScore, boardNumber)
      : finalScore < 2000 ? 1 : finalScore < 6000 ? 2 : 3;
    const numStars = Number.isFinite(forcedStars)
      ? Math.min(3, Math.max(1, forcedStars as number))
      : computedStars;
    console.log(`🌟 Base Score: ${currentScore}, Combo: +${safeComboBonus}, Efficiency: +${safeEfficiencyBonus}, Final: ${finalScore}, Stars: ${numStars}`);
    
    // Create 3 star containers (each has empty star + filled star on top)
    const starElements: Array<{ 
      container: HTMLElement; 
      emptyImg: HTMLImageElement; 
      filledImg: HTMLImageElement;
    }> = [];
    
    for (let i = 0; i < 3; i++) {
      // Star container (holds both empty and filled)
      const starContainer = document.createElement('div');
      
      // 🌟 NEW: Apply rotation and position based on star index
      // Left star (i=0): -8° rotation
      // Middle star (i=1): translateY -16px (16px higher than left/right)
      // Right star (i=2): +8° rotation
      let transformStyle = '';
      if (i === 0) {
        transformStyle = 'rotate(-8deg)'; // Left: counter-clockwise
      } else if (i === 1) {
        transformStyle = 'translateY(-16px)'; // Middle: 16px higher (8 + 8 = 16px)
      } else if (i === 2) {
        transformStyle = 'rotate(8deg)'; // Right: clockwise
      }
      
      starContainer.style.cssText = [
        'position:relative',
        'width:clamp(60px, 20vw, 90px)',
        'height:clamp(60px, 20vw, 90px)',
        'flex-shrink:0',
        `transform:${transformStyle}`,
        'overflow:visible' // Allow particles to float outside star bounds
      ].join(';');
      
      // Empty star (always visible, background layer)
      const emptyStar = document.createElement('img');
      emptyStar.src = './assets/modals/star-empty.png';
      emptyStar.alt = 'Empty star';
      emptyStar.loading = 'eager';
      emptyStar.decoding = 'sync';
      emptyStar.fetchPriority = 'high';
      emptyStar.style.cssText = [
        'position:absolute',
        'inset:0',
        'width:100%',
        'height:100%',
        'object-fit:contain',
        'z-index:1'
      ].join(';');
      
      // Filled star (on top, hidden initially, will bounce in)
      const filledStar = document.createElement('img');
      filledStar.src = './assets/modals/star.png';
      filledStar.alt = 'Filled star';
      filledStar.loading = 'eager';
      filledStar.decoding = 'sync';
      filledStar.fetchPriority = 'high';
      filledStar.style.cssText = [
        'position:absolute',
        'inset:0',
        'width:100%',
        'height:100%',
        'object-fit:contain',
        'z-index:2',
        'opacity:0',
        'transform:scale(0)',
        'transition:none'
      ].join(';');
      
      starContainer.appendChild(emptyStar); // z:1 - back
      starContainer.appendChild(filledStar); // z:2 - front
      starsContainer.appendChild(starContainer);
      
      starElements.push({
        container: starContainer,
        emptyImg: emptyStar,
        filledImg: filledStar
      });
    }
    
    // Use starsContainer as hero for animation purposes
    const hero = starsContainer;

    // Content stacks replicate design spacing (hero + text)
    const infoStack = document.createElement('div');
    infoStack.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:48px', // 🌟 48px spacing between stars and title (56 - 8 = 48px)
      'width:100%',
      'overflow:visible', // Allow particles to float outside
      'transform: translateY(16px)'
    ].join(';');

    const textCluster = document.createElement('div');
    textCluster.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:16px',
      'width:100%'
    ].join(';');

    const scoreGroup = document.createElement('div');
    scoreGroup.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:8px',
      'width:100%'
    ].join(';');

    // Title (random headline)
    const title = document.createElement('div');
    title.textContent = pickRandom(HEADLINES);
    title.style.cssText = 'color:#B07F69;font-weight:800;font-size:40px;line-height:1;margin:0;';

    // "Your score" label (or "NEW Highscore" if new high score)
    const scoreLabel = document.createElement('div');
    scoreLabel.style.cssText = 'color:#b69077;font-weight:600;font-size:20px;line-height:1.2;margin:0;letter-spacing:0.02em;';
    
    // Set label text based on whether it's a new high score
    if (isNewHighScore) {
      scoreLabel.innerHTML = '<span style="color:#E97A55;font-weight:900;font-size:20px;letter-spacing:0.02em;">NEW</span> <span>Highscore</span>';
    } else {
      scoreLabel.textContent = 'Your score';
    }

    // Main score display (simple text, no flip animation)
    const mainScore = document.createElement('div');
    mainScore.textContent = '0';
    mainScore.style.cssText = 'color:#E77449;font-weight:800;font-size:80px;line-height:1;margin:0;';

    // Bonus + cleared status share the same visual slot
    // iOS FIX: Use absolute positioning instead of grid to prevent rotation bug
    const statusSlot = document.createElement('div');
    statusSlot.style.cssText = [
      'position:relative',
      'width:100%',
      'min-height:52px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'transform: none',
      'animation: none',
      '-webkit-transform: none'
    ].join(';');

    // 🎯 NEW: Combo Bonus Wrapper (shows first)
    const comboWrapper = document.createElement('div');
    comboWrapper.style.cssText = [
      'position:absolute',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:6px',
      'opacity:0',
      'transform:scale(0.75) translateY(-8px)',
      'width:100%'
    ].join(';');

    const comboValue = document.createElement('div');
    comboValue.textContent = `+${safeComboBonus}`;
    comboValue.style.cssText = 'color:#E77449;font-weight:800;font-size:36px;line-height:1;';

    const comboLabel = document.createElement('div');
    comboLabel.textContent = longestCombo > 0 ? `Combo x${longestCombo}` : 'Combo bonus';
    comboLabel.style.cssText = 'color:#c48a6d;font-weight:600;font-size:18px;line-height:1;letter-spacing:0.02em;';

    comboWrapper.appendChild(comboValue);
    comboWrapper.appendChild(comboLabel);

    // 🎯 NEW: Efficiency Bonus Wrapper (shows second)
    const efficiencyWrapper = document.createElement('div');
    efficiencyWrapper.style.cssText = [
      'position:absolute',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:6px',
      'opacity:0',
      'transform:scale(0.75) translateY(-8px)',
      'width:100%'
    ].join(';');

    const efficiencyValue = document.createElement('div');
    efficiencyValue.textContent = `+${safeEfficiencyBonus}`;
    efficiencyValue.style.cssText = 'color:#E77449;font-weight:800;font-size:36px;line-height:1;';

    const efficiencyLabel = document.createElement('div');
    efficiencyLabel.textContent = 'Efficiency';
    efficiencyLabel.style.cssText = 'color:#c48a6d;font-weight:600;font-size:18px;line-height:1;letter-spacing:0.02em;';

    efficiencyWrapper.appendChild(efficiencyValue);
    efficiencyWrapper.appendChild(efficiencyLabel);

    // Board cleared text (initially hidden)
    const boardCleared = document.createElement('div');
    const progressLabel = formatGameplayProgressLabel(
      isArcadeHomeRun ? 'arcade' : 'journey',
      boardNumber,
      { padTo: 2 },
    );
    boardCleared.textContent = `${progressLabel} ${arcadeRunReached ? 'reached' : 'cleared'}`;
    // SIMPLE: Just text, no transforms, no animations
    boardCleared.style.position = 'absolute';
    boardCleared.style.color = '#b69077';
    boardCleared.style.fontWeight = '600';
    boardCleared.style.fontSize = '20px';
    boardCleared.style.lineHeight = '1.2';
    boardCleared.style.margin = '0';
    boardCleared.style.opacity = '0';
    boardCleared.style.letterSpacing = '0.02em';
    boardCleared.style.width = '100%';
    boardCleared.style.textAlign = 'center';

    // 🔥 Continue ONLY when entered via interim card. Detail modal (Play/Continue on already-unlocked board) → Play Again + Exit only.
    const cameFromDetailModal = (window as any).__ccCameFromDetailModal === true;
    let isFromInterimBoard = isJourneyInterimOriginActive();
    if (typeof isFromInterimBoardOverride === 'boolean') {
      isFromInterimBoard = isFromInterimBoardOverride;
    }
    if (cameFromDetailModal) {
      isFromInterimBoard = false;
      console.log('🎯 Clean board: opened from detail modal → Play Again + Exit only');
    }
    console.log('🎯 Clean board modal: isFromInterimBoard =', isFromInterimBoard, {
      isArcadeHomeRun,
      cameFromDetailModal,
      __ccFromInterimBoard: (window as any).__ccFromInterimBoard,
      __ccIsInterimBoard: (window as any).__ccIsInterimBoard,
      __ccFromInterimBoardLS: localStorage.getItem('__ccFromInterimBoard')
    });
    
    // 🔥 NEW: Create button container (for 1 or 2 buttons)
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'cc-cta-stack';
    
    // 🔥 NEW: Primary button (Continue for interim Journey, Play Again otherwise including Arcade)
    const primaryBtn = document.createElement('button');
    primaryBtn.type = 'button';
    // Arcade rule: always "Play Again" on clean board.
    // Journey/interim keeps "Continue" behavior (and dev override for testing).
    const shouldShowContinue = !isArcadeHomeRun && (devMode || isFromInterimBoard);
    primaryBtn.textContent = shouldShowContinue ? 'Continue' : 'Play Again';
    primaryBtn.className = 'cc-clean-board-cta';
    
    // 🔥 NEW: Secondary button ("Exit" for regular boards, "Back to Journey" for interim)
    let secondaryBtn: HTMLButtonElement | null = null;
    secondaryBtn = document.createElement('button');
    secondaryBtn.type = 'button';
    secondaryBtn.textContent = 'Exit';
    secondaryBtn.className = 'cc-clean-board-cta';
    
    // Add buttons to container
    buttonContainer.appendChild(primaryBtn);
    if (secondaryBtn) {
      buttonContainer.appendChild(secondaryBtn);
    }
    
    // Keep reference to primaryBtn for existing code (was "btn")
    const btn = primaryBtn;

    // 🔥 NEW: Outer stack to isolate buttons from card scaling
    const outerStack = document.createElement('div');
    outerStack.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:18px',
      'position:relative'
    ].join(';');

    // 🎯 PURE CSS APPROACH - JavaScript only adds/removes classes
    // All animations handled by CSS classes in style.css
    const buttonStaggerMs = 350; // Delay between Play Again and Exit button appearance
    let cleanBoardStarAppearHapticPlayed = false;
    const triggerMainScoreCounterHaptic = createCounterLightHapticTrigger();
    const triggerComboCounterHaptic = createCounterLightHapticTrigger();
    const triggerEfficiencyCounterHaptic = createCounterLightHapticTrigger();

    // Set button to hidden state (before animation)
    const ctaControllers: CtaController[] = [];
    const setButtonInitialState = (button: HTMLButtonElement) => {
      button.style.visibility = 'hidden';
      button.style.pointerEvents = 'none';
    };

    // Animate button in (bounce entrance)
    const animateButtonIn = (button: HTMLButtonElement) => {
      void getRegisteredCta(button)?.enter();
      // CTA appearing on screen should feel confirmatory.
      triggerHapticImpactSafe('medium');
    };

    const buttonExitDurationMs = ctaMotion.exitDuration * 1000;

    infoStack.appendChild(hero);
    textCluster.appendChild(title);
    textCluster.appendChild(scoreLabel);
    scoreGroup.appendChild(mainScore);
    scoreGroup.appendChild(statusSlot);
    textCluster.appendChild(scoreGroup);
    infoStack.appendChild(textCluster);
    card.appendChild(infoStack);
    statusSlot.appendChild(comboWrapper);
    statusSlot.appendChild(efficiencyWrapper);
    statusSlot.appendChild(boardCleared);
    outerStack.appendChild(card);
    outerStack.appendChild(buttonContainer);
    el.appendChild(outerStack);
    document.body.appendChild(el);

    // 🔥 BOARD RECOVERY FIX: Clear pending clean board flag NOW that modal is visible
    // This prevents recovery from triggering on next app load if user hard-exits during modal/transition
    // The flag's purpose is to recover from force-quit during LAST MERGE ANIMATION - once modal shows,
    // we've successfully passed that point, so flag is no longer needed
    try {
      clearPendingCleanBoard();
      console.log('✅ clean-board-modal: Cleared pending clean board flag (modal is now visible)');
    } catch (e) {
      console.warn('⚠️ clean-board-modal: Failed to clear pending clean board flag:', e);
    }

    // 🔥 HARD EXIT FIX: Update board high score IMMEDIATELY when modal appears
    // This ensures the score (with bonuses) is saved even if user hard-exits before clicking CTA
    // Previously, high score was only updated when user clicked Continue/Exit/Play Again
    try {
      if (isArcadeHomeRun) {
        const isNewArcadeHigh = arcadeStatsService.updateHighScore(finalScore);
        if (isNewArcadeHigh) {
          console.log(`🏆 clean-board-modal: New ARCADE high score: ${finalScore} (saved immediately on modal show)`);
        } else {
          console.log(`✅ clean-board-modal: ARCADE high score checked: ${finalScore} (not a new high)`);
        }
      } else {
        const isNewHigh = boardStatsService.updateBoardHighScore(boardNumber, finalScore);
        if (isNewHigh) {
          console.log(`🏆 clean-board-modal: New board ${boardNumber} high score: ${finalScore} (saved immediately on modal show)`);
        } else {
          console.log(`✅ clean-board-modal: Board ${boardNumber} high score checked: ${finalScore} (not a new high)`);
        }
        
        // Also update global high score immediately
        statsService.updateHighScore(finalScore);
        console.log(`✅ clean-board-modal: Global high score updated to ${finalScore} (on modal show)`);
      }
    } catch (e) {
      console.warn('⚠️ clean-board-modal: Failed to update high score on modal show:', e);
    }

    // Score bookkeeping (already calculated above for high score check)

    // 🔥 ANIMATION: Start with 0, will animate to currentScore
    mainScore.textContent = '0';
    comboValue.textContent = `+${formatScoreSimple(safeComboBonus)}`;
    efficiencyValue.textContent = `+${formatScoreSimple(safeEfficiencyBonus)}`;

    // Prepare initial pop-in states
    const setInit = (element: HTMLElement, dy: number, scale = 0): void => {
      element.style.opacity = '0';
      element.style.transform = `scale(${scale}) translateY(${dy}px)`;
      element.style.transition = 'none';
    };
    
    // 🌟 NEW: Set initial state for all elements (including stars container)
    setInit(hero, -25, 0); // Stars container
    setInit(title, -20);
    setInit(scoreLabel, -15);
    setInit(mainScore, -10);
    setInit(comboWrapper, -6, 0.65); // First bonus
    setInit(efficiencyWrapper, -6, 0.65); // Second bonus
    // CRITICAL: No initial scale for boardCleared - just opacity
    boardCleared.style.opacity = '0';
    boardCleared.style.transition = 'none';
    
    // 🎯 PURE CSS: Set BOTH buttons to hidden state (CSS handles all animations)
    setButtonInitialState(primaryBtn);
    if (secondaryBtn) {
      setButtonInitialState(secondaryBtn);
    }
    
    // Show modal and card immediately
    el.style.opacity = '1';
    card.style.opacity = '1';
    card.style.transform = 'scale(1)';
    
    // Wait for next frame to ensure elements are rendered
    requestAnimationFrame(() => {
      const trans = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      hero.style.transition = trans;
      title.style.transition = trans;
      scoreLabel.style.transition = trans;
      mainScore.style.transition = trans;

      // 🔥 ANIMATION: Animate score counting from 0 to target value
      const updateScore = (newScore: number, animate: boolean = true): void => {
        if (!animate) {
          mainScore.textContent = formatScoreSimple(newScore);
          return;
        }
        
        // Get current displayed value - parse from textContent
        const currentText = mainScore.textContent || '0';
        // Remove all non-numeric characters and parse
        const cleanedText = currentText.replace(/[^0-9]/g, '');
        const currentDisplayed = cleanedText ? parseInt(cleanedText, 10) : 0;
        const targetScore = Math.max(0, Math.floor(newScore));
        
        console.log('🎯 updateScore called:', { 
          currentText, 
          cleanedText, 
          currentDisplayed, 
          targetScore, 
          newScore 
        });
        
        if (currentDisplayed === targetScore) {
          mainScore.textContent = formatScoreSimple(targetScore);
          return;
        }
        
        // Kill any existing animation on scoreProxy object
        let scoreProxy = { value: currentDisplayed };
        gsap.killTweensOf(scoreProxy);
        
        // Reset proxy to current value
        scoreProxy.value = currentDisplayed;
        
        // Calculate duration: minimum 0.8s, maximum 1.5s, based on difference
        const diff = Math.abs(targetScore - currentDisplayed);
        const duration = Math.min(1.5, Math.max(0.8, diff / 500)); // Slower for better visibility
        
        console.log('🎯 Starting score animation:', { 
          from: currentDisplayed, 
          to: targetScore, 
          duration, 
          diff 
        });
        
        const scoreTween = trackTween(scoreProxy, {
          value: targetScore,
          duration: duration,
          ease: 'power2.out',
          onUpdate: () => {
            const rounded = Math.round(scoreProxy.value);
            const formatted = formatScoreSimple(rounded);
            mainScore.textContent = formatted;
            triggerMainScoreCounterHaptic(rounded);
          },
          onComplete: () => {
            mainScore.textContent = formatScoreSimple(targetScore);
          }
        });
        activeGSAPTweens.push(scoreTween);
      };

      // 🎯 NEW: Transfer Combo Bonus (Step 1)
      const transferComboBonus = (): void => {
        const durationMs = safeComboBonus > 0 ? 1400 : 800;
        const durationSec = durationMs / 1000;
        mainScore.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        mainScore.style.transform = 'scale(1.08) translateY(0)';
        trackTimeout(() => {
          if (!el.isConnected || el.getAttribute('data-clean-board-exiting') === 'true') return;
          mainScore.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
          mainScore.style.transform = 'scale(1) translateY(0)';
        }, 420);

        // 🔥 ANIMATION: Animate score from current to scoreAfterCombo
        updateScore(scoreAfterCombo, true);

        // Animate combo bonus countdown separately
        const comboProxy = { value: safeComboBonus };
        const comboTween = trackTween(comboProxy, {
          value: 0,
          duration: durationSec,
          ease: 'power2.out',
          onUpdate: () => {
            const rounded = Math.round(comboProxy.value);
            comboValue.textContent = `+${formatScoreSimple(rounded)}`;
            triggerComboCounterHaptic(rounded);
          },
          onComplete: () => {
            comboValue.textContent = '+0';
          }
        });
        activeGSAPTweens.push(comboTween);
      };

      // 🎯 NEW: Transfer Efficiency Bonus (Step 2)
      const transferEfficiencyBonus = (): void => {
        const durationMs = safeEfficiencyBonus > 0 ? 1400 : 800;
        const durationSec = durationMs / 1000;
        mainScore.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        mainScore.style.transform = 'scale(1.08) translateY(0)';
        setTimeout(() => {
          mainScore.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
          mainScore.style.transform = 'scale(1) translateY(0)';
        }, 420);

        // 🔥 ANIMATION: Animate score from scoreAfterCombo to finalScore
        updateScore(finalScore, true);

        // Animate efficiency bonus countdown separately
        const efficiencyProxy = { value: safeEfficiencyBonus };
        const efficiencyTween = trackTween(efficiencyProxy, {
          value: 0,
          duration: durationSec,
          ease: 'power2.out',
          onUpdate: () => {
            const rounded = Math.round(efficiencyProxy.value);
            efficiencyValue.textContent = `+${formatScoreSimple(rounded)}`;
            triggerEfficiencyCounterHaptic(rounded);
          },
          onComplete: () => {
            efficiencyValue.textContent = '+0';
          }
        });
        activeGSAPTweens.push(efficiencyTween);
      };

      {
        // SEQUENCE 1: Initial elements pop-in WITH CONFETTI EXPLOSION
        // Start confetti 400ms earlier (immediately, no delay)
        allowConfettiSpawns();
        createConfettiExplosion(hero);
        
        setTimeout(() => {
          // 🌟 Hero is now stars container, animate it in
          console.log('🌟 Animating stars container (hero) to visible');
          hero.style.transition = trans;
          hero.style.opacity = '1';
          hero.style.transform = 'scale(1) translateY(0)';
          if (!cleanBoardStarAppearHapticPlayed) {
            cleanBoardStarAppearHapticPlayed = true;
            triggerHapticImpactSafe('medium');
          }
          console.log('🌟 Hero styles set:', { opacity: hero.style.opacity, transform: hero.style.transform });
          
          // Animate earned stars filling in with the established staggered bounce.
          // Delay 500ms after hero appears, then fill stars one by one (left → middle → right)
          trackTimeout(() => {
            if (!el.isConnected || el.getAttribute('data-clean-board-exiting') === 'true') return;
            starElements.forEach((star, index) => {
              // Only fill stars that were earned (numStars)
              if (index < numStars) {
                trackTimeout(() => {
                  if (!el.isConnected || el.getAttribute('data-clean-board-exiting') === 'true') return;
                  const { filledImg, emptyImg } = star;
                  // One medium haptic per earned (filled) star.
                  triggerHapticImpactSafe('medium');
                  
                  // 🌟 Hide empty star when filled star appears (no background visibility when pulsing)
                  emptyImg.style.opacity = '0';
                  emptyImg.style.transition = 'opacity 0.2s ease';
                  
                  // 🌟 Stronger bounce animation using GSAP (scale 0 → 1.4 → 0.88 with springy bounce)
                  // Set initial state
                  gsap.set(filledImg, {
                    scale: 0,
                    opacity: 1,
                    transformOrigin: 'center center'
                  });
                  
                  // Create bounce timeline
                  const bounceTl = trackTimeline();
                  
                  // 🎾 TRAMPOLIN BOUNCE: Scale 0 → 0.88 sa jako elastic/springy easing
                  // elastic.out(amplitude, period) - manji period = više bounces (trampolin efekt!)
                  // 🔥 END at scale 0.88 to match breathing animation START (seamless transition!)
                  bounceTl.to(filledImg, {
                    scale: 0.88, // 🔥 Match breathing animation start (scale(0.88) at 0%)
                    duration: 1.2, // Duže trajanje za više bounce-ova (trampolin!)
                    ease: 'elastic.out(1.5, 0.4)' // Jači elastic za više bouncy "boing boing" efekt!
                    // amplitude 1.5 = jak overshoot
                    // period 0.4 = više oscillacija (bouncy trampolin!)
                  });
                  
                  // 🌟 After bounce completes at scale(0.88), SEAMLESSLY start breathing animation
                  // Breathing starts at scale(0.88) → NO JUMP, perfectly fluid!
                  bounceTl.call(() => {
                    // Breathing/pulsating animation (inhale/exhale like lungs)
                    // Starts at 0.88 (current scale) → 1.25 → 0.88 loop
                    filledImg.style.animation = 'starBreathing 2.5s ease-in-out infinite';
                  });
                  
                  // Track timeline for cleanup
                  starBounceTimelines.push(bounceTl);
                  
                  console.log(`🌟 Star ${index + 1} filled with TRAMPOLIN BOUNCY bounce! (0 → 0.88 elastic springy → seamless breathing, delay: ${index * 500}ms)`);
                }, index * 500); // 🌟 500ms delay between each star (left → middle → right)
              }
            });
          }, 500); // 🌟 Start filling stars 500ms after hero appears
        }, 100);
        setTimeout(() => {
          title.style.opacity = '1';
          title.style.transform = 'scale(1) translateY(0)';
        }, 220);
        setTimeout(() => {
          scoreLabel.style.opacity = '1';
          scoreLabel.style.transform = 'scale(1) translateY(0)';
        }, 320);
        setTimeout(() => {
          mainScore.style.opacity = '1';
          mainScore.style.transform = 'scale(1) translateY(0)';
          // 🔥 ANIMATION: Start counting from 0 to currentScore when score appears
          // Add small delay to ensure element is fully visible before animation starts
          setTimeout(() => {
            console.log('🎯 Starting initial score animation from 0 to', currentScore);
            updateScore(currentScore, true);
          }, 50); // Small delay to ensure element is rendered
        }, 420);

        // SEQUENCE 2: Score already displayed (no animation needed)

        if (arcadeRunReached) {
          comboWrapper.style.display = 'none';
          comboWrapper.style.visibility = 'hidden';
          efficiencyWrapper.style.display = 'none';
          efficiencyWrapper.style.visibility = 'hidden';

          setTimeout(() => {
            boardCleared.style.transition = 'opacity 0.4s ease';
            boardCleared.style.opacity = '1';
          }, 1450);

          setTimeout(() => {
            animateButtonIn(primaryBtn);
            if (secondaryBtn) {
              setTimeout(() => {
                animateButtonIn(secondaryBtn);
              }, buttonStaggerMs);
            }
          }, 2050);
          return;
        }

        // 🎯 SEQUENCE 3: Combo Bonus pop-in
        setTimeout(() => {
          comboWrapper.style.transition = 'opacity 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          comboWrapper.style.opacity = '1';
          comboWrapper.style.transform = 'scale(1) translateY(0)';
        }, 1350);

        // 🎯 SEQUENCE 4: Transfer Combo Bonus into score (draining to zero)
        setTimeout(() => {
          if (safeComboBonus <= 0) {
            comboValue.textContent = '+0';
            updateScore(scoreAfterCombo, true);
          } else {
            transferComboBonus();
          }
        }, 2150);

        // 🎯 SEQUENCE 5: Hide Combo, show Efficiency Bonus
        setTimeout(() => {
          // Hide combo bonus
          comboWrapper.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          comboWrapper.style.opacity = '0';
          comboWrapper.style.transform = 'scale(0.8) translateY(-8px)';

          setTimeout(() => {
            comboWrapper.style.visibility = 'hidden';
            comboWrapper.style.display = 'none';
            
            // Show efficiency bonus
            efficiencyWrapper.style.transition = 'opacity 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
            efficiencyWrapper.style.opacity = '1';
            efficiencyWrapper.style.transform = 'scale(1) translateY(0)';
          }, 320);
        }, 3650);

        // 🎯 SEQUENCE 6: Transfer Efficiency Bonus into score (draining to zero)
        setTimeout(() => {
          if (safeEfficiencyBonus <= 0) {
            efficiencyValue.textContent = '+0';
            updateScore(finalScore, true);
          } else {
            transferEfficiencyBonus();
          }
        }, 4600);

        // 🎯 SEQUENCE 7: Hide Efficiency, show "Board cleared" label
        setTimeout(() => {
          efficiencyWrapper.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          efficiencyWrapper.style.opacity = '0';
          efficiencyWrapper.style.transform = 'scale(0.8) translateY(-8px)';

          setTimeout(() => {
            efficiencyWrapper.style.visibility = 'hidden';
            efficiencyWrapper.style.display = 'none';
            // SIMPLE transition - only opacity, NO transforms at all
            boardCleared.style.transition = 'opacity 0.4s ease';
            boardCleared.style.opacity = '1';
          }, 320);
        }, 6100);

        // 🎯 SEQUENCE 8: Button(s) pop-in (sequential bounce - Play Again first, then Exit)
        // Buttons appear AFTER "Board cleared" (6100ms + 320ms + 200ms = 6620ms)
        setTimeout(() => {
          // Show BOTH CTAs in all modes: primary first (Play Again/Continue), then Exit.
          // Arcade regression fix: Play Again was unintentionally hidden.
          animateButtonIn(primaryBtn);
          if (secondaryBtn) {
            setTimeout(() => {
              animateButtonIn(secondaryBtn);
            }, buttonStaggerMs); // 350ms delay between buttons
          }
        }, 6620); // After boardCleared (6100 + 320 + 200)
      }
    }); // Close requestAnimationFrame from line 431

    // 🔥 MEMORY LEAK FIX: Track button event listeners for cleanup
    const buttonEventListeners: Array<{ 
      button: HTMLButtonElement; 
      handlers: Array<{ event: string; handler: EventListener; options?: any }> 
    }> = [];
    
    // 🌟 Track star bounce animations for cleanup
    const starBounceTimelines: Array<gsap.core.Timeline> = [];
    
    // 🔥 Track all GSAP tweens for cleanup (score, combo, efficiency animations)
    const activeGSAPTweens: Array<gsap.core.Tween> = [];
    const starExitTimelines = new Set<gsap.core.Timeline>();
    let starExitPromise: Promise<void> | null = null;
    let settleStarExit: (() => void) | null = null;

    const cancelStarExit = () => {
      starExitTimelines.forEach((timeline) => {
        try { animationManager.killExternalTimeline(timeline); } catch {
          try { timeline.kill(); } catch {}
        }
      });
      starExitTimelines.clear();
      settleStarExit?.();
      settleStarExit = null;
    };
    abortStarAnimations = cancelStarExit;

    const playEarnedStarsExit = (earned = numStars): Promise<void> => {
      if (starExitPromise) return starExitPromise;
      const numEarned = Math.max(0, earned | 0);
      starExitPromise = new Promise<void>((resolveExit) => {
        let remaining = numEarned;
        let settledExit = false;
        const finish = () => {
          if (settledExit) return;
          remaining -= 1;
          if (remaining > 0) return;
          settledExit = true;
          settleStarExit = null;
          resolveExit();
        };
        settleStarExit = () => {
          if (settledExit) return;
          settledExit = true;
          resolveExit();
        };
        if (numEarned === 0) {
          hero.style.opacity = '0';
          finish();
          return;
        }
        starBounceTimelines.forEach((timeline) => {
          try { animationManager.killExternalTimeline(timeline); } catch {
            try { timeline.kill(); } catch {}
          }
        });
        starBounceTimelines.length = 0;
        starElements.forEach(({ filledImg, emptyImg }, index) => {
          emptyImg.style.opacity = '0';
          if (index >= numEarned) return;
          filledImg.style.animation = 'none';
          const timeline = trackTimeline({
            delay: Math.max(0, numEarned - 1 - index) * 0.07,
            onComplete: () => {
              starExitTimelines.delete(timeline);
              finish();
            },
            onInterrupt: () => {
              starExitTimelines.delete(timeline);
              finish();
            },
          });
          timeline
            .to(filledImg, {
              scale: 1.22,
              opacity: 1,
              duration: 0.10,
              ease: 'back.out(2.7)',
              overwrite: true,
            })
            .to(filledImg, {
              scale: 0,
              opacity: 1,
              duration: 0.40,
              ease: 'back.in(1.7)',
              overwrite: true,
            })
            .set(filledImg, { opacity: 0 });
          starExitTimelines.add(timeline);
        });
      });
      return starExitPromise;
    };
    
    // 🔥 CLEANUP: Kill all GSAP tweens (score, combo, efficiency animations)
    const killAllGSAPTweens = () => {
      activeGSAPTweens.forEach(tween => {
        try {
          tween.kill();
        } catch (e) {}
      });
      activeGSAPTweens.length = 0;
      
      // Also kill tweens on all DOM elements
      try {
        gsap.killTweensOf([hero, title, scoreLabel, mainScore, statusSlot, boardCleared, card]);
      } catch (e) {}
      
      console.log('✅ All GSAP tweens killed!');
    };
    
    // 🌟 CLEANUP / EXIT: Stop star animations. With exit: true, hide empty stars,
    // animate filled stars with the standard punch + back.in cartoon exit.
    const stopAllStarAnimations = (opts?: { exit?: boolean; numStars?: number }) => {
      const numEarned = Math.max(0, (opts?.numStars ?? numStars) | 0);
      const isExit = opts?.exit === true;

      if (isExit) {
        return playEarnedStarsExit(numEarned);
      }

      // Kill all star bounce timelines
      starBounceTimelines.forEach(tl => {
        try {
          tl.kill();
        } catch (e) {}
      });
      starBounceTimelines.length = 0;

      starElements.forEach(({ filledImg, emptyImg }, index) => {
        // 🔥 EXIT: Never show gray empty stars; hide all empties
        if (emptyImg) {
          try {
            emptyImg.style.opacity = '0';
            emptyImg.style.transition = 'opacity 0.15s ease';
          } catch (e) {}
        }

        if (!filledImg) return;

        // Non-exit path (e.g. cleanup): just stop breathing, no empty reset
        try {
          filledImg.style.animation = 'none';
          gsap.killTweensOf(filledImg);
        } catch (e) {}
      });

      console.log('✅ Star animations stopped' + (isExit ? ' (exit in place)' : '') + '!');
    };
    
    // 🔥 CLEANUP: Remove CSS style tag
    const removeStyleTag = () => {
      try {
        const styleTag = document.getElementById('clean-board-star-animations');
        if (styleTag) {
          styleTag.remove();
          console.log('✅ CSS style tag removed!');
        }
      } catch (e) {
        console.warn('⚠️ Failed to remove CSS style tag:', e);
      }
    };

    const addButtonPressHandling = (
      button: HTMLButtonElement,
      action: () => void | Promise<void>,
      variant: 'primary' | 'secondary',
    ): void => {
      const controller = registerCta(button, {
        variant,
        initialState: 'hidden',
        activationTiming: 'immediate',
        onActivate: action,
      });
      ctaControllers.push(controller);
    };
    
    // 🔥 MEMORY LEAK FIX: Cleanup function to remove all event listeners
    const cleanupButtonListeners = () => {
      buttonEventListeners.forEach(({ button, handlers }) => {
        handlers.forEach(({ event, handler, options }) => {
          try {
            button.removeEventListener(event, handler, options);
          } catch (e) {
            console.warn(`⚠️ Failed to remove ${event} listener:`, e);
          }
        });
      });
      buttonEventListeners.length = 0;
      console.log('✅ All button event listeners removed');
    };
    const disposeCtas = () => {
      ctaControllers.splice(0).forEach(controller => controller.dispose());
    };

    // 🔥 NEW: Primary button handler (Continue for interim, Play Again for regular)
    addButtonPressHandling(primaryBtn, async () => {
      // Haptic for primary button
      if (typeof (window as any).triggerHapticSelection === 'function') {
        (window as any).triggerHapticSelection();
      }
      
      primaryBtn.disabled = true;
      if (secondaryBtn) secondaryBtn.disabled = true;
      
      // 🔥 Mark overlay as exiting to neutralize :active styles
      el.setAttribute('data-clean-board-exiting', 'true');

      // 🔥 CRITICAL: Hide board app/stage IMMEDIATELY to prevent old board flash
      // 🚀 PERFORMANCE: Use display:none to completely remove from render flow (not just opacity)
      // Pixi v8: use app.canvas; fallback to app.view for older versions
      const appCanvas = getAppCanvasSafely(app);
      if (appCanvas?.style) {
        appCanvas.style.display = 'none'; // Browser won't render ANY tiles - huge performance boost!
        appCanvas.style.opacity = '0';
      }
      if (stage) {
        stage.alpha = 0;
        stage.visible = false; // PixiJS optimization - skip rendering
      }

      // 🔥 CRITICAL: Stop ALL background animations IMMEDIATELY for smooth exit
      // This prevents choppy exit animation caused by ongoing GSAP tweens and star animations
      killAllGSAPTweens(); // Kill score/combo/efficiency animations
      const earnedStarsExitPromise = playEarnedStarsExit(numStars);
      clearAllModalTimeouts(); // Clear all pending timeouts
      clearAllModalAnimationFrames(); // Clear all animation frames
      
      // CRITICAL: Reset boardCleared before exit animation - NO transforms at all
      boardCleared.style.transition = 'none';
      boardCleared.style.animation = 'none';
      boardCleared.style.transform = 'none';
      boardCleared.style.webkitTransform = 'none';
      
      // Also reset parent container
      statusSlot.style.transform = 'none';
      statusSlot.style.webkitTransform = 'none';
      
      // 🎯 Also reset bonus wrappers in case they're visible
      comboWrapper.style.transition = 'none';
      comboWrapper.style.transform = 'scale(1) translateY(0)';
      efficiencyWrapper.style.transition = 'none';
      efficiencyWrapper.style.transform = 'scale(1) translateY(0)';
      
      // Force reflow to apply reset
      void boardCleared.offsetHeight;
      void statusSlot.offsetHeight;
      
      // Buttons are outside the card, so card scale won't move them
      
      const exitTrans = 'opacity 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      const exitOffsets = [-22, -18, -14, -10, -6]; // 5 nodes (no hero)
      const exitScale = [0, 0.08, -0.04, 0.05, -0.02];
      // Hero remains the stable coordinate owner while earned stars exit
      // individually. Scaling both parent and children creates a compounded,
      // visibly incorrect Star exit.
      const nodes = [title, scoreLabel, mainScore, statusSlot, boardCleared];
      nodes.forEach((node) => { node.style.transition = exitTrans; });
      hero.style.transition = 'none';

      // 🎯 BUTTONS: Animate INDIVIDUALLY (not as container)
      // The clicked CTA exits first; its companion follows by one tiny visual beat.
      // Primary button (Play Again/Continue) was clicked - animate it FIRST
      await Promise.all([
        exitCtaPair(primaryBtn, secondaryBtn),
        earnedStarsExitPromise,
      ]);

      requestAnimationFrame(() => {
        nodes.forEach((node, idx) => {
          const delay = (idx + 1) * 60;
          setTimeout(() => {
            const extra = exitScale[idx] ?? 0;
            node.style.opacity = '0';
            node.style.transform = `scale(${0.0 + extra}) translateY(${exitOffsets[idx]}px)`;
          }, delay);
        });
      });
      // 🔥 FIX: Delay card scale animation until AFTER buttons start animating
      // This prevents buttons from moving up with card scale
      setTimeout(() => {
      card.style.transition = 'transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      requestAnimationFrame(() => {
        card.style.transform = 'scale(0.86)';
      });
      }, 400); // Delay card scale until buttons are mid-animation
      // 🎯 Calculate duration: buttons need FULL 400ms to animate to scale(0) (FASTER exit)
      // Give EXTRA time to ensure button animation completes BEFORE card fadeout
      const buttonExitDuration = buttonExitDurationMs;
      const extraBuffer = 200;
      const buttonDelay = ctaMotion.companionExitStaggerMs;
      const collapseDuration = secondaryBtn 
        ? nodes.length * 60 + buttonDelay + buttonExitDuration + extraBuffer  // With Exit button: 360 + 200 + 650 + 200 = 1410ms
        : nodes.length * 60 + buttonExitDuration + extraBuffer;               // Without Exit button: 360 + 650 + 200 = 1210ms
      setTimeout(() => {
        card.style.transition = 'transform 0.30s ease, opacity 0.30s ease';
        card.style.opacity = '0';
        el.style.transition = 'opacity 0.30s ease';
        el.style.opacity = '0';
      }, collapseDuration);
      
      // CRITICAL: Update score with bonus when Continue is clicked
      // 🔥 FIX: Use totalBonus (comboBonus + efficiencyBonus) instead of legacy bonus
      try {
        const cur = typeof getScore === 'function' ? (getScore()|0) : 0;
        const next = Math.min(scoreCap, cur + totalBonus);
        console.log('💾 clean-board-modal: Setting final score on Continue:', cur, '+', totalBonus, '=', next);
        if (typeof animateScore === 'function') {
          animateScore(next, 0.45);
        } else if (typeof setScore === 'function') {
          setScore(next);
          if (updateHUD) updateHUD();
        }
        try { (window as any).updateHighScore?.(next); } catch {}
        
        // Ensure final score is persisted in the correct high score bucket for this mode.
        try {
          if (isArcadeHomeRun) {
            arcadeStatsService.updateHighScore(finalScore);
            console.log(`✅ clean-board-modal: Updated ARCADE high score: ${finalScore} on Continue`);
          } else {
            boardStatsService.updateBoardHighScore(boardNumber, finalScore);
            console.log(`✅ clean-board-modal: Updated high score for board ${boardNumber}: ${finalScore} on Continue`);
            statsService.updateHighScore(finalScore);
            console.log(`✅ clean-board-modal: Updated global high score: ${finalScore} on Continue`);
          }
        } catch (error) {
          console.warn(`⚠️ clean-board-modal: Failed to update high score on Continue:`, error);
        }
        
        // SIMPLE: Clear completed board state (user clicked Continue, normal flow)
        localStorage.removeItem('cc_board_completed');
        
        // 🔥 USER REQUEST FIX: Clear board-specific saved state when continuing to next board
        // This ensures "Play" button shows instead of "Continue" when returning to completed board
        // Without this, user sees "Continue" + ghost placeholders on completed boards
        try {
          const { clearBoardSaveState } = await import('../utils/board-save-utils.js');
          clearBoardSaveState(boardNumber);
          console.log(`✅ clean-board-modal: Cleared board-specific saved state for board ${boardNumber} on Continue`);
        } catch (clearError) {
          console.warn(`⚠️ clean-board-modal: Failed to clear board saved state:`, clearError);
        }
      } catch {}
      
      // Star outro already has one idempotent owner started at exit tap.
      try {
        import('./confetti-system.js').then(confettiModule => {
          if (confettiModule && typeof confettiModule.cleanupConfetti === 'function') {
            confettiModule.cleanupConfetti();
          } else if (confettiModule && typeof confettiModule.stopConfettiSpawns === 'function') {
            confettiModule.stopConfettiSpawns();
          }
        }).catch(() => {});
      } catch {}

      // 🧪 DEV MODE: If dev mode is enabled, show board transition screen instead of normal flow
      if (devMode) {
        console.log('🧪 DEV MODE: Showing board transition screen');
        
        // Cleanup modal first (non-blocking - cleanup happens in background)
        cleanupButtonListeners();
        trackTimeout(() => { 
          disposeCtas();
          try { el.remove(); } catch {}
          removeStyleTag();
        }, collapseDuration + 220);
        
        // 🔥 CRITICAL FIX: Show board transition screen IMMEDIATELY without waiting for modal cleanup
        // This removes delay between exit animation and transition screen
        const nextBoardNumber = (boardNumber || 1) + 1;
        try {
          const { showBoardTransitionScreen } = await import('./board-transition-screen.js');
          // Don't await - show immediately, resolve promise in background
          showBoardTransitionScreen({
            boardNumber: nextBoardNumber,
            onComplete: async () => {
              console.log('🧪 DEV MODE: Board transition complete, starting new board');
              
              // Start new board (use startNewRunFromJourney for proper initialization)
              try {
                try { (window as any).CC?.cleanupFxForBoardReset?.('clean-board-modal'); } catch {}
                try { (window as any).CC?.softResetBoardView?.('clean-board-modal'); } catch {}
                if (typeof (window as any).startNewRunFromJourney === 'function') {
                  // Set Journey flags for proper initialization
                  markJourneyGameOrigin({ fromInterim: true });
                  await (window as any).startNewRunFromJourney(nextBoardNumber);
                  console.log(`✅ DEV MODE: Started board ${nextBoardNumber} via startNewRunFromJourney`);
                } else if (typeof (window as any).startLevel === 'function') {
                  (window as any).startLevel(nextBoardNumber);
                  console.log(`✅ DEV MODE: Started board ${nextBoardNumber} via startLevel`);
                } else {
                  console.error('❌ DEV MODE: No start function found');
                }
              } catch (error) {
                console.error('❌ DEV MODE: Failed to start new board:', error);
              }
              
              safeResolve('continue');
            }
          }).catch((error) => {
            console.error('❌ DEV MODE: Failed to show board transition screen:', error);
            safeResolve('continue');
          });
        } catch (error) {
          console.error('❌ DEV MODE: Failed to import board transition screen:', error);
          safeResolve('continue');
        }
        return; // Exit early - don't continue with normal flow
      }
      
      // 🎯 CRITICAL: Set flag to prevent saveGameState() from re-saving after clean board
      // Clean board = completed board, we already cleared save state, don't re-save it!
      (window as any).__ccBoardJustCompleted = true;
      console.log('🎯 clean-board-modal: Set __ccBoardJustCompleted flag to prevent re-saving after clean board (Continue)');
      
      // 🔥 MEMORY LEAK FIX: Final cleanup before resolving (animations already stopped at button click)
      cleanupButtonListeners(); // Remove all button event listeners
      
      // 🔥 NOTE: FX cleanup handled centrally in endgame-flow before startLevel
      
      trackTimeout(() => { 
        disposeCtas();
        try { el.remove(); } catch {}
        removeStyleTag(); // Remove CSS style tag
        
        // 🔥 DEFENSIVE CLEANUP: Fully cleanup confetti to reduce transition spikes
        try {
          import('./confetti-system.js').then(confettiModule => {
            if (confettiModule && typeof confettiModule.cleanupConfetti === 'function') {
              confettiModule.cleanupConfetti();
            } else if (confettiModule && typeof confettiModule.stopConfettiSpawns === 'function') {
              confettiModule.stopConfettiSpawns();
            }
          }).catch(() => {});
        } catch {}
        
        // 🔥 NEW: Return action based on which button was clicked
        const action = (!isArcadeHomeRun && isFromInterimBoard) ? 'continue' : 'play-again';
        console.log(`✅ clean-board-modal: Resolving with action: ${action}`);
        safeResolve(action);
      }, collapseDuration + 220);
    }, 'primary');
    
    // 🔥 NEW: Exit/Back button handler
    if (secondaryBtn) {
      addButtonPressHandling(secondaryBtn, async () => {
        // Haptic for exit button
        if (typeof (window as any).triggerHapticSelection === 'function') {
          (window as any).triggerHapticSelection();
        }
        
        primaryBtn.disabled = true;
        secondaryBtn.disabled = true;
        const exitStartedAt = performance.now();
        emitNativeConsoleDiagnostic('[CC_ARCADE_EXIT]', 'clean-board-exit-tap', {
          boardNumber,
          arcadeRunReached,
          boardExitAlreadyComplete: (window as any).__ccGameOverBoardExitComplete === true,
        });
        
        // 🔥 Mark overlay as exiting and stop it blocking clicks (detail modal will show under it)
        el.setAttribute('data-clean-board-exiting', 'true');
        (el as HTMLElement).style.pointerEvents = 'none';

        // 🔥 CRITICAL FIX: Play board exit animation FIRST before hiding board
        // This ensures user sees the original board exit animation (tiles + HUD) as requested
        console.log('🎬 clean-board-modal: Starting board exit animation before hiding board...');
        
        // Stop only modal-specific animations, but NOT board animations (let exit animation play)
        const earnedStarsExitPromise = playEarnedStarsExit(numStars);
        // Ensure confetti is fully removed right when Exit is tapped.
        // Keeping existing confetti alive causes visible "waiting on confetti" before homepage.
        stopConfettiSpawnsSafe();
        clearAllModalTimeouts();
        clearAllModalAnimationFrames();
        
        // 🔥 CRITICAL: DO NOT kill GSAP tweens or hide board yet - let exit animation play first
        // Start board exit animation (don't await yet - let it run in parallel with modal exit)
        let boardExitPromise: Promise<void> = Promise.resolve();
        if (arcadeRunReached && (window as any).__ccGameOverBoardExitComplete === true) {
          console.log('⏭️ clean-board-modal: Arcade summary board exit already completed - skipping duplicate exit');
        } else {
          try {
            const { STATE } = await import('./app-state.js');
            if (STATE && typeof (window as any).animateBoardExit === 'function') {
              console.log('🎬 clean-board-modal: Calling animateBoardExit() to play board exit animation...');
              boardExitPromise = (window as any).animateBoardExit();
            } else {
              console.warn('⚠️ clean-board-modal: animateBoardExit not available, skipping board exit animation');
            }
          } catch (error) {
            console.error('❌ clean-board-modal: Failed to start board exit animation:', error);
          }
        }
        
        // 🔥 Start modal exit animation IMMEDIATELY (in parallel with board exit animation)
        boardCleared.style.transition = 'none';
        boardCleared.style.animation = 'none';
        boardCleared.style.transform = 'none';
        boardCleared.style.webkitTransform = 'none';
        statusSlot.style.transform = 'none';
        statusSlot.style.webkitTransform = 'none';
        comboWrapper.style.transition = 'none';
        comboWrapper.style.transform = 'scale(1) translateY(0)';
        efficiencyWrapper.style.transition = 'none';
        efficiencyWrapper.style.transform = 'scale(1) translateY(0)';
        void boardCleared.offsetHeight;
        void statusSlot.offsetHeight;
        
        const exitTrans = 'opacity 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        const exitOffsets = [-22, -18, -14, -10, -6];
        const exitScale = [0, 0.08, -0.04, 0.05, -0.02];
        const nodes = [title, scoreLabel, mainScore, statusSlot, boardCleared];
        nodes.forEach((node) => { node.style.transition = exitTrans; });
        // Keep the parent at identity; stopAllStarAnimations owns the visual
        // exit for each earned Star.
        hero.style.transition = 'none';

        const ctaExitPromise = exitCtaPair(secondaryBtn, primaryBtn);

        trackAnimationFrame(() => {
          nodes.forEach((node, idx) => {
            const delay = (idx + 1) * 60;
            trackTimeout(() => {
              const extra = exitScale[idx] ?? 0;
              node.style.opacity = '0';
              node.style.transform = `scale(${0.0 + extra}) translateY(${exitOffsets[idx]}px)`;
            }, delay);
          });
        });
        // 🔥 FIX: Delay card scale animation until AFTER buttons start animating
        // This prevents buttons from moving up with card scale
        void earnedStarsExitPromise.then(() => {
          if (!el.isConnected) return;
          card.style.transition = 'transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          trackAnimationFrame(() => {
            card.style.transform = 'scale(0.86)';
          });
        });
        
        // Board and modal exits are independent owners. Hide gameplay after its
        // own exit, but do not kill modal GSAP/CSS work from this completion.
        const boardExitCompletePromise = boardExitPromise.catch((error) => {
          console.error('❌ clean-board-modal: Board exit animation failed:', error);
        }).then(() => {
          console.log('✅ clean-board-modal: Board exit completed, hiding gameplay surface...');
          const canvas = getAppCanvasSafely(app);
          if (canvas?.style) {
            canvas.style.display = 'none';
            canvas.style.opacity = '0';
          }
          if (stage) {
            stage.alpha = 0;
            stage.visible = false;
          }
          emitNativeConsoleDiagnostic('[CC_ARCADE_EXIT]', 'board-exit-owner-complete', {
            boardNumber,
            elapsedMs: Math.round(performance.now() - exitStartedAt),
          });
        });
        // Fade the complete paper only after every parallel visual owner has
        // reached its endpoint. In particular, do not replace the card's
        // 650ms transition while it is still settling from the 400ms delay.
        const contentExitDuration = nodes.length * 60 + 580;
        const starExitDuration = 500 + Math.max(0, numStars - 1) * 70;
        const cardExitDuration = starExitDuration + 650;
        const ctaExitDuration = ctaMotion.companionExitStaggerMs + buttonExitDurationMs;
        const collapseDuration = Math.max(
          contentExitDuration,
          cardExitDuration,
          ctaExitDuration,
        );
        const modalExitPromise = Promise.all([
          ctaExitPromise,
          new Promise<void>((resolveModalExit) => {
            trackTimeout(() => {
              card.style.transition = 'transform 0.30s ease, opacity 0.30s ease';
              card.style.opacity = '0';
              el.style.transition = 'opacity 0.30s ease';
              el.style.opacity = '0';
            }, collapseDuration);
            trackTimeout(resolveModalExit, collapseDuration + 300);
          }),
        ]).then(() => {
          emitNativeConsoleDiagnostic('[CC_ARCADE_EXIT]', 'modal-exit-owner-complete', {
            boardNumber,
            elapsedMs: Math.round(performance.now() - exitStartedAt),
            collapseDuration,
          });
        });
        emitNativeConsoleDiagnostic('[CC_ARCADE_EXIT]', 'exit-owners-started', {
          boardNumber,
          collapseDuration,
          boardExitAlreadyComplete: arcadeRunReached
            && (window as any).__ccGameOverBoardExitComplete === true,
        });
        
        // 🔥 EXIT FIX: Clear board save state to show "Play" instead of "Continue" on next entry
        // Also update high score in board-stats-service
        console.log('🚪 clean-board-modal: Exit button clicked - clearing save state and updating high score');
        
        try {
          // Clear board-specific saved state (so "Play" shows instead of "Continue")
          const { clearBoardSaveState, hasSavedStateForBoard, getBoardSaveKey } = await import('../utils/board-save-utils.js');
          
          // 🔍 DEBUG: Check state BEFORE clearing
          const hadSaveBefore = hasSavedStateForBoard(boardNumber);
          const saveKey = getBoardSaveKey(boardNumber);
          console.log(`🔍 clean-board-modal Exit: Board ${boardNumber} saved state BEFORE clear:`, hadSaveBefore, `(key: ${saveKey})`);
          
          // Clear board save state
          clearBoardSaveState(boardNumber);
          console.log(`✅ clean-board-modal: Cleared board-specific saved state for board ${boardNumber} on Exit`);
          
          // 🔍 DEBUG: Verify state AFTER clearing
          const hasSaveAfter = hasSavedStateForBoard(boardNumber);
          console.log(`🔍 clean-board-modal Exit: Board ${boardNumber} saved state AFTER clear:`, hasSaveAfter);
          
          if (hasSaveAfter) {
            console.error(`❌ CRITICAL: Board ${boardNumber} STILL has saved state after clearing! Key: ${saveKey}`);
          } else {
            console.log(`✅ VERIFIED: Board ${boardNumber} save state successfully cleared`);
          }
        } catch (clearError) {
          console.warn(`⚠️ clean-board-modal: Failed to clear board saved state on Exit:`, clearError);
        }
        
        // Update high score with FINAL score (including bonuses) in correct mode bucket
        try {
          if (isArcadeHomeRun) {
            arcadeStatsService.updateHighScore(finalScore);
            console.log(`✅ clean-board-modal: Updated ARCADE high score: ${finalScore}`);
          } else {
            boardStatsService.updateBoardHighScore(boardNumber, finalScore);
            console.log(`✅ clean-board-modal: Updated high score for board ${boardNumber}: ${finalScore}`);
            statsService.updateHighScore(finalScore);
            console.log(`✅ clean-board-modal: Updated global high score: ${finalScore}`);
          }
        } catch (error) {
          console.warn(`⚠️ clean-board-modal: Failed to update high score on Exit:`, error);
        }
        
        // 🔥 MEMORY LEAK FIX: Final cleanup before resolving
        cleanupButtonListeners(); // Remove all button event listeners
        
        // 🎯 CRITICAL: Set flag to prevent saveGameState() from re-saving after clean board
        // Clean board = completed board, we already cleared save state, don't re-save it!
        (window as any).__ccBoardJustCompleted = true;
        console.log('🎯 clean-board-modal: Set __ccBoardJustCompleted flag to prevent re-saving after clean board');
        
        // Retire the overlay only after both independent owners have completed.
        // Round 02+ summaries arrive with an already-resolved board exit; that
        // must never truncate the Clean Board paper/card exit again.
        const exitsCompleted = await Promise.race([
          Promise.all([boardExitCompletePromise, modalExitPromise]).then(() => true),
          navigationAbortPromise.then(() => false),
        ]);
        if (!exitsCompleted) return;
        killAllGSAPTweens();
        clearAllModalTimeouts();
        clearAllModalAnimationFrames();
        disposeCtas();
        try { el.remove(); } catch {}
        removeStyleTag();
        stopConfettiSpawnsSafe();
        const exitAction = isFromInterimBoard ? 'back-to-journey' : 'exit';
        emitNativeConsoleDiagnostic('[CC_ARCADE_EXIT]', 'overlay-retired', {
          boardNumber,
          elapsedMs: Math.round(performance.now() - exitStartedAt),
          exitAction,
          overlayConnected: el.isConnected,
        });
        console.log(`✅ clean-board-modal: Resolving with action: ${exitAction} (board + complete modal exit settled)`);
        safeResolve(exitAction);
      }, 'secondary');
    }
      } catch (error) {
        console.error('❌ clean-board-modal: Unhandled error - falling back to continue', error);
        safeResolve('continue');
      }
    };
    run();
  });
}
