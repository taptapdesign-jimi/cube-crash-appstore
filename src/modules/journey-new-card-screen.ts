// @ts-nocheck
import { gsap } from 'gsap';
import { cleanupJourneySmokeEffects, smokeBubblesAtCard } from './journey-card-idle-bounce.js';
import { formatGameplayProgressLabel } from './gameplay-terminology.ts';
import { applyAppPaperSurfaceToElement } from '../utils/app-paper-background.js';
import {
  createJourneyNewCardTiltProfile,
  getJourneyNewCardDragTiltAngle,
  isJourneyNewCardCollectDrag,
  JOURNEY_NEW_CARD_DRAG_TAP_SLOP_PX,
} from './journey-new-card-tilt.js';
import { resolveJourneyCardAsset, type JourneyCardRarity } from './journey-card-assets.js';
import {
  getJourneyNewCardDisplayName,
  getJourneyNewCardRevealCopy,
  JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX,
  JOURNEY_NEW_CARD_INTERIM_SCALE,
  JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX,
  JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX,
  JOURNEY_NEW_CARD_UNLOCKED_SCALE,
  JOURNEY_NEW_CARD_UNLOCKED_SHADOW_Y_PX,
} from './journey-new-card-presentation.js';
import {
  applyJourneyInterimShineProfileVariables,
  clearJourneyInterimShineMask as clearLightMask,
  JOURNEY_INTERIM_CARD_SHINE_PROFILE,
  JOURNEY_INTERIM_GLOW_PULSE_CLASS,
  JOURNEY_INTERIM_SHINE_TRIGGER_CLASS,
  setJourneyInterimShineMask as setLightMask,
  setJourneyInterimShineMaskScale as setLightFrameScale,
  triggerJourneyInterimShinePulse,
} from './journey-interim-card-shine.js';
import {
  getJourneyCardLegendaryDragShineState,
  JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS,
  JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG,
} from './journey-card-overlay-modal.js';

type JourneyNewCardScreenOptions = {
  boardNumber: number;
  cardImagePath: string;
  cardName?: string;
  cardRarity: JourneyCardRarity;
};

let cleanupFns: Array<() => void> = [];
let activeTimelines: gsap.core.Timeline[] = [];

const JOURNEY_NEW_CARD_CONTINUE_COACH_INITIAL_DELAY_MS = 1000;
const JOURNEY_NEW_CARD_CONTINUE_COACH_REPEAT_DELAY_MS = 2000;
const JOURNEY_NEW_CARD_CONTINUE_COACH_DURATION_MS = 2100;

function renderContinueCoachLine(line: string): string {
  return `<span class="cc-journey-new-card-coach-line">${Array.from(line).map((letter, index) => (
    letter === ' '
      ? `<span class="cc-journey-new-card-coach-letter is-space" style="--cc-new-card-coach-letter:${index}">&nbsp;</span>`
      : `<span class="cc-journey-new-card-coach-letter" style="--cc-new-card-coach-letter:${index}">${letter}</span>`
  )).join('')}</span>`;
}

function trackNewCardTimeline(timeline: gsap.core.Timeline): gsap.core.Timeline {
  activeTimelines.push(timeline);
  return timeline;
}

function cleanupJourneyNewCardScreen(): void {
  activeTimelines.splice(0).forEach((timeline) => {
    try { timeline.kill(); } catch {}
  });
  cleanupFns.forEach((fn) => {
    try { fn(); } catch {}
  });
  cleanupFns = [];
  const existing = document.getElementById('cc-journey-new-card-overlay');
  if (existing) {
    try { gsap.killTweensOf([existing, ...Array.from(existing.querySelectorAll('*'))]); } catch {}
    try { existing.remove(); } catch {}
  }
  const style = document.getElementById('cc-journey-new-card-style');
  if (style) {
    try { style.remove(); } catch {}
  }
}

function ensureJourneyNewCardStyles(): void {
  if (document.getElementById('cc-journey-new-card-style')) return;
  const style = document.createElement('style');
  style.id = 'cc-journey-new-card-style';
  style.textContent = `
    #cc-journey-new-card-overlay {
      position: fixed;
      inset: 0;
      z-index: 1295000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      box-sizing: border-box;
      padding: clamp(84px, 13.5vh, 132px) 24px max(42px, env(safe-area-inset-bottom));
      font-family: "Baloo2", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      color: #b58a78;
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
      touch-action: manipulation;
    }
    .cc-journey-new-card-title {
      margin: 0;
      color: #ef744d;
      font-size: clamp(44px, 9.4vw, 64px);
      line-height: 0.95;
      font-weight: 900;
      letter-spacing: 0;
      text-align: center;
      position: relative;
      top: -16px;
      max-width: min(88vw, 520px);
      text-wrap: balance;
    }
    .cc-journey-new-card-subtitle {
      margin: 26px 0 0;
      color: #C4A896;
      font-size: clamp(23px, 5.1vw, 32px);
      line-height: 1.2;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-align: center;
      position: relative;
      top: -16px;
      max-width: min(88vw, 520px);
      text-wrap: balance;
    }
    .cc-journey-new-card-subtitle-card-name {
      color: #ef744d;
    }
    .cc-journey-new-card-content {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: clamp(20px, 4.2vh, 42px);
      margin-top: clamp(70px, 12.5vh, 116px);
    }
    .cc-journey-new-card-hero {
      position: relative;
      width: min(68vw, 380px);
      aspect-ratio: 310 / 458;
      display: grid;
      place-items: center;
      overflow: visible;
      cursor: pointer;
      transform-origin: 50% 50%;
      perspective: 1050px;
      -webkit-perspective: 1050px;
      -webkit-tap-highlight-color: transparent;
      touch-action: none;
      margin-top: -64px;
    }
    .cc-journey-new-card-shadow {
      position: absolute;
      left: 50%;
      bottom: calc(-5% - 36px);
      z-index: 0;
      width: 88%;
      height: 16%;
      transform: translateX(-50%);
      border-radius: 999px;
      background: radial-gradient(ellipse at center, rgba(185,105,62,0.34) 0%, rgba(185,105,62,0.2) 42%, rgba(185,105,62,0) 76%);
      filter: blur(14px);
      opacity: 0;
      pointer-events: none;
    }
    .cc-journey-new-card-motion {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      overflow: visible;
      animation: ccJourneyNewCardIdle 3s ease-in-out infinite;
      transform-origin: 50% 50%;
      transform-style: preserve-3d;
      -webkit-transform-style: preserve-3d;
      pointer-events: none;
    }
    .cc-journey-new-card-pose-shell {
      position: relative;
      grid-area: 1 / 1;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      transform-origin: 50% 50%;
      transform-style: preserve-3d;
      -webkit-transform-style: preserve-3d;
      pointer-events: none;
    }
    .cc-journey-new-card-surface {
      position: relative;
      grid-area: 1 / 1;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      transform-origin: 50% 50%;
      transform-style: preserve-3d;
      -webkit-transform-style: preserve-3d;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      will-change: transform;
    }
    .cc-journey-new-card-surface--interim {
      z-index: 1;
    }
    .cc-journey-new-card-surface--unlocked {
      z-index: 3;
      opacity: 0;
      visibility: hidden;
    }
    .cc-journey-new-card-auto-tilt-shell {
      position: relative;
      grid-area: 1 / 1;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      transform-origin: 50% 54%;
      transform-style: preserve-3d;
      -webkit-transform-style: preserve-3d;
      animation: ccJourneyNewCardAutoTilt 3s ease-in-out infinite both;
      animation-play-state: paused;
    }
    /* The revealed face is owned by WAAPI for both auto idle and live drag.
       A paused CSS animation still outranks inline transform in the cascade,
       so it must not remain a competing transform owner on this shell. */
    .cc-journey-new-card-auto-tilt-shell--unlocked {
      animation: none;
    }
    #cc-journey-new-card-overlay[data-card-rarity="legendary"]
      .cc-journey-new-card-legendary-holo {
      z-index: 5;
      display: block;
      border-radius: 0;
      -webkit-clip-path: inset(0);
      clip-path: inset(0);
    }
    #cc-journey-new-card-overlay.is-unlocked-auto-holo
      .cc-journey-new-card-legendary-holo {
      will-change: background-position, opacity;
    }
    .cc-journey-new-card-frame,
    .cc-journey-new-card-final {
      grid-area: 1 / 1;
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      position: relative;
      z-index: 1;
      border-radius: 38px;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
      filter: drop-shadow(0 12px 26px rgba(161, 91, 54, 0.22));
    }
    .cc-journey-new-card-final {
      opacity: 1;
      visibility: visible;
      z-index: 3;
      border-radius: 0;
      filter: none;
    }
    .cc-journey-new-card-light {
      position: absolute;
      inset: 0;
      z-index: 4;
      border-radius: 38px;
      overflow: hidden;
      pointer-events: none;
      opacity: 0.92;
      transform-origin: 50% 50%;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      -webkit-mask-type: alpha;
      mask-mode: alpha;
      -webkit-mask-position: center;
      mask-position: center;
      -webkit-mask-size: contain;
      mask-size: contain;
    }
    .cc-journey-new-card-continue-coach {
      position: absolute;
      inset: 0;
      z-index: 10;
      visibility: hidden;
      pointer-events: none;
    }
    .cc-journey-new-card-coach-hand {
      position: absolute;
      top: 56%;
      left: 50%;
      width: min(36vw, 168px);
      height: auto;
      opacity: 0;
      user-select: none;
      -webkit-user-drag: none;
      filter: drop-shadow(0 12px 16px rgba(132, 82, 63, 0.24));
      transform: translate3d(-50%, -28%, 80px) rotate(-8deg) scale(0.78);
    }
    .cc-journey-new-card-coach-copy {
      position: absolute;
      bottom: calc(34px + env(safe-area-inset-bottom, 0px));
      left: 50%;
      width: max-content;
      max-width: calc(100vw - 32px);
      color: #fff;
      font-family: "Baloo2", system-ui, -apple-system, sans-serif;
      font-size: 32px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -1.2px;
      text-align: center;
      text-shadow:
        0 3px 0 rgba(159, 105, 82, 0.34),
        0 8px 20px rgba(104, 67, 53, 0.22);
      transform: translateX(-50%);
    }
    .cc-journey-new-card-coach-line {
      display: flex;
      align-items: baseline;
      justify-content: center;
      white-space: nowrap;
    }
    .cc-journey-new-card-coach-letter {
      display: inline-block;
      opacity: 0;
      transform: translateY(10px) scale(0) rotate(-7deg);
      transform-origin: 50% 70%;
    }
    .cc-journey-new-card-coach-letter:nth-child(3n + 1) { font-size: 0.92em; }
    .cc-journey-new-card-coach-letter:nth-child(3n + 2) { font-size: 1.06em; }
    .cc-journey-new-card-coach-letter.is-space {
      width: 0.34em;
      font-size: 1em;
    }
    #cc-journey-new-card-overlay.is-continue-coach .cc-journey-new-card-continue-coach {
      visibility: visible;
    }
    #cc-journey-new-card-overlay.is-continue-coach .cc-journey-new-card-coach-letter {
      animation: ccJourneyNewCardCoachCopy 1.7s linear both;
      animation-delay: calc(var(--cc-new-card-coach-letter, 0) * 12ms);
    }
    @keyframes ccJourneyNewCardIdle {
      0%, 100% { transform: translateY(0px) scale(1); }
      50% { transform: translateY(-8px) scale(1.02); }
    }
    @keyframes ccJourneyNewCardAutoTilt {
      0%, 100% { transform: perspective(1050px) rotateX(0deg) rotateY(0deg) rotateZ(-0.45deg) translateZ(0); }
      28% { transform: perspective(1050px) rotateX(-2.3deg) rotateY(2.6deg) rotateZ(1.35deg) translateZ(5px); }
      58% { transform: perspective(1050px) rotateX(1.65deg) rotateY(-2.35deg) rotateZ(-1.15deg) translateZ(3px); }
      78% { transform: perspective(1050px) rotateX(-0.4deg) rotateY(0.7deg) rotateZ(0.3deg) translateZ(1px); }
    }
    @keyframes ccJourneyNewCardCoachCopy {
      0% {
        opacity: 0;
        transform: translateY(10px) scale(0) rotate(-7deg);
        animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      16% {
        opacity: 1;
        transform: translateY(-3px) scale(1.13) rotate(3deg);
      }
      24%, 72% {
        opacity: 1;
        transform: translateY(0) scale(1) rotate(0);
      }
      80% {
        opacity: 1;
        transform: translateY(-2px) scale(1.08) rotate(-2deg);
        animation-timing-function: cubic-bezier(0.55, 0.06, 0.68, 0.19);
      }
      100% {
        opacity: 0;
        transform: translateY(7px) scale(0) rotate(6deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .cc-journey-new-card-motion,
      .cc-journey-new-card-auto-tilt-shell {
        animation: none !important;
      }
      .cc-journey-new-card-continue-coach {
        display: none !important;
      }
    }
    @media (max-height: 760px) {
      #cc-journey-new-card-overlay {
        padding-top: 56px;
      }
      .cc-journey-new-card-content {
        gap: 18px;
        margin-top: 42px;
      }
      .cc-journey-new-card-hero {
        width: min(58vw, 300px);
        margin-top: -64px;
      }
    }
  `;
  document.head.appendChild(style);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Reveal sand sequence base timing (× FAST_20 = 20% faster on top) */
const SAND_FRAME_SPEED = 0.3;
/** 20% faster than current timings */
const FAST_20 = 0.8;

// Sand "zguzvano" (crumple) frame sequence: 1..19.
function getCrumbleFramePath(frame: number): string {
  return `./assets/animations/sand/zguzvano${frame}.png`;
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {}
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

type CrumbleFramePlayerOptions = {
  baseImg: HTMLImageElement | null;
  lightEl?: HTMLElement | null;
  frames: number[];
  delays: number[];
  shouldContinue?: () => boolean;
  /** Motion-blur resolve duration per frame swap (ms) */
  blurMs?: number;
  motionStrength?: number;
  /** Timing scale for step/blur (1 = full speed; 0.3 = 70% faster). Intro uses 1 so 1→9 is visible. */
  speedScale?: number;
  onFrame?: (frame: number, index: number) => void;
};

// Single visible layer: 1→2→3… with motion blur only (no stacked duplicate frames).
async function playCrumbleFrames({
  baseImg,
  lightEl,
  frames,
  delays,
  shouldContinue,
  blurMs = 54,
  motionStrength = 1,
  speedScale = SAND_FRAME_SPEED,
  onFrame,
}: CrumbleFramePlayerOptions): Promise<void> {
  if (!baseImg || frames.length === 0) return;

  const scale = Math.max(0.2, Math.min(1, speedScale)) * FAST_20;
  const stepMs = (ms: number) => Math.max(10, Math.round(ms * scale));
  const blurSec = Math.max(0.035, (blurMs * scale) / 1000);
  const blurPx = Math.max(1.2, 2.4 * motionStrength);

  const firstSrc = getCrumbleFramePath(frames[0]);
  baseImg.src = firstSrc;
  setLightMask(lightEl || null, firstSrc);
  baseImg.style.opacity = '1';
  baseImg.style.visibility = 'visible';
  baseImg.style.transformOrigin = '50% 50%';
  try { onFrame?.(frames[0], 0); } catch {}
  try { gsap.killTweensOf(baseImg); } catch {}
  gsap.set(baseImg, { filter: 'blur(0px)', scale: 1, transformOrigin: '50% 50%', force3D: true });

  for (let index = 1; index < frames.length; index++) {
    if (shouldContinue && !shouldContinue()) return;
    await wait(stepMs(delays[index - 1] ?? 80));
    if (shouldContinue && !shouldContinue()) return;

    const nextSrc = getCrumbleFramePath(frames[index]);
    setLightMask(lightEl || null, nextSrc);

    // One frame at a time + motion blur + random size bounce (TNT-style pop).
    baseImg.src = nextSrc;
    try { onFrame?.(frames[index], index); } catch {}
    const bouncePeak = 0.94 + Math.random() * 0.12;
    const bounceStart = bouncePeak * (0.86 + Math.random() * 0.06);
    try { gsap.killTweensOf(baseImg); } catch {}

    await new Promise<void>((resolve) => {
      const tl = trackNewCardTimeline(gsap.timeline({ onComplete: resolve }));
      tl.set(baseImg, {
        filter: `blur(${blurPx}px) brightness(1.04)`,
        scale: bounceStart,
        transformOrigin: '50% 50%',
        force3D: true,
      }, 0)
        .to(baseImg, {
          filter: 'blur(0px) brightness(1)',
          scale: bouncePeak,
          duration: blurSec * 0.55,
          ease: 'back.out(1.7)',
        }, 0)
        .to(baseImg, {
          scale: 1,
          duration: blurSec * 0.45,
          ease: 'sine.inOut',
        }, '>');
    });
  }

  gsap.set(baseImg, { filter: 'blur(0px)', scale: 1 });
}

export async function showJourneyNewCardScreen({
  boardNumber,
  cardImagePath,
  cardName,
  cardRarity,
}: JourneyNewCardScreenOptions): Promise<{ action: 'continue' }> {
  cleanupJourneyNewCardScreen();
  try { cleanupJourneySmokeEffects(); } catch {}
  ensureJourneyNewCardStyles();

  const safeBoardNumber = Math.max(1, Math.min(30, boardNumber | 0));
  const fallbackAsset = resolveJourneyCardAsset(safeBoardNumber, 0);
  const safeCardPath = cardImagePath || fallbackAsset.path2x || fallbackAsset.path1x;
  const safeCardName = getJourneyNewCardDisplayName(
    safeBoardNumber,
    cardName || formatGameplayProgressLabel('journey', safeBoardNumber),
  );
  const safeCardRarity = cardRarity;
  const revealCopy = getJourneyNewCardRevealCopy(safeCardName, safeCardRarity);
  const revealTilt = createJourneyNewCardTiltProfile();

  await Promise.all([
    ...Array.from({ length: 9 }, (_, i) => preloadImage(getCrumbleFramePath(i + 1))),
    preloadImage(safeCardPath),
    preloadImage('./assets/hand-pointer.png'),
  ]);

  return new Promise((resolve) => {
    let resolved = false;
    let revealed = false;
    let revealRunning = false;
    let disposed = false;
    let framePlaybackId = 0;
    let sprite9ShineIntervalId: number | null = null;
    let finalCardShineIntervalId: number | null = null;
    let continueCoachTimerId = 0;
    let continueCoachHandAnimation: Animation | null = null;
    let continueCoachCardAnimation: Animation | null = null;
    let unlockedIdleTiltAnimation: Animation | null = null;
    let unlockedIdleHoloAnimation: Animation | null = null;
    let unlockedDragSettleAnimation: Animation | null = null;
    let unlockedDragHoloSettleAnimation: Animation | null = null;
    let activeDragPointerId: number | null = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartTiltAngle = 0;
    let currentDragTiltAngle = 0;
    let dragAxis: 'horizontal' | 'vertical' | null = null;
    let dragMoved = false;
    let suppressClickUntil = 0;
    let continueCoachGeneration = 0;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const hapticTimeouts: number[] = [];
    const shineTimeouts: number[] = [];
    const shineAnimationFrames: number[] = [];

    const overlay = document.createElement('div');
    overlay.id = 'cc-journey-new-card-overlay';
    overlay.dataset.cardRarity = safeCardRarity;
    applyAppPaperSurfaceToElement(overlay);
    overlay.innerHTML = `
      <h1 class="cc-journey-new-card-title" style="opacity:0;transform:scale(0) translateY(-28px);">New Reward</h1>
      <p class="cc-journey-new-card-subtitle" style="opacity:0;transform:scale(0) translateY(-22px);">Tap the card to reveal</p>
      <div class="cc-journey-new-card-content">
        <div class="cc-journey-new-card-hero" role="button" aria-label="Reveal ${safeCardName}" tabindex="0" style="opacity:0;transform:translateY(-30px) scale(0);">
          <div class="cc-journey-new-card-shadow" style="opacity:0;transform:translateX(-50%) scale(0.68, 0.72);"></div>
          <div class="cc-journey-new-card-motion">
            <div class="cc-journey-new-card-pose-shell">
              <div class="cc-journey-new-card-surface cc-journey-new-card-surface--interim">
                <div class="cc-journey-new-card-auto-tilt-shell cc-journey-new-card-auto-tilt-shell--interim">
                  <img class="cc-journey-new-card-frame cc-journey-interim-shine-face" src="${getCrumbleFramePath(1)}" alt="">
                  <div class="cc-journey-new-card-light cc-journey-new-card-light--interim cc-journey-interim-shine-light ${JOURNEY_INTERIM_SHINE_TRIGGER_CLASS}" aria-hidden="true"></div>
                </div>
              </div>
              <div class="cc-journey-new-card-surface cc-journey-new-card-surface--unlocked">
                <div class="cc-journey-new-card-auto-tilt-shell cc-journey-new-card-auto-tilt-shell--unlocked">
                  <img class="cc-journey-new-card-final cc-journey-interim-shine-face" src="${safeCardPath}" alt="${safeCardName}">
                  <div class="cc-journey-new-card-light cc-journey-new-card-light--unlocked cc-journey-interim-shine-light" aria-hidden="true"></div>
                  <div class="cc-journey-new-card-legendary-holo journey-card-flip-legendary-shine" aria-hidden="true"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="cc-journey-new-card-continue-coach" aria-hidden="true">
        <img class="cc-journey-new-card-coach-hand" src="./assets/hand-pointer.png" srcset="./assets/hand-pointer@2x.png 2x, ./assets/hand-pointer@3x.png 3x" alt="" draggable="false">
        <div class="cc-journey-new-card-coach-copy">${renderContinueCoachLine('TAP TO COLLECT')}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    applyJourneyInterimShineProfileVariables(overlay);

    const title = overlay.querySelector('.cc-journey-new-card-title') as HTMLElement | null;
    const subtitle = overlay.querySelector('.cc-journey-new-card-subtitle') as HTMLElement | null;
    const hero = overlay.querySelector('.cc-journey-new-card-hero') as HTMLElement | null;
    const motion = overlay.querySelector('.cc-journey-new-card-motion') as HTMLElement | null;
    const poseShell = overlay.querySelector('.cc-journey-new-card-pose-shell') as HTMLElement | null;
    const interimSurface = overlay.querySelector('.cc-journey-new-card-surface--interim') as HTMLElement | null;
    const unlockedSurface = overlay.querySelector('.cc-journey-new-card-surface--unlocked') as HTMLElement | null;
    const interimAutoTilt = overlay.querySelector('.cc-journey-new-card-auto-tilt-shell--interim') as HTMLElement | null;
    const unlockedAutoTilt = overlay.querySelector('.cc-journey-new-card-auto-tilt-shell--unlocked') as HTMLElement | null;
    const frameImg = overlay.querySelector('.cc-journey-new-card-frame') as HTMLImageElement | null;
    const finalImg = overlay.querySelector('.cc-journey-new-card-final') as HTMLImageElement | null;
    const interimLight = overlay.querySelector('.cc-journey-new-card-light--interim') as HTMLElement | null;
    const unlockedLight = overlay.querySelector('.cc-journey-new-card-light--unlocked') as HTMLElement | null;
    const unlockedLegendaryHolo = overlay.querySelector('.cc-journey-new-card-legendary-holo') as HTMLElement | null;
    const shadow = overlay.querySelector('.cc-journey-new-card-shadow') as HTMLElement | null;
    const continueCoachHand = overlay.querySelector('.cc-journey-new-card-coach-hand') as HTMLImageElement | null;
    const applyRevealCopy = (): void => {
      if (title) title.textContent = revealCopy.title;
      if (!subtitle) return;
      const cardNameAccent = document.createElement('span');
      cardNameAccent.className = 'cc-journey-new-card-subtitle-card-name';
      cardNameAccent.textContent = safeCardName;
      subtitle.replaceChildren(
        document.createTextNode('Unlocked '),
        cardNameAccent,
      );
    };
    const unlockedIdleAngles = [
      0,
      -JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG,
      0,
      JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG,
      0,
    ];
    const unlockedIdleOffsets = [0, 0.25, 0.5, 0.75, 1];
    const getCurrentUnlockedIdleAngle = (): number => {
      const progress = Number(unlockedIdleTiltAnimation?.effect?.getComputedTiming().progress ?? 0);
      if (!Number.isFinite(progress)) return 0;
      const scaled = Math.max(0, Math.min(1, progress)) * (unlockedIdleAngles.length - 1);
      const startIndex = Math.min(unlockedIdleAngles.length - 2, Math.floor(scaled));
      const localProgress = scaled - startIndex;
      return unlockedIdleAngles[startIndex]
        + (unlockedIdleAngles[startIndex + 1] - unlockedIdleAngles[startIndex]) * localProgress;
    };
    const paintUnlockedLegendaryHolo = (angle: number, idleStrength: boolean) => {
      if (safeCardRarity !== 'legendary' || !unlockedLegendaryHolo) return;
      const shine = getJourneyCardLegendaryDragShineState(angle);
      overlay.classList.add('is-unlocked-auto-holo');
      unlockedLegendaryHolo.style.backgroundPosition = `${shine.backgroundPositionPercent}% 50%, ${shine.rainbowBackgroundPositionPercent}% 50%`;
      unlockedLegendaryHolo.style.opacity = String(
        Math.max(0.12, idleStrength ? shine.opacity * 0.58 : shine.opacity),
      );
    };
    const stopUnlockedIdleMotion = (clearTransform = true) => {
      unlockedIdleTiltAnimation?.cancel();
      unlockedIdleTiltAnimation = null;
      unlockedIdleHoloAnimation?.cancel();
      unlockedIdleHoloAnimation = null;
      unlockedDragSettleAnimation?.cancel();
      unlockedDragSettleAnimation = null;
      unlockedDragHoloSettleAnimation?.cancel();
      unlockedDragHoloSettleAnimation = null;
      overlay.classList.remove('is-unlocked-auto-holo');
      unlockedLegendaryHolo?.style.removeProperty('background-position');
      unlockedLegendaryHolo?.style.removeProperty('opacity');
      if (clearTransform) unlockedAutoTilt?.style.removeProperty('transform');
    };
    const startUnlockedIdleMotion = () => {
      stopUnlockedIdleMotion();
      if (
        prefersReducedMotion
        || resolved
        || disposed
        || !unlockedAutoTilt
        || typeof unlockedAutoTilt.animate !== 'function'
      ) return;
      unlockedAutoTilt.style.removeProperty('transform');
      unlockedIdleTiltAnimation = unlockedAutoTilt.animate(
        unlockedIdleAngles.map((angle, index) => ({
          transform: `perspective(1050px) rotateY(${angle}deg)`,
          offset: unlockedIdleOffsets[index],
        })),
        {
          duration: JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS,
          easing: 'ease-in-out',
          iterations: Infinity,
        },
      );
      if (
        safeCardRarity !== 'legendary'
        || !unlockedLegendaryHolo
        || typeof unlockedLegendaryHolo.animate !== 'function'
      ) return;
      const shineKeyframes = unlockedIdleAngles.map((angle, index) => {
        const shine = getJourneyCardLegendaryDragShineState(angle);
        return {
          backgroundPosition: `${shine.backgroundPositionPercent}% 50%, ${shine.rainbowBackgroundPositionPercent}% 50%`,
          opacity: Math.max(0.12, shine.opacity * 0.58),
          offset: unlockedIdleOffsets[index],
        };
      });
      overlay.classList.add('is-unlocked-auto-holo');
      unlockedIdleHoloAnimation = unlockedLegendaryHolo.animate(shineKeyframes, {
        duration: JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS,
        easing: 'ease-in-out',
        iterations: Infinity,
      });
    };
    const setCardIdleTiltState = (activeFace: 'interim' | 'unlocked' | 'none') => {
      if (interimAutoTilt) interimAutoTilt.style.animationPlayState = activeFace === 'interim' ? 'running' : 'paused';
      if (activeFace === 'unlocked') startUnlockedIdleMotion();
      else stopUnlockedIdleMotion();
    };
    let finish: () => void = () => {};

    const stopContinueCoach = () => {
      continueCoachGeneration += 1;
      if (continueCoachTimerId !== 0) {
        window.clearTimeout(continueCoachTimerId);
        continueCoachTimerId = 0;
      }
      continueCoachHandAnimation?.cancel();
      continueCoachHandAnimation = null;
      continueCoachCardAnimation?.cancel();
      continueCoachCardAnimation = null;
      overlay.classList.remove('is-continue-coach');
    };

    const scheduleContinueCoach = (
      delayMs = JOURNEY_NEW_CARD_CONTINUE_COACH_INITIAL_DELAY_MS,
    ) => {
      stopContinueCoach();
      if (prefersReducedMotion || resolved || disposed || !revealed || revealRunning || !document.body.contains(overlay)) return;
      const generation = continueCoachGeneration;
      continueCoachTimerId = window.setTimeout(() => {
        continueCoachTimerId = 0;
        if (generation !== continueCoachGeneration || resolved || disposed || !revealed || revealRunning) return;
        if (
          !continueCoachHand
          || !poseShell
          || typeof continueCoachHand.animate !== 'function'
          || typeof poseShell.animate !== 'function'
        ) return;
        overlay.classList.add('is-continue-coach');
        const handAnimation = continueCoachHand.animate([
          { opacity: 0, transform: 'translate3d(-50%, -28%, 80px) rotate(-8deg) scale(0.78)', offset: 0 },
          { opacity: 1, transform: 'translate3d(-50%, -50%, 80px) rotate(-8deg) scale(0.96)', offset: 0.2 },
          { opacity: 1, transform: 'translate3d(-50%, -38%, 80px) rotate(-6deg) scale(0.84)', offset: 0.42 },
          { opacity: 1, transform: 'translate3d(-50%, -52%, 80px) rotate(-8deg) scale(1)', offset: 0.58 },
          { opacity: 0, transform: 'translate3d(-50%, -34%, 80px) rotate(-7deg) scale(0.84)', offset: 1 },
        ], {
          duration: JOURNEY_NEW_CARD_CONTINUE_COACH_DURATION_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        });
        const cardAnimation = poseShell.animate([
          { transform: 'scale(1)', offset: 0 },
          { transform: 'scale(1)', offset: 0.34 },
          { transform: 'scale(0.965)', offset: 0.43 },
          { transform: 'scale(1.06)', offset: 0.57 },
          { transform: 'scale(0.988)', offset: 0.7 },
          { transform: 'scale(1)', offset: 0.82 },
          { transform: 'scale(1)', offset: 1 },
        ], {
          duration: JOURNEY_NEW_CARD_CONTINUE_COACH_DURATION_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        });
        continueCoachHandAnimation = handAnimation;
        continueCoachCardAnimation = cardAnimation;
        void Promise.allSettled([handAnimation.finished, cardAnimation.finished]).then(() => {
          if (
            generation !== continueCoachGeneration
            || continueCoachHandAnimation !== handAnimation
            || continueCoachCardAnimation !== cardAnimation
          ) return;
          continueCoachHandAnimation = null;
          continueCoachCardAnimation = null;
          overlay.classList.remove('is-continue-coach');
          scheduleContinueCoach(JOURNEY_NEW_CARD_CONTINUE_COACH_REPEAT_DELAY_MS);
        });
      }, delayMs);
    };

    cleanupFns.push(() => {
      disposed = true;
      stopContinueCoach();
      stopUnlockedIdleMotion();
      if (sprite9ShineIntervalId !== null) {
        try { window.clearInterval(sprite9ShineIntervalId); } catch {}
        sprite9ShineIntervalId = null;
      }
      if (finalCardShineIntervalId !== null) {
        try { window.clearInterval(finalCardShineIntervalId); } catch {}
        finalCardShineIntervalId = null;
      }
      hapticTimeouts.splice(0).forEach((timeoutId) => {
        try { window.clearTimeout(timeoutId); } catch {}
      });
      shineTimeouts.splice(0).forEach((timeoutId) => {
        try { window.clearTimeout(timeoutId); } catch {}
      });
      shineAnimationFrames.splice(0).forEach((frameId) => {
        try { window.cancelAnimationFrame(frameId); } catch {}
      });
      try { cleanupJourneySmokeEffects(hero); } catch {}
      try { clearLightMask(interimLight); } catch {}
      try { clearLightMask(unlockedLight); } catch {}
      try { clearLightMask(unlockedLegendaryHolo); } catch {}
      try { if (frameImg) frameImg.removeAttribute('src'); } catch {}
      try { if (finalImg) finalImg.removeAttribute('src'); } catch {}
      try { gsap.killTweensOf([overlay, title, subtitle, hero, motion, poseShell, interimSurface, unlockedSurface, interimAutoTilt, unlockedAutoTilt, frameImg, finalImg, interimLight, unlockedLight, shadow]); } catch {}
    });

    const triggerHaptic = (style: 'light' | 'medium' = 'medium') => {
      if (resolved || disposed || !document.body.contains(overlay)) return;
      try {
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact(style);
        } else {
          (window as any).triggerHapticSelection?.();
        }
      } catch {}
    };

    const scheduleHaptic = (delayMs: number, style: 'light' | 'medium' = 'medium') => {
      const timeoutId = window.setTimeout(() => {
        const index = hapticTimeouts.indexOf(timeoutId);
        if (index >= 0) hapticTimeouts.splice(index, 1);
        triggerHaptic(style);
      }, delayMs);
      hapticTimeouts.push(timeoutId);
    };

    const playScreenShake = (strength = 8, duration = 0.34) => {
      if (resolved || disposed || !document.body.contains(overlay)) return;
      try {
        gsap.killTweensOf(overlay, 'x,y');
        trackNewCardTimeline(gsap.timeline())
          .to(overlay, { x: strength, y: -strength * 0.45, duration: duration * 0.12, ease: 'power2.out' })
          .to(overlay, { x: -strength * 0.85, y: strength * 0.35, duration: duration * 0.12, ease: 'power2.inOut' })
          .to(overlay, { x: strength * 0.55, y: -strength * 0.25, duration: duration * 0.14, ease: 'power2.inOut' })
          .to(overlay, { x: -strength * 0.25, y: strength * 0.12, duration: duration * 0.16, ease: 'power2.inOut' })
          .to(overlay, { x: 0, y: 0, duration: duration * 0.46, ease: 'elastic.out(1, 0.55)' });
      } catch {}
    };

    const scheduleShineTimeout = (fn: () => void, delayMs: number): number => {
      const timeoutId = window.setTimeout(() => {
        const index = shineTimeouts.indexOf(timeoutId);
        if (index >= 0) shineTimeouts.splice(index, 1);
        if (!resolved && !disposed && document.body.contains(overlay)) fn();
      }, delayMs);
      shineTimeouts.push(timeoutId);
      return timeoutId;
    };

    const scheduleShineFrame = (fn: () => void): number => {
      const frameId = window.requestAnimationFrame(() => {
        const index = shineAnimationFrames.indexOf(frameId);
        if (index >= 0) shineAnimationFrames.splice(index, 1);
        if (!resolved && !disposed && document.body.contains(overlay)) fn();
      });
      shineAnimationFrames.push(frameId);
      return frameId;
    };

    const stopSprite9ShineLoop = () => {
      if (sprite9ShineIntervalId === null) return;
      try { window.clearInterval(sprite9ShineIntervalId); } catch {}
      sprite9ShineIntervalId = null;
    };

    const stopFinalCardShineLoop = () => {
      if (finalCardShineIntervalId === null) return;
      try { window.clearInterval(finalCardShineIntervalId); } catch {}
      finalCardShineIntervalId = null;
    };

    const playRevealSmoke = () => {
      if (!hero || resolved || disposed || !document.body.contains(overlay)) return;
      try {
        cleanupJourneySmokeEffects(hero);
        smokeBubblesAtCard(hero, {
          allowNonInterim: true,
          wrapperElement: hero,
          containerElement: hero,
          zIndex: 0,
          sizeScale: 0.98,
          distanceScale: 0.88,
          countScale: 1.72,
          haloScale: 1.02,
          strength: 1.08,
          trailAlpha: 0.9,
          baseAlpha: 0.94,
          allowOverlap: false,
          activeLockMs: 1400,
          fadeOutTime: 0.82,
          cleanupTime: 1.75,
          organicFadeBySize: true,
          mixedCardRevealSmoke: true,
        });
      } catch {}
    };

    const clearPendingShineWork = () => {
      shineTimeouts.splice(0).forEach((timeoutId) => {
        try { window.clearTimeout(timeoutId); } catch {}
      });
      shineAnimationFrames.splice(0).forEach((frameId) => {
        try { window.cancelAnimationFrame(frameId); } catch {}
      });
      try { cleanupJourneySmokeEffects(hero); } catch {}
      try { interimLight?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS); } catch {}
      try { unlockedLight?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS); } catch {}
      try { frameImg?.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS); } catch {}
      try { finalImg?.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS); } catch {}
      try { clearLightMask(interimLight); } catch {}
      try { clearLightMask(unlockedLight); } catch {}
      try { gsap.killTweensOf([interimSurface, unlockedSurface, interimLight, unlockedLight, frameImg, finalImg]); } catch {}
    };

    const startSprite9ShineLoop = () => {
      stopSprite9ShineLoop();
      const play = () => {
        if (revealed || revealRunning || resolved || disposed || !frameImg || !document.body.contains(overlay)) {
          stopSprite9ShineLoop();
          return;
        }
        triggerJourneyInterimShinePulse({
          lightElement: interimLight,
          faceElement: frameImg,
          baseScale: 1.2,
          shouldRun: () => !revealed && !revealRunning && !resolved && !disposed && !!frameImg && document.body.contains(overlay),
          onPulse: () => triggerHaptic('light'),
          scheduleTimeout: scheduleShineTimeout,
          scheduleFrame: scheduleShineFrame,
          trackTimeline: trackNewCardTimeline,
        });
      };
      play();
      sprite9ShineIntervalId = window.setInterval(play, JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs);
    };

    const startFinalCardShineLoop = () => {
      stopFinalCardShineLoop();
      if (safeCardRarity === 'legendary') return;
      const play = () => {
        if ((!revealed && !revealRunning) || resolved || disposed || !finalImg || !document.body.contains(overlay)) {
          stopFinalCardShineLoop();
          return;
        }
        setLightMask(unlockedLight, safeCardPath);
        setLightFrameScale(unlockedLight, 0.95);
        gsap.set(unlockedLight, {
          scale: 1,
          transformOrigin: '50% 50%',
          force3D: true,
        });
        triggerJourneyInterimShinePulse({
          lightElement: unlockedLight,
          faceElement: finalImg,
          baseScale: 0.95,
          shouldRun: () => (revealed || revealRunning) && !resolved && !disposed && !!finalImg && document.body.contains(overlay),
          scheduleTimeout: scheduleShineTimeout,
          scheduleFrame: scheduleShineFrame,
          trackTimeline: trackNewCardTimeline,
        });
      };
      play();
      finalCardShineIntervalId = window.setInterval(play, JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs);
    };

    finish = () => {
      if (resolved) return;
      resolved = true;
      stopSprite9ShineLoop();
      stopFinalCardShineLoop();
      stopContinueCoach();
      clearPendingShineWork();
      setCardIdleTiltState('none');
      ++framePlaybackId;
      try { hero?.removeEventListener('click', onReveal); } catch {}
      try { hero?.removeEventListener('keydown', onHeroKeyDown); } catch {}
      try { gsap.killTweensOf([overlay, title, subtitle, hero, motion, poseShell, interimSurface, unlockedSurface, frameImg, finalImg, interimLight, unlockedLight, shadow]); } catch {}
      void (async () => {
        const tl = trackNewCardTimeline(gsap.timeline({
          onComplete: () => {
            cleanupJourneyNewCardScreen();
            resolve({ action: 'continue' });
          },
        }));
        tl.to(hero, {
          scale: 0,
          y: -30,
          duration: 0.24,
          ease: 'back.in(1.65)',
          force3D: true,
        }, 0)
        .to(unlockedSurface, {
          rotationZ: revealTilt.unlockedExitRotationDeg,
          rotationX: revealTilt.unlockedExitRotateXDeg,
          rotationY: revealTilt.unlockedExitRotateYDeg,
          z: -188,
          duration: 0.24,
          ease: 'back.in(1.65)',
          force3D: true,
        }, 0)
        .set(hero, { visibility: 'hidden', opacity: 0 })
        // 3. Text exits one after another, no idle gap.
        .to(title, {
          scale: 0,
          opacity: 0,
          y: -34,
          duration: 0.18,
          ease: 'back.in(1.55)',
          force3D: true,
        })
        .set(title, { visibility: 'hidden' })
        .to(subtitle, {
          scale: 0,
          opacity: 0,
          y: -28,
          duration: 0.18,
          ease: 'back.in(1.55)',
          force3D: true,
        })
        .set(subtitle, { visibility: 'hidden' })
          .to(overlay, { opacity: 0, duration: 0.1, ease: 'power2.inOut' });
      })();
    };

    const reveal = async () => {
      if (revealed || revealRunning || resolved || disposed) return;
      revealRunning = true;
      setCardIdleTiltState('none');
      stopSprite9ShineLoop();
      clearPendingShineWork();
      const revealFramePlaybackId = ++framePlaybackId;
      try { hero?.setAttribute('aria-disabled', 'true'); } catch {}
      triggerHaptic('medium');

      try {
        gsap.killTweensOf([title, subtitle, hero, interimSurface, unlockedSurface, frameImg, finalImg, interimLight, unlockedLight, shadow]);
        const rd = (s: number) => s * FAST_20;
        if (frameImg) {
          frameImg.src = getCrumbleFramePath(9);
          frameImg.style.opacity = '1';
          frameImg.style.visibility = 'visible';
          gsap.set(frameImg, { y: 0, scale: 1.2, filter: 'blur(0px)', transformOrigin: '50% 50%', force3D: true });
        }
        setLightFrameScale(interimLight, 1.2);
        setLightMask(interimLight, getCrumbleFramePath(9));
        gsap.set(interimLight, { scale: 1, transformOrigin: '50% 50%', force3D: true });
        gsap.set(interimSurface, {
          opacity: 1,
          visibility: 'visible',
          y: JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX,
          scale: JOURNEY_NEW_CARD_INTERIM_SCALE,
          rotationZ: revealTilt.interimRestRotationDeg,
          rotationX: revealTilt.interimRestRotateXDeg,
          rotationY: revealTilt.interimRestRotateYDeg,
          z: 0,
          force3D: true,
        });
        if (finalImg) {
          finalImg.style.visibility = 'visible';
          finalImg.style.opacity = '1';
          gsap.set(finalImg, {
            y: -4,
            scale: 0.95,
            transformOrigin: '50% 50%',
            force3D: true,
          });
        }
        gsap.set(unlockedSurface, {
          opacity: 0,
          visibility: 'hidden',
          y: JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX - 18,
          scale: 0.58,
          rotationZ: revealTilt.unlockedEntryRotationDeg,
          rotationX: revealTilt.unlockedEntryRotateXDeg,
          rotationY: revealTilt.unlockedEntryRotateYDeg,
          z: -180,
          force3D: true,
        });

        await new Promise<void>((revealDone) => {
          const coverExitDuration = rd(0.32);
          const cardEnterStart = 0;
          const cardEnterDuration = rd(0.52);
          const cardImpactStart = cardEnterStart + cardEnterDuration;
          const cardSecondShineStart = cardImpactStart + rd(0.24);
          const titleStart = cardEnterStart;
          const subtitleStart = cardEnterStart;
          trackNewCardTimeline(gsap.timeline({
            onComplete: () => {
              if (framePlaybackId !== revealFramePlaybackId || resolved || disposed) {
                revealDone();
                return;
              }
              gsap.set(finalImg, {
                opacity: 1,
                visibility: 'visible',
                y: -4,
                scale: 0.95,
                transformOrigin: '50% 50%',
                force3D: true,
              });
              gsap.set(unlockedSurface, {
                opacity: 1,
                visibility: 'visible',
                y: JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX,
                scale: JOURNEY_NEW_CARD_UNLOCKED_SCALE,
                rotationZ: revealTilt.unlockedRestRotationDeg,
                rotationX: revealTilt.unlockedRestRotateXDeg,
                rotationY: revealTilt.unlockedRestRotateYDeg,
                z: 0,
                force3D: true,
              });
              setCardIdleTiltState('unlocked');
              revealDone();
            },
          }))
            .set(title, { opacity: 0, y: -16, scale: 0.72 }, 0)
            .set(subtitle, { opacity: 0, y: -12, scale: 0.78 }, 0)
            .call(applyRevealCopy, undefined, titleStart)
            .to(interimSurface, {
              scale: 0,
              y: JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX - 30,
              rotationZ: revealTilt.interimExitRotationDeg,
              rotationX: revealTilt.interimExitRotateXDeg,
              rotationY: revealTilt.interimExitRotateYDeg,
              z: -188,
              duration: coverExitDuration,
              ease: 'back.in(1.65)',
              transformOrigin: '50% 50%',
              force3D: true,
            }, 0)
            .set(interimLight, { opacity: 0 }, 0)
            .call(() => triggerHaptic('light'), undefined, rd(0.22))
            .set(interimSurface, {
              visibility: 'hidden',
              opacity: 0,
            }, coverExitDuration)
            .set(shadow, { opacity: 0, y: JOURNEY_NEW_CARD_UNLOCKED_SHADOW_Y_PX, scaleX: 0.52, scaleY: 0.58 }, cardEnterStart)
            .set(unlockedSurface, {
              opacity: 1,
              visibility: 'visible',
              y: JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX - 18,
              scale: 0.58,
              rotationZ: revealTilt.unlockedEntryRotationDeg,
              rotationX: revealTilt.unlockedEntryRotateXDeg,
              rotationY: revealTilt.unlockedEntryRotateYDeg,
              z: -180,
              transformOrigin: '50% 50%',
              force3D: true,
            }, cardEnterStart)
            .call(() => {
              setLightMask(unlockedLight, safeCardPath);
              setLightFrameScale(unlockedLight, 0.95);
              gsap.set(unlockedLight, {
                opacity: 0,
                scale: 1,
                transformOrigin: '50% 50%',
                force3D: true,
              });
              playScreenShake(11, 0.42);
              triggerHaptic('medium');
            }, undefined, cardEnterStart)
            .to(unlockedSurface, {
              y: JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX,
              scale: JOURNEY_NEW_CARD_UNLOCKED_SCALE,
              rotationZ: revealTilt.unlockedRestRotationDeg,
              rotationX: revealTilt.unlockedRestRotateXDeg,
              rotationY: revealTilt.unlockedRestRotateYDeg,
              z: 0,
              duration: cardEnterDuration,
              ease: 'back.out(1.85)',
              force3D: true,
            }, cardEnterStart)
            .to(shadow, { opacity: 0.82, y: JOURNEY_NEW_CARD_UNLOCKED_SHADOW_Y_PX, scaleX: 1.16, scaleY: 1.08, duration: rd(0.24), ease: 'power2.out' }, cardEnterStart)
            .to(title, { opacity: 1, y: 0, scale: 1, duration: rd(0.24), ease: 'back.out(1.65)' }, titleStart)
            .to(subtitle, { opacity: 1, y: 0, scale: 1, duration: rd(0.24), ease: 'back.out(1.65)' }, subtitleStart)
            .call(() => triggerHaptic('light'), undefined, titleStart)
            .call(() => {
              if (framePlaybackId !== revealFramePlaybackId || resolved || disposed) return;
              gsap.set(finalImg, {
                opacity: 1,
                visibility: 'visible',
                y: -4,
                scale: 0.95,
                transformOrigin: '50% 50%',
                force3D: true,
              });
              setLightMask(unlockedLight, safeCardPath);
              setLightFrameScale(unlockedLight, 0.95);
              gsap.set(unlockedLight, {
                opacity: 0.92,
                scale: 1,
                transformOrigin: '50% 50%',
                force3D: true,
              });
              try {
                unlockedLight?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
                finalImg?.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
                void unlockedLight?.offsetHeight;
                void finalImg?.offsetHeight;
                unlockedLight?.classList.add(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
                scheduleShineTimeout(() => {
                  unlockedLight?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
                }, JOURNEY_INTERIM_CARD_SHINE_PROFILE.sweepDurationMs);
              } catch {}
              playRevealSmoke();
              playScreenShake(22, 0.42);
              triggerHaptic('medium');
            }, undefined, cardImpactStart)
            .call(() => {
              if (framePlaybackId !== revealFramePlaybackId || resolved || disposed) return;
              triggerHaptic('light');
            }, undefined, cardImpactStart)
            .call(() => {
              if (framePlaybackId !== revealFramePlaybackId || resolved || disposed) return;
              gsap.set(finalImg, {
                opacity: 1,
                visibility: 'visible',
                y: -4,
                scale: 0.95,
                transformOrigin: '50% 50%',
                force3D: true,
              });
              setLightFrameScale(unlockedLight, 0.95);
              gsap.set(unlockedLight, {
                opacity: 0.92,
                scale: 1,
                transformOrigin: '50% 50%',
                force3D: true,
              });
              triggerJourneyInterimShinePulse({
                lightElement: unlockedLight,
                faceElement: finalImg,
                baseScale: 0.95,
                shouldRun: () => framePlaybackId === revealFramePlaybackId && !resolved && !disposed,
                scheduleTimeout: scheduleShineTimeout,
                scheduleFrame: scheduleShineFrame,
                trackTimeline: trackNewCardTimeline,
              });
              triggerHaptic('light');
              scheduleShineTimeout(() => {
                if (framePlaybackId !== revealFramePlaybackId || resolved || disposed) return;
                startFinalCardShineLoop();
              }, 1850);
            }, undefined, cardSecondShineStart);
        });

        if (framePlaybackId !== revealFramePlaybackId || resolved || disposed) return;
        revealed = true;
        revealRunning = false;
        hero?.removeAttribute('aria-disabled');
        hero?.setAttribute('aria-label', `Continue after unlocking ${safeCardName}`);
        scheduleContinueCoach();
      } catch {
        applyRevealCopy();
        if (frameImg) {
          frameImg.style.opacity = '0';
          frameImg.style.visibility = 'hidden';
        }
        if (finalImg) {
          finalImg.style.visibility = 'visible';
          finalImg.style.opacity = '1';
          gsap.set(finalImg, {
            y: -4,
            scale: 0.95,
            transformOrigin: '50% 50%',
            force3D: true,
          });
          gsap.set(unlockedSurface, {
            opacity: 1,
            visibility: 'visible',
            y: JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX,
            scale: JOURNEY_NEW_CARD_UNLOCKED_SCALE,
            rotationZ: revealTilt.unlockedRestRotationDeg,
            rotationX: revealTilt.unlockedRestRotateXDeg,
            rotationY: revealTilt.unlockedRestRotateYDeg,
            z: 0,
            force3D: true,
          });
          setCardIdleTiltState('unlocked');
        }
        revealed = true;
        revealRunning = false;
        hero?.removeAttribute('aria-disabled');
        hero?.setAttribute('aria-label', `Continue after unlocking ${safeCardName}`);
        scheduleContinueCoach();
      }
    };

    const settleUnlockedCardAfterDrag = () => {
      if (!unlockedAutoTilt || resolved || disposed) return;
      unlockedDragSettleAnimation?.cancel();
      const fromAngle = currentDragTiltAngle;
      const settleAnimation = unlockedAutoTilt.animate([
        { transform: `perspective(1050px) rotateY(${fromAngle}deg)` },
        { transform: 'perspective(1050px) rotateY(0deg)' },
      ], {
        duration: 260,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      });
      unlockedDragSettleAnimation = settleAnimation;
      if (safeCardRarity === 'legendary' && unlockedLegendaryHolo) {
        const fromShine = getJourneyCardLegendaryDragShineState(fromAngle);
        const settleShine = getJourneyCardLegendaryDragShineState(0);
        unlockedDragHoloSettleAnimation = unlockedLegendaryHolo.animate([
          {
            backgroundPosition: `${fromShine.backgroundPositionPercent}% 50%, ${fromShine.rainbowBackgroundPositionPercent}% 50%`,
            opacity: Math.max(0.12, fromShine.opacity),
          },
          {
            backgroundPosition: `${settleShine.backgroundPositionPercent}% 50%, ${settleShine.rainbowBackgroundPositionPercent}% 50%`,
            opacity: 0.12,
          },
        ], {
          duration: 260,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        });
      }
      void settleAnimation.finished.catch(() => undefined).then(() => {
        if (unlockedDragSettleAnimation !== settleAnimation || resolved || disposed) return;
        unlockedDragSettleAnimation = null;
        settleAnimation.cancel();
        unlockedDragHoloSettleAnimation?.cancel();
        unlockedDragHoloSettleAnimation = null;
        unlockedAutoTilt.style.removeProperty('transform');
        currentDragTiltAngle = 0;
        startUnlockedIdleMotion();
        scheduleContinueCoach(JOURNEY_NEW_CARD_CONTINUE_COACH_REPEAT_DELAY_MS);
      });
    };

    const handleUnlockedPointerDown = (event: PointerEvent) => {
      if (!revealed || revealRunning || resolved || disposed || event.isPrimary === false || !unlockedAutoTilt) return;
      activeDragPointerId = event.pointerId;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragAxis = null;
      dragMoved = false;
      dragStartTiltAngle = getCurrentUnlockedIdleAngle();
      currentDragTiltAngle = dragStartTiltAngle;
      stopContinueCoach();
      stopUnlockedIdleMotion(false);
      unlockedAutoTilt.style.transform = `perspective(1050px) rotateY(${dragStartTiltAngle}deg)`;
      paintUnlockedLegendaryHolo(dragStartTiltAngle, false);
      try { hero?.setPointerCapture(event.pointerId); } catch {}
      event.preventDefault();
    };

    const handleUnlockedPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeDragPointerId || !unlockedAutoTilt) return;
      const deltaX = event.clientX - dragStartX;
      const deltaY = event.clientY - dragStartY;
      if (!dragMoved) {
        dragMoved = Math.max(Math.abs(deltaX), Math.abs(deltaY)) > JOURNEY_NEW_CARD_DRAG_TAP_SLOP_PX;
      }
      if (!dragMoved) return;
      if (dragAxis === null) {
        dragAxis = Math.abs(deltaY) > Math.abs(deltaX) * 1.15 ? 'vertical' : 'horizontal';
      }
      if (dragAxis === 'horizontal') {
        currentDragTiltAngle = getJourneyNewCardDragTiltAngle(
          dragStartTiltAngle,
          deltaX,
          window.innerWidth || 390,
        );
        unlockedAutoTilt.style.transform = `perspective(1050px) rotateY(${currentDragTiltAngle}deg)`;
        paintUnlockedLegendaryHolo(currentDragTiltAngle, false);
      }
      event.preventDefault();
    };

    const finishUnlockedPointer = (event: PointerEvent, allowCollect: boolean) => {
      if (event.pointerId !== activeDragPointerId) return;
      const deltaX = event.clientX - dragStartX;
      const deltaY = event.clientY - dragStartY;
      try { hero?.releasePointerCapture(event.pointerId); } catch {}
      activeDragPointerId = null;
      suppressClickUntil = Date.now() + 500;
      const shouldCollect = allowCollect && (
        !dragMoved
        || (dragAxis === 'vertical' && isJourneyNewCardCollectDrag(
          deltaX,
          deltaY,
          hero?.getBoundingClientRect().height || 458,
        ))
      );
      dragAxis = null;
      dragMoved = false;
      if (shouldCollect) {
        try { (window as any).triggerHapticSelection?.(); } catch {}
        finish();
        return;
      }
      settleUnlockedCardAfterDrag();
    };

    const handleUnlockedPointerUp = (event: PointerEvent) => {
      finishUnlockedPointer(event, true);
    };

    const handleUnlockedPointerCancel = (event: PointerEvent) => {
      finishUnlockedPointer(event, false);
    };

    const onReveal = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() < suppressClickUntil) return;
      if (revealed && !revealRunning) {
        stopContinueCoach();
        try { (window as any).triggerHapticSelection?.(); } catch {}
        finish();
        return;
      }
      reveal();
    };
    const onHeroKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      onReveal(event);
    };
    hero?.addEventListener('pointerdown', handleUnlockedPointerDown);
    hero?.addEventListener('pointermove', handleUnlockedPointerMove);
    hero?.addEventListener('pointerup', handleUnlockedPointerUp);
    hero?.addEventListener('pointercancel', handleUnlockedPointerCancel);
    hero?.addEventListener('click', onReveal);
    hero?.addEventListener('keydown', onHeroKeyDown);
    cleanupFns.push(() => {
      try { hero?.removeEventListener('pointerdown', handleUnlockedPointerDown); } catch {}
      try { hero?.removeEventListener('pointermove', handleUnlockedPointerMove); } catch {}
      try { hero?.removeEventListener('pointerup', handleUnlockedPointerUp); } catch {}
      try { hero?.removeEventListener('pointercancel', handleUnlockedPointerCancel); } catch {}
      try { hero?.removeEventListener('click', onReveal); } catch {}
      try { hero?.removeEventListener('keydown', onHeroKeyDown); } catch {}
    });

    const d = (sec: number) => sec * FAST_20;

    gsap.set(title, { opacity: 0, y: -28, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(subtitle, { opacity: 0, y: -22, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(hero, { opacity: 0, y: -30, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(shadow, { opacity: 0, y: JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX, scaleX: 0.42, scaleY: 0.54 });
    gsap.set(interimSurface, {
      opacity: 1,
      visibility: 'visible',
      y: JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX,
      scale: 1,
      rotationZ: revealTilt.interimRestRotationDeg,
      rotationX: revealTilt.interimRestRotateXDeg,
      rotationY: revealTilt.interimRestRotateYDeg,
      z: 0,
      transformOrigin: '50% 50%',
      force3D: true,
    });
    gsap.set(unlockedSurface, {
      opacity: 0,
      visibility: 'hidden',
      y: JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX - 18,
      scale: 0.58,
      rotationZ: revealTilt.unlockedEntryRotationDeg,
      rotationX: revealTilt.unlockedEntryRotateXDeg,
      rotationY: revealTilt.unlockedEntryRotateYDeg,
      z: -180,
      transformOrigin: '50% 50%',
      force3D: true,
    });
    gsap.set(interimLight, { scale: 1, transformOrigin: '50% 50%' });
    gsap.set(unlockedLight, { scale: 1, opacity: 0, transformOrigin: '50% 50%' });
    setLightFrameScale(interimLight, 1);
    setLightMask(interimLight, getCrumbleFramePath(1));
    setLightMask(unlockedLight, safeCardPath);
    setLightMask(unlockedLegendaryHolo, safeCardPath);
    setLightFrameScale(unlockedLegendaryHolo, 0.95);

    const enter = trackNewCardTimeline(gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        setCardIdleTiltState('interim');
        gsap.to(shadow, {
          opacity: 0.72,
          y: JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX,
          scaleX: 0.86,
          scaleY: 0.82,
          duration: d(1.42),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      },
    }));
    enter
      .to(title, { opacity: 1, y: 0, scale: 1, duration: d(0.3), ease: 'back.out(1.65)' }, 0)
      .to(subtitle, { opacity: 1, y: 0, scale: 1, duration: d(0.3), ease: 'back.out(1.65)' }, d(0.04))
      .to(hero, { opacity: 1, y: 0, scale: 1, duration: d(0.65), ease: 'back.out(1.7)' }, d(0.22))
      .to(shadow, { opacity: 1, y: JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX, scaleX: 1, scaleY: 1, duration: d(0.32), ease: 'power2.out' }, 0)
      .add(() => {
        const introFramePlaybackId = ++framePlaybackId;
        (async () => {
          await playCrumbleFrames({
            baseImg: frameImg,
            lightEl: interimLight,
            frames: [1, 2, 3, 4, 5, 6, 7, 8, 9],
            delays: [27, 26, 24, 23, 24, 25, 27, 29],
            blurMs: 21,
            motionStrength: 0.38,
            speedScale: 1,
            onFrame: (frame) => {
              if (frame <= 1) return;
              triggerHaptic(frame >= 9 ? 'medium' : 'light');
            },
            shouldContinue: () => framePlaybackId === introFramePlaybackId && !resolved && !disposed,
          });
          if (framePlaybackId !== introFramePlaybackId || resolved || disposed) return;
          if (frameImg) {
            frameImg.src = getCrumbleFramePath(9);
            gsap.killTweensOf(frameImg);
            setLightFrameScale(interimLight, 1.2);
            gsap.set(interimLight, { opacity: 0.95, scale: 1, transformOrigin: '50% 50%', force3D: true });
            trackNewCardTimeline(gsap.timeline())
              .set(frameImg, { filter: 'brightness(1)', transformOrigin: '50% 50%', force3D: true })
              .call(() => {
                try {
                  setLightMask(interimLight, getCrumbleFramePath(9));
                  interimLight?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
                  frameImg.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
                  void interimLight?.offsetHeight;
                  void frameImg.offsetHeight;
                  interimLight?.classList.add(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
                  frameImg.classList.add(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
                  scheduleShineTimeout(() => {
                    interimLight?.classList.remove(JOURNEY_INTERIM_SHINE_TRIGGER_CLASS);
                    frameImg.classList.remove(JOURNEY_INTERIM_GLOW_PULSE_CLASS);
                    gsap.set(interimLight, { opacity: 0.92, scale: 1, transformOrigin: '50% 50%', force3D: true });
                  }, JOURNEY_INTERIM_CARD_SHINE_PROFILE.sweepDurationMs);
                } catch {}
                playScreenShake(16, 0.38);
                triggerHaptic('medium');
              }, undefined, 0)
              .to(frameImg, { filter: 'brightness(1.32) saturate(1.08)', scale: 1.34, duration: 0.08, ease: 'power2.out' }, 0)
              .to(frameImg, { filter: 'brightness(1.04) saturate(1.02)', scale: 1.2, duration: 0.18, ease: 'back.out(2.1)' })
              .to(interimSurface, {
                y: JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX,
                scale: JOURNEY_NEW_CARD_INTERIM_SCALE,
                duration: 0.18,
                ease: 'back.out(2.1)',
                transformOrigin: '50% 50%',
                force3D: true,
              }, 0.08)
              .to(frameImg, { filter: 'brightness(1)', duration: 0.16, ease: 'sine.out' }, 0.12)
              .call(startSprite9ShineLoop);
          }
        })().catch(() => {});
      }, d(0.87));

    scheduleHaptic(0, 'medium');
    scheduleHaptic(Math.round(150 * FAST_20), 'light');
    scheduleHaptic(Math.round(300 * FAST_20), 'medium');
  });
}

export { cleanupJourneyNewCardScreen };
