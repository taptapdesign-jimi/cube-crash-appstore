// @ts-nocheck
import { gsap } from 'gsap';

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
    try { gsap.killTweensOf(existing.querySelectorAll('*')); } catch {}
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
        radial-gradient(ellipse at center, rgb(255,255,255) 0%, rgb(255,250,244) 48%, rgb(252,238,223) 100%);
      font-family: "LTCrow", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
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
      color: #b58a78;
      font-size: clamp(22px, 4.6vw, 28px);
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: 0.01em;
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
      bottom: calc(-5% - 16px);
      z-index: 0;
      width: 72%;
      height: 13%;
      transform: translateX(-50%);
      border-radius: 999px;
      background: radial-gradient(ellipse at center, rgba(185,105,62,0.34) 0%, rgba(185,105,62,0.2) 42%, rgba(185,105,62,0) 76%);
      filter: blur(12px);
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
    .cc-journey-new-card-frame-next,
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
    .cc-journey-new-card-frame-next {
      opacity: 0;
      z-index: 2;
    }
    .cc-journey-new-card-final {
      opacity: 0;
      visibility: hidden;
      z-index: 3;
    }
    .cc-journey-new-card-light {
      position: absolute;
      inset: 0;
      z-index: 4;
      border-radius: 38px;
      overflow: hidden;
      pointer-events: none;
      opacity: 0.92;
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
    .cc-journey-new-card-cta {
      width: min(68vw, 408px);
      max-width: 408px;
      transform: scale(0);
      opacity: 0;
      visibility: hidden;
      flex: 0 0 auto;
      margin-top: 8px;
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

function getCrumbleFramePath(frame: number): string {
  return `./assets/animations/crumble/crumble${frame}.png`;
}

function setLightMask(lightEl: HTMLElement | null, src: string): void {
  if (!lightEl) return;
  try {
    const mask = `url("${src}")`;
    lightEl.style.webkitMaskImage = mask;
    lightEl.style.maskImage = mask;
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
  nextImg: HTMLImageElement | null;
  motionEl: HTMLElement | null;
  lightEl?: HTMLElement | null;
  frames: number[];
  delays: number[];
  shouldContinue?: () => boolean;
  crossfadeMs?: number;
  motionStrength?: number;
};

async function playCrumbleFrames({
  baseImg,
  nextImg,
  motionEl,
  lightEl,
  frames,
  delays,
  shouldContinue,
  crossfadeMs = 54,
  motionStrength = 1,
}: CrumbleFramePlayerOptions): Promise<void> {
  if (!baseImg || frames.length === 0) return;
  const firstSrc = getCrumbleFramePath(frames[0]);
  baseImg.src = firstSrc;
  setLightMask(lightEl || null, firstSrc);
  baseImg.style.opacity = '1';
  baseImg.style.visibility = 'visible';
  if (nextImg) {
    nextImg.style.opacity = '0';
    nextImg.style.visibility = 'hidden';
  }

  for (let index = 1; index < frames.length; index++) {
    if (shouldContinue && !shouldContinue()) return;
    await wait(delays[index - 1] ?? 80);
    if (shouldContinue && !shouldContinue()) return;

    const nextSrc = getCrumbleFramePath(frames[index]);
    setLightMask(lightEl || null, nextSrc);
    if (!nextImg) {
      baseImg.src = nextSrc;
      continue;
    }

    nextImg.src = nextSrc;
    nextImg.style.visibility = 'visible';
    nextImg.style.opacity = '0';

    try { gsap.killTweensOf([baseImg, nextImg, motionEl]); } catch {}
    const tl = gsap.timeline();
    const direction = index % 2 === 0 ? 1 : -1;
    tl.set(nextImg, { opacity: 0, filter: 'blur(0.45px) brightness(1.04)' }, 0)
      .to(nextImg, { opacity: 1, filter: 'blur(0px) brightness(1)', duration: crossfadeMs / 1000, ease: 'sine.out' }, 0)
      .to(baseImg, { opacity: 0.18, duration: crossfadeMs / 1000, ease: 'sine.out' }, 0);

    if (motionEl) {
      tl.to(motionEl, {
        y: -2.2 * motionStrength,
        rotate: direction * 0.42 * motionStrength,
        scale: 1 + 0.008 * motionStrength,
        duration: Math.max(0.06, crossfadeMs / 1000),
        ease: 'sine.out',
      }, 0)
        .to(motionEl, {
          y: 0,
          rotate: 0,
          scale: 1,
          duration: 0.1,
          ease: 'sine.inOut',
        }, '>');
    }

    await new Promise<void>((resolve) => {
      tl.eventCallback('onComplete', resolve);
    });

    baseImg.src = nextSrc;
    baseImg.style.opacity = '1';
    baseImg.style.filter = '';
    nextImg.style.opacity = '0';
    nextImg.style.visibility = 'hidden';
    nextImg.style.filter = '';
  }
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

  await Promise.all([
    ...Array.from({ length: 10 }, (_, i) => preloadImage(getCrumbleFramePath(i + 1))),
    preloadImage(safeCardPath),
  ]);

  return new Promise((resolve) => {
    let resolved = false;
    let revealed = false;
    let revealRunning = false;
    let disposed = false;
    let framePlaybackId = 0;
    const hapticTimeouts: number[] = [];

    const overlay = document.createElement('div');
    overlay.id = 'cc-journey-new-card-overlay';
    overlay.innerHTML = `
      <h1 class="cc-journey-new-card-title" style="opacity:0;transform:scale(0) translateY(-28px);">New Card</h1>
      <p class="cc-journey-new-card-subtitle" style="opacity:0;transform:scale(0) translateY(-22px);">Tap the card to reveal</p>
      <div class="cc-journey-new-card-content">
        <div class="cc-journey-new-card-hero" role="button" aria-label="Reveal ${safeCardName}" tabindex="0" style="opacity:0;transform:translateY(-30px) scale(0) rotate(-8deg);">
          <div class="cc-journey-new-card-shadow" style="opacity:0;transform:translateX(-50%) scale(0.68, 0.72);"></div>
          <div class="cc-journey-new-card-motion">
            <img class="cc-journey-new-card-frame" src="${getCrumbleFramePath(1)}" alt="">
            <img class="cc-journey-new-card-frame-next" src="${getCrumbleFramePath(1)}" alt="">
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
    const frameNextImg = overlay.querySelector('.cc-journey-new-card-frame-next') as HTMLImageElement | null;
    const finalImg = overlay.querySelector('.cc-journey-new-card-final') as HTMLImageElement | null;
    const light = overlay.querySelector('.cc-journey-new-card-light') as HTMLElement | null;
    const shadow = overlay.querySelector('.cc-journey-new-card-shadow') as HTMLElement | null;
    const cta = overlay.querySelector('.cc-journey-new-card-cta') as HTMLButtonElement | null;

    cleanupFns.push(() => {
      disposed = true;
      hapticTimeouts.splice(0).forEach((timeoutId) => {
        try { window.clearTimeout(timeoutId); } catch {}
      });
      try { gsap.killTweensOf([title, subtitle, hero, motion, frameImg, frameNextImg, finalImg, light, shadow, cta]); } catch {}
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

    const finish = () => {
      if (resolved) return;
      resolved = true;
      try { cta?.removeEventListener('click', onContinue); } catch {}
      try { hero?.removeEventListener('click', onReveal); } catch {}
      try { hero?.removeEventListener('keydown', onHeroKeyDown); } catch {}
      try { gsap.killTweensOf([title, subtitle, hero, motion, frameImg, frameNextImg, finalImg, light, shadow, cta]); } catch {}
      if (cta) {
        cta.disabled = true;
        cta.classList.remove('animate-enter');
      }
      const tl = gsap.timeline({
        onComplete: () => {
          cleanupJourneyNewCardScreen();
          resolve({ action: 'continue' });
        },
      });
      tl.to(title, { scale: 0, opacity: 0, y: -28, duration: 0.3, ease: 'back.in(1.65)' }, 0.08)
        .to(subtitle, { scale: 0, opacity: 0, y: -22, duration: 0.3, ease: 'back.in(1.65)' }, 0.11)
        .to(hero, { scale: 0, opacity: 0, y: -30, rotate: -8, duration: 0.32, ease: 'back.in(1.65)' }, 0.16)
        .to(shadow, { opacity: 0, scaleX: 0.42, scaleY: 0.54, duration: 0.32, ease: 'power2.inOut' }, 0.16)
        .to(cta, { scale: 0, opacity: 0, y: 20, duration: 0.28, ease: 'back.in(1.65)' }, 0.12)
        .to(overlay, { opacity: 0, duration: 0.1, ease: 'power2.inOut' }, 0.68);
    };

    const reveal = async () => {
      if (revealed || revealRunning || resolved || disposed) return;
      revealRunning = true;
      const revealFramePlaybackId = ++framePlaybackId;
      try { hero?.setAttribute('aria-disabled', 'true'); } catch {}
      triggerHaptic('medium');

      try {
        gsap.killTweensOf(hero);
        const rotationDeg = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 5);
        const bounce = gsap.timeline();
        bounce
          .to(hero, { scale: 0.7, rotation: 0, duration: 0.09, ease: 'power2.out', force3D: true })
          .to(hero, { scale: 1.28, rotation: rotationDeg, duration: 0.12, ease: 'power2.out', force3D: true })
          .to(hero, { scale: 1, rotation: 0, duration: 0.09, ease: 'power2.inOut', force3D: true });
      } catch {}

      const framePromise = (async () => {
        await playCrumbleFrames({
          baseImg: frameImg,
          nextImg: frameNextImg,
          motionEl: motion,
          lightEl: light,
          frames: [6, 7, 8, 9, 10],
          delays: [46, 39, 31, 22],
          crossfadeMs: 20,
          motionStrength: 1.15,
          shouldContinue: () => framePlaybackId === revealFramePlaybackId && !resolved && !disposed,
        });
        if (framePlaybackId !== revealFramePlaybackId || resolved || disposed) return;
        if (frameImg) {
          frameImg.style.opacity = '0';
          frameImg.style.visibility = 'hidden';
        }
        if (finalImg) {
          finalImg.style.visibility = 'visible';
          finalImg.style.opacity = '1';
          finalImg.style.transform = 'scale(1) rotateY(0deg)';
        }
        setLightMask(light, safeCardPath);
      })();

      try {
        gsap.killTweensOf([title, subtitle, light, cta]);
        const revealTl = gsap.timeline({
          onComplete: () => {
            if (!cta) return;
            cta.style.removeProperty('opacity');
            cta.style.removeProperty('visibility');
            cta.style.removeProperty('transform');
            cta.style.removeProperty('-webkit-transform');
            cta.classList.add('animate-enter');
          },
        });
        revealTl
          .to(title, { opacity: 0, y: -14, scale: 0.82, duration: 0.16, ease: 'power2.in' }, 0)
          .to(subtitle, { opacity: 0, y: -10, scale: 0.86, duration: 0.16, ease: 'power2.in' }, 0.03)
          .set(title, { textContent: 'Card Unlocked!', y: -16, scale: 0.72 }, 0.08)
          .set(subtitle, { textContent: 'Added to Collection', y: -12, scale: 0.78 }, 0.08)
          .to(title, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'back.out(1.65)' }, 0.1)
          .to(subtitle, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'back.out(1.65)' }, 0.15)
          .to(light, { opacity: 0.92, duration: 0.16, ease: 'power2.out' }, 0.06);
        framePromise.catch(() => {});
        revealed = true;
      } catch {
        if (title) title.textContent = 'Card Unlocked!';
        if (subtitle) subtitle.textContent = 'Added to Collection';
        if (frameImg) frameImg.style.opacity = '0';
        if (finalImg) {
          finalImg.style.visibility = 'visible';
          finalImg.style.opacity = '1';
        }
        cta?.classList.add('animate-enter');
      }

      scheduleHaptic(0, 'medium');
      scheduleHaptic(130, 'light');
      scheduleHaptic(260, 'medium');
      revealRunning = false;
    };

    const onReveal = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
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

    gsap.set(title, { opacity: 0, y: -28, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(subtitle, { opacity: 0, y: -22, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(hero, { opacity: 0, y: -30, scale: 0, rotate: -8, transformOrigin: '50% 50%' });
    gsap.set(shadow, { opacity: 0, scaleX: 0.42, scaleY: 0.54 });
    gsap.set(cta, { opacity: 0, scale: 0, visibility: 'hidden', transformOrigin: '50% 50%' });
    setLightMask(light, getCrumbleFramePath(1));

    const enter = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        gsap.to(shadow, {
          opacity: 0.72,
          scaleX: 0.86,
          scaleY: 0.82,
          duration: 1.42,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      },
    });
    enter
      .to(title, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.65)' }, 0)
      .to(subtitle, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.65)' }, 0.04)
      .to(hero, { opacity: 1, y: 0, scale: 1, rotate: 0, duration: 0.65, ease: 'back.out(1.7)' }, 0.22)
      .to(shadow, { opacity: 1, scaleX: 1, scaleY: 1, duration: 0.32, ease: 'power2.out' }, 0.22)
      .add(() => {
        const introFramePlaybackId = ++framePlaybackId;
        (async () => {
          await playCrumbleFrames({
            baseImg: frameImg,
            nextImg: frameNextImg,
            motionEl: motion,
            lightEl: light,
            frames: [1, 2, 3, 4, 5, 6],
            delays: [54, 50, 46, 50, 58],
            crossfadeMs: 42,
            motionStrength: 0.38,
            shouldContinue: () => framePlaybackId === introFramePlaybackId && !resolved && !disposed,
          });
          if (framePlaybackId !== introFramePlaybackId || resolved || disposed) return;
          if (frameImg) frameImg.src = getCrumbleFramePath(6);
        })().catch(() => {});
      }, 0.87);

    scheduleHaptic(0, 'medium');
    scheduleHaptic(150, 'light');
    scheduleHaptic(300, 'medium');
  });
}

export { cleanupJourneyNewCardScreen };
