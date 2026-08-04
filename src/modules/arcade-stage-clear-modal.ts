// @ts-nocheck

import { gsap } from 'gsap';
import { formatGameplayProgressLabel, getGameplayProgressTerm } from './gameplay-terminology.ts';
import { appSpatialMotion } from './journey-spatial-motion.js';

const HEADLINES = [
  'Sweet Win',
  'Nice Move',
  'Nice Job',
  'Clean Hit',
  'Smooth',
  'Wild',
  'Magic',
  'Legend',
  'Nailed It',
  'Done',
  'Nice',
  'Sweet',
  'Awesome',
  'Congrats',
  'Rock On',
  'Fantastic',
];

let activeOverlay: HTMLElement | null = null;
let activeTweens: gsap.core.Tween[] = [];
let activeTimelines: gsap.core.Timeline[] = [];
export type ArcadeStageClearResult = { action: 'continue' | 'cancel' };

let activeResolve: ((result: ArcadeStageClearResult) => void) | null = null;

const TEXT_ENTER_BOUNCE_SCALE = 1.2;
const TEXT_ENTER_DURATION = 0.24;
const TEXT_SETTLE_DURATION = 0.1;
const TEXT_FINAL_SETTLE_DURATION = 0.1;
const TEXT_ENTER_STAGGER = 0.02;
const TEXT_EXIT_STAGGER = 0.012;
const TEXT_EXIT_BOUNCE_DURATION = 0.13;
const TEXT_EXIT_FADE_DURATION = 0.17;

function pickHeadline(): string {
  return HEADLINES[Math.floor(Math.random() * HEADLINES.length)] || 'Woow!';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const tween = gsap.delayedCall(ms / 1000, resolve);
    activeTweens.push(tween);
  });
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLetterSpans(text: string, className: string): string {
  return Array.from(text).map((letter) => {
    const content = letter === ' ' ? '&nbsp;' : escapeHtml(letter);
    return `<span class="${className}">${content}</span>`;
  }).join('');
}

function renderVariedTitleLetterSpans(text: string, className: string): string {
  return Array.from(text).map((letter, index) => {
    const content = letter === ' ' ? '&nbsp;' : escapeHtml(letter);
    const sizePercent = letter === ' '
      ? 100
      : Math.round(85 + Math.random() * 30);
    const marginLeft = index === 0 || letter === ' ' ? 0 : -2;
    return `<span class="${className}" style="font-size:${sizePercent}%;margin-left:${marginLeft}px;">${content}</span>`;
  }).join('');
}

function ensureStyles(): void {
  let style = document.getElementById('cc-arcade-stage-clear-style') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'cc-arcade-stage-clear-style';
    document.head.appendChild(style);
  }
  style.textContent = `
    #cc-arcade-stage-clear-overlay {
      position: fixed;
      left: 0;
      right: 0;
      top: max(118px, calc(env(safe-area-inset-top, 0px) + 96px));
      bottom: max(112px, calc(env(safe-area-inset-bottom, 0px) + 92px));
      z-index: 1295000;
      pointer-events: none;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      font-family: "Baloo2", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    #app > #cc-arcade-stage-clear-overlay {
      position: absolute;
      left: 0;
      right: 0;
      top: max(118px, calc(env(safe-area-inset-top, 0px) + 96px));
      bottom: max(112px, calc(env(safe-area-inset-bottom, 0px) + 92px));
      width: auto;
      height: auto;
    }
    .cc-arcade-stage-card,
    .cc-arcade-stage-next {
      position: absolute;
      left: 50%;
      top: 50%;
      width: min(84vw, 440px);
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      pointer-events: none;
      will-change: transform, opacity;
    }
    .cc-arcade-stage-card {
      top: calc(50% - 24px);
    }
    .cc-arcade-stage-title {
      margin: 0;
      color: #ef744d;
      font-size: clamp(65px, 14vw, 86px);
      line-height: 0.95;
      font-weight: 900;
      letter-spacing: 0;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      flex-wrap: wrap;
      transform-origin: center center;
    }
    .cc-arcade-stage-subtitle {
      margin: 16px 0 0;
      color: #b58a78;
      font-size: clamp(24px, 5.4vw, 34px);
      line-height: 1.05;
      font-weight: 700;
      letter-spacing: 0;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      flex-wrap: wrap;
    }
    .cc-arcade-stage-title-letter,
    .cc-arcade-stage-subtitle-letter {
      display: inline-block;
      transform-origin: center center;
      opacity: 0;
      will-change: transform, opacity;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      line-height: 1;
    }
    .cc-arcade-stage-thumb-wrap {
      position: relative;
      width: min(58vw, 300px);
      aspect-ratio: 1 / 1;
      margin-top: clamp(22px, 4.4vh, 40px);
      display: grid;
      place-items: center;
      transform: translateY(24px);
    }
    .cc-arcade-stage-thumb-shadow {
      position: absolute;
      left: 50%;
      bottom: -70px;
      width: 74%;
      height: 15%;
      border-radius: 999px;
      transform: translateX(-50%);
      background: radial-gradient(ellipse at center, rgba(185,105,62,0.32) 0%, rgba(185,105,62,0.16) 46%, rgba(185,105,62,0) 78%);
      filter: blur(10px);
      opacity: 0;
    }
    .cc-arcade-stage-thumb {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      object-fit: contain;
      transform-origin: 50% 74%;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }
    .cc-arcade-next-label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1px;
      margin: 0 0 8px;
      color: #b58a78;
      font-size: clamp(24px, 5.4vw, 34px);
      line-height: 1.05;
      font-weight: 700;
      letter-spacing: 0;
    }
    .cc-arcade-next-letter {
      display: inline-block;
      transform-origin: center center;
      opacity: 0;
    }
    .cc-arcade-next-number {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin: 0;
      padding: 0;
      line-height: 1;
      transform: translateY(-20px);
    }
    .cc-arcade-next-digit-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 0 0 -4px;
      padding: 0;
      position: relative;
      z-index: 2;
    }
    .cc-arcade-next-digit-wrap:first-child {
      margin-left: 0;
    }
    .cc-arcade-next-digit {
      display: inline-block;
      margin: 0;
      padding: 0;
      color: #e77449;
      font-size: clamp(190px, 56vw, 332px);
      line-height: 1;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum" 1;
      transform-origin: center center;
      opacity: 0;
      will-change: transform, opacity;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      contain: layout style paint;
    }
    @media (max-height: 720px) {
      .cc-arcade-stage-card,
      .cc-arcade-stage-next {
        top: 50%;
      }
      .cc-arcade-stage-card {
        top: calc(50% - 18px);
      }
      .cc-arcade-stage-thumb-wrap {
        width: min(46vw, 230px);
        margin-top: 16px;
      }
      .cc-arcade-stage-subtitle {
        margin-top: 10px;
      }
      .cc-arcade-stage-title {
        font-size: clamp(58px, 12vw, 76px);
      }
      .cc-arcade-next-label {
        font-size: clamp(24px, 5.4vw, 34px);
        margin-bottom: 8px;
      }
      .cc-arcade-next-digit {
        font-size: clamp(168px, 49vw, 276px);
      }
    }
  `;
}

function createOverlay(clearedStage: number, nextStage: number): {
  overlay: HTMLElement;
  clearCard: HTMLElement;
  title: HTMLElement;
  subtitle: HTMLElement;
  thumb: HTMLImageElement;
  thumbShadow: HTMLElement;
  nextCard: HTMLElement;
  titleLetters: HTMLElement[];
  subtitleLetters: HTMLElement[];
  letters: HTMLElement[];
  digits: HTMLElement[];
} {
  const overlay = document.createElement('div');
  overlay.id = 'cc-arcade-stage-clear-overlay';

  const safeCleared = String(Math.max(1, clearedStage | 0)).padStart(2, '0');
  const safeNext = String(Math.max(1, nextStage | 0)).padStart(2, '0');
  const headline = pickHeadline();
  overlay.innerHTML = `
    <section class="cc-arcade-stage-card" aria-hidden="true">
      <h1 class="cc-arcade-stage-title">${renderVariedTitleLetterSpans(headline, 'cc-arcade-stage-title-letter')}</h1>
      <p class="cc-arcade-stage-subtitle">${renderLetterSpans(`${formatGameplayProgressLabel('arcade', safeCleared)} complete`, 'cc-arcade-stage-subtitle-letter')}</p>
      <div class="cc-arcade-stage-thumb-wrap">
        <div class="cc-arcade-stage-thumb-shadow"></div>
        <img class="cc-arcade-stage-thumb" src="./assets/thumbs-up@2x.png" alt="">
      </div>
    </section>
    <section class="cc-arcade-stage-next" aria-hidden="true">
      <div class="cc-arcade-next-label">${renderLetterSpans(getGameplayProgressTerm('arcade'), 'cc-arcade-next-letter')}</div>
      <div class="cc-arcade-next-number">${Array.from(safeNext).map((digit) => `<span class="cc-arcade-next-digit-wrap"><span class="cc-arcade-next-digit">${digit}</span></span>`).join('')}</div>
    </section>
  `;

  const appHost = document.getElementById('app');
  if (appHost && appHost.style.display !== 'none' && !appHost.hidden) {
    appHost.appendChild(overlay);
  } else {
    document.body.appendChild(overlay);
  }

  return {
    overlay,
    clearCard: overlay.querySelector('.cc-arcade-stage-card') as HTMLElement,
    title: overlay.querySelector('.cc-arcade-stage-title') as HTMLElement,
    subtitle: overlay.querySelector('.cc-arcade-stage-subtitle') as HTMLElement,
    thumb: overlay.querySelector('.cc-arcade-stage-thumb') as HTMLImageElement,
    thumbShadow: overlay.querySelector('.cc-arcade-stage-thumb-shadow') as HTMLElement,
    nextCard: overlay.querySelector('.cc-arcade-stage-next') as HTMLElement,
    titleLetters: Array.from(overlay.querySelectorAll('.cc-arcade-stage-title-letter')) as HTMLElement[],
    subtitleLetters: Array.from(overlay.querySelectorAll('.cc-arcade-stage-subtitle-letter')) as HTMLElement[],
    letters: Array.from(overlay.querySelectorAll('.cc-arcade-next-letter')) as HTMLElement[],
    digits: Array.from(overlay.querySelectorAll('.cc-arcade-next-digit')) as HTMLElement[],
  };
}

async function decodeThumb(thumb: HTMLImageElement | null): Promise<void> {
  if (!thumb) return;
  if (thumb.complete && thumb.naturalWidth > 0) return;
  if (typeof thumb.decode === 'function') {
    try { await thumb.decode(); } catch {}
    return;
  }
  await new Promise<void>((resolve) => {
    thumb.addEventListener('load', () => resolve(), { once: true });
    thumb.addEventListener('error', () => resolve(), { once: true });
  });
}

function prepareBubblyLetters(letters: HTMLElement[]): void {
  letters.forEach((letterEl) => {
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
      rotation: 0,
      rotationX: 0,
      rotationY: 0,
      z: 0,
      force3D: true,
      transformOrigin: 'center center',
    });
  });
}

function playBubblyLetterEnter(letters: HTMLElement[], startDelay = 0): Promise<void> {
  if (!letters.length) return Promise.resolve();
  prepareBubblyLetters(letters);
  return new Promise((resolve) => {
    let completed = 0;
    letters.forEach((letterEl, index) => {
      const delay = startDelay + index * TEXT_ENTER_STAGGER;
      const timeline = gsap.timeline({ delay });
      activeTimelines.push(timeline);
      timeline
        .to(letterEl, {
          opacity: 1,
          scale: TEXT_ENTER_BOUNCE_SCALE,
          rotation: 0,
          rotationX: -5,
          rotationY: 0,
          z: 20,
          x: 0,
          y: 0,
          duration: TEXT_ENTER_DURATION,
          ease: 'back.out(2.0)',
        })
        .to(letterEl, {
          scale: 0.95,
          rotation: 0,
          rotationX: 0,
          rotationY: 0,
          z: 0,
          x: 0,
          y: 0,
          duration: TEXT_SETTLE_DURATION,
          ease: 'power2.out',
        })
        .to(letterEl, {
          opacity: 1,
          scale: 1,
          rotation: 0,
          rotationX: 0,
          rotationY: 0,
          z: 0,
          x: 0,
          y: 0,
          duration: TEXT_FINAL_SETTLE_DURATION,
          ease: 'back.out(1.5)',
          onComplete: () => {
            completed += 1;
            if (completed === letters.length) resolve();
          },
        });
    });
  });
}

function playBubblyLetterExit(letters: HTMLElement[]): Promise<void> {
  if (!letters.length) return Promise.resolve();
  return new Promise((resolve) => {
    let completed = 0;
    letters.forEach((letterEl, index) => {
      const delay = index * TEXT_EXIT_STAGGER;
      const timeline = gsap.timeline({ delay });
      activeTimelines.push(timeline);
      const exitRotation = (index % 2 === 0 ? 1 : -1) * (12 + Math.random() * 8);
      timeline
        .to(letterEl, {
          scale: 1.1,
          z: 30,
          x: 0,
          y: 0,
          duration: TEXT_EXIT_BOUNCE_DURATION,
          ease: 'power2.out',
        })
        .to(letterEl, {
          opacity: 0,
          scale: 0,
          rotation: exitRotation,
          rotationX: index % 2 === 0 ? 45 : -45,
          rotationY: index % 2 === 0 ? 30 : -30,
          z: -100,
          x: 0,
          y: 0,
          duration: TEXT_EXIT_FADE_DURATION,
          ease: 'power2.in',
          onComplete: () => {
            completed += 1;
            if (completed === letters.length) resolve();
          },
        });
    });
  });
}

function playThumbArrivalShake(clearCard: HTMLElement, thumb: HTMLElement): void {
  triggerHeavyHaptic();

  const shakeTimeline = gsap.timeline();
  activeTimelines.push(shakeTimeline);
  shakeTimeline
    .to(clearCard, { xPercent: -50, yPercent: -50, x: -14, y: 5, rotation: -2.8, duration: 0.055, ease: 'power2.out' })
    .to(clearCard, { xPercent: -50, yPercent: -50, x: 13, y: -4, rotation: 2.6, duration: 0.055, ease: 'power2.inOut' })
    .to(clearCard, { xPercent: -50, yPercent: -50, x: -10, y: 3, rotation: -2.0, duration: 0.05, ease: 'power2.inOut' })
    .to(clearCard, { xPercent: -50, yPercent: -50, x: 8, y: -2, rotation: 1.6, duration: 0.05, ease: 'power2.inOut' })
    .to(clearCard, { xPercent: -50, yPercent: -50, x: -5, y: 1.5, rotation: -1.0, duration: 0.045, ease: 'power2.inOut' })
    .to(clearCard, { xPercent: -50, yPercent: -50, x: 3, y: -1, rotation: 0.6, duration: 0.045, ease: 'power2.inOut' })
    .to(clearCard, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: 0, duration: 0.12, ease: 'back.out(2.4)' }, '>');

  const thumbPunch = gsap.timeline();
  activeTimelines.push(thumbPunch);
  thumbPunch
    .to(thumb, { scale: 1.14, duration: 0.08, ease: 'power2.out' }, 0)
    .to(thumb, { scale: 1, duration: 0.18, ease: 'back.out(2.2)' }, '>');
}

function triggerStageNumberHaptic(strength: 'light' | 'medium' = 'medium'): void {
  try {
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact(strength);
    }
  } catch {}
}

function triggerHeavyHaptic(): void {
  try {
    if (typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact('heavy');
    }
  } catch {}
}

function playStageNumberScreenShake(overlay: HTMLElement): void {
  const shakeTimeline = gsap.timeline();
  activeTimelines.push(shakeTimeline);
  shakeTimeline
    .to(overlay, { x: -18, y: 7, rotation: -0.6, duration: 0.05, ease: 'power2.out' })
    .to(overlay, { x: 16, y: -6, rotation: 0.6, duration: 0.055, ease: 'power2.inOut' })
    .to(overlay, { x: -13, y: 5, rotation: -0.45, duration: 0.05, ease: 'power2.inOut' })
    .to(overlay, { x: 10, y: -4, rotation: 0.35, duration: 0.05, ease: 'power2.inOut' })
    .to(overlay, { x: -7, y: 3, rotation: -0.25, duration: 0.045, ease: 'power2.inOut' })
    .to(overlay, { x: 5, y: -2, rotation: 0.18, duration: 0.045, ease: 'power2.inOut' })
    .to(overlay, { x: -3, y: 1, rotation: -0.1, duration: 0.04, ease: 'power2.inOut' })
    .to(overlay, { x: 0, y: 0, rotation: 0, duration: 0.14, ease: 'back.out(2.2)' });
}

async function playClearPhase(parts: ReturnType<typeof createOverlay>): Promise<void> {
  const { clearCard, title, subtitle, titleLetters, subtitleLetters, thumb, thumbShadow } = parts;
  gsap.set(clearCard, { opacity: 1, xPercent: -50, yPercent: -50, scale: 1 });
  gsap.set([title, subtitle], { opacity: 1 });
  gsap.set(thumb, { opacity: 0, y: -24, scale: 0, rotation: -8, force3D: true });
  gsap.set(thumbShadow, { opacity: 0, scaleX: 0.68, scaleY: 0.72 });
  prepareBubblyLetters(titleLetters);
  prepareBubblyLetters(subtitleLetters);

  const thumbTimeline = gsap.timeline();
  activeTimelines.push(thumbTimeline);
  thumbTimeline
    .to(thumbShadow, { opacity: 1, scaleX: 1, scaleY: 1, duration: 0.24, ease: 'power2.out' }, 0.08)
    .to(thumb, {
      opacity: 1,
      y: 0,
      scale: 1,
      rotation: 0,
      duration: 0.42,
      ease: 'back.out(2.05)',
      onComplete: () => playThumbArrivalShake(clearCard, thumb),
    }, 0.06);

  triggerHeavyHaptic();
  await playBubblyLetterEnter(titleLetters, 0);
  await Promise.all([
    playBubblyLetterEnter(subtitleLetters, 0),
    new Promise<void>((resolve) => thumbTimeline.eventCallback('onComplete', resolve)),
  ]);

  const idle = gsap.to(thumb, {
    y: -8,
    rotation: 2.5,
    duration: 0.82,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  });
  activeTweens.push(idle);
  await wait(500);
  try { idle.kill(); } catch {}

  const exitTimeline = gsap.timeline();
  activeTimelines.push(exitTimeline);
  exitTimeline
    .to(thumb, { opacity: 0, y: 28, scale: 0, rotation: 9, duration: 0.28, ease: 'back.in(1.8)' }, 0.02)
    .to(thumbShadow, { opacity: 0, scaleX: 0.62, scaleY: 0.62, duration: 0.18, ease: 'power2.in' }, 0.04);
  await Promise.all([
    playBubblyLetterExit([...titleLetters, ...subtitleLetters]),
    new Promise<void>((resolve) => exitTimeline.eventCallback('onComplete', resolve)),
  ]);
  gsap.set(clearCard, { opacity: 0 });
}

function animateBottomHudStageIndicator(nextStage: number): void {
  try {
    const hud = (window as any).HUD;
    if (hud && typeof hud.updateBoardIndicatorValueWithBounce === 'function') {
      hud.updateBoardIndicatorValueWithBounce(nextStage);
    }
  } catch {}
}

async function playRoundNumberPhase(parts: ReturnType<typeof createOverlay>, displayedStage: number): Promise<void> {
  const { overlay, nextCard, letters, digits } = parts;
  animateBottomHudStageIndicator(displayedStage);
  gsap.set(nextCard, { opacity: 1, xPercent: -50, yPercent: -50, scale: 1 });
  prepareBubblyLetters(letters);
  digits.forEach((digit, index) => {
    const baseRotation = -8 + Math.random() * 16;
    gsap.set(digit, {
      opacity: 0,
      scale: 0,
      x: 0,
      y: 0,
      rotation: index % 2 === 0 ? baseRotation : -baseRotation,
      rotationX: 0,
      rotationY: 0,
      z: 0,
      force3D: true,
    });
  });

  const labelEnterPromise = playBubblyLetterEnter(letters, 0);

  await new Promise<void>((resolveEnter) => {
    let completedDigits = 0;
    digits.forEach((digit, index) => {
      const timeline = gsap.timeline({
        delay: index * 0.3,
        onStart: () => {
          triggerStageNumberHaptic(index === 0 ? 'medium' : 'light');
          playStageNumberScreenShake(overlay);
        },
        onComplete: () => {
          completedDigits += 1;
          if (completedDigits === digits.length) resolveEnter();
        },
      });
      activeTimelines.push(timeline);
      const currentRotation = gsap.getProperty(digit, 'rotation') as number;
      timeline
        .to(digit, {
          opacity: 1,
          scale: 1.2,
          rotation: currentRotation,
          rotationX: -5,
          rotationY: 0,
          z: 20,
          x: 0,
          y: 0,
          transformOrigin: 'center center',
          duration: 0.4,
          ease: 'back.out(2.0)',
        })
        .to(digit, {
          scale: 0.95,
          rotation: currentRotation,
          rotationX: 0,
          rotationY: 0,
          z: 0,
          x: 0,
          y: 0,
          transformOrigin: 'center center',
          duration: 0.15,
          ease: 'power2.out',
        })
        .to(digit, {
          opacity: 1,
          scale: 1,
          rotation: currentRotation,
          rotationX: 0,
          rotationY: 0,
          z: 0,
          x: 0,
          y: 0,
          transformOrigin: 'center center',
          duration: 0.2,
          ease: 'back.out(1.5)',
        });
    });
  });

  await labelEnterPromise;

  await Promise.all([
    playBubblyLetterExit(letters),
    new Promise<void>((resolveExit) => {
      let completedDigits = 0;
      digits.forEach((digit, index) => {
        const timeline = gsap.timeline({
          delay: index * 0.4,
          onComplete: () => {
            completedDigits += 1;
            if (completedDigits === digits.length) resolveExit();
          },
        });
        activeTimelines.push(timeline);
        timeline
          .to(digit, {
            scale: 1.1,
            z: 30,
            x: 0,
            y: 0,
            duration: 0.15,
            ease: 'power2.out',
          })
          .to(digit, {
            opacity: 0,
            scale: 0,
            rotation: index % 2 === 0 ? 15 : -15,
            rotationX: index % 2 === 0 ? 45 : -45,
            rotationY: index % 2 === 0 ? 30 : -30,
            z: -100,
            x: 0,
            y: 0,
            duration: 0.3,
            ease: 'power2.in',
          });
      });
    }),
  ]);
  gsap.set(nextCard, { opacity: 0 });
}

export async function showArcadeStageClearModal(stageNumber: number, nextStageNumber?: number): Promise<ArcadeStageClearResult> {
  cancelArcadeStageClearModal();
  ensureStyles();

  const clearedStage = Math.max(1, stageNumber | 0);
  const nextStage = Math.max(1, (nextStageNumber ?? clearedStage + 1) | 0);
  const parts = createOverlay(clearedStage, nextStage);
  activeOverlay = parts.overlay;
  appSpatialMotion.activateArcadeStageClear(parts.overlay, clearedStage);

  return new Promise((resolve) => {
    activeResolve = resolve;
    (async () => {
      try {
        await decodeThumb(parts.thumb);
        await playClearPhase(parts);
        await playRoundNumberPhase(parts, nextStage);
      } finally {
        cleanupArcadeStageClearModal(false);
        const finish = activeResolve;
        activeResolve = null;
        finish?.({ action: 'continue' });
      }
    })();
  });
}

/**
 * Shows only the pure Round-number visual when an existing Arcade run is
 * resumed from Homepage. It never resolves a stage-clear continuation and
 * therefore cannot advance, reset, close, or rebuild gameplay.
 */
export async function showArcadeContinuationRoundCue(stageNumber: number): Promise<void> {
  cancelArcadeStageClearModal();
  ensureStyles();

  const resumedStage = Math.max(1, stageNumber | 0);
  const parts = createOverlay(resumedStage - 1, resumedStage);
  activeOverlay = parts.overlay;
  appSpatialMotion.activateArcadeStageClear(parts.overlay, resumedStage - 1);
  gsap.set(parts.clearCard, { opacity: 0 });

  try {
    await playRoundNumberPhase(parts, resumedStage);
  } finally {
    cleanupArcadeStageClearModal(false);
  }
}

/**
 * Cancels an abandoned stage-clear owner without translating that teardown
 * into a gameplay "continue" action. This prevents a later overlay cleanup
 * from accidentally advancing the old run.
 */
export function cancelArcadeStageClearModal(): void {
  const cancel = activeResolve;
  activeResolve = null;
  cleanupArcadeStageClearModal(false);
  cancel?.({ action: 'cancel' });
}

export function cleanupArcadeStageClearModal(resolveActive: boolean = true): void {
  appSpatialMotion.deactivateArcadeStageClear();
  activeTweens.forEach((tween) => {
    try { tween.kill(); } catch {}
  });
  activeTimelines.forEach((timeline) => {
    try { timeline.kill(); } catch {}
  });
  activeTweens = [];
  activeTimelines = [];

  if (activeOverlay) {
    try { gsap.killTweensOf(activeOverlay.querySelectorAll('*')); } catch {}
    try { activeOverlay.remove(); } catch {}
  }
  activeOverlay = null;

  if (resolveActive && activeResolve) {
    const finish = activeResolve;
    activeResolve = null;
    finish({ action: 'continue' });
  }
}
