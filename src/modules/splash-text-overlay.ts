// @ts-nocheck
// Splash text overlay – SWOOP (magnet merge 6)
// Same enter/exit as TNT BOOM, white color

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { attachPuffyClouds } from './text-clouds.js';
import { attachSmallStarCenterBurst } from './text-sparkles.js';
import { attachBoltSprites } from './text-bolts.js';
import { attachBottleFinaleScene } from './bottle-finale-scene.js';
import { setWildFxDragLock, startWildFxDragLockForAnimation } from './wild-fx-drag-lock.ts';

const trackTimeline = (opts?: any) => animationManager.trackExternalTimeline(gsap.timeline(opts));
const trackDelayedCall = (...args: any[]) => animationManager.trackExternalTween(gsap.delayedCall(...args));
const killTrackedTimeline = (timeline?: gsap.core.Timeline | null) => animationManager.killExternalTimeline(timeline);
const killTrackedTween = (tween?: gsap.core.Tween | null) => animationManager.killExternalTween(tween);

let swoopOverlay: HTMLElement | null = null;
let swoopTimelinesRef: gsap.core.Timeline[] = [];
let swoopBounceTimelinesRef: gsap.core.Timeline[] = [];
let swoopDelayedCallsRef: gsap.core.Tween[] = [];
let swoopFxCleanup: (() => void) | null = null;
let magneticTextActive = false;
let magneticTextWaiters: Array<() => void> = [];
let magneticRunId = 0;
let sparkleOverlay: HTMLElement | null = null;
let sparkleTimelinesRef: gsap.core.Timeline[] = [];
let sparkleBounceTimelinesRef: gsap.core.Timeline[] = [];
let sparkleDelayedCallsRef: gsap.core.Tween[] = [];
let sparkleFxCleanup: (() => void) | null = null;
let sparkleTextActive = false;
let sparkleTextWaiters: Array<() => void> = [];
let noMovesOverlay: HTMLElement | null = null;
let noMovesTimelinesRef: gsap.core.Timeline[] = [];
let noMovesBounceTimelinesRef: gsap.core.Timeline[] = [];
let noMovesDelayedCallsRef: gsap.core.Tween[] = [];
let noMovesLetterScales: number[] = [];
let noMovesLetterRotations: number[] = [];
let noMovesCloudCleanup: (() => void) | null = null;
let noMovesExitPromise: Promise<void> | null = null;
let noMovesExiting = false;

function resolveMagneticTextWaiters(): void {
  if (!magneticTextWaiters.length) return;
  const waiters = magneticTextWaiters;
  magneticTextWaiters = [];
  waiters.forEach((resolve) => {
    try { resolve(); } catch {}
  });
}

function resolveSparkleTextWaiters(): void {
  if (!sparkleTextWaiters.length) return;
  const waiters = sparkleTextWaiters;
  sparkleTextWaiters = [];
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
const SPARKLE_LATE_HAPTIC_COUNT = 6;
const SPARKLE_LATE_HAPTIC_START = 1.0;
const SPARKLE_LATE_HAPTIC_INTERVAL = 0.11;
function createRandomTextLetterSizes(count: number): number[] {
  const large = [92, 98, 104];
  const medium = [66, 72, 80];
  const small = [30, 36, 44, 50];
  const buckets = [large, medium, small, medium, large, small, medium, small, large];
  const offset = Math.floor(Math.random() * buckets.length);
  return Array.from({ length: count }, (_, index) => {
    const bucket = buckets[(index + offset) % buckets.length];
    const base = bucket[Math.floor(Math.random() * bucket.length)];
    const size = Math.max(28, base + (Math.random() * 10 - 5));
    return index === 0 ? Math.max(75, size) : size;
  });
}

function triggerSparkleHapticTrain(): void {
  try {
    if (typeof (window as any).triggerHapticImpact !== 'function') return;
    for (let i = 0; i < SPARKLE_HAPTIC_COUNT; i++) {
      const call = trackDelayedCall(i * SPARKLE_HAPTIC_INTERVAL, () => {
        try { (window as any).triggerHapticImpact?.('light'); } catch {}
      });
      sparkleDelayedCallsRef.push(call);
    }
    for (let i = 0; i < SPARKLE_LATE_HAPTIC_COUNT; i++) {
      const call = trackDelayedCall(SPARKLE_LATE_HAPTIC_START + i * SPARKLE_LATE_HAPTIC_INTERVAL, () => {
        try { (window as any).triggerHapticImpact?.('light'); } catch {}
      });
      sparkleDelayedCallsRef.push(call);
    }
  } catch {}
}

function cleanupBuzzzOverlay(expectedRunId?: number): void {
  if (typeof expectedRunId === 'number' && expectedRunId !== magneticRunId) return;
  try {
    swoopDelayedCallsRef.forEach((dc) => {
      killTrackedTween(dc);
    });
    swoopDelayedCallsRef = [];
    swoopBounceTimelinesRef.forEach((tl) => {
      killTrackedTimeline(tl);
    });
    swoopBounceTimelinesRef = [];
    swoopTimelinesRef.forEach((tl) => {
      killTrackedTimeline(tl);
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
    setWildFxDragLock('magnetic-text', false);
    resolveMagneticTextWaiters();
  } catch {}
}

/**
 * Show SWOOP text overlay (magnet merge 6)
 * Same enter/exit as TNT BOOM, white color
 */
export function showMagneticText(options: any = {}): void {
  let runId = 0;
  try {
    cleanupBuzzzOverlay();
    runId = ++magneticRunId;
    magneticTextActive = true;
    startWildFxDragLockForAnimation('magnetic-text', 3600, options?.inputReleaseAtRatio ?? 0.25);

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
    // Bottle keeps Magnet gameplay but explicitly reuses the exact Cubero
    // artwork-flight owner. Other Magnet variants retain their bolt/bee owner.
    const usesBottleOceanScene = options?.finaleScene === 'bottle-ocean';
    const usesCuberoFlight = options?.burstMotion?.cuberoFlight === true;
    const particleStartedAt = performance.now();
    const particleCleanup = usesBottleOceanScene
      ? attachBottleFinaleScene(overlay, 1, BOOM_ENTER_DELAY)
      : usesCuberoFlight
      ? attachSmallStarCenterBurst(overlay, {
          count: Number(options?.burstMotion?.count) || 14,
          zIndex: 1,
          sources: options?.burstSources,
          motion: options?.burstMotion,
        })
      : attachBoltSprites(overlay, {
          count: Number(options?.burstMotion?.count) || 16,
          zIndex: 1,
          sources: options?.burstSources,
          motion: options?.burstMotion,
        });
    swoopFxCleanup = () => {
      try { particleCleanup?.(); } catch {}
    };
    (swoopFxCleanup as any).startExit = () => {
      try { (particleCleanup as any)?.startExit?.(); } catch {}
    };
    const particleCompletionDelaySeconds = Number((particleCleanup as any)?.completionDelaySeconds) || 0;

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
      'gap: 0',
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

    const letters = Array.from(String(options?.text || 'SWOOP'));
    const letterFontSizes = createRandomTextLetterSizes(letters.length);
    const letterScales: number[] = [];
    const letterRotations: number[] = [];
    const swoopBounceTimelines: gsap.core.Timeline[] = [];

    letters.forEach((letter, index) => {
      const letterScale = 1;
      const letterFontSize = letterFontSizes[index];
      const rotation = 0;
      const el = document.createElement('span');
      el.textContent = letter;
      const splitIndex = Number.isFinite(options?.splitIndex) ? Number(options.splitIndex) : -1;
      const lightColor = options?.colors?.[0] || options?.color || '#FF9472';
      const darkColor = options?.colors?.[1] || options?.color || lightColor;
      const isSplitLetter = index === Math.floor(splitIndex) && splitIndex % 1 !== 0;
      const letterColor = index < splitIndex ? lightColor : darkColor;
      el.style.cssText = [
        'font-family: "Baloo2", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        `font-size: ${letterFontSize.toFixed(1)}px`,
        'line-height: 1',
        `color: ${letterColor}`,
        `-webkit-text-fill-color: ${isSplitLetter ? 'transparent' : letterColor}`,
        isSplitLetter ? `background: linear-gradient(90deg, ${lightColor} 0 50%, ${darkColor} 50% 100%)` : 'background: none',
        isSplitLetter ? '-webkit-background-clip: text' : '-webkit-background-clip: border-box',
        isSplitLetter ? 'background-clip: text' : 'background-clip: border-box',
        'text-align: center',
        'opacity: 0',
        'transform: scale(0) perspective(1000px) translateZ(0)',
        'display: inline-block',
        'visibility: visible',
        'pointer-events: none',
        'margin-right: 0',
        index === 0 ? 'margin-left: 0' : 'margin-left: -4.2px',
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
      if (runId !== magneticRunId) return;
      if (exitStarted) return;
      exitStarted = true;
      try { (particleCleanup as any)?.startExit?.(); } catch {}
      swoopBounceTimelines.forEach((tl) => {
        killTrackedTimeline(tl);
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
      // Honey exits in eight uneven pairs; leave enough lifecycle tail for the
      // final pair to complete its own edge bounce-out before pooled cleanup.
      const beeFlightTail = options?.burstMotion?.beeFlight === true ? 0.9 : 0;
      const particleElapsedSeconds = Math.max(0, (performance.now() - particleStartedAt) / 1000);
      const particleRemainingSeconds = Math.max(0, particleCompletionDelaySeconds - particleElapsedSeconds);
      const cleanupDelay = Math.max(exitTotal + beeFlightTail, particleRemainingSeconds + 0.05);
      const exitCleanupCall = trackDelayedCall(cleanupDelay, () => cleanupBuzzzOverlay(runId));
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
          if (runId !== magneticRunId) return;
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
    cleanupBuzzzOverlay(runId || undefined);
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
    let timeoutId: number | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      magneticTextWaiters = magneticTextWaiters.filter((fn) => fn !== finish);
      resolve();
    };
    magneticTextWaiters.push(finish);
    // Failsafe: never block flow if animation is interrupted.
    try {
      timeoutId = window.setTimeout(finish, timeoutMs);
    } catch {
      finish();
    }
  });
}

function cleanupSparkleOverlay(): void {
  try {
    sparkleDelayedCallsRef.forEach((dc) => {
      killTrackedTween(dc);
    });
    sparkleDelayedCallsRef = [];
    sparkleBounceTimelinesRef.forEach((tl) => {
      killTrackedTimeline(tl);
    });
    sparkleBounceTimelinesRef = [];
    sparkleTimelinesRef.forEach((tl) => {
      killTrackedTimeline(tl);
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
    setWildFxDragLock('sparkle-text', false);
    resolveSparkleTextWaiters();
  } catch {}
}

/**
 * Show SPARKLE text overlay for wild-star merge 6.
 * Uses the same enter/exit style as BUBBLY, but in yellow.
 */
export function showSparkleText(origin?: { x: number; y: number } | null, options: any = {}): void {
  try {
    cleanupSparkleOverlay();
    sparkleTextActive = true;
    startWildFxDragLockForAnimation('sparkle-text', 3600, options?.inputReleaseAtRatio ?? 0.25);
    const sparkleText = String(options?.text || 'SPARKLE');
    const sparkleColor = String(options?.color || '#FFCB81');

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
    const smallStarBurstCleanup = attachSmallStarCenterBurst(overlay, {
      count: options?.burstMotion?.count ?? 26,
      zIndex: 2,
      origin,
      sources: options?.burstSources,
      motion: options?.burstMotion,
    });
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
      'gap: 0',
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

    const letters = Array.from(sparkleText);
    const letterFontSizes = createRandomTextLetterSizes(letters.length);
    const letterScales: number[] = [];
    const letterRotations: number[] = [];
    const bounceTimelines: gsap.core.Timeline[] = [];

    letters.forEach((letter, index) => {
      const letterScale = 1;
      const letterFontSize = letterFontSizes[index];
      const rotation = 0;
      const el = document.createElement('span');
      el.textContent = letter;
      el.style.cssText = [
        'font-family: "Baloo2", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        `font-size: ${letterFontSize.toFixed(1)}px`,
        'line-height: 1',
        `color: ${sparkleColor}`,
        `-webkit-text-fill-color: ${sparkleColor}`,
        'text-align: center',
        'opacity: 0',
        'transform: scale(0) perspective(1000px) translateZ(0)',
        'display: inline-block',
        'visibility: visible',
        'pointer-events: none',
        'margin-right: 0',
        index === 0 ? 'margin-left: 0' : 'margin-left: -4.2px',
        'padding: 0',
        'border: 0',
        'outline: 0',
        'vertical-align: top',
        'text-shadow: none',
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
        killTrackedTimeline(tl);
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

export function waitForSparkleTextComplete(timeoutMs = 2200): Promise<void> {
  if (!sparkleTextActive) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    let timeoutId: number | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      sparkleTextWaiters = sparkleTextWaiters.filter((fn) => fn !== finish);
      resolve();
    };
    sparkleTextWaiters.push(finish);
    try {
      timeoutId = window.setTimeout(finish, timeoutMs);
    } catch {
      finish();
    }
  });
}

function cleanupNoMovesOverlay(): void {
  try {
    noMovesBounceTimelinesRef.forEach((tl) => {
      killTrackedTimeline(tl);
    });
    noMovesBounceTimelinesRef.length = 0;
    noMovesDelayedCallsRef.forEach((dc) => {
      killTrackedTween(dc);
    });
    noMovesDelayedCallsRef.length = 0;
    noMovesTimelinesRef.forEach((tl) => {
      killTrackedTimeline(tl);
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
    document.querySelectorAll('.cc-no-moves-overlay').forEach((overlay) => {
      try {
        gsap.killTweensOf(overlay);
        overlay.querySelectorAll('*').forEach((el) => {
          try { gsap.killTweensOf(el); } catch {}
        });
        overlay.remove();
      } catch {}
    });
    noMovesOverlay = null;
    noMovesExitPromise = null;
    noMovesExiting = false;
  } catch {}
}

/**
 * Show "No Moves" text overlay during end-game wait (1.5s before fail screen).
 * Same enter animation as STACK IT! / SWOOP. Stays visible until clearNoMovesText().
 */
export function showNoMovesText(): void {
  try {
    if (noMovesOverlay?.isConnected || noMovesExiting) {
      return;
    }
    cleanupNoMovesOverlay();
    noMovesExitPromise = null;
    noMovesExiting = false;

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
    overlay.className = 'cc-no-moves-overlay';
    noMovesOverlay = overlay;

    const container = document.createElement('div');
    container.className = 'cc-no-moves-text';
    container.style.cssText = [
      'position: absolute',
      'left: 50%',
      'top: 50%',
      'transform: translate(-50%, -50%)',
      'display: flex',
      'flex-direction: row',
      'align-items: center',
      'justify-content: center',
      'gap: 0',
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

    const letters = ['N', 'o', ' ', 'M', 'o', 'v', 'e', 's'];
    const letterFontSizes = createRandomTextLetterSizes(letters.length);
    noMovesLetterScales = [];
    noMovesLetterRotations = [];
    const bounceTimelines: gsap.core.Timeline[] = [];

    letters.forEach((ch, index) => {
      const letterScale = 1;
      const letterFontSize = ch === ' ' ? 64 : letterFontSizes[index];
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
      const textAlpha = 0.8 + Math.random() * 0.2;
      const textColor = `rgba(231,116,73,${textAlpha.toFixed(2)})`;
      el.style.cssText = [
        'font-family: "Baloo2", system-ui, -apple-system, sans-serif',
        'font-weight: 800',
        `font-size: ${letterFontSize.toFixed(1)}px`,
        'line-height: 1',
        `color: ${textColor}`,
        'text-align: center',
        'opacity: 0',
        'transform: scale(0) perspective(1000px) translateZ(0)',
        'display: inline-block',
        'visibility: visible',
        'pointer-events: none',
        'margin-right: 0',
        index === 0 ? 'margin-left: 0' : 'margin-left: -4.2px',
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
    let textEnterStarted = false;
    const startTextEnter = () => {
      if (textEnterStarted || !noMovesOverlay || !noMovesOverlay.isConnected) return;
      textEnterStarted = true;
      letters.forEach((_, index) => {
        const el = container.children[index] as HTMLElement;
        if (!el) return;
        const delay = index * BOOM_ENTER_STAGGER;
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
    };

    noMovesCloudCleanup = attachPuffyClouds(overlay, {
      count: 5,
      zIndex: 1,
      autoExit: true,
      floatBounce: false,
      timingScale: 0.38,
    } as any);
    const textEnterCall = trackDelayedCall(0.2, startTextEnter);
    noMovesDelayedCallsRef.push(textEnterCall);
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
  if (noMovesExitPromise) {
    return noMovesExitPromise;
  }
  noMovesExiting = true;
  noMovesExitPromise = new Promise((resolve) => {
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
    const container = noMovesOverlay.querySelector('.cc-no-moves-text') as HTMLElement | null;
    if (!container || container.children.length === 0) {
      safeResolve();
      return;
    }
    const letters = ['N', 'O', ' ', 'M', 'O', 'V', 'E', 'S'];
    noMovesBounceTimelinesRef.forEach((tl) => {
      killTrackedTimeline(tl);
    });
    noMovesBounceTimelinesRef.length = 0;
    noMovesDelayedCallsRef.forEach((dc) => {
      killTrackedTween(dc);
    });
    noMovesDelayedCallsRef.length = 0;
    noMovesTimelinesRef.forEach((tl) => {
      killTrackedTimeline(tl);
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

      el.style.willChange = 'transform, opacity';
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
  return noMovesExitPromise;
}
