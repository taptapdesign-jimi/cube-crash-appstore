// TNT Animation – Explosion Pack merge-6 sprite sequence
// Anchor na kockici merge 6; prati board shake; bez stanke na tnt6; slide + bounce

import { gsap } from 'gsap';
import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import animationManager from './animation-manager.js';
import { logger } from '../core/logger.js';
import { domElementPool } from './dom-element-pool.js';

const BASE = './assets/shop/explosion pack/animation/';
const TNT_ANIM_FRAMES_1X: string[] = [
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
const TNT_ANIM_FRAMES_2X: string[] = [
  `${BASE}tnt1@2x.png`,
  `${BASE}tnt2@2x.png`,
  `${BASE}tnt3@2x.png`,
  `${BASE}tnt4@2x.png`,
  `${BASE}tnt5@2x.png`,
  `${BASE}tnt6@2x.png`,
  `${BASE}tnt7@2x.png`,
  `${BASE}tnt8@2x.png`,
  `${BASE}tnt9@2x.png`,
  `${BASE}tnt10@2x.png`,
  `${BASE}tnt11@2x.png`,
  `${BASE}tnt12@2x.png`,
];
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const TNT_ANIM_FRAMES_FALLBACK: string[] = TNT_ANIM_FRAMES_1X;
export const TNT_ANIM_FRAMES: string[] = isMobile ? TNT_ANIM_FRAMES_2X : TNT_ANIM_FRAMES_FALLBACK;

let preloadPromise: Promise<void> | null = null;

export function preloadTntFrames(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const uniqueFrames = Array.from(new Set([...TNT_ANIM_FRAMES, ...TNT_ANIM_FRAMES_FALLBACK]));
  preloadPromise = (async () => {
    try {
      await Assets.load(uniqueFrames);
      return;
    } catch {}
    // Fallback preload path (without persistent cache map)
    await new Promise<void>((resolve) => {
      let idx = 0;
      const img = new Image();
      const loadNext = () => {
        if (idx >= uniqueFrames.length) {
          resolve();
          return;
        }
        const src = uniqueFrames[idx++];
        let doneCalled = false;
        const done = () => {
          if (doneCalled) return;
          doneCalled = true;
          img.onload = null;
          img.onerror = null;
          loadNext();
        };
        img.onload = done;
        img.onerror = done;
        img.src = src;
        if (img.complete) done();
      };
      loadNext();
    });
  })();
  return preloadPromise;
}

let isActive = false;
let overlay: HTMLElement | null = null;
let timeline: gsap.core.Timeline | null = null;
let extraTimelines: gsap.core.Timeline[] = [];
let spriteBounceTweensRef: gsap.core.Tween[] = [];
let boomBounceTimelinesRef: gsap.core.Timeline[] = [];
let memSampleCallsRef: gsap.core.Tween[] = [];
let pixiFrameContainer: Container | null = null;
let activeFrameSprites: Sprite[] = [];
let activeFrameImages: HTMLImageElement[] = [];
let activeFrameWrappers: HTMLElement[] = [];
let dragBlockTimeout: gsap.core.Tween | null = null;
let boomExitListeners: Array<() => void> = [];
let tntCompleteListeners: Array<() => void> = [];
let didComplete = false;
let cleanupInProgress = false;
let lastTntStartMs = 0;
const TNT_DEBOUNCE_MS = 200;
const TNT_STUCK_RESET_MS = 1500;
const MAX_TNT_SPRITE_POOL = 24;
let pooledFrameSprites: Sprite[] = [];
let pooledFrameContainer: Container | null = null;

const trackTimeline = (opts?: gsap.TimelineVars) => animationManager.trackExternalTimeline(gsap.timeline(opts));
const trackDelayedCall = (...args: Parameters<typeof gsap.delayedCall>) =>
  animationManager.trackExternalTween(gsap.delayedCall(...args));
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
let memorySpikeTrackerPromise: Promise<any | null> | null = null;
function loadMemorySpikeTracker(): Promise<any | null> {
  if (!memorySpikeTrackerPromise) {
    memorySpikeTrackerPromise = import('../utils/memory-spike-tracker.js').catch(() => null);
  }
  return memorySpikeTrackerPromise;
}
function tntMemInit(): void {
  void loadMemorySpikeTracker().then((mod) => {
    try {
      mod?.initMemorySpikeTracker?.();
      mod?.sampleMemorySpike?.('tnt_0_start');
    } catch {}
  });
}
function tntMemSample(label: string): void {
  void loadMemorySpikeTracker().then((mod) => {
    try { mod?.sampleMemorySpike?.(label); } catch {}
  });
}
function tntMemReport(): void {
  void loadMemorySpikeTracker().then((mod) => {
    try { mod?.reportBiggestMemorySpike?.(); } catch {}
  });
}

function getAppStage(): any {
  try {
    const w = (window as any);
    const state = w?.STATE || null;
    const app = state?.app || null;
    const appStage = app?.stage || null;
    const stateStage = state?.stage || null;
    if (appStage && !appStage.destroyed) return appStage;
    if (stateStage && !stateStage.destroyed) return stateStage;
  } catch {}
  return null;
}

function getViewportCenter(): { x: number; y: number } {
  try {
    const w = window as any;
    const app = w?.STATE?.app || null;
    const screen = app?.renderer?.screen || null;
    const width = Number(screen?.width) || Number(app?.renderer?.width) || window.innerWidth || 0;
    const height = Number(screen?.height) || Number(app?.renderer?.height) || window.innerHeight || 0;
    return { x: width * 0.5, y: height * 0.5 };
  } catch {}
  return { x: (window.innerWidth || 0) * 0.5, y: (window.innerHeight || 0) * 0.5 };
}

function getTntPixiHost(): any {
  const stage = getAppStage();
  if (!stage || stage.destroyed) return null;
  const w = window as any;
  let host = w.__ccTntFxLayer || null;
  const needsNew = !host || host.destroyed || host.parent !== stage;
  if (needsNew) {
    try {
      host = new Container();
      host.label = '__ccTntFxLayer';
      host.zIndex = 999998;
      host.eventMode = 'none';
      host.visible = true;
      host.alpha = 1;
      host.renderable = true;
      try { host.interactiveChildren = false; } catch {}
      if (stage.sortableChildren !== undefined) stage.sortableChildren = true;
      stage.addChild(host);
      stage.sortChildren?.();
      w.__ccTntFxLayer = host;
    } catch {
      return null;
    }
  } else {
    try {
      host.visible = true;
      host.alpha = 1;
      host.renderable = true;
      host.position.set(0, 0);
      host.scale.set(1, 1);
      host.rotation = 0;
      host.pivot?.set?.(0, 0);
    } catch {}
  }
  return host;
}

function isRenderableTexture(tex: Texture | null | undefined): tex is Texture {
  if (!tex || (tex as any).destroyed) return false;
  try {
    const anyTex: any = tex as any;
    const source = anyTex.source ?? anyTex.baseTexture ?? null;
    if (!source || source.destroyed) return false;
    // Some crashes came from null style/source during bind (addressModeU path).
    if (source.style == null && source.resource == null) return false;
    return true;
  } catch {
    return false;
  }
}

function acquireFrameSprite(tex: Texture, zIndex: number, x: number, y: number): Sprite {
  const sprite = pooledFrameSprites.pop() ?? new Sprite(tex);
  try {
    sprite.texture = tex;
    sprite.anchor.set(0.5);
    sprite.x = x;
    sprite.y = y;
    sprite.alpha = 0;
    sprite.visible = true;
    sprite.renderable = true;
    sprite.eventMode = 'none';
    sprite.zIndex = zIndex;
    sprite.rotation = 0;
    sprite.scale.set(0, 0);
  } catch {}
  return sprite;
}

function releaseFrameSprite(sprite: Sprite): void {
  if (!sprite || (sprite as any).destroyed) return;
  try {
    gsap.killTweensOf(sprite);
    gsap.killTweensOf(sprite.scale);
    if (sprite.parent) sprite.parent.removeChild(sprite);
    sprite.alpha = 0;
    sprite.visible = false;
    sprite.renderable = false;
    sprite.rotation = 0;
    sprite.scale.set(1, 1);
    sprite.x = 0;
    sprite.y = 0;
    if (pooledFrameSprites.length < MAX_TNT_SPRITE_POOL) {
      pooledFrameSprites.push(sprite);
    } else {
      sprite.destroy();
    }
  } catch {}
}

function cleanup(): void {
  if (cleanupInProgress) return;
  cleanupInProgress = true;
  tntMemSample('tnt_3_cleanup_start');
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
    memSampleCallsRef.forEach((t) => {
      try { t.kill(); } catch {}
    });
    memSampleCallsRef = [];
    boomBounceTimelinesRef.forEach((tl) => {
      try { tl.kill(); } catch {}
    });
    boomBounceTimelinesRef = [];
    if (dragBlockTimeout) {
      try { dragBlockTimeout.kill(); } catch {}
      dragBlockTimeout = null;
    }
    boomExitListeners = [];
    if (didComplete) {
      try {
        tntCompleteListeners.forEach((fn) => {
          try { fn(); } catch {}
        });
      } catch {}
    }
    tntCompleteListeners = [];
    didComplete = false;
    activeFrameSprites.forEach((sp) => {
      releaseFrameSprite(sp);
    });
    activeFrameSprites = [];
    if (pixiFrameContainer) {
      try {
        gsap.killTweensOf(pixiFrameContainer);
        if (pixiFrameContainer.parent) pixiFrameContainer.parent.removeChild(pixiFrameContainer);
        pixiFrameContainer.removeChildren();
        if (!pixiFrameContainer.destroyed) {
          pooledFrameContainer = pixiFrameContainer;
        } else {
          pooledFrameContainer = null;
        }
      } catch {}
      pixiFrameContainer = null;
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
  } finally {
    cleanupInProgress = false;
    tntMemSample('tnt_4_cleanup_end');
    tntMemReport();
  }
}

export function isTntAnimationActive(): boolean {
  return isActive;
}

export function onTntBoomExitComplete(cb: () => void): void {
  if (!cb) return;
  boomExitListeners.push(cb);
}

export function onTntAnimationComplete(cb: () => void): void {
  if (!cb) return;
  tntCompleteListeners.push(cb);
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
const MAX_TEXT_CONTAINER_TILT_DEG = 15;

/**
 * Play TNT explosion (tnt1..tnt12). Sve u centru viewporta.
 * Nema anchor na merge 6 – strukturna animacija u centru ekrana.
 */
export function showTntAnimation(options: {
  onComplete?: () => void;
  onBoomExitStart?: () => void;
  onSprite6Start?: () => void;
  onSprite10ExitStart?: () => void;
  onSprite10ExitLeadStart?: () => void;
  onSpriteSequenceComplete?: () => void;
  onNinthSpriteStart?: () => void;
} = {}): HTMLElement | null {
  tntMemInit();
  const now = Date.now();
  // Safety: if previous animation got stuck, force cleanup after a grace window
  if (isActive && now - lastTntStartMs > TNT_STUCK_RESET_MS) {
    cleanup();
  }
  if (isActive || now - lastTntStartMs < TNT_DEBOUNCE_MS) {
    return null;
  }
  lastTntStartMs = now;

  isActive = true;
  try {
    (window as any).__ccTntAnimationActive = true;
    (window as any).__ccTntDragBlocked = true;
  } catch {}
  const { onComplete, onBoomExitStart, onSprite6Start, onSprite10ExitStart, onSprite10ExitLeadStart, onSpriteSequenceComplete, onNinthSpriteStart } = options;

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

  // PIXI layered frame stack (12 sprites, slika-na-sliku efekt)
  const pixiHost = getTntPixiHost();
  const { x: centerX, y: centerY } = getViewportCenter();
  const frameEls: Sprite[] = [];
  if (pixiHost) {
    const reused = pooledFrameContainer && !pooledFrameContainer.destroyed ? pooledFrameContainer : null;
    pooledFrameContainer = null;
    pixiFrameContainer = reused ?? new Container();
    pixiFrameContainer.label = 'tnt-animation-frames';
    pixiFrameContainer.zIndex = 999998;
    pixiFrameContainer.eventMode = 'none';
    pixiFrameContainer.visible = true;
    pixiFrameContainer.alpha = 1;
    pixiFrameContainer.renderable = true;
    pixiFrameContainer.removeChildren();
    try { pixiFrameContainer.interactiveChildren = false; } catch {}
    pixiHost.addChild(pixiFrameContainer);
    pixiHost.sortChildren?.();

    for (let i = 0; i < NUM_FRAMES; i++) {
      const frameSrc = TNT_ANIM_FRAMES[i] || TNT_ANIM_FRAMES_FALLBACK[i] || TNT_ANIM_FRAMES_FALLBACK[0];
      const tex = (Assets.get(frameSrc) as Texture | undefined) || (Assets.get(TNT_ANIM_FRAMES_FALLBACK[i] || TNT_ANIM_FRAMES_FALLBACK[0]) as Texture | undefined);
      if (!isRenderableTexture(tex)) continue;
      const frameEl = acquireFrameSprite(tex, i, centerX, centerY);
      pixiFrameContainer.addChild(frameEl);
      frameEls.push(frameEl);
      activeFrameSprites.push(frameEl);
    }
    tntMemSample('tnt_1_frames_created');
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
  boomContainer.style.transform = `translate(-50%, -50%) rotate(${containerTilt}deg)`;

  const boomLetters: HTMLElement[] = [];
  const boomLetterScales: number[] = [];
  const boomLetterRotations: number[] = [];
  const boomBounceTimelines: gsap.core.Timeline[] = [];
  const boomText = ['B', 'O', 'O', 'M'];
  const boomFontSizes = createRandomTextLetterSizes(boomText.length);
  boomText.forEach((letter, idx) => {
    const letterScale = 1;
    const letterFontSize = boomFontSizes[idx];
    const rotation = 0; // tilt is now applied to whole BOOM container
    const letterEl = document.createElement('span');
    letterEl.textContent = letter;
    letterEl.style.cssText = [
      'font-family: "Baloo2", system-ui, -apple-system, sans-serif',
      'font-weight: 800',
      `font-size: ${letterFontSize.toFixed(1)}px`,
      'line-height: 1',
      'color: #F18453',
      '-webkit-text-fill-color: #F18453',
      'text-align: center',
      'opacity: 0',
      'transform: scale(0) perspective(1000px) translateZ(0)',
      'display: inline-block',
      'visibility: visible',
      'pointer-events: none',
      'margin-right: 0',
      idx === 0 ? 'margin-left: 0' : 'margin-left: -4.2px',
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

  overlay.appendChild(boomContainer);
  document.body.appendChild(overlay);

  // Master timeline for cleanup
  timeline = trackTimeline({
    onComplete: () => {
      didComplete = true;
      cleanup();
      try { onComplete?.(); } catch {}
    },
    onKill: () => {
      cleanup();
    },
  });

  // Frame 6 timing helpers:
  // - enter end: used to start board blast right after sprite enter animation
  // - settle end: used for TNT internal hold/exit choreography
  const sprite5EnterEndTime = 0.07 + 5 * 0.04 + ENTER_DURATION;
  const sprite5SettleTime = sprite5EnterEndTime + SETTLE_DURATION;
  const exitStartTime = sprite5SettleTime + HOLD_AT_FRAME_6 + SPRITE_EXTRA_DURATION - 0.2;
  spriteBounceTweensRef = [];

  let sprite10ExitTriggered = false;
  let spriteSequenceCompleteTriggered = false;
  frameEls.forEach((frameEl, i) => {
    const randomRotation = (Math.random() - 0.5) * 20;
    const randomSize = 1 + Math.random() * 0.52;
    const enterDelay = 0.07 + i * 0.04;
    const dEnter = ENTER_DURATION;
    const dSettle = SETTLE_DURATION;
    const settleEndTime = enterDelay + dEnter + dSettle;
    const exitStaggerDelay = i * SPRITE_EXIT_STAGGER;
    const holdDuration = Math.max(0, exitStartTime + exitStaggerDelay - settleEndTime);
    const baseY = centerY;
    const rotRad = randomRotation * (Math.PI / 180);
    frameEl.x = centerX;
    frameEl.y = baseY;
    frameEl.scale.set(0, 0);
    frameEl.alpha = 0;
    frameEl.rotation = rotRad;

    const tl = trackTimeline({ delay: enterDelay });
    extraTimelines.push(tl);
    tl.to(frameEl, {
      alpha: 1,
      duration: dEnter,
      ease: 'back.out(2.0)'
    });
    tl.to(frameEl.scale, {
      x: randomSize * ENTER_BOUNCE_SCALE,
      y: randomSize * ENTER_BOUNCE_SCALE * VERTICAL_STRETCH,
      duration: dEnter,
      ease: 'back.out(2.0)'
    }, '<');
    tl.to(frameEl, {
      duration: dSettle,
      ease: 'power2.out'
    }, '>0');
    tl.to(frameEl.scale, {
      x: randomSize,
      y: randomSize * VERTICAL_STRETCH,
      duration: dSettle,
      ease: 'power2.out'
    }, '<');
    tl.call(() => {
      const bounceS = randomSize * (1.02 + Math.random() * 0.06);
      const bounce = gsap.to(frameEl, {
        y: baseY + (Math.random() - 0.5) * 4,
        duration: 0.4,
        ease: 'elastic.inOut(1, 0.25)',
        repeat: -1,
        yoyo: true
      });
      spriteBounceTweensRef.push(bounce);
      const bounceScale = gsap.to(frameEl.scale, {
        x: bounceS,
        y: bounceS * VERTICAL_STRETCH,
        duration: 0.4,
        ease: 'elastic.inOut(1, 0.25)',
        repeat: -1,
        yoyo: true
      });
      spriteBounceTweensRef.push(bounceScale);
    }, [], '+=0');
    tl.to({}, { duration: holdDuration }, '>0');
    tl.call(() => {
      if (i === 9 && !sprite10ExitTriggered) {
        sprite10ExitTriggered = true;
        try { onSprite10ExitStart?.(); } catch {}
      }
      try {
        gsap.killTweensOf(frameEl);
        gsap.killTweensOf(frameEl.scale);
      } catch {}
      const exitS = randomSize * EXIT_BOUNCE_SCALE;
      gsap.to(frameEl, {
        alpha: 1,
        duration: EXIT_BOUNCE_DURATION,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(frameEl.scale, {
            x: exitS,
            y: exitS * VERTICAL_STRETCH,
            duration: EXIT_BOUNCE_DURATION,
            ease: 'power2.out'
          });
          gsap.to(frameEl, {
            alpha: 0,
            duration: EXIT_FADE_DURATION,
            ease: 'back.in(2.0)',
            onComplete: () => {
              if (i === NUM_FRAMES - 1 && !spriteSequenceCompleteTriggered) {
                spriteSequenceCompleteTriggered = true;
                try { onSpriteSequenceComplete?.(); } catch {}
              }
            }
          });
          gsap.to(frameEl.scale, {
            x: 0,
            y: 0,
            duration: EXIT_FADE_DURATION,
            ease: 'back.in(2.0)'
          });
        }
      });
    }, [], '>0');
  });
  // Fire once when frame 6 enter animation is complete (no settle wait)
  let sprite6Triggered = false;
  timeline.call(() => {
    if (sprite6Triggered) return;
    sprite6Triggered = true;
    try { onSprite6Start?.(); } catch {}
  }, [], sprite5EnterEndTime);

  // Compatibility hook: around the 9th sprite start time (index 8): 0.07 + 8*0.04
  let ninthSpriteTriggered = false;
  timeline.call(() => {
    if (ninthSpriteTriggered) return;
    ninthSpriteTriggered = true;
    try { onNinthSpriteStart?.(); } catch {}
  }, [], 0.39);
  const sprite10ExitLeadTime = Math.max(0, exitStartTime + (9 * SPRITE_EXIT_STAGGER) - 0.3);
  let sprite10ExitLeadTriggered = false;
  timeline.call(() => {
    if (sprite10ExitLeadTriggered) return;
    sprite10ExitLeadTriggered = true;
    try { onSprite10ExitLeadStart?.(); } catch {}
  }, [], sprite10ExitLeadTime);
  tntMemSample('tnt_2_timelines_created');
  const peakSampleA = trackDelayedCall(0.25, () => tntMemSample('tnt_peak_a_250ms'));
  const peakSampleB = trackDelayedCall(0.75, () => tntMemSample('tnt_peak_b_750ms'));
  if (peakSampleA) memSampleCallsRef.push(peakSampleA as any);
  if (peakSampleB) memSampleCallsRef.push(peakSampleB as any);

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
        try {
          boomExitListeners.forEach((fn) => {
            try { fn(); } catch {}
          });
          boomExitListeners = [];
        } catch {}
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
