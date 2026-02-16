// Lightweight endgame hint overlay for last-move guidance
import { logger } from '../core/logger.js';
import { gsap } from 'gsap';

const HINT_MESSAGES = ['STACK IT!'];
const IDLE_DELAY_MS = 3000;
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

let shouldShow = false;
let hintVisible = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let rotateTimer: ReturnType<typeof setInterval> | null = null;
let hintEl: HTMLDivElement | null = null;
let messageIndex = 0;
let activeTween: gsap.core.Tween | gsap.core.Timeline | null = null;
let letterEls: HTMLSpanElement[] = [];
let letterScales: number[] = [];
let letterRotations: number[] = [];
let bounceTweens: gsap.core.Tween[] = [];

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
      gap: -4px;
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
  const el = document.createElement('div');
  el.className = 'endgame-hint';
  document.body.appendChild(el);
  hintEl = el;
  renderMessage(HINT_MESSAGES[messageIndex]);
  return el;
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
  hintEl.innerHTML = '';
  letterEls = [];
  letterScales = [];
  letterRotations = [];
  const chars = text.split('');
  chars.forEach((ch) => {
    const letterScale = 0.9 + Math.random() * 0.4;
    const rotation = 0;
    const letterEl = document.createElement('span');
    if (ch === ' ') {
      letterEl.textContent = '\u00A0';
      letterEl.style.minWidth = '18px';
    } else {
      letterEl.textContent = ch;
    }
    letterEl.style.cssText = [
      'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
      'font-weight: 800',
      'font-size: 64px',
      'line-height: 1',
      'color: #e77449',
      'text-align: center',
      'opacity: 0',
      'transform: scale(0) perspective(1000px) translateZ(0)',
      'display: inline-block',
      'visibility: visible',
      'pointer-events: none',
      'margin-right: 0',
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
  if (!hintEl || letterEls.length === 0) return;
  activeTween?.kill?.();
  clearLetterAnimations();
  const tl = gsap.timeline({ onComplete: () => onComplete?.() });
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
  ensureElement();
  updateMessage();
  hintVisible = true;
  animateIn();
}

function hideHint(): void {
  hintVisible = false;
  stopRotate();
  if (hintEl && hintEl.isConnected) {
    animateOut(() => {
      try { hintEl?.remove(); } catch {}
      hintEl = null;
    });
  }
}

function scheduleShow(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    showHint();
  }, IDLE_DELAY_MS);
}

export function updateEndgameHint(shouldShowNow: boolean): void {
  shouldShow = shouldShowNow;
  if (!shouldShow) {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    hideHint();
    return;
  }
  if (!hintVisible) {
    scheduleShow();
  }
}

export function notifyEndgameHintInteraction(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (hintVisible) {
    hideHint();
  }
  if (shouldShow) {
    scheduleShow();
  }
}

/** On drag start: hide and re-arm idle hint (no immediate show). */
export function showEndgameHintOnDragStart(): void {
  if (!shouldShow) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (hintVisible) {
    hideHint();
  }
  scheduleShow();
}

export function resetEndgameHint(): void {
  shouldShow = false;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  hideHint();
  messageIndex = 0;
  logger.debug('🧹 Endgame hint reset', 'endgame-hint');
}
