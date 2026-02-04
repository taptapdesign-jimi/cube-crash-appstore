// TNT Animation – Explosion Pack merge-6 sprite sequence
// Anchor na kockici merge 6; prati board shake; bez stanke na tnt6; slide + bounce

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { logger } from '../core/logger.js';
import { domElementPool } from './dom-element-pool.js';

const BASE = './assets/shop/explosion pack/animation/';
export const TNT_ANIM_FRAMES: string[] = [
  `${BASE}tnt1.png`,
  `${BASE}tnt2.png`,
  `${BASE}tnt3.png`,
  `${BASE}tnt4.png`,
  `${BASE}tnt5.png`,
  `${BASE}tnt6.png`,
  `${BASE}tnt7.png`,
  `${BASE}tnt8.png`,
  `${BASE}tnt9.png`,
  `${BASE}tnt10.png`,
  `${BASE}tnt11.png`,
  `${BASE}tnt12.png`,
];

let isActive = false;
let overlay: HTMLElement | null = null;
let timeline: gsap.core.Timeline | null = null;
let extraTimelines: gsap.core.Timeline[] = [];
let spriteBounceTweensRef: gsap.core.Tween[] = [];
let boomBounceTimelinesRef: gsap.core.Timeline[] = [];
let activeFrameImages: HTMLImageElement[] = [];
let activeFrameWrappers: HTMLElement[] = [];
let dragBlockTimeout: gsap.core.Tween | null = null;

const trackTimeline = (opts?: gsap.TimelineVars) => animationManager.trackExternalTimeline(gsap.timeline(opts));
const trackDelayedCall = (...args: Parameters<typeof gsap.delayedCall>) =>
  animationManager.trackExternalTween(gsap.delayedCall(...args));

function cleanup(): void {
  try {
    if (timeline) {
      timeline.kill();
      timeline = null;
    }
    extraTimelines.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    extraTimelines = [];
    spriteBounceTweensRef.forEach((t) => {
      try { t.kill(); } catch {}
    });
    spriteBounceTweensRef = [];
    boomBounceTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    boomBounceTimelinesRef = [];
    if (dragBlockTimeout) {
      try { dragBlockTimeout.kill(); } catch {}
      dragBlockTimeout = null;
    }
    activeFrameImages.forEach((img) => {
      try {
        gsap.killTweensOf(img);
        domElementPool.release(img);
      } catch {}
    });
    activeFrameImages = [];
    activeFrameWrappers.forEach((wrap) => {
      try {
        gsap.killTweensOf(wrap);
        domElementPool.release(wrap);
      } catch {}
    });
    activeFrameWrappers = [];
    if (overlay) {
      try {
        gsap.killTweensOf(overlay);
        overlay.querySelectorAll('*').forEach((el) => {
          try { gsap.killTweensOf(el); } catch {}
        });
      } catch {}
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      overlay = null;
    }
    isActive = false;
    try {
      (window as any).__ccTntAnimationActive = false;
      (window as any).__ccTntDragBlocked = false;
    } catch {}
  } catch (e) {
    logger.warn('⚠️ tnt-animation cleanup error:', e);
  }
}

export function isTntAnimationActive(): boolean {
  return isActive;
}

/** Vrati overlay element da ga app-core može proslijediti screenShake (alsoShake). */
export function getTntAnimationOverlay(): HTMLElement | null {
  return overlay;
}

// TNT sprite sekvenca - 12 frameova, sve u centru viewporta
const NUM_FRAMES = 12;
const ENTER_BOUNCE_SCALE = 1.2;
/** Vertikalno rastezanje spriteova za 40% (manje plosnato) */
const VERTICAL_STRETCH = 1.4;
const ENTER_DURATION = 0.24;
const SETTLE_DURATION = 0.1;
const FINAL_SETTLE_DURATION = 0.1;
const EXIT_BOUNCE_SCALE = 1.2;
const EXIT_BOUNCE_DURATION = 0.13;
const EXIT_FADE_DURATION = 0.17;
const HOLD_AT_FRAME_6 = 0.3;
const SPRITE_EXTRA_DURATION = 0.3;
const SPRITE_EXIT_STAGGER = 0.04;
const BOOM_ENTER_DELAY = 0.3;
const BOOM_ENTER_STAGGER = 0.05;
const BOOM_EXIT_STAGGER = 0.06;
const BOOM_ENTER_EXTRA = 0.1;
const BOOM_EXIT_EXTRA = 0.3;

/**
 * Play TNT explosion (tnt1..tnt12). Sve u centru viewporta.
 * Nema anchor na merge 6 – strukturna animacija u centru ekrana.
 */
export function showTntAnimation(options: {
  onComplete?: () => void;
  onBoomExitStart?: () => void;
} = {}): HTMLElement | null {
  if (isActive) {
    try { cleanup(); } catch {}
  }

  isActive = true;
  try {
    (window as any).__ccTntAnimationActive = true;
    (window as any).__ccTntDragBlocked = true;
  } catch {}
  const { onComplete, onBoomExitStart } = options;

  overlay = document.createElement('div');
  overlay.id = 'cc-tnt-animation-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    'width: 100%',
    'height: 100%',
    'z-index: 99998',
    'pointer-events: none',
    'background: transparent',
  ].join(';');

  const framesContainer = document.createElement('div');
  framesContainer.style.cssText = [
    'position: absolute',
    'left: 0',
    'top: 0',
    'width: 100%',
    'height: 100%',
    'pointer-events: none',
  ].join(';');

  const frameEls: HTMLImageElement[] = [];
  for (let i = 0; i < NUM_FRAMES; i++) {
    const wrapper = domElementPool.acquire('div');
    activeFrameWrappers.push(wrapper);
    wrapper.style.cssText = [
      'position: absolute',
      'left: 50%',
      'top: 50%',
      'transform: translate(-50%, -50%)',
      'pointer-events: none',
      'display: flex',
      'align-items: center',
      'justify-content: center',
    ].join(';');
    const frameEl = domElementPool.acquire('img') as HTMLImageElement;
    activeFrameImages.push(frameEl);
    frameEl.src = TNT_ANIM_FRAMES[i];
    frameEl.alt = '';
    frameEl.style.cssText = [
      'display: block',
      'max-width: 95vw',
      'max-height: 95vh',
      'object-fit: contain',
      'opacity: 0',
      'transform-origin: center center',
      'pointer-events: none',
      'will-change: transform, opacity',
      'filter: brightness(1.05)',
    ].join(';');
    wrapper.appendChild(frameEl);
    framesContainer.appendChild(wrapper);
    frameEls.push(frameEl);
  }

  // BOOM text – centar viewporta
  const boomContainer = document.createElement('div');
  boomContainer.style.cssText = [
    'position: absolute',
    'left: 50%',
    'top: 50%',
    'transform: translate(-50%, -50%)',
    'display: flex',
    'flex-direction: row',
    'align-items: center',
    'justify-content: center',
    'gap: -4px',
    'margin: 0',
    'padding: 0',
    'width: fit-content',
    'min-width: 0',
    'max-width: 100%',
    'box-sizing: border-box',
    'z-index: 2',
    'pointer-events: none',
    'perspective: 1000px',
    'transform-style: preserve-3d',
  ].join(';');

  const boomLetters: HTMLElement[] = [];
  const boomLetterScales: number[] = [];
  const boomLetterRotations: number[] = [];
  const boomBounceTimelines: gsap.core.Timeline[] = [];
  const boomText = ['B', 'O', 'O', 'M'];
  boomText.forEach((letter, idx) => {
    const letterScale = 0.9 + Math.random() * 0.4; // random veličina slova
    const rotation = (Math.random() - 0.5) * 24; // -12 do +12 deg, svako slovo svoja random rotacija
    const letterEl = document.createElement('span');
    letterEl.textContent = letter;
    const dropShadow = 'drop-shadow(5px 12px 16.1px rgba(210, 109, 64, 0.25))';
    letterEl.style.cssText = [
      'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
      'font-weight: 800',
      'font-size: 83px',
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
      `filter: ${dropShadow}`,
      'transform-style: preserve-3d',
      'backface-visibility: hidden',
      '-webkit-font-smoothing: antialiased',
      '-moz-osx-font-smoothing: grayscale',
      'text-rendering: optimizeLegibility',
      'transform-origin: center center',
      'position: relative',
      'z-index: 10'
    ].join(';');
    boomContainer.appendChild(letterEl);
    boomLetters.push(letterEl);
    boomLetterScales.push(letterScale);
    boomLetterRotations.push(rotation);

    // kontinuirani springy bounce - nisko trenje
    const bounceTl = trackTimeline({ repeat: -1, yoyo: true });
    bounceTl.pause(0);
    bounceTl.to(letterEl, {
      scale: letterScale * (1.02 + Math.random() * 0.06),
      rotation: rotation * 1.1,
      duration: 0.35,
      ease: 'elastic.inOut(1, 0.2)'
    });
    boomBounceTimelines.push(bounceTl);
    boomBounceTimelinesRef.push(bounceTl);

    // postavi baznu rotaciju odmah
    gsap.set(letterEl, { rotation });
  });

  overlay.appendChild(framesContainer);
  overlay.appendChild(boomContainer);
  document.body.appendChild(overlay);

  // Master timeline for cleanup
  timeline = trackTimeline({
    onComplete: () => {
      cleanup();
      try { onComplete?.(); } catch {}
    },
    onKill: () => {
      cleanup();
    },
  });

  // Frame 6 hold: kada 6. sprite dođe, ostani 0.3s bounce pa exit
  const sprite5SettleTime = 0.07 + 5 * 0.04 + ENTER_DURATION + SETTLE_DURATION;
  const exitStartTime = sprite5SettleTime + HOLD_AT_FRAME_6 + SPRITE_EXTRA_DURATION - 0.2;
  spriteBounceTweensRef = [];

  frameEls.forEach((frameEl, i) => {
    const randomRotation = (Math.random() - 0.5) * 20;
    const randomSize = 1 + Math.random() * 0.52;
    const enterDelay = 0.07 + (i * 0.04);
    const dEnter = ENTER_DURATION;
    const dSettle = SETTLE_DURATION;
    const settleEndTime = enterDelay + dEnter + dSettle;
    const exitStaggerDelay = i * SPRITE_EXIT_STAGGER;
    const holdDuration = Math.max(0, exitStartTime + exitStaggerDelay - settleEndTime);

    gsap.set(frameEl, {
      x: 0,
      y: 0,
      scaleX: 0,
      scaleY: 0,
      opacity: 0,
      rotation: randomRotation
    });

    const tl = trackTimeline({ delay: enterDelay });
    extraTimelines.push(tl);
    tl.to(frameEl, {
      opacity: 1,
      scaleX: randomSize * ENTER_BOUNCE_SCALE,
      scaleY: randomSize * ENTER_BOUNCE_SCALE * VERTICAL_STRETCH,
      duration: dEnter,
      ease: 'back.out(2.0)'
    });
    tl.to(frameEl, {
      scaleX: randomSize,
      scaleY: randomSize * VERTICAL_STRETCH,
      duration: dSettle,
      ease: 'power2.out'
    }, '>0');
    tl.call(() => {
      const bounceS = randomSize * (1.02 + Math.random() * 0.06);
      const bounce = gsap.to(frameEl, {
        scaleX: bounceS,
        scaleY: bounceS * VERTICAL_STRETCH,
        y: (Math.random() - 0.5) * 4,
        duration: 0.4,
        ease: 'elastic.inOut(1, 0.25)',
        repeat: -1,
        yoyo: true
      });
      spriteBounceTweensRef.push(bounce);
    }, [], `+=0`);
    tl.to({}, { duration: holdDuration }, `>0`);
    tl.call(() => {
      const bounce = spriteBounceTweensRef[i];
      if (bounce) try { bounce.kill(); } catch {}
      const exitS = randomSize * EXIT_BOUNCE_SCALE;
      gsap.to(frameEl, {
        scaleX: exitS,
        scaleY: exitS * VERTICAL_STRETCH,
        z: 30,
        duration: EXIT_BOUNCE_DURATION,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(frameEl, {
            opacity: 0,
            scaleX: 0,
            scaleY: 0,
            z: -100,
            duration: EXIT_FADE_DURATION,
            ease: 'back.in(2.0)'
          });
        }
      });
    }, [], `>0`);
  });

  // BOOM enter/exit (isti enter/exit kao board broj)
  let boomExitStarted = false;
  const startBoomExit = () => {
    if (boomExitStarted) return;
    boomExitStarted = true;
    try { onBoomExitStart?.(); } catch {}
    boomBounceTimelines.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    // Allow drag after BOOM letters finish exit
    try {
      if (dragBlockTimeout) dragBlockTimeout.kill();
      const exitTotal =
        (BOOM_EXIT_STAGGER * Math.max(0, boomLetters.length - 1)) +
        (EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2) +
        (EXIT_FADE_DURATION + BOOM_EXIT_EXTRA * 0.8) +
        0.05;
      dragBlockTimeout = trackDelayedCall(exitTotal, () => {
        try { (window as any).__ccTntDragBlocked = false; } catch {}
      });
    } catch {}
    boomLetters.forEach((letterEl, index) => {
      const delay = index * BOOM_EXIT_STAGGER;
      const exitTl = trackTimeline({ delay });
      extraTimelines.push(exitTl);
      const baseScale = boomLetterScales[index] ?? 1;
      const baseRot = boomLetterRotations[index] ?? 0;
      const exitRotation = (baseRot >= 0 ? 1 : -1) * (12 + Math.random() * 8); // svako slovo zadržava svoj smjer
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
    });
  };

  let boomEnterComplete = 0;
  boomLetters.forEach((letterEl, index) => {
    const delay = BOOM_ENTER_DELAY + index * BOOM_ENTER_STAGGER;
    const baseRotation = gsap.getProperty(letterEl, 'rotation') as number;
    const randomRotation = typeof baseRotation === 'number' ? baseRotation : 0;
    const baseScale = boomLetterScales[index] ?? 1;
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

    const letterTl = trackTimeline({ delay });
    extraTimelines.push(letterTl);
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
        // start springy bounce after enter completes for this letter
        try { boomBounceTimelines[index]?.play(0); } catch {}
        boomEnterComplete += 1;
        if (boomEnterComplete === boomLetters.length) {
          startBoomExit();
        }
      }
    });
  });

  // Cleanup after all animations
  timeline.to({}, { duration: 4.2 });

  return overlay;
}

export function stopTntAnimation(): void {
  cleanup();
}
