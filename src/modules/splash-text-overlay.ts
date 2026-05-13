// @ts-nocheck
// Splash text overlay – SWOOP (magnet merge 6)
// Same enter/exit as TNT BOOM, white color

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { attachPuffyClouds } from './text-clouds.js';
import { attachSmallStarCenterBurst } from './text-sparkles.js';
import { attachBoltSprites } from './text-bolts.js';

const trackTimeline = (opts?: any) => animationManager.trackExternalTimeline(gsap.timeline(opts));
const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));

let swoopOverlay: HTMLElement | null = null;
let swoopTimelinesRef: gsap.core.Timeline[] = [];
let swoopBounceTimelinesRef: gsap.core.Timeline[] = [];
let swoopDelayedCallsRef: gsap.core.Tween[] = [];
let swoopFxCleanup: (() => void) | null = null;
let magneticTextActive = false;
let magneticTextWaiters: Array<() => void> = [];
let sparkleOverlay: HTMLElement | null = null;
let sparkleTimelinesRef: gsap.core.Timeline[] = [];
let sparkleBounceTimelinesRef: gsap.core.Timeline[] = [];
let sparkleDelayedCallsRef: gsap.core.Tween[] = [];
let sparkleFxCleanup: (() => void) | null = null;
let sparkleTextActive = false;
let noMovesOverlay: HTMLElement | null = null;
let noMovesTimelinesRef: gsap.core.Timeline[] = [];
let noMovesBounceTimelinesRef: gsap.core.Timeline[] = [];
let noMovesLetterScales: number[] = [];
let noMovesLetterRotations: number[] = [];
let noMovesCloudCleanup: (() => void) | null = null;

function resolveMagneticTextWaiters(): void {
  if (!magneticTextWaiters.length) return;
  const waiters = magneticTextWaiters;
  magneticTextWaiters = [];
  waiters.forEach((resolve) => {
    try { resolve(); } catch {}
  });
}

// Same as TNT BOOM
const ENTER_BOUNCE_SCALE = 1.2;
const ENTER_DURATION = 0.24;
const SETTLE_DURATION = 0.1;
const FINAL_SETTLE_DURATION = 0.1;
const BOOM_ENTER_DELAY = 0.3;
const BOOM_ENTER_STAGGER = 0.05;
const BOOM_EXIT_STAGGER = 0.06;
const BOOM_ENTER_EXTRA = 0.1;
const BOOM_EXIT_EXTRA = 0.3;
const EXIT_BOUNCE_DURATION = 0.13;
const EXIT_FADE_DURATION = 0.17;
const MAX_TEXT_CONTAINER_TILT_DEG = 15;
const SPARKLE_HAPTIC_COUNT = 7;
const SPARKLE_HAPTIC_INTERVAL = 0.095;

function triggerSparkleHapticTrain(): void {
  try {
    if (typeof (window as any).triggerHapticImpact !== 'function') return;
    for (let i = 0; i < SPARKLE_HAPTIC_COUNT; i++) {
      const call = trackDelayedCall(i * SPARKLE_HAPTIC_INTERVAL, () => {
        try { (window as any).triggerHapticImpact?.('light'); } catch {}
      });
      sparkleDelayedCallsRef.push(call);
    }
  } catch {}
}

function cleanupBuzzzOverlay(): void {
  try {
    swoopDelayedCallsRef.forEach((dc) => {
      try { dc.kill(); } catch {}
    });
    swoopDelayedCallsRef = [];
    swoopBounceTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    swoopBounceTimelinesRef = [];
    swoopTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    swoopTimelinesRef = [];
    if (swoopOverlay) {
      try {
        gsap.killTweensOf(swoopOverlay);
        swoopOverlay.querySelectorAll('*').forEach((el) => {
          try { gsap.killTweensOf(el); } catch {}
        });
      } catch {}
    }
    if (swoopFxCleanup) {
      try { swoopFxCleanup(); } catch {}
      swoopFxCleanup = null;
    }
    if (swoopOverlay?.parentNode) {
      swoopOverlay.parentNode.removeChild(swoopOverlay);
    }
    swoopOverlay = null;
    magneticTextActive = false;
    resolveMagneticTextWaiters();
  } catch {}
}

/**
 * Show SWOOP text overlay (magnet merge 6)
 * Same enter/exit as TNT BOOM, white color
 */
export function showMagneticText(): void {
  try {
    cleanupBuzzzOverlay();
    magneticTextActive = true;

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'width: 100%',
      'height: 100%',
      'pointer-events: none',
      'z-index: 9999999',
      'display: flex',
      'align-items: center',
      'justify-content: center',
    ].join(';');
    swoopOverlay = overlay;
    // Wild-magnet SWOOP uses pooled bolt sprites instead of clouds.
    swoopFxCleanup = attachBoltSprites(overlay, { count: 16, zIndex: 1 });

    const container = document.createElement('div');
    container.style.cssText = [
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
    const containerTilt = (Math.random() - 0.5) * (MAX_TEXT_CONTAINER_TILT_DEG * 2);
    container.style.transform = `translate(-50%, -50%) rotate(${containerTilt}deg)`;

    const letters = ['S', 'W', 'O', 'O', 'P'];
    const letterScales: number[] = [];
    const letterRotations: number[] = [];
    const swoopBounceTimelines: gsap.core.Timeline[] = [];
    const dropShadow = 'drop-shadow(5px 12px 16.1px rgba(255, 148, 114, 0.45))';

    letters.forEach((letter) => {
      const letterScale = 0.9 + Math.random() * 0.4;
      const rotation = 0;
      const el = document.createElement('span');
      el.textContent = letter;
      el.style.cssText = [
        'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        'font-size: 64px',
        'line-height: 1',
        'color: #FF9472',
        '-webkit-text-fill-color: #FF9472',
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
        'z-index: 10',
      ].join(';');
      container.appendChild(el);
      letterScales.push(letterScale);
      letterRotations.push(rotation);

      const bounceTl = trackTimeline({ repeat: -1, yoyo: true });
      bounceTl.pause(0);
      bounceTl.to(el, {
        scale: letterScale * (1.02 + Math.random() * 0.06),
        rotation: rotation * 1.1,
        duration: 0.35,
        ease: 'elastic.inOut(1, 0.2)'
      });
      swoopBounceTimelines.push(bounceTl);
      swoopBounceTimelinesRef.push(bounceTl);
      gsap.set(el, { rotation });
    });

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    let exitStarted = false;
    const startExit = () => {
      if (exitStarted) return;
      exitStarted = true;
      swoopBounceTimelines.forEach((tl) => {
        try { tl.kill(); } catch {}
      });
      letters.forEach((_, index) => {
        const el = container.children[index] as HTMLElement;
        if (!el) return;
        const delay = index * BOOM_EXIT_STAGGER;
        const tl = trackTimeline({ delay });
        swoopTimelinesRef.push(tl);
        const baseScale = letterScales[index] ?? 1;
        const baseRot = letterRotations[index] ?? 0;
        const exitRotation = (baseRot >= 0 ? 1 : -1) * (12 + Math.random() * 8);
        tl.to(el, {
          scale: baseScale * 1.1,
          z: 30,
          duration: EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2,
          ease: 'power2.out'
        });
        tl.to(el, {
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
      const exitTotal =
        BOOM_EXIT_STAGGER * (letters.length - 1) +
        EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2 +
        EXIT_FADE_DURATION + BOOM_EXIT_EXTRA * 0.8 +
        0.05;
      const exitCleanupCall = trackDelayedCall(exitTotal, () => cleanupBuzzzOverlay());
      swoopDelayedCallsRef.push(exitCleanupCall);
    };

    let enterComplete = 0;
    letters.forEach((_, index) => {
      const el = container.children[index] as HTMLElement;
      if (!el) return;
      const delay = BOOM_ENTER_DELAY + index * BOOM_ENTER_STAGGER;
      const baseRotation = letterRotations[index] ?? 0;
      const baseScale = letterScales[index] ?? 1;

      el.style.willChange = 'transform, opacity';
      el.style.transform = 'translateZ(0)';
      el.style.backfaceVisibility = 'hidden';
      el.style.webkitBackfaceVisibility = 'hidden';
      el.style.contain = 'layout style paint';

      gsap.set(el, {
        opacity: 0,
        scale: 0,
        x: 0,
        y: 0,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        force3D: true
      });

      const tl = trackTimeline({ delay });
      swoopTimelinesRef.push(tl);
      tl.to(el, {
        opacity: 1,
        scale: baseScale * ENTER_BOUNCE_SCALE,
        rotation: baseRotation,
        rotationX: -5,
        rotationY: 0,
        z: 20,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: ENTER_DURATION + BOOM_ENTER_EXTRA * 0.6,
        ease: 'back.out(2.0)'
      });
      tl.to(el, {
        scale: baseScale * 0.95,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
        ease: 'power2.out'
      });
      tl.to(el, {
        opacity: 1,
        scale: baseScale,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: FINAL_SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
        ease: 'back.out(1.5)',
        onComplete: () => {
          try { swoopBounceTimelines[index]?.play(0); } catch {}
          enterComplete += 1;
          if (enterComplete === letters.length) {
            startExit();
          }
        }
      });
    });
  } catch (e) {
    console.warn('⚠️ showMagneticText (SWOOP) failed:', e);
    cleanupBuzzzOverlay();
  }
}

export function stopMagneticText(): void {
  cleanupBuzzzOverlay();
}

export function isMagneticTextActive(): boolean {
  return magneticTextActive;
}

export function waitForMagneticTextComplete(timeoutMs = 2200): Promise<void> {
  if (!magneticTextActive) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    magneticTextWaiters.push(finish);
    // Failsafe: never block flow if animation is interrupted.
    try {
      window.setTimeout(finish, timeoutMs);
    } catch {
      finish();
    }
  });
}

function cleanupSparkleOverlay(): void {
  try {
    sparkleDelayedCallsRef.forEach((dc) => {
      try { dc.kill(); } catch {}
    });
    sparkleDelayedCallsRef = [];
    sparkleBounceTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    sparkleBounceTimelinesRef = [];
    sparkleTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    sparkleTimelinesRef = [];
    if (sparkleOverlay) {
      try {
        gsap.killTweensOf(sparkleOverlay);
        sparkleOverlay.querySelectorAll('*').forEach((el) => {
          try { gsap.killTweensOf(el); } catch {}
        });
      } catch {}
    }
    if (sparkleFxCleanup) {
      try { sparkleFxCleanup(); } catch {}
      sparkleFxCleanup = null;
    }
    if (sparkleOverlay?.parentNode) {
      sparkleOverlay.parentNode.removeChild(sparkleOverlay);
    }
    sparkleOverlay = null;
    sparkleTextActive = false;
  } catch {}
}

/**
 * Show SPARKLE text overlay for wild-star merge 6.
 * Uses the same enter/exit style as BUBBLY, but in yellow.
 */
export function showSparkleText(origin?: { x: number; y: number } | null): void {
  try {
    cleanupSparkleOverlay();
    sparkleTextActive = true;

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'width: 100%',
      'height: 100%',
      'pointer-events: none',
      'z-index: 9999999',
      'display: flex',
      'align-items: center',
      'justify-content: center',
    ].join(';');
    sparkleOverlay = overlay;
    const smallStarBurstCleanup = attachSmallStarCenterBurst(overlay, { count: 26, zIndex: 2, origin });
    sparkleFxCleanup = () => {
      try { smallStarBurstCleanup(); } catch {}
    };
    triggerSparkleHapticTrain();

    const container = document.createElement('div');
    container.style.cssText = [
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
      'z-index: 3',
      'pointer-events: none',
      'perspective: 1000px',
      'transform-style: preserve-3d',
    ].join(';');
    const containerTilt = (Math.random() - 0.5) * (MAX_TEXT_CONTAINER_TILT_DEG * 2);
    container.style.transform = `translate(-50%, -50%) rotate(${containerTilt}deg)`;

    const letters = ['S', 'P', 'A', 'R', 'K', 'L', 'E'];
    const letterScales: number[] = [];
    const letterRotations: number[] = [];
    const bounceTimelines: gsap.core.Timeline[] = [];
    const dropShadow = 'drop-shadow(5px 12px 16.1px rgba(255, 231, 157, 0.45))';

    letters.forEach((letter) => {
      const letterScale = 0.9 + Math.random() * 0.4;
      const rotation = 0;
      const el = document.createElement('span');
      el.textContent = letter;
      el.style.cssText = [
        'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        'font-size: 64px',
        'line-height: 1',
        'color: #FFCB81',
        '-webkit-text-fill-color: #FFCB81',
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
        'text-shadow: none',
        `filter: ${dropShadow}`,
        'transform-style: preserve-3d',
        'backface-visibility: hidden',
        '-webkit-font-smoothing: antialiased',
        '-moz-osx-font-smoothing: grayscale',
        'text-rendering: optimizeLegibility',
        'transform-origin: center center',
        'position: relative',
        'z-index: 10',
      ].join(';');
      container.appendChild(el);
      letterScales.push(letterScale);
      letterRotations.push(rotation);

      const bounceTl = trackTimeline({ repeat: -1, yoyo: true });
      bounceTl.pause(0);
      bounceTl.to(el, {
        scale: letterScale * (1.02 + Math.random() * 0.06),
        rotation: rotation * 1.1,
        duration: 0.35,
        ease: 'elastic.inOut(1, 0.2)'
      });
      bounceTimelines.push(bounceTl);
      sparkleBounceTimelinesRef.push(bounceTl);
      gsap.set(el, { rotation });
    });

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    let exitStarted = false;
    const startExit = () => {
      if (exitStarted) return;
      exitStarted = true;
      bounceTimelines.forEach((tl) => {
        try { tl.kill(); } catch {}
      });
      letters.forEach((_, index) => {
        const el = container.children[index] as HTMLElement;
        if (!el) return;
        const delay = index * BOOM_EXIT_STAGGER;
        const tl = trackTimeline({ delay });
        sparkleTimelinesRef.push(tl);
        const baseScale = letterScales[index] ?? 1;
        const baseRot = letterRotations[index] ?? 0;
        const exitRotation = (baseRot >= 0 ? 1 : -1) * (12 + Math.random() * 8);
        tl.to(el, {
          scale: baseScale * 1.1,
          z: 30,
          duration: EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2,
          ease: 'power2.out'
        });
        tl.to(el, {
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
      const exitTotal =
        BOOM_EXIT_STAGGER * (letters.length - 1) +
        EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2 +
        EXIT_FADE_DURATION + BOOM_EXIT_EXTRA * 0.8 +
        0.05;
      const exitCleanupCall = trackDelayedCall(exitTotal, () => cleanupSparkleOverlay());
      sparkleDelayedCallsRef.push(exitCleanupCall);
    };

    let enterComplete = 0;
    letters.forEach((_, index) => {
      const el = container.children[index] as HTMLElement;
      if (!el) return;
      const delay = BOOM_ENTER_DELAY + index * BOOM_ENTER_STAGGER;
      const baseRotation = letterRotations[index] ?? 0;
      const baseScale = letterScales[index] ?? 1;

      el.style.willChange = 'transform, opacity';
      el.style.transform = 'translateZ(0)';
      el.style.backfaceVisibility = 'hidden';
      el.style.webkitBackfaceVisibility = 'hidden';
      el.style.contain = 'layout style paint';

      gsap.set(el, {
        opacity: 0,
        scale: 0,
        x: 0,
        y: 0,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        force3D: true
      });

      const tl = trackTimeline({ delay });
      sparkleTimelinesRef.push(tl);
      tl.to(el, {
        opacity: 1,
        scale: baseScale * ENTER_BOUNCE_SCALE,
        rotation: baseRotation,
        rotationX: -5,
        rotationY: 0,
        z: 20,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: ENTER_DURATION + BOOM_ENTER_EXTRA * 0.6,
        ease: 'back.out(2.0)'
      });
      tl.to(el, {
        scale: baseScale * 0.95,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
        ease: 'power2.out'
      });
      tl.to(el, {
        opacity: 1,
        scale: baseScale,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: FINAL_SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
        ease: 'back.out(1.5)',
        onComplete: () => {
          try { bounceTimelines[index]?.play(0); } catch {}
          enterComplete += 1;
          if (enterComplete === letters.length) {
            startExit();
          }
        }
      });
    });
  } catch (e) {
    console.warn('⚠️ showSparkleText failed:', e);
    cleanupSparkleOverlay();
  }
}

export function stopSparkleText(): void {
  cleanupSparkleOverlay();
}

export function isSparkleTextActive(): boolean {
  return sparkleTextActive;
}

function cleanupNoMovesOverlay(): void {
  try {
    noMovesBounceTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    noMovesBounceTimelinesRef.length = 0;
    noMovesTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    noMovesTimelinesRef.length = 0;
    noMovesLetterScales = [];
    noMovesLetterRotations = [];
    if (noMovesOverlay) {
      try {
        gsap.killTweensOf(noMovesOverlay);
        noMovesOverlay.querySelectorAll('*').forEach((el) => {
          try { gsap.killTweensOf(el); } catch {}
        });
      } catch {}
    }
    if (noMovesCloudCleanup) {
      try { noMovesCloudCleanup(); } catch {}
      noMovesCloudCleanup = null;
    }
    if (noMovesOverlay?.parentNode) {
      noMovesOverlay.parentNode.removeChild(noMovesOverlay);
    }
    noMovesOverlay = null;
  } catch {}
}

/**
 * Show "NO MOVES" text overlay during end-game wait (1.5s before fail screen).
 * Same enter animation as STACK IT! / SWOOP. Stays visible until clearNoMovesText().
 */
export function showNoMovesText(): void {
  try {
    cleanupNoMovesOverlay();

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'width: 100%',
      'height: 100%',
      'pointer-events: none',
      'z-index: 9999999',
      'display: flex',
      'align-items: center',
      'justify-content: center',
    ].join(';');
    noMovesOverlay = overlay;
    noMovesCloudCleanup = attachPuffyClouds(overlay, { count: 5, zIndex: 1 });

    const container = document.createElement('div');
    container.style.cssText = [
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
    const containerTilt = (Math.random() - 0.5) * (MAX_TEXT_CONTAINER_TILT_DEG * 2);
    container.style.transform = `translate(-50%, -50%) rotate(${containerTilt}deg)`;

    const letters = ['N', 'O', ' ', 'M', 'O', 'V', 'E', 'S'];
    noMovesLetterScales = [];
    noMovesLetterRotations = [];
    const bounceTimelines: gsap.core.Timeline[] = [];
    const dropShadow = 'drop-shadow(5px 12px 16.1px rgba(196, 197, 193, 0.5))';

    letters.forEach((ch) => {
      const letterScale = 0.9 + Math.random() * 0.4;
      const rotation = 0;
      const el = document.createElement('span');
      if (ch === ' ') {
        el.textContent = '\u00A0';
        el.style.minWidth = '18px';
      } else {
        el.textContent = ch;
      }
      noMovesLetterScales.push(letterScale);
      noMovesLetterRotations.push(rotation);
      el.style.cssText = [
        'font-family: "LTCrow", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        'font-size: 64px',
        'line-height: 1',
        'color: #CC9882',
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
        'z-index: 10',
      ].join(';');
      container.appendChild(el);

      const bounceTl = trackTimeline({ repeat: -1, yoyo: true });
      bounceTl.pause(0);
      bounceTl.to(el, {
        scale: letterScale * (1.02 + Math.random() * 0.06),
        rotation: rotation * 1.1,
        duration: 0.35,
        ease: 'elastic.inOut(1, 0.2)'
      });
      bounceTimelines.push(bounceTl);
      noMovesBounceTimelinesRef.push(bounceTl);
      gsap.set(el, { rotation });
    });

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    let enterComplete = 0;
    letters.forEach((_, index) => {
      const el = container.children[index] as HTMLElement;
      if (!el) return;
      const delay = BOOM_ENTER_DELAY + index * BOOM_ENTER_STAGGER;
      const baseRotation = noMovesLetterRotations[index] ?? 0;
      const baseScale = noMovesLetterScales[index] ?? 1;

      el.style.willChange = 'transform, opacity';
      el.style.transform = 'translateZ(0)';
      el.style.backfaceVisibility = 'hidden';
      el.style.webkitBackfaceVisibility = 'hidden';
      el.style.contain = 'layout style paint';

      gsap.set(el, {
        opacity: 0,
        scale: 0,
        x: 0,
        y: 0,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        force3D: true
      });

      const tl = trackTimeline({ delay });
      noMovesTimelinesRef.push(tl);
      tl.to(el, {
        opacity: 1,
        scale: baseScale * ENTER_BOUNCE_SCALE,
        rotation: baseRotation,
        rotationX: -5,
        rotationY: 0,
        z: 20,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: ENTER_DURATION + BOOM_ENTER_EXTRA * 0.6,
        ease: 'back.out(2.0)'
      });
      tl.to(el, {
        scale: baseScale * 0.95,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
        ease: 'power2.out'
      });
      tl.to(el, {
        opacity: 1,
        scale: baseScale,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        x: 0,
        y: 0,
        transformOrigin: 'center center',
        duration: FINAL_SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
        ease: 'back.out(1.5)',
        onComplete: () => {
          try { bounceTimelines[index]?.play(0); } catch {}
          enterComplete += 1;
        }
      });
    });
  } catch (e) {
    console.warn('⚠️ showNoMovesText failed:', e);
    cleanupNoMovesOverlay();
  }
}

export function clearNoMovesText(): void {
  cleanupNoMovesOverlay();
}

/**
 * Play exit animation on NO MOVES text, then remove. Returns Promise that resolves when done.
 * Call after 1.5s wait, before showFinalScreen().
 */
export function exitNoMovesText(): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = () => {
      if (resolved) return;
      resolved = true;
      cleanupNoMovesOverlay();
      resolve();
    };

    if (!noMovesOverlay || !noMovesOverlay.isConnected) {
      safeResolve();
      return;
    }
    const container = noMovesOverlay.querySelector('div');
    if (!container || container.children.length === 0) {
      safeResolve();
      return;
    }
    const letters = ['N', 'O', ' ', 'M', 'O', 'V', 'E', 'S'];
    noMovesBounceTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    noMovesBounceTimelinesRef.length = 0;
    noMovesTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    noMovesTimelinesRef.length = 0;

    letters.forEach((_, index) => {
      const el = container.children[index] as HTMLElement;
      if (!el) return;
      const delay = index * BOOM_EXIT_STAGGER;
      const tl = trackTimeline({ delay });
      noMovesTimelinesRef.push(tl);
      const baseScale = noMovesLetterScales[index] ?? 1;
      const baseRot = noMovesLetterRotations[index] ?? 0;
      const exitRotation = (baseRot >= 0 ? 1 : -1) * (12 + Math.random() * 8);
      tl.to(el, {
        scale: baseScale * 1.1,
        z: 30,
        duration: EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2,
        ease: 'power2.out'
      });
      tl.to(el, {
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
    const exitTotal =
      BOOM_EXIT_STAGGER * (letters.length - 1) +
      EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2 +
      EXIT_FADE_DURATION + BOOM_EXIT_EXTRA * 0.8 +
      0.05;

    // Fallback: even if GSAP delayedCall gets killed by global cleanup, never hang fail flow.
    const fallbackMs = Math.max(250, Math.ceil(exitTotal * 1000) + 120);
    const fallbackTimer = setTimeout(() => {
      safeResolve();
    }, fallbackMs);

    trackDelayedCall(exitTotal, () => {
      try { clearTimeout(fallbackTimer); } catch {}
      safeResolve();
    });
  });
}
