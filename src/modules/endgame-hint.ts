// Lightweight endgame hint overlay for last-move guidance
import { logger } from '../core/logger.js';
import { gsap } from 'gsap';
import { attachPuffyClouds } from './text-clouds.js';

const HINT_MESSAGES = [
  'Stack it!',
  'Drag it!',
  'Move it!',
  'Knock knock',
  'Helloo?',
  'You home?',
  'Anybody?',
  'Wazzup?',
  'Tap tap',
  'Do it!',
  'Go go!',
  'Your move',
  'Come on',
  'Psst!',
  'Still there?',
  'Wake up!',
  'Nudge it',
  'Send it',
  'Boop!',
  'One more'
];
const IDLE_DELAY_MS = 20000;
const VISIBLE_DURATION_MS = 3000;
const REPEAT_DELAY_MS = 5000;
const ROTATE_MS = 3000;
const STYLE_ID = 'endgame-hint-style';
const ENTER_BOUNCE_SCALE = 1.2;
const ENTER_DURATION = 0.24;
const SETTLE_DURATION = 0.1;
const FINAL_SETTLE_DURATION = 0.1;
const EXIT_BOUNCE_DURATION = 0.026; // 80% faster (was 0.13)
const EXIT_FADE_DURATION = 0.034;   // 80% faster (was 0.17)
const BOOM_ENTER_DELAY = 0.3;
const BOOM_ENTER_STAGGER = 0.05;
const BOOM_EXIT_STAGGER = 0.012; // 80% faster (was 0.06)
const BOOM_ENTER_EXTRA = 0.1;
const BOOM_EXIT_EXTRA = 0.06; // 80% faster (was 0.3)
const MAX_TEXT_CONTAINER_TILT_DEG = 15;
function createRandomTextLetterSizes(count: number): number[] {
  const base = count >= 11 ? 58 : count >= 9 ? 64 : count >= 7 ? 72 : 80;
  return Array.from({ length: count }, (_, index) => {
    const wave = index % 2 === 0 ? 1.04 : 0.96;
    const randomVariation = 0.94 + Math.random() * 0.12;
    return base * wave * randomVariation;
  });
}

let shouldShow = false;
let hintVisible = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let visibleTimer: ReturnType<typeof setTimeout> | null = null;
let repeatTimer: ReturnType<typeof setTimeout> | null = null;
let rotateTimer: ReturnType<typeof setInterval> | null = null;
let hintEl: HTMLDivElement | null = null;
let hintCloudOverlay: HTMLDivElement | null = null;
let hintCloudCleanup: (() => void) | null = null;
let messageIndex = 0;
let activeTween: gsap.core.Tween | gsap.core.Timeline | null = null;
let letterEls: HTMLSpanElement[] = [];
let letterScales: number[] = [];
let letterRotations: number[] = [];
let bounceTweens: gsap.core.Tween[] = [];
let bottomSheetObserver: MutationObserver | null = null;
let lastMessageIndex = -1;

function chooseNextMessageIndex(): number {
  if (HINT_MESSAGES.length <= 1) return 0;
  let next = Math.floor(Math.random() * HINT_MESSAGES.length);
  if (next === lastMessageIndex) {
    next = (next + 1) % HINT_MESSAGES.length;
  }
  lastMessageIndex = next;
  return next;
}

function isBottomSheetActive(): boolean {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector([
    '.score-bottom-sheet',
    '.score-bottom-sheet.visible',
    '.simple-bottom-sheet',
    '.simple-bottom-sheet.visible',
    '.resume-bottom-sheet',
    '.resume-bottom-sheet.visible',
    '.hearts-bottom-sheet',
    '.hearts-bottom-sheet.visible',
    '.collectible-reward-bottom-sheet',
    '.collectible-reward-bottom-sheet.visible',
    '.collectible-reward-sheet',
    '.collectible-reward-sheet.show'
  ].join(','));
}

function clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
  if (timer) clearTimeout(timer);
  return null;
}

function clearScheduledTimers(): void {
  idleTimer = clearTimer(idleTimer);
  visibleTimer = clearTimer(visibleTimer);
  repeatTimer = clearTimer(repeatTimer);
}

function scheduleRepeatShow(): void {
  if (!shouldShow || isBottomSheetActive() || idleTimer || repeatTimer) return;
  repeatTimer = setTimeout(() => {
    repeatTimer = null;
    if (shouldShow && !isBottomSheetActive() && !hintVisible && !idleTimer) {
      showHint();
    } else if (shouldShow && isBottomSheetActive()) {
      scheduleRepeatShow();
    }
  }, REPEAT_DELAY_MS);
}

function stopBottomSheetObserver(): void {
  if (!bottomSheetObserver) return;
  try { bottomSheetObserver.disconnect(); } catch {}
  bottomSheetObserver = null;
}

function ensureBottomSheetObserver(): void {
  if (bottomSheetObserver || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  bottomSheetObserver = new MutationObserver(() => {
    if (!shouldShow) return;
    if (isBottomSheetActive()) {
      clearScheduledTimers();
      if (hintVisible || hintEl) {
        hideHint();
      }
      return;
    }
    if (!hintVisible && !idleTimer && !repeatTimer) {
      scheduleShow();
    }
  });
  try {
    bottomSheetObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  } catch {
    stopBottomSheetObserver();
  }
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .endgame-hint {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 999999;
      pointer-events: none;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin: 0;
      padding: 0;
      width: fit-content;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
      perspective: 1000px;
      transform-style: preserve-3d;
      color: #e77449;
    }
  `;
  document.head.appendChild(style);
}

function ensureElement(): HTMLDivElement {
  if (hintEl && hintEl.isConnected) return hintEl;
  ensureStyles();
  if (!hintCloudOverlay || !hintCloudOverlay.isConnected) {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'width: 100%',
      'height: 100%',
      'pointer-events: none',
      'z-index: 999998'
    ].join(';');
    document.body.appendChild(overlay);
    hintCloudOverlay = overlay;
    hintCloudCleanup = attachPuffyClouds(overlay, { count: 5, zIndex: 1 });
  }
  const el = document.createElement('div');
  el.className = 'endgame-hint';
  document.body.appendChild(el);
  hintEl = el;
  renderMessage(HINT_MESSAGES[messageIndex]);
  return el;
}

function cleanupHintClouds(): void {
  if (hintCloudCleanup) {
    try { hintCloudCleanup(); } catch {}
    hintCloudCleanup = null;
  }
  if (hintCloudOverlay && hintCloudOverlay.parentNode) {
    try { hintCloudOverlay.parentNode.removeChild(hintCloudOverlay); } catch {}
  }
  hintCloudOverlay = null;
}

function updateMessage(): void {
  if (!hintEl) return;
  renderMessage(HINT_MESSAGES[messageIndex]);
}

function clearLetterAnimations(): void {
  bounceTweens.forEach((t) => {
    try { t.kill(); } catch {}
  });
  bounceTweens = [];
}

function renderMessage(text: string): void {
  if (!hintEl) return;
  activeTween?.kill?.();
  activeTween = null;
  clearLetterAnimations();
  hintEl.innerHTML = '';
  letterEls = [];
  letterScales = [];
  letterRotations = [];
  const chars = text.split('');
  const letterFontSizes = createRandomTextLetterSizes(chars.length);
  chars.forEach((ch, index) => {
    const letterScale = 1;
    const letterFontSize = ch === ' ' ? 64 : letterFontSizes[index];
    const rotation = 0;
    const letterEl = document.createElement('span');
    if (ch === ' ') {
      letterEl.textContent = '\u00A0';
      letterEl.style.minWidth = '42px';
    } else {
      letterEl.textContent = ch;
    }
    letterEl.style.cssText = [
      'font-family: "Baloo2", system-ui, -apple-system, sans-serif',
      'font-weight: 800',
      `font-size: ${letterFontSize.toFixed(1)}px`,
      'line-height: 1',
      'color: #e77449',
      'text-align: center',
      'opacity: 0',
      'transform: scale(0) perspective(1000px) translateZ(0)',
      'display: inline-block',
      'visibility: visible',
      'pointer-events: none',
    'margin-right: 0',
    letterEls.length === 0 ? 'margin-left: 0' : 'margin-left: -4.2px',
      'padding: 0',
      'border: 0',
      'outline: 0',
      'vertical-align: top',
      'transform-style: preserve-3d',
      'backface-visibility: hidden',
      '-webkit-font-smoothing: antialiased',
      '-moz-osx-font-smoothing: grayscale',
      'text-rendering: optimizeLegibility',
      'transform-origin: center center',
      'position: relative',
      'z-index: 10'
    ].join(';');
    hintEl.appendChild(letterEl);
    letterEls.push(letterEl);
    letterScales.push(letterScale);
    letterRotations.push(rotation);
    gsap.set(letterEl, { rotation });
  });
  const containerTilt = (Math.random() - 0.5) * (MAX_TEXT_CONTAINER_TILT_DEG * 2);
  hintEl.style.transform = `translate(-50%, -50%) rotate(${containerTilt}deg)`;
}

function animateIn(): void {
  if (!hintEl || letterEls.length === 0) return;
  activeTween?.kill?.();
  activeTween = null;
  clearLetterAnimations();
  const tl = gsap.timeline();
  let enterComplete = 0;
  letterEls.forEach((letterEl, index) => {
    const delay = BOOM_ENTER_DELAY + index * BOOM_ENTER_STAGGER;
    const baseRotation = gsap.getProperty(letterEl, 'rotation') as number;
    const randomRotation = typeof baseRotation === 'number' ? baseRotation : 0;
    const baseScale = letterScales[index] ?? 1;
    letterEl.style.willChange = 'transform, opacity';
    letterEl.style.transform = 'translateZ(0)';
    letterEl.style.backfaceVisibility = 'hidden';
    letterEl.style.webkitBackfaceVisibility = 'hidden';
    letterEl.style.contain = 'layout style paint';

    gsap.set(letterEl, {
      opacity: 0,
      scale: 0,
      x: 0,
      y: 0,
      rotation: randomRotation,
      rotationX: 0,
      rotationY: 0,
      z: 0,
      force3D: true
    });

    const letterTl = gsap.timeline({ delay });
    letterTl.to(letterEl, {
      opacity: 1,
      scale: baseScale * ENTER_BOUNCE_SCALE,
      rotation: randomRotation,
      rotationX: -5,
      rotationY: 0,
      z: 20,
      x: 0,
      y: 0,
      transformOrigin: 'center center',
      duration: ENTER_DURATION + BOOM_ENTER_EXTRA * 0.6,
      ease: 'back.out(2.0)'
    });
    letterTl.to(letterEl, {
      scale: baseScale * 0.95,
      rotation: randomRotation,
      rotationX: 0,
      rotationY: 0,
      z: 0,
      x: 0,
      y: 0,
      transformOrigin: 'center center',
      duration: SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
      ease: 'power2.out'
    });
    letterTl.to(letterEl, {
      opacity: 1,
      scale: baseScale,
      rotation: randomRotation,
      rotationX: 0,
      rotationY: 0,
      z: 0,
      x: 0,
      y: 0,
      transformOrigin: 'center center',
      duration: FINAL_SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
      ease: 'back.out(1.5)',
      onComplete: () => {
        enterComplete += 1;
        if (enterComplete === letterEls.length) {
          letterEls.forEach((el, idx) => {
            const baseScaleInner = letterScales[idx] ?? 1;
            const amp = 1.16 + Math.random() * 0.06; // stronger bounce
            const dur = 0.54 + Math.random() * 0.42;
            const delay = Math.random() * 0.25 + idx * 0.03;
            const bounce = gsap.to(el, {
              scale: baseScaleInner * amp,
              duration: dur,
              ease: 'sine.inOut',
              repeat: -1,
              yoyo: true,
              delay
            });
            bounceTweens.push(bounce);
          });
        }
      }
    });
    tl.add(letterTl, 0);
  });
  activeTween = tl;
}

function animateOut(onComplete?: () => void): void {
  if (!hintEl) {
    onComplete?.();
    return;
  }
  if (letterEls.length === 0) {
    onComplete?.();
    return;
  }
  activeTween?.kill?.();
  activeTween = null;
  clearLetterAnimations();
  const tl = gsap.timeline({ onComplete: () => {
    activeTween = null;
    onComplete?.();
  } });
  letterEls.forEach((letterEl, index) => {
    const delay = index * BOOM_EXIT_STAGGER;
    const baseScale = letterScales[index] ?? 1;
    const baseRot = letterRotations[index] ?? 0;
    const exitRotation = (baseRot >= 0 ? 1 : -1) * (12 + Math.random() * 8);
    const exitTl = gsap.timeline({ delay });
    exitTl.to(letterEl, {
      scale: baseScale * 1.1,
      z: 30,
      duration: EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2,
      ease: 'power2.out'
    });
    exitTl.to(letterEl, {
      opacity: 0,
      scale: 0,
      rotation: exitRotation,
      rotationX: baseRot >= 0 ? 45 : -45,
      rotationY: baseRot >= 0 ? 30 : -30,
      z: -100,
      duration: EXIT_FADE_DURATION + BOOM_EXIT_EXTRA * 0.8,
      ease: 'power2.in'
    });
    tl.add(exitTl, 0);
  });
  activeTween = tl;
}

function startRotate(): void {
  // Single message only; keep bounce loop in place.
}

function stopRotate(): void {
  if (!rotateTimer) return;
  clearInterval(rotateTimer);
  rotateTimer = null;
}

function showHint(): void {
  if (!shouldShow) return;
  if (isBottomSheetActive()) {
    scheduleRepeatShow();
    return;
  }
  visibleTimer = clearTimer(visibleTimer);
  repeatTimer = clearTimer(repeatTimer);
  messageIndex = chooseNextMessageIndex();
  ensureElement();
  updateMessage();
  hintVisible = true;
  animateIn();
  visibleTimer = setTimeout(() => {
    visibleTimer = null;
    hideHint(true);
  }, VISIBLE_DURATION_MS);
}

function hideHint(scheduleRepeat = false): void {
  visibleTimer = clearTimer(visibleTimer);
  hintVisible = false;
  stopRotate();
  if (scheduleRepeat) scheduleRepeatShow();
  if (hintEl && hintEl.isConnected) {
    animateOut(() => {
      try { hintEl?.remove(); } catch {}
      hintEl = null;
      letterEls = [];
      letterScales = [];
      letterRotations = [];
      cleanupHintClouds();
    });
  }
}

function scheduleShow(): void {
  idleTimer = clearTimer(idleTimer);
  repeatTimer = clearTimer(repeatTimer);
  if (isBottomSheetActive()) {
    scheduleRepeatShow();
    return;
  }
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (isBottomSheetActive()) {
      scheduleRepeatShow();
      return;
    }
    showHint();
  }, IDLE_DELAY_MS);
}

export function updateEndgameHint(shouldShowNow: boolean): void {
  shouldShow = shouldShowNow;
  if (!shouldShow) {
    clearScheduledTimers();
    hideHint();
    stopBottomSheetObserver();
    return;
  }
  ensureBottomSheetObserver();
  if (isBottomSheetActive()) {
    clearScheduledTimers();
    hideHint();
    return;
  }
  if (!hintVisible && !idleTimer && !repeatTimer) {
    scheduleShow();
  }
}

export function notifyEndgameHintInteraction(): void {
  clearScheduledTimers();
  if (hintVisible) {
    hideHint();
  }
  // IMPORTANT: Do not auto-reschedule here.
  // Reshow must always come from a fresh board-state evaluation via updateEndgameHint(true),
  // otherwise stale "STACK IT!" timers can fire after board changed to no-moves (e.g. 4+3).
}

/** On drag start: hide and re-arm idle hint (no immediate show). */
export function showEndgameHintOnDragStart(): void {
  if (!shouldShow) return;
  clearScheduledTimers();
  if (hintVisible) {
    hideHint();
  }
  // IMPORTANT: Do not auto-reschedule on drag start.
  // Let app-core re-enable hint only after recomputing current board validity.
}

export function resetEndgameHint(): void {
  shouldShow = false;
  clearScheduledTimers();
  hideHint();
  stopBottomSheetObserver();
  messageIndex = 0;
  lastMessageIndex = -1;
  logger.debug('🧹 Endgame hint reset', 'endgame-hint');
}

/** Force-remove hint immediately (no animation). Use when exiting game – GSAP may be killed before hideHint completes. */
export function forceClearEndgameHint(): void {
  shouldShow = false;
  clearScheduledTimers();
  stopBottomSheetObserver();
  stopRotate();
  activeTween?.kill?.();
  activeTween = null;
  clearLetterAnimations();
  if (hintEl && hintEl.isConnected) {
    try { hintEl.remove(); } catch {}
    hintEl = null;
  }
  letterEls = [];
  letterScales = [];
  letterRotations = [];
  cleanupHintClouds();
  hintVisible = false;
  messageIndex = 0;
  lastMessageIndex = -1;
}

/** Play exit animation on NO MOVES! hint, then remove. Returns Promise that resolves when done. Call BEFORE killing GSAP in exitToMenu. */
export function hideEndgameHintWithAnimation(): Promise<void> {
  return new Promise((resolve) => {
    if (!hintEl || !hintEl.isConnected) {
      shouldShow = false;
      clearScheduledTimers();
      stopBottomSheetObserver();
      resolve();
      return;
    }
    shouldShow = false;
    clearScheduledTimers();
    stopBottomSheetObserver();
    hintVisible = false;
    stopRotate();
    animateOut(() => {
      try { hintEl?.remove(); } catch {}
      hintEl = null;
      letterEls = [];
      letterScales = [];
      letterRotations = [];
      cleanupHintClouds();
      resolve();
    });
  });
}
