// @ts-nocheck
import { gsap } from 'gsap';
import { cleanupJourneySmokeEffects, smokeBubblesAtCard } from './journey-card-idle-bounce.js';

type JourneyNewCardScreenOptions = {
  boardNumber: number;
  cardImagePath: string;
  cardName?: string;
};

let cleanupFns: Array<() => void> = [];

function cleanupJourneyNewCardScreen(): void {
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
      background:
        linear-gradient(rgba(243,238,232,0.65), rgba(243,238,232,0.65)),
        url('./assets/paper-bg.png') center / 100% 100% no-repeat,
        #f3eee8;
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
      -webkit-tap-highlight-color: transparent;
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
      pointer-events: none;
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
      opacity: 0;
      visibility: hidden;
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
      -webkit-mask-position: center;
      mask-position: center;
      -webkit-mask-size: contain;
      mask-size: contain;
    }
    .cc-journey-new-card-light::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        rgba(255,255,255,0.00) 0%,
        rgba(255,255,255,0.52) 50%,
        rgba(255,255,255,0.00) 100%
      );
      transform: translateX(-160%) skewX(-12deg) translateZ(0);
      opacity: 0;
      display: block;
      visibility: visible;
      filter: blur(0.56px);
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      pointer-events: none;
      animation: ccJourneyNewCardShimmer 1.7s linear infinite;
    }
    .cc-journey-new-card-light.shine-trigger::after {
      animation: ccJourneyNewCardInterimShimmer 1.7s linear !important;
      animation-delay: 0s !important;
    }
    .cc-journey-new-card-cta {
      width: min(68vw, 408px);
      max-width: 408px;
      transform: scale(0);
      -webkit-transform: scale(0);
      opacity: 0;
      visibility: hidden;
      flex: 0 0 auto;
      margin-top: 8px;
    }
    .cc-journey-new-card-cta.animate-enter-initial {
      opacity: 1 !important;
      visibility: hidden !important;
      transform: scale(0) !important;
      -webkit-transform: scale(0) !important;
      transition: none !important;
      -webkit-transition: none !important;
    }
    .cc-journey-new-card-cta.animate-enter {
      opacity: 1 !important;
      visibility: visible !important;
      transform: scale(1) !important;
      -webkit-transform: scale(1) !important;
      transition:
        transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6) !important;
      -webkit-transition:
        -webkit-transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6) !important;
      will-change: transform !important;
    }
    .cc-journey-new-card-cta.animate-exit {
      opacity: 1 !important;
      visibility: visible !important;
      transform: translateY(20px) scale(0) !important;
      -webkit-transform: translateY(20px) scale(0) !important;
      transition:
        transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6) !important;
      -webkit-transition:
        -webkit-transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6) !important;
      will-change: transform, opacity !important;
    }
    @keyframes ccJourneyNewCardIdle {
      0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
      50% { transform: translateY(-8px) rotate(1deg) scale(1.02); }
    }
    @keyframes ccJourneyNewCardShimmer {
      0%, 10% { transform: translateX(-160%) skewX(-12deg); opacity: 0; }
      15% { transform: translateX(-120%) skewX(-12deg); opacity: 0.5; }
      20%, 40% { opacity: 1; }
      30% { transform: translateX(0%) skewX(-12deg); opacity: 1; }
      45% { transform: translateX(120%) skewX(-12deg); opacity: 0.5; }
      50%, 100% { transform: translateX(160%) skewX(-12deg); opacity: 0; }
    }
    @keyframes ccJourneyNewCardInterimShimmer {
      0% { transform: translateX(-160%) skewX(-12deg); opacity: 0; }
      1% { transform: translateX(-158%) skewX(-12deg); opacity: 0.125; }
      2% { transform: translateX(-154%) skewX(-12deg); opacity: 0.25; }
      5% { transform: translateX(-140%) skewX(-12deg); opacity: 0.375; }
      12% { transform: translateX(-120%) skewX(-12deg); opacity: 0.45; }
      20% { transform: translateX(-80%) skewX(-12deg); opacity: 0.5; }
      30% { transform: translateX(0%) skewX(-12deg); opacity: 0.5; }
      40% { transform: translateX(80%) skewX(-12deg); opacity: 0.5; }
      45% { transform: translateX(120%) skewX(-12deg); opacity: 0.25; }
      50%, 100% { transform: translateX(160%) skewX(-12deg); opacity: 0; }
    }
    @keyframes ccJourneyNewCardGlowPulse {
      0% { filter: brightness(1); }
      50% { filter: brightness(1.22) saturate(1.06); }
      100% { filter: brightness(1.04); }
    }
    .cc-journey-new-card-frame.glow-pulse,
    .cc-journey-new-card-final.glow-pulse {
      animation: ccJourneyNewCardGlowPulse 0.5s ease-out;
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
      .cc-journey-new-card-cta {
        margin-top: 8px;
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

function setLightMask(lightEl: HTMLElement | null, src: string): void {
  if (!lightEl) return;
  try {
    const mask = `url("${src}")`;
    lightEl.style.webkitMaskImage = mask;
    lightEl.style.maskImage = mask;
  } catch {}
}

function setLightFrameScale(lightEl: HTMLElement | null, scale: number): void {
  if (!lightEl) return;
  try {
    const pct = `${Math.max(0.05, scale) * 100}%`;
    lightEl.style.webkitMaskSize = pct;
    lightEl.style.maskSize = pct;
  } catch {}
}

function toDisplayCardName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function triggerJourneyNewCardShine(
  lightEl: HTMLElement | null,
  target: HTMLElement | null,
  bounceScale = 1.2,
  scheduleTimeout: (fn: () => void, delayMs: number) => number = (fn, delayMs) => window.setTimeout(fn, delayMs),
  scheduleFrame: (fn: () => void) => number = (fn) => window.requestAnimationFrame(fn)
): void {
  if (!lightEl && !target) return;
  try {
    lightEl?.classList.remove('shine-trigger');
    target?.classList.remove('glow-pulse');
    // Restart the CSS animations reliably on mobile Safari.
    void lightEl?.offsetHeight;
    void target?.offsetHeight;
    scheduleFrame(() => {
      lightEl?.classList.add('shine-trigger');
      scheduleTimeout(() => {
        target?.classList.add('glow-pulse');
        if (target) {
          gsap.killTweensOf(target);
          gsap.timeline()
            .set(target, { transformOrigin: '50% 50%', force3D: true })
            .to(target, { scale: bounceScale * 1.055, duration: 0.14, ease: 'back.out(2)' })
            .to(target, { scale: bounceScale, duration: 0.18, ease: 'sine.out' });
        }
      }, 150);
      scheduleTimeout(() => {
        lightEl?.classList.remove('shine-trigger');
        target?.classList.remove('glow-pulse');
      }, 1700);
    });
  } catch {}
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
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
      const tl = gsap.timeline({ onComplete: resolve });
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
}: JourneyNewCardScreenOptions): Promise<{ action: 'continue' }> {
  cleanupJourneyNewCardScreen();
  ensureJourneyNewCardStyles();

  const safeBoardNumber = Math.max(1, Math.min(16, boardNumber | 0));
  const safeCardPath = cardImagePath || `./assets/colelctibles/common/${String(safeBoardNumber).padStart(2, '0')}.png`;
  const safeCardName = cardName || `Board ${safeBoardNumber}`;
  const displayCardName = toDisplayCardName(safeCardName);
  const revealSubtitle = `"${displayCardName}" added`;

  await Promise.all([
    ...Array.from({ length: 9 }, (_, i) => preloadImage(getCrumbleFramePath(i + 1))),
    preloadImage(safeCardPath),
  ]);

  return new Promise((resolve) => {
    let resolved = false;
    let revealed = false;
    let revealRunning = false;
    let disposed = false;
    let framePlaybackId = 0;
    let sprite9ShineIntervalId: number | null = null;
    let finalCardShineIntervalId: number | null = null;
    const hapticTimeouts: number[] = [];
    const shineTimeouts: number[] = [];
    const shineAnimationFrames: number[] = [];

    const overlay = document.createElement('div');
    overlay.id = 'cc-journey-new-card-overlay';
    overlay.innerHTML = `
      <h1 class="cc-journey-new-card-title" style="opacity:0;transform:scale(0) translateY(-28px);">New Reward</h1>
      <p class="cc-journey-new-card-subtitle" style="opacity:0;transform:scale(0) translateY(-22px);">Tap the card to reveal</p>
      <div class="cc-journey-new-card-content">
        <div class="cc-journey-new-card-hero" role="button" aria-label="Reveal ${safeCardName}" tabindex="0" style="opacity:0;transform:translateY(-30px) scale(0) rotate(-8deg);">
          <div class="cc-journey-new-card-shadow" style="opacity:0;transform:translateX(-50%) scale(0.68, 0.72);"></div>
          <div class="cc-journey-new-card-motion">
            <img class="cc-journey-new-card-frame" src="${getCrumbleFramePath(1)}" alt="">
            <img class="cc-journey-new-card-final" src="${safeCardPath}" alt="${safeCardName}">
            <div class="cc-journey-new-card-light" aria-hidden="true"></div>
          </div>
        </div>
        <button class="cc-journey-new-card-cta restart-btn primary-button bottom-sheet-cta" type="button">Continue</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const title = overlay.querySelector('.cc-journey-new-card-title') as HTMLElement | null;
    const subtitle = overlay.querySelector('.cc-journey-new-card-subtitle') as HTMLElement | null;
    const hero = overlay.querySelector('.cc-journey-new-card-hero') as HTMLElement | null;
    const motion = overlay.querySelector('.cc-journey-new-card-motion') as HTMLElement | null;
    const frameImg = overlay.querySelector('.cc-journey-new-card-frame') as HTMLImageElement | null;
    const finalImg = overlay.querySelector('.cc-journey-new-card-final') as HTMLImageElement | null;
    const light = overlay.querySelector('.cc-journey-new-card-light') as HTMLElement | null;
    const shadow = overlay.querySelector('.cc-journey-new-card-shadow') as HTMLElement | null;
    const cta = overlay.querySelector('.cc-journey-new-card-cta') as HTMLButtonElement | null;

    cleanupFns.push(() => {
      disposed = true;
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
      try { gsap.killTweensOf([overlay, title, subtitle, hero, motion, frameImg, finalImg, light, shadow, cta]); } catch {}
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
        gsap.timeline()
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
      try { light?.classList.remove('shine-trigger'); } catch {}
      try { frameImg?.classList.remove('glow-pulse'); } catch {}
      try { finalImg?.classList.remove('glow-pulse'); } catch {}
      try { gsap.killTweensOf([light, frameImg, finalImg]); } catch {}
    };

    const startSprite9ShineLoop = () => {
      stopSprite9ShineLoop();
      const play = () => {
        if (revealed || revealRunning || resolved || disposed || !frameImg || !document.body.contains(overlay)) {
          stopSprite9ShineLoop();
          return;
        }
        triggerJourneyNewCardShine(light, frameImg, 1.2, scheduleShineTimeout, scheduleShineFrame);
        scheduleHaptic(150, 'light');
      };
      play();
      sprite9ShineIntervalId = window.setInterval(play, 3000);
    };

    const startFinalCardShineLoop = () => {
      stopFinalCardShineLoop();
      const play = () => {
        if ((!revealed && !revealRunning) || resolved || disposed || !finalImg || !document.body.contains(overlay)) {
          stopFinalCardShineLoop();
          return;
        }
        setLightFrameScale(light, 0.95);
        gsap.set(light, { scale: 1, transformOrigin: '50% 50%', force3D: true });
        triggerJourneyNewCardShine(light, finalImg, 0.95, scheduleShineTimeout, scheduleShineFrame);
      };
      play();
      finalCardShineIntervalId = window.setInterval(play, 3000);
    };

    const finish = () => {
      if (resolved) return;
      resolved = true;
      stopSprite9ShineLoop();
      stopFinalCardShineLoop();
      clearPendingShineWork();
      ++framePlaybackId;
      try { cta?.removeEventListener('click', onContinue); } catch {}
      try { hero?.removeEventListener('click', onReveal); } catch {}
      try { hero?.removeEventListener('keydown', onHeroKeyDown); } catch {}
      try { gsap.killTweensOf([overlay, title, subtitle, hero, motion, frameImg, finalImg, light, shadow, cta]); } catch {}
      if (cta) {
        cta.disabled = true;
        cta.classList.remove('animate-enter', 'animate-enter-initial', 'animate-exit');
        cta.style.removeProperty('transition');
        cta.style.removeProperty('-webkit-transition');
        gsap.set(cta, {
          opacity: 1,
          visibility: 'visible',
          y: 0,
          scale: 1,
          transformOrigin: '50% 50%',
          force3D: true,
        });
      }
      const tl = gsap.timeline({
        onComplete: () => {
          cleanupJourneyNewCardScreen();
          resolve({ action: 'continue' });
        },
      });
      tl
        // 1. Continue button exits alone.
        .to(cta, {
          scale: 0,
          opacity: 0,
          y: 20,
          duration: 0.24,
          ease: 'back.in(1.9)',
          overwrite: 'auto',
          force3D: true,
        })
        .set(cta, { visibility: 'hidden' })
        // 2. Card exits immediately after CTA, with its shine/shadow.
        .to(hero, {
          scale: 0,
          opacity: 0,
          y: -30,
          rotate: -8,
          duration: 0.24,
          ease: 'back.in(1.65)',
          force3D: true,
        })
        .set(hero, { visibility: 'hidden' })
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
    };

    const reveal = async () => {
      if (revealed || revealRunning || resolved || disposed) return;
      revealRunning = true;
      stopSprite9ShineLoop();
      clearPendingShineWork();
      const revealFramePlaybackId = ++framePlaybackId;
      try { hero?.setAttribute('aria-disabled', 'true'); } catch {}
      triggerHaptic('medium');

      try {
        gsap.killTweensOf([title, subtitle, hero, frameImg, finalImg, light, shadow, cta]);
        const rd = (s: number) => s * FAST_20;
        if (frameImg) {
          frameImg.src = getCrumbleFramePath(9);
          frameImg.style.opacity = '1';
          frameImg.style.visibility = 'visible';
          gsap.set(frameImg, { y: 0, rotate: 0, scale: 1.2, filter: 'blur(0px)', transformOrigin: '50% 50%', force3D: true });
        }
        setLightFrameScale(light, 1.2);
        gsap.set(light, { scale: 1, transformOrigin: '50% 50%', force3D: true });
        if (finalImg) {
          finalImg.style.visibility = 'visible';
          finalImg.style.opacity = '0';
          gsap.set(finalImg, {
            y: -30,
            scale: 0,
            rotate: -8,
            transformOrigin: '50% 50%',
            force3D: true,
          });
        }

        await new Promise<void>((revealDone) => {
          if (cta) {
            cta.style.marginTop = '24px';
            cta.classList.remove('animate-enter-initial', 'animate-enter', 'animate-exit');
            cta.style.removeProperty('transition');
            cta.style.removeProperty('-webkit-transition');
            gsap.set(cta, {
              opacity: 0,
              visibility: 'visible',
              y: 18,
              scale: 0,
              transformOrigin: '50% 50%',
              force3D: true,
            });
          }
          const coverExitDuration = rd(0.32);
          const cardEnterStart = Math.max(0, coverExitDuration - 0.5);
          const cardEnterDuration = rd(0.52);
          const cardImpactStart = cardEnterStart + cardEnterDuration;
          const cardSecondShineStart = cardImpactStart + rd(0.24);
          const titleStart = cardEnterStart;
          const subtitleStart = cardEnterStart;
          const ctaStart = titleStart + rd(0.2);
          gsap.timeline({
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
                rotate: 0,
                transformOrigin: '50% 50%',
                force3D: true,
              });
              revealDone();
            },
          })
            .set(title, { opacity: 0, y: -16, scale: 0.72 }, 0)
            .set(subtitle, { opacity: 0, y: -12, scale: 0.78 }, 0)
            .set(title, { textContent: 'Unlocked!', opacity: 0, y: -16, scale: 0.72 }, titleStart)
            .set(subtitle, { textContent: revealSubtitle, opacity: 0, y: -12, scale: 0.78 }, titleStart)
            .to(frameImg, { scale: 0, opacity: 0, y: -30, rotate: -8, duration: coverExitDuration, ease: 'back.in(1.65)', force3D: true }, 0)
            .set(light, { opacity: 0 }, 0)
            .call(() => triggerHaptic('light'), undefined, rd(0.22))
            .set(frameImg, { visibility: 'hidden', opacity: 0, scale: 0, y: -30, rotate: -8 }, coverExitDuration)
            .set(shadow, { opacity: 0, y: 8, scaleX: 0.52, scaleY: 0.58 }, cardEnterStart)
            .set(finalImg, {
              opacity: 0,
              visibility: 'visible',
              y: -18,
              scale: 0.58,
              rotate: -5,
              transformOrigin: '50% 50%',
              force3D: true,
            }, cardEnterStart)
            .call(() => {
              setLightMask(light, safeCardPath);
              setLightFrameScale(light, 0.95);
              gsap.set(light, { opacity: 0, scale: 1, transformOrigin: '50% 50%', force3D: true });
              playScreenShake(11, 0.42);
              triggerHaptic('medium');
            }, undefined, cardEnterStart)
            .to(finalImg, {
              opacity: 1,
              y: -4,
              scale: 0.95,
              rotate: 0,
              duration: cardEnterDuration,
              ease: 'back.out(1.85)',
              force3D: true,
            }, cardEnterStart)
            .to(shadow, { opacity: 0.82, y: 8, scaleX: 1.16, scaleY: 1.08, duration: rd(0.24), ease: 'power2.out' }, cardEnterStart)
            .to(title, { opacity: 1, y: 0, scale: 1, duration: rd(0.24), ease: 'back.out(1.65)' }, titleStart)
            .to(subtitle, { opacity: 1, y: 0, scale: 1, duration: rd(0.24), ease: 'back.out(1.65)' }, subtitleStart)
            .to(cta, {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: rd(0.34),
              ease: 'back.out(1.8)',
              force3D: true,
            }, ctaStart)
            .call(() => triggerHaptic('light'), undefined, titleStart)
            .call(() => triggerHaptic('light'), undefined, ctaStart)
            .call(() => {
              if (framePlaybackId !== revealFramePlaybackId || resolved || disposed) return;
              gsap.set(finalImg, {
                opacity: 1,
                visibility: 'visible',
                y: -4,
                scale: 0.95,
                rotate: 0,
                transformOrigin: '50% 50%',
                force3D: true,
              });
              setLightFrameScale(light, 0.95);
              gsap.set(light, { opacity: 0.92, scale: 1, transformOrigin: '50% 50%', force3D: true });
              try {
                light?.classList.remove('shine-trigger');
                finalImg?.classList.remove('glow-pulse');
                void light?.offsetHeight;
                void finalImg?.offsetHeight;
                light?.classList.add('shine-trigger');
                scheduleShineTimeout(() => {
                  light?.classList.remove('shine-trigger');
                }, 1700);
              } catch {}
              playRevealSmoke();
              playScreenShake(22, 0.42);
              triggerHaptic('medium');
            }, undefined, cardImpactStart)
            .call(() => {
              if (framePlaybackId !== revealFramePlaybackId || resolved || disposed) return;
              gsap.set(finalImg, {
                opacity: 1,
                visibility: 'visible',
                y: -4,
                scale: 0.95,
                rotate: 0,
                transformOrigin: '50% 50%',
                force3D: true,
              });
              setLightFrameScale(light, 0.95);
              gsap.set(light, { opacity: 0.92, scale: 1, transformOrigin: '50% 50%', force3D: true });
              triggerJourneyNewCardShine(light, finalImg, 0.95, scheduleShineTimeout, scheduleShineFrame);
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
      } catch {
        if (title) title.textContent = 'Unlocked!';
        if (subtitle) subtitle.textContent = revealSubtitle;
        if (frameImg) {
          frameImg.style.opacity = '0';
          frameImg.style.visibility = 'hidden';
        }
        if (finalImg) {
          finalImg.style.visibility = 'visible';
          finalImg.style.opacity = '1';
        }
        cta?.classList.remove('animate-enter-initial', 'animate-exit');
        cta?.classList.add('animate-enter');
        revealRunning = false;
      }
    };

    const onReveal = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if (revealed && !revealRunning) {
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
    const onContinue = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      try { (window as any).triggerHapticSelection?.(); } catch {}
      finish();
    };

    hero?.addEventListener('click', onReveal);
    hero?.addEventListener('keydown', onHeroKeyDown);
    cta?.addEventListener('click', onContinue);
    cleanupFns.push(() => {
      try { hero?.removeEventListener('click', onReveal); } catch {}
      try { hero?.removeEventListener('keydown', onHeroKeyDown); } catch {}
      try { cta?.removeEventListener('click', onContinue); } catch {}
    });

    const d = (sec: number) => sec * FAST_20;

    gsap.set(title, { opacity: 0, y: -28, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(subtitle, { opacity: 0, y: -22, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(hero, { opacity: 0, y: -30, scale: 0, rotate: -8, transformOrigin: '50% 50%' });
    gsap.set(shadow, { opacity: 0, y: 8, scaleX: 0.42, scaleY: 0.54 });
    gsap.set(light, { scale: 1, transformOrigin: '50% 50%' });
    setLightFrameScale(light, 1);
    gsap.set(cta, { opacity: 0, scale: 0, visibility: 'hidden', transformOrigin: '50% 50%' });
    if (cta) {
      cta.classList.remove('animate-exit', 'animate-enter');
      cta.classList.add('animate-enter-initial');
    }
    setLightMask(light, getCrumbleFramePath(1));

    const enter = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        gsap.to(shadow, {
          opacity: 0.72,
          y: 8,
          scaleX: 0.86,
          scaleY: 0.82,
          duration: d(1.42),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      },
    });
    enter
      .to(title, { opacity: 1, y: 0, scale: 1, duration: d(0.3), ease: 'back.out(1.65)' }, 0)
      .to(subtitle, { opacity: 1, y: 0, scale: 1, duration: d(0.3), ease: 'back.out(1.65)' }, d(0.04))
      .to(hero, { opacity: 1, y: 0, scale: 1, rotate: 0, duration: d(0.65), ease: 'back.out(1.7)' }, d(0.22))
      .to(shadow, { opacity: 1, y: 8, scaleX: 1, scaleY: 1, duration: d(0.32), ease: 'power2.out' }, 0)
      .add(() => {
        const introFramePlaybackId = ++framePlaybackId;
        (async () => {
          await playCrumbleFrames({
            baseImg: frameImg,
            lightEl: light,
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
            setLightFrameScale(light, 1.2);
            gsap.set(light, { opacity: 0.95, scale: 1, transformOrigin: '50% 50%', force3D: true });
            gsap.timeline()
              .set(frameImg, { filter: 'brightness(1)', transformOrigin: '50% 50%', force3D: true })
              .call(() => {
                try {
                  setLightMask(light, getCrumbleFramePath(9));
                  light?.classList.remove('shine-trigger');
                  frameImg.classList.remove('glow-pulse');
                  void light?.offsetHeight;
                  void frameImg.offsetHeight;
                  light?.classList.add('shine-trigger');
                  frameImg.classList.add('glow-pulse');
                  scheduleShineTimeout(() => {
                    light?.classList.remove('shine-trigger');
                    frameImg.classList.remove('glow-pulse');
                    gsap.set(light, { opacity: 0.92, scale: 1, transformOrigin: '50% 50%', force3D: true });
                  }, 1700);
                } catch {}
                playScreenShake(16, 0.38);
                triggerHaptic('medium');
              }, undefined, 0)
              .to(frameImg, { filter: 'brightness(1.32) saturate(1.08)', scale: 1.34, duration: 0.08, ease: 'power2.out' }, 0)
              .to(frameImg, { filter: 'brightness(1.04) saturate(1.02)', scale: 1.2, duration: 0.18, ease: 'back.out(2.1)' })
              .to(frameImg, { filter: 'brightness(1)', duration: 0.16, ease: 'sine.out' }, '<0.04')
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
