// @ts-nocheck
import { gsap } from 'gsap';

let cleanupFns: Array<() => void> = [];

function cleanupTutorialCompleteModal(): void {
  cleanupFns.forEach((fn) => {
    try { fn(); } catch {}
  });
  cleanupFns = [];
  const existing = document.getElementById('cc-tutorial-complete-overlay');
  if (existing) {
    try { gsap.killTweensOf(existing.querySelectorAll('*')); } catch {}
    try { existing.remove(); } catch {}
  }
  const style = document.getElementById('cc-tutorial-complete-style');
  if (style) {
    try { style.remove(); } catch {}
  }
}

function ensureTutorialCompleteStyles(): void {
  if (document.getElementById('cc-tutorial-complete-style')) return;
  const style = document.createElement('style');
  style.id = 'cc-tutorial-complete-style';
  style.textContent = `
    #cc-tutorial-complete-overlay {
      position: fixed;
      inset: 0;
      z-index: 1300000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      box-sizing: border-box;
      padding: clamp(92px, 15vh, 150px) 24px max(42px, env(safe-area-inset-bottom));
      background:
        radial-gradient(ellipse at center, rgba(255,255,255,0.88) 0%, rgba(255,250,244,0.94) 48%, rgba(252,238,223,0.96) 100%);
      font-family: "Baloo2", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      color: #b58a78;
      overflow: hidden;
    }
    .cc-tutorial-complete-title {
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
    .cc-tutorial-complete-subtitle {
      margin: 26px 0 0;
      color: #b58a78;
      font-size: clamp(23px, 5.1vw, 32px);
      line-height: 1.2;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-align: center;
      position: relative;
      top: -16px;
    }
    .cc-tutorial-complete-content {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: clamp(44px, 7vh, 82px);
      margin-top: clamp(76px, 15vh, 132px);
    }
    .cc-tutorial-complete-hero {
      position: relative;
      width: min(68vw, 420px);
      aspect-ratio: 1 / 1;
      display: grid;
      place-items: center;
      overflow: visible;
      margin-top: -24px;
    }
    .cc-tutorial-complete-shadow {
      position: absolute;
      left: 50%;
      bottom: calc(-3% - 24px);
      z-index: 0;
      width: 76%;
      height: 18%;
      transform: translateX(-50%);
      border-radius: 999px;
      background: radial-gradient(ellipse at center, rgba(185,105,62,0.34) 0%, rgba(185,105,62,0.2) 42%, rgba(185,105,62,0) 76%);
      filter: blur(12px);
      opacity: 0;
      pointer-events: none;
    }
    .cc-tutorial-complete-thumb {
      position: relative;
      z-index: 1;
      top: -16px;
      width: 100%;
      height: 100%;
      object-fit: contain;
      transform-origin: 50% 74%;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
      opacity: 0;
    }
    .cc-tutorial-complete-thumb.animate-enter-initial {
      opacity: 1 !important;
      transform: translateY(-30px) scale(0) rotate(-8deg) !important;
      -webkit-transform: translateY(-30px) scale(0) rotate(-8deg) !important;
      transition: none !important;
      -webkit-transition: none !important;
      will-change: transform, opacity !important;
    }
    .cc-tutorial-complete-thumb.animate-enter {
      opacity: 1 !important;
      transform: translateY(0) scale(1) rotate(0deg) !important;
      -webkit-transform: translateY(0) scale(1) rotate(0deg) !important;
      transition:
        transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6),
        opacity 0.16s ease !important;
      -webkit-transition:
        -webkit-transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6),
        opacity 0.16s ease !important;
      will-change: transform, opacity !important;
    }
    .cc-tutorial-complete-cta {
      width: min(68vw, 408px);
      max-width: 408px;
      transform: scale(0);
      opacity: 0;
      flex: 0 0 auto;
      margin-top: 48px;
    }
    .cc-tutorial-complete-cta.animate-enter-initial {
      opacity: 1 !important;
      visibility: hidden !important;
      transform: scale(0) !important;
      -webkit-transform: scale(0) !important;
      transition: none !important;
      -webkit-transition: none !important;
    }
    .cc-tutorial-complete-cta.animate-enter {
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
    .cc-tutorial-complete-cta.animate-exit {
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
    @media (max-height: 760px) {
      #cc-tutorial-complete-overlay {
        padding-top: 58px;
      }
      .cc-tutorial-complete-content {
        gap: 30px;
        margin-top: 42px;
      }
      .cc-tutorial-complete-hero {
        width: min(58vw, 320px);
      }
    }
  `;
  document.head.appendChild(style);
}

export async function showTutorialCompleteModal(): Promise<{ action: 'continue' }> {
  cleanupTutorialCompleteModal();
  ensureTutorialCompleteStyles();

  return new Promise((resolve) => {
    let resolved = false;
    let disposed = false;
    const overlay = document.createElement('div');
    overlay.id = 'cc-tutorial-complete-overlay';
    overlay.innerHTML = `
      <h1 class="cc-tutorial-complete-title" style="opacity:0;transform:scale(0) translateY(-28px);">Congrats!</h1>
      <p class="cc-tutorial-complete-subtitle" style="opacity:0;transform:scale(0) translateY(-22px);">You cleared the board.</p>
      <div class="cc-tutorial-complete-content">
        <div class="cc-tutorial-complete-hero" aria-hidden="true">
          <div class="cc-tutorial-complete-shadow" style="opacity:0;transform:translateX(-50%) scale(0.68, 0.72);"></div>
          <img class="cc-tutorial-complete-thumb animate-enter-initial" src="./assets/thumbs-up@2x.png" alt="" style="opacity:1;transform:translateY(-30px) scale(0) rotate(-8deg);">
        </div>
        <button class="cc-tutorial-complete-cta restart-btn primary-button bottom-sheet-cta" type="button">Continue</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const title = overlay.querySelector('.cc-tutorial-complete-title') as HTMLElement | null;
    const subtitle = overlay.querySelector('.cc-tutorial-complete-subtitle') as HTMLElement | null;
    const hero = overlay.querySelector('.cc-tutorial-complete-hero') as HTMLElement | null;
    const thumb = overlay.querySelector('.cc-tutorial-complete-thumb') as HTMLImageElement | null;
    const shadow = overlay.querySelector('.cc-tutorial-complete-shadow') as HTMLElement | null;
    const cta = overlay.querySelector('.cc-tutorial-complete-cta') as HTMLButtonElement | null;
    const hapticTimeouts: number[] = [];
    cleanupFns.push(() => {
      disposed = true;
      hapticTimeouts.splice(0).forEach((timeoutId) => {
        try { window.clearTimeout(timeoutId); } catch {}
      });
      try { (thumb as any)?.__ccTutorialThumbIdleTween?.kill?.(); } catch {}
      try { gsap.killTweensOf([title, subtitle, hero, thumb, shadow, cta]); } catch {}
    });

    const finish = () => {
      if (resolved) return;
      resolved = true;
      cleanupFns = cleanupFns.filter((fn) => fn !== finish);
      try { cta && cta.removeEventListener('click', onContinue); } catch {}
      try { gsap.killTweensOf([title, subtitle, hero, thumb, shadow, cta]); } catch {}
      if (thumb) {
        thumb.classList.remove('animate-enter', 'animate-enter-initial');
      }
      if (cta) {
        cta.classList.remove('animate-enter', 'animate-enter-initial', 'animate-exit');
        cta.style.removeProperty('transition');
        cta.style.removeProperty('-webkit-transition');
        cta.style.removeProperty('transform');
        cta.style.removeProperty('-webkit-transform');
        cta.style.removeProperty('opacity');
        cta.style.removeProperty('visibility');
        cta.classList.add('animate-exit');
      }
      const tl = gsap.timeline({
        onComplete: () => {
          cleanupTutorialCompleteModal();
          resolve({ action: 'continue' });
        },
      });
      tl.to(title, { scale: 0, opacity: 0, y: -28, duration: 0.3, ease: 'back.in(1.65)' }, 0.12)
        .to(subtitle, { scale: 0, opacity: 0, y: -22, duration: 0.3, ease: 'back.in(1.65)' }, 0.15)
        .to(thumb, { scale: 0, opacity: 0, y: -30, rotate: -8, duration: 0.32, ease: 'back.in(1.65)' }, 0.18)
        .to(shadow, { opacity: 0, scaleX: 0.42, scaleY: 0.54, duration: 0.32, ease: 'power2.inOut' }, 0.18)
        .to(overlay, { opacity: 0, duration: 0.1, ease: 'power2.inOut' }, 0.72);
    };

    const onContinue = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      try { (window as any).triggerHapticSelection?.(); } catch {}
      if (cta) cta.disabled = true;
      finish();
    };

    cta?.addEventListener('click', onContinue);
    cleanupFns.push(() => {
      try { cta?.removeEventListener('click', onContinue); } catch {}
    });

    gsap.set(title, { opacity: 0, y: -28, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(subtitle, { opacity: 0, y: -22, scale: 0, transformOrigin: '50% 50%' });
    if (thumb) {
      thumb.classList.remove('animate-enter');
      thumb.classList.add('animate-enter-initial');
      thumb.style.removeProperty('transition');
      thumb.style.removeProperty('-webkit-transition');
      thumb.style.opacity = '1';
      thumb.style.transform = 'translateY(-30px) scale(0) rotate(-8deg)';
      thumb.style.webkitTransform = 'translateY(-30px) scale(0) rotate(-8deg)';
    }
    gsap.set(shadow, { opacity: 0, scaleX: 0.68, scaleY: 0.72 });
    if (cta) {
      cta.classList.remove('animate-exit', 'animate-reset', 'animate-enter', 'animate-enter-initial');
      cta.style.removeProperty('opacity');
      cta.style.removeProperty('visibility');
      cta.style.removeProperty('transform');
      cta.style.removeProperty('-webkit-transform');
      cta.style.removeProperty('transition');
      cta.style.removeProperty('-webkit-transition');
      cta.classList.add('animate-enter-initial');
      void cta.offsetHeight;
    }

    let thumbIdleStarted = false;
    const triggerElementHaptic = (style: 'light' | 'medium' = 'medium') => {
      if (resolved || disposed || !document.body.contains(overlay)) return;
      try {
        if (typeof (window as any).triggerHapticImpact === 'function') {
          (window as any).triggerHapticImpact(style);
        } else {
          (window as any).triggerHapticSelection?.();
        }
      } catch {}
    };
    const scheduleElementHaptic = (delayMs: number, style: 'light' | 'medium' = 'medium') => {
      const timeoutId = window.setTimeout(() => {
        const index = hapticTimeouts.indexOf(timeoutId);
        if (index >= 0) hapticTimeouts.splice(index, 1);
        triggerElementHaptic(style);
      }, delayMs);
      hapticTimeouts.push(timeoutId);
    };
    const startThumbIdle = () => {
      if (thumbIdleStarted || !thumb || resolved) return;
      thumbIdleStarted = true;
      try { (thumb as any).__ccTutorialThumbIdleTween?.kill?.(); } catch {}
      thumb.classList.remove('animate-enter', 'animate-enter-initial');
      thumb.style.removeProperty('transition');
      thumb.style.removeProperty('-webkit-transition');
      gsap.set(thumb, {
        opacity: 1,
        visibility: 'visible',
        y: 0,
        scale: 1,
        rotate: 0,
      });
      (thumb as any).__ccTutorialThumbIdleTween = gsap.to(thumb, {
        y: -10,
        scale: 1.018,
        rotate: -1.2,
        duration: 1.42,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    };

    const startEnterAnimation = () => {
      if (resolved || disposed || !document.body.contains(overlay)) return;
      gsap.killTweensOf([title, subtitle, thumb, shadow, cta]);
      if (cta) {
        cta.classList.remove('animate-exit', 'animate-reset', 'animate-enter', 'animate-enter-initial');
        cta.style.removeProperty('opacity');
        cta.style.removeProperty('visibility');
        cta.style.removeProperty('transform');
        cta.style.removeProperty('-webkit-transform');
        cta.style.removeProperty('transition');
        cta.style.removeProperty('-webkit-transition');
        cta.classList.add('animate-enter-initial');
        void cta.offsetHeight;
      }

      gsap.set(title, { opacity: 0, y: -28, scale: 0, transformOrigin: '50% 50%' });
      gsap.set(subtitle, { opacity: 0, y: -22, scale: 0, transformOrigin: '50% 50%' });
      if (thumb) {
        thumb.classList.remove('animate-enter');
        thumb.classList.add('animate-enter-initial');
        thumb.style.opacity = '1';
        thumb.style.transform = 'translateY(-30px) scale(0) rotate(-8deg)';
        thumb.style.webkitTransform = 'translateY(-30px) scale(0) rotate(-8deg)';
        thumb.style.removeProperty('transition');
        thumb.style.removeProperty('-webkit-transition');
        void thumb.offsetHeight;
      }
      gsap.set(shadow, { opacity: 0, scaleX: 0.42, scaleY: 0.54 });

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
        .add(() => {
          if (!cta) return;
          gsap.set(cta, { visibility: 'visible' });
          cta.style.removeProperty('opacity');
          cta.style.removeProperty('visibility');
          cta.style.removeProperty('display');
          cta.style.removeProperty('transform');
          cta.style.removeProperty('-webkit-transform');
          cta.style.removeProperty('transition');
          cta.style.removeProperty('-webkit-transition');
          cta.classList.add('animate-enter');
          cta.classList.remove('animate-enter-initial');
        }, 0.12)
        .add(() => {
          if (!thumb) return;
          thumb.classList.add('animate-enter');
          thumb.classList.remove('animate-enter-initial');
        }, 0.22)
        .to(shadow, { opacity: 1, scaleX: 1, scaleY: 1, duration: 0.32, ease: 'power2.out' }, 0.22)
        .call(startThumbIdle, undefined, 0.9);

      scheduleElementHaptic(0, 'medium');
      scheduleElementHaptic(150, 'light');
      scheduleElementHaptic(300, 'medium');
      scheduleElementHaptic(450, 'light');
      scheduleElementHaptic(600, 'medium');
    };

    let enterStarted = false;
    const startEnterOnce = () => {
      if (enterStarted || disposed || resolved || !document.body.contains(overlay)) return;
      enterStarted = true;
      startEnterAnimation();
    };
    const enterFallback = window.setTimeout(startEnterOnce, 420);
    cleanupFns.push(() => {
      try { window.clearTimeout(enterFallback); } catch {}
    });
    if (thumb?.complete && thumb.naturalWidth > 0) {
      try { window.clearTimeout(enterFallback); } catch {}
      window.requestAnimationFrame(startEnterOnce);
    } else if (thumb?.decode) {
      thumb.decode()
        .then(() => {
          try { window.clearTimeout(enterFallback); } catch {}
          window.requestAnimationFrame(startEnterOnce);
        })
        .catch(startEnterOnce);
    } else if (thumb) {
      thumb.addEventListener('load', startEnterOnce, { once: true });
      thumb.addEventListener('error', startEnterOnce, { once: true });
      cleanupFns.push(() => {
        try { thumb.removeEventListener('load', startEnterOnce); } catch {}
        try { thumb.removeEventListener('error', startEnterOnce); } catch {}
      });
    } else {
      startEnterOnce();
    }
  });
}

export { cleanupTutorialCompleteModal };
