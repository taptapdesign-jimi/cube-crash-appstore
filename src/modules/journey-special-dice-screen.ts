// @ts-nocheck
import { gsap } from 'gsap';

type SpecialDiceType = 'juice';

type JourneySpecialDiceScreenOptions = {
  diceType: SpecialDiceType;
};

const STYLE_ID = 'cc-journey-special-dice-style';
const OVERLAY_ID = 'cc-journey-special-dice-overlay';
const JUICE_UNLOCK_KEY = 'cc_special_dice_unlocked_juice';

let cleanupFns: Array<() => void> = [];

export function isJourneySpecialDiceUnlocked(diceType: SpecialDiceType): boolean {
  if (diceType !== 'juice') return false;
  try {
    return localStorage.getItem(JUICE_UNLOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markJourneySpecialDiceUnlocked(diceType: SpecialDiceType): void {
  if (diceType !== 'juice') return;
  try {
    localStorage.setItem(JUICE_UNLOCK_KEY, 'true');
  } catch {}
}

function cleanupJourneySpecialDiceScreen(): void {
  cleanupFns.forEach((fn) => {
    try { fn(); } catch {}
  });
  cleanupFns = [];
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    try { gsap.killTweensOf([existing, ...Array.from(existing.querySelectorAll('*'))]); } catch {}
    try { existing.remove(); } catch {}
  }
  const style = document.getElementById(STYLE_ID);
  if (style) {
    try { style.remove(); } catch {}
  }
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 1296000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      box-sizing: border-box;
      padding: clamp(84px, 13.5vh, 132px) 24px max(42px, env(safe-area-inset-bottom));
      background:
        linear-gradient(rgba(243,238,232,0.65), rgba(243,238,232,0.65)),
        url('./assets/paper-bg.png') center / 100% 100% no-repeat,
        radial-gradient(ellipse at center, rgb(255,255,255) 0%, rgb(255,250,244) 48%, rgb(252,238,223) 100%);
      font-family: "Baloo2", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      color: #b58a78;
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
      touch-action: manipulation;
    }
    .cc-journey-special-dice-title {
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
    .cc-journey-special-dice-subtitle {
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
    .cc-journey-special-dice-content {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: clamp(20px, 4.2vh, 42px);
      margin-top: clamp(70px, 12.5vh, 116px);
    }
    .cc-journey-special-dice-hero {
      position: relative;
      width: min(68vw, 380px);
      aspect-ratio: 379 / 438;
      display: grid;
      place-items: center;
      overflow: visible;
      cursor: pointer;
      transform-origin: 50% 50%;
      -webkit-tap-highlight-color: transparent;
      margin-top: -64px;
    }
    .cc-journey-special-dice-shadow {
      position: absolute;
      left: 50%;
      bottom: calc(-5% - 28px);
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
    .cc-journey-special-dice-motion {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      overflow: visible;
      animation: ccJourneySpecialDiceIdle 3s ease-in-out infinite;
      transform-origin: 50% 50%;
      pointer-events: none;
    }
    .cc-journey-special-dice-backpack,
    .cc-journey-special-dice-final {
      grid-area: 1 / 1;
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      position: relative;
      z-index: 1;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
      filter: drop-shadow(0 12px 26px rgba(161, 91, 54, 0.22));
    }
    .cc-journey-special-dice-final {
      width: 52%;
      height: 52%;
      opacity: 0;
      visibility: hidden;
      z-index: 3;
      filter: drop-shadow(0 16px 30px rgba(232, 116, 74, 0.26));
    }
    .cc-journey-special-dice-light {
      position: absolute;
      inset: 0;
      z-index: 4;
      border-radius: 38px;
      overflow: hidden;
      pointer-events: none;
      opacity: 0;
      transform-origin: 50% 50%;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      -webkit-mask-position: center;
      mask-position: center;
      -webkit-mask-size: contain;
      mask-size: contain;
    }
    .cc-journey-special-dice-light::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.56) 50%, rgba(255,255,255,0) 100%);
      transform: translateX(-160%) skewX(-12deg) translateZ(0);
      opacity: 0;
      display: block;
      filter: blur(0.56px);
      pointer-events: none;
      animation: ccJourneySpecialDiceShimmer 1.7s linear infinite;
    }
    .cc-journey-special-dice-cta {
      width: min(68vw, 408px);
      max-width: 408px;
      transform: scale(0);
      -webkit-transform: scale(0);
      opacity: 0;
      visibility: hidden;
      flex: 0 0 auto;
      margin-top: 24px;
    }
    @keyframes ccJourneySpecialDiceIdle {
      0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
      50% { transform: translateY(-8px) rotate(1deg) scale(1.02); }
    }
    @keyframes ccJourneySpecialDiceShimmer {
      0%, 10% { transform: translateX(-160%) skewX(-12deg); opacity: 0; }
      15% { transform: translateX(-120%) skewX(-12deg); opacity: 0.5; }
      20%, 40% { opacity: 1; }
      30% { transform: translateX(0%) skewX(-12deg); opacity: 1; }
      45% { transform: translateX(120%) skewX(-12deg); opacity: 0.5; }
      50%, 100% { transform: translateX(160%) skewX(-12deg); opacity: 0; }
    }
    @media (max-height: 760px) {
      #${OVERLAY_ID} {
        padding-top: 56px;
      }
      .cc-journey-special-dice-content {
        gap: 18px;
        margin-top: 42px;
      }
      .cc-journey-special-dice-hero {
        width: min(64vw, 330px);
        margin-top: -64px;
      }
      .cc-journey-special-dice-cta {
        margin-top: 18px;
      }
    }
  `;
  document.head.appendChild(style);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function getBackpackFramePath(frame: number): string {
  return `./assets/animations/backpack/backpack-${frame}.png`;
}

function setLightMask(lightEl: HTMLElement | null, src: string): void {
  if (!lightEl) return;
  try {
    const mask = `url("${src}")`;
    lightEl.style.webkitMaskImage = mask;
    lightEl.style.maskImage = mask;
  } catch {}
}

async function playBackpackFrames(img: HTMLImageElement | null, light: HTMLElement | null, isActive: () => boolean): Promise<void> {
  if (!img) return;
  for (let frame = 1; frame <= 20; frame++) {
    if (!isActive()) return;
    const src = getBackpackFramePath(frame);
    img.src = src;
    setLightMask(light, src);
    try {
      gsap.killTweensOf(img);
      gsap.fromTo(img, {
        filter: 'blur(1.6px) brightness(1.04)',
        scale: frame >= 18 ? 1.08 : 1.02,
        transformOrigin: '50% 50%',
        force3D: true,
      }, {
        filter: 'blur(0px) brightness(1)',
        scale: 1,
        duration: 0.045,
        ease: 'sine.out',
        force3D: true,
      });
    } catch {}
    if (frame === 1 || frame === 7 || frame === 14 || frame === 20) {
      try { (window as any).triggerHapticImpact?.(frame === 20 ? 'medium' : 'light'); } catch {}
    }
    await wait(frame >= 17 ? 64 : 46);
  }
}

export async function showJourneySpecialDiceScreen({
  diceType,
}: JourneySpecialDiceScreenOptions): Promise<{ action: 'continue' }> {
  cleanupJourneySpecialDiceScreen();
  ensureStyles();

  const finalAsset = diceType === 'juice' ? './assets/wild-juice.png' : './assets/wild.png';

  await Promise.all([
    ...Array.from({ length: 20 }, (_, i) => preloadImage(getBackpackFramePath(i + 1))),
    preloadImage(finalAsset),
  ]);

  return new Promise((resolve) => {
    let resolved = false;
    let revealed = false;
    let revealRunning = false;
    let disposed = false;
    let shineIntervalId: number | null = null;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <h1 class="cc-journey-special-dice-title" style="opacity:0;transform:scale(0) translateY(-28px);">Special Dice</h1>
      <p class="cc-journey-special-dice-subtitle" style="opacity:0;transform:scale(0) translateY(-22px);">Tap the backpack to reveal</p>
      <div class="cc-journey-special-dice-content">
        <div class="cc-journey-special-dice-hero" role="button" aria-label="Reveal special dice" tabindex="0" style="opacity:0;transform:translateY(-30px) scale(0) rotate(-8deg);">
          <div class="cc-journey-special-dice-shadow" style="opacity:0;transform:translateX(-50%) scale(0.68, 0.72);"></div>
          <div class="cc-journey-special-dice-motion">
            <img class="cc-journey-special-dice-backpack" src="${getBackpackFramePath(1)}" alt="">
            <img class="cc-journey-special-dice-final" src="${finalAsset}" alt="Wild juice">
            <div class="cc-journey-special-dice-light" aria-hidden="true"></div>
          </div>
        </div>
        <button class="cc-journey-special-dice-cta restart-btn primary-button bottom-sheet-cta" type="button">Continue</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const title = overlay.querySelector('.cc-journey-special-dice-title') as HTMLElement | null;
    const subtitle = overlay.querySelector('.cc-journey-special-dice-subtitle') as HTMLElement | null;
    const hero = overlay.querySelector('.cc-journey-special-dice-hero') as HTMLElement | null;
    const motion = overlay.querySelector('.cc-journey-special-dice-motion') as HTMLElement | null;
    const backpack = overlay.querySelector('.cc-journey-special-dice-backpack') as HTMLImageElement | null;
    const finalImg = overlay.querySelector('.cc-journey-special-dice-final') as HTMLImageElement | null;
    const light = overlay.querySelector('.cc-journey-special-dice-light') as HTMLElement | null;
    const shadow = overlay.querySelector('.cc-journey-special-dice-shadow') as HTMLElement | null;
    const cta = overlay.querySelector('.cc-journey-special-dice-cta') as HTMLButtonElement | null;

    const stopShineLoop = () => {
      if (shineIntervalId === null) return;
      try { window.clearInterval(shineIntervalId); } catch {}
      shineIntervalId = null;
    };

    cleanupFns.push(() => {
      disposed = true;
      stopShineLoop();
      try { gsap.killTweensOf([overlay, title, subtitle, hero, motion, backpack, finalImg, light, shadow, cta]); } catch {}
    });

    const playScreenShake = (strength = 12, duration = 0.36) => {
      if (resolved || disposed || !document.body.contains(overlay)) return;
      try {
        gsap.killTweensOf(overlay, 'x,y');
        gsap.timeline()
          .to(overlay, { x: strength, y: -strength * 0.45, duration: duration * 0.12, ease: 'power2.out' })
          .to(overlay, { x: -strength * 0.85, y: strength * 0.35, duration: duration * 0.12, ease: 'power2.inOut' })
          .to(overlay, { x: strength * 0.55, y: -strength * 0.25, duration: duration * 0.14, ease: 'power2.inOut' })
          .to(overlay, { x: 0, y: 0, duration: duration * 0.62, ease: 'elastic.out(1, 0.55)' });
      } catch {}
    };

    const startShineLoop = () => {
      stopShineLoop();
      const play = () => {
        if (!revealed || resolved || disposed || !finalImg || !light || !document.body.contains(overlay)) {
          stopShineLoop();
          return;
        }
        try {
          setLightMask(light, finalAsset);
          gsap.set(light, { opacity: 0.92, scale: 0.56, transformOrigin: '50% 50%', force3D: true });
          gsap.timeline()
            .fromTo(light, { opacity: 0.9 }, { opacity: 0.92, duration: 0.01 })
            .fromTo(finalImg, { scale: 0.52 }, { scale: 0.56, duration: 0.14, ease: 'back.out(2)' })
            .to(finalImg, { scale: 0.52, duration: 0.18, ease: 'sine.out' });
        } catch {}
      };
      play();
      shineIntervalId = window.setInterval(play, 3000);
    };

    const finish = () => {
      if (resolved) return;
      resolved = true;
      stopShineLoop();
      try { cta?.removeEventListener('click', onContinue); } catch {}
      try { hero?.removeEventListener('click', onReveal); } catch {}
      try { hero?.removeEventListener('keydown', onHeroKeyDown); } catch {}
      try { gsap.killTweensOf([overlay, title, subtitle, hero, motion, backpack, finalImg, light, shadow, cta]); } catch {}
      if (cta) cta.disabled = true;
      gsap.timeline({
        onComplete: () => {
          cleanupJourneySpecialDiceScreen();
          resolve({ action: 'continue' });
        },
      })
        .to(cta, { scale: 0, opacity: 0, y: 20, duration: 0.22, ease: 'back.in(1.7)', force3D: true })
        .set(cta, { visibility: 'hidden' })
        .to(hero, { scale: 0, opacity: 0, y: -30, rotate: -8, duration: 0.24, ease: 'back.in(1.65)', force3D: true })
        .set(hero, { visibility: 'hidden' })
        .to(title, { scale: 0, opacity: 0, y: -34, duration: 0.18, ease: 'back.in(1.55)', force3D: true })
        .set(title, { visibility: 'hidden' })
        .to(subtitle, { scale: 0, opacity: 0, y: -28, duration: 0.18, ease: 'back.in(1.55)', force3D: true })
        .set(subtitle, { visibility: 'hidden' })
        .to(overlay, { opacity: 0, duration: 0.1, ease: 'power2.inOut' });
    };

    const reveal = async () => {
      if (revealed || revealRunning || resolved || disposed) return;
      revealRunning = true;
      try { hero?.setAttribute('aria-disabled', 'true'); } catch {}
      try { (window as any).triggerHapticImpact?.('medium'); } catch {}
      try {
        await playBackpackFrames(backpack, light, () => !resolved && !disposed && revealRunning);
        if (resolved || disposed) return;

        if (backpack) {
          gsap.set(backpack, { scale: 1, opacity: 1, y: 0, rotate: 0, transformOrigin: '50% 50%' });
        }
        if (finalImg) {
          finalImg.style.visibility = 'visible';
          gsap.set(finalImg, { opacity: 0, scale: 0, y: -18, rotate: -5, transformOrigin: '50% 50%', force3D: true });
        }
        setLightMask(light, finalAsset);

        await new Promise<void>((done) => {
          gsap.timeline({ onComplete: done })
            .set(title, { textContent: 'Unlocked!', opacity: 0, y: -16, scale: 0.72 }, 0)
            .set(subtitle, { textContent: 'Special dice unlocked "juice"', opacity: 0, y: -12, scale: 0.78 }, 0)
            .to(backpack, { scale: 0, opacity: 0, y: -30, rotate: -8, duration: 0.32, ease: 'back.in(1.65)', force3D: true }, 0)
            .set(backpack, { visibility: 'hidden' }, 0.32)
            .set(shadow, { opacity: 0, y: 8, scaleX: 0.52, scaleY: 0.58 }, 0.02)
            .call(() => {
              playScreenShake(13, 0.42);
              try { (window as any).triggerHapticImpact?.('medium'); } catch {}
            }, undefined, 0.04)
            .to(finalImg, { opacity: 1, y: -4, scale: 0.52, rotate: 0, duration: 0.52, ease: 'back.out(1.85)', force3D: true }, 0.02)
            .to(shadow, { opacity: 0.82, y: 8, scaleX: 1.16, scaleY: 1.08, duration: 0.24, ease: 'power2.out' }, 0.02)
            .to(title, { opacity: 1, y: 0, scale: 1, duration: 0.24, ease: 'back.out(1.65)' }, 0.02)
            .to(subtitle, { opacity: 1, y: 0, scale: 1, duration: 0.24, ease: 'back.out(1.65)' }, 0.02)
            .to(cta, { opacity: 1, visibility: 'visible', y: 0, scale: 1, duration: 0.34, ease: 'back.out(1.8)', force3D: true }, 0.22)
            .call(() => {
              if (resolved || disposed) return;
              gsap.set(light, { opacity: 0.92, scale: 0.56, transformOrigin: '50% 50%', force3D: true });
              playScreenShake(22, 0.42);
              markJourneySpecialDiceUnlocked(diceType);
              startShineLoop();
            }, undefined, 0.54);
        });

        revealed = true;
      } finally {
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

    gsap.set(title, { opacity: 0, y: -28, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(subtitle, { opacity: 0, y: -22, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(hero, { opacity: 0, y: -30, scale: 0, rotate: -8, transformOrigin: '50% 50%' });
    gsap.set(shadow, { opacity: 0, y: 8, scaleX: 0.42, scaleY: 0.54 });
    gsap.set(cta, { opacity: 0, scale: 0, visibility: 'hidden', y: 18, transformOrigin: '50% 50%' });
    gsap.set(light, { opacity: 0, scale: 1, transformOrigin: '50% 50%' });
    setLightMask(light, getBackpackFramePath(1));

    gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        gsap.to(shadow, {
          opacity: 0.72,
          y: 8,
          scaleX: 0.86,
          scaleY: 0.82,
          duration: 1.14,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      },
    })
      .to(title, { opacity: 1, y: 0, scale: 1, duration: 0.24, ease: 'back.out(1.65)' }, 0)
      .to(subtitle, { opacity: 1, y: 0, scale: 1, duration: 0.24, ease: 'back.out(1.65)' }, 0.03)
      .to(hero, { opacity: 1, y: 0, scale: 1, rotate: 0, duration: 0.52, ease: 'back.out(1.7)' }, 0.18)
      .to(shadow, { opacity: 1, y: 8, scaleX: 1, scaleY: 1, duration: 0.26, ease: 'power2.out' }, 0);

    try { (window as any).triggerHapticImpact?.('medium'); } catch {}
  });
}

export { cleanupJourneySpecialDiceScreen };
