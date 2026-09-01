// @ts-nocheck

type MenuExitTarget = 'homepage' | 'auto';

type MenuExitOptions = {
  reason: string;
  target?: MenuExitTarget;
  homepageSlideIndex?: 0 | 1;
  onHomepageEnterPrepared?: () => void;
  timeoutMs?: number;
  skipBoardExit?: boolean;
  fastArcadeCleanExit?: boolean;
};

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function isVisible(el: HTMLElement | null): boolean {
  if (!el || el.hidden) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0.01;
}

export function isAnyMenuScreenVisible(): boolean {
  return isVisible(document.getElementById('home') as HTMLElement | null)
    || isVisible(document.getElementById('journey-screen') as HTMLElement | null)
    || isVisible(document.getElementById('collectibles-detail-modal') as HTMLElement | null);
}

function isHomepageMenuReady(targetSlideIndex = 0): boolean {
  const home = document.getElementById('home') as HTMLElement | null;
  const container = document.getElementById('slider-container') as HTMLElement | null;
  const activeSlide = document.querySelector('.slider-slide.active') as HTMLElement | null;
  const hero = activeSlide?.querySelector('.hero-container') as HTMLElement | null;
  const cta = activeSlide?.querySelector('.slide-button') as HTMLElement | null;
  const hasArea = (element: HTMLElement | null): boolean => {
    if (!isVisible(element)) return false;
    const rect = element!.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  };
  const activeSlideIndex = Number(activeSlide?.dataset.slide);
  return activeSlideIndex === targetSlideIndex
    && hasArea(home) && hasArea(container) && hasArea(activeSlide)
    && (hasArea(hero) || hasArea(cta));
}

async function forceHomepageVisible(
  reason: string,
  targetSlideIndex: 0 | 1 = 0,
  onHomepageEnterPrepared?: () => void,
): Promise<void> {
  try {
    const { appZoneManager } = await import('./app-zone-manager.js');
    appZoneManager.markHomeMenu(`menu-exit-handoff:${reason}`);
    delete (window as any).__skipBoardExitAnimation;
    delete (window as any).__ccFastArcadeCleanExit;
  } catch {}

  try {
    const { appZoneManager } = await import('./app-zone-manager.js');
    await appZoneManager.showHomepageShell(`menu-exit-handoff:${reason}`, targetSlideIndex);
    const homepageEnter = (window as any).__ccPlayHomepageSliderEnterHandoff;
    if (typeof homepageEnter === 'function') {
      await homepageEnter(`menu-exit-recovery:${reason}`, {
        targetSlideIndex,
        skipFirstPaintReady: true,
        onEnterPrepared: onHomepageEnterPrepared,
      });
    }
    const uiManagerModule = await import('./ui-manager.js');
    const uiManager = uiManagerModule.default;
    await wait(80);
    uiManager?.hideApp?.();
  } catch (error) {
    console.warn('⚠️ menu-exit-handoff: forceHomepageVisible failed', { reason, error });
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.style.display = 'none';
      appEl.style.visibility = 'hidden';
      appEl.style.opacity = '0';
      appEl.style.pointerEvents = 'none';
    }
    const home = document.getElementById('home') as HTMLElement | null;
    if (home) {
      home.hidden = false;
      home.removeAttribute('hidden');
      home.style.display = 'block';
      home.style.visibility = 'visible';
      home.style.opacity = '1';
      home.style.pointerEvents = 'auto';
      home.style.zIndex = '1';
    }
  }
}

async function forceAutoMenuVisible(reason: string): Promise<void> {
  const cameFromJourney =
    (() => {
      try {
        return (window as any).__ccRunMode !== 'arcade_home'
          && (
            (window as any).__ccCameFromJourney === true ||
            localStorage.getItem('__ccCameFromJourney') === 'true' ||
            (window as any).__ccFromInterimBoard === true ||
            localStorage.getItem('__ccFromInterimBoard') === 'true'
          );
      } catch {
        return false;
      }
    })();

  if (!cameFromJourney) {
    await forceHomepageVisible(reason);
    return;
  }

  try {
    const home = document.getElementById('home') as HTMLElement | null;
    if (home) {
      home.hidden = true;
      home.setAttribute('hidden', 'true');
      home.style.display = 'none';
      home.style.visibility = 'hidden';
      home.style.opacity = '0';
    }
    try {
      const { appZoneManager } = await import('./app-zone-manager.js');
      appZoneManager.markJourneyMenu(`menu-exit-handoff:${reason}`);
    } catch {}
    const { ensureCollectiblesManager, showCollectiblesScreen } = await import('../collectibles-manager.js');
    await ensureCollectiblesManager?.();
    await showCollectiblesScreen?.();
    try {
      const { journeyBoardsManager } = await import('./journey-boards-manager.js');
      journeyBoardsManager.resumeInterimCardIdleEffects?.(`menu-exit-handoff:${reason}`);
      window.setTimeout(() => {
        try {
          journeyBoardsManager.resumeInterimCardIdleEffects?.(`menu-exit-handoff-late:${reason}`);
        } catch {}
      }, 650);
    } catch (resumeError) {
      console.warn('⚠️ menu-exit-handoff: failed to resume Journey interim effects', { reason, resumeError });
    }
    const uiManagerModule = await import('./ui-manager.js');
    uiManagerModule.default?.hideApp?.();
  } catch (error) {
    console.warn('⚠️ menu-exit-handoff: force journey fallback failed, using homepage', { reason, error });
    await forceHomepageVisible(reason);
  }
}

export async function ensureMenuVisibleAfterExit(options: MenuExitOptions): Promise<void> {
  await wait(320);
  if (options.target === 'homepage') {
    const targetSlideIndex = options.homepageSlideIndex ?? 0;
    if (isHomepageMenuReady(targetSlideIndex)) return;
    console.warn('⚠️ menu-exit-handoff: homepage shell incomplete after exit, applying fallback', options);
    (window as any).exitingToMenu = false;
    await forceHomepageVisible(options.reason, targetSlideIndex, options.onHomepageEnterPrepared);
    return;
  }
  if (isAnyMenuScreenVisible()) return;
  console.warn('⚠️ menu-exit-handoff: no visible menu after exit, applying fallback', options);
  (window as any).exitingToMenu = false;
  await forceAutoMenuVisible(options.reason);
}

export async function requestExitToMenu(options: MenuExitOptions): Promise<void> {
  try {
    if (options.skipBoardExit) (window as any).__skipBoardExitAnimation = true;
    if (options.fastArcadeCleanExit) (window as any).__ccFastArcadeCleanExit = true;
  } catch {}

  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? (options.skipBoardExit ? 2500 : 4500);

  if ((window as any).exitingToMenu === true) {
    let watchdogReported = false;
    while ((window as any).exitingToMenu === true) {
      await wait(120);
      if (!watchdogReported && Date.now() - startedAt >= timeoutMs) {
        watchdogReported = true;
        console.warn('⚠️ menu-exit-handoff: active exit exceeded watchdog; preserving its sole ownership', {
          reason: options.reason,
          timeoutMs,
        });
      }
    }
  } else if (typeof (window as any).exitToMenu === 'function') {
    let watchdog: number | undefined;
    try {
      const exitPromise = Promise.resolve((window as any).exitToMenu({
        target: options.target,
        homepageSlideIndex: options.homepageSlideIndex,
        onHomepageEnterPrepared: options.onHomepageEnterPrepared,
      }));
      watchdog = window.setTimeout(() => {
        console.warn('⚠️ menu-exit-handoff: exit exceeded watchdog; waiting for the authoritative owner', {
          reason: options.reason,
          timeoutMs,
        });
      }, timeoutMs);
      await exitPromise;
    } catch (error) {
      console.warn('⚠️ menu-exit-handoff: exitToMenu failed', { reason: options.reason, error });
    } finally {
      if (watchdog !== undefined) window.clearTimeout(watchdog);
    }
  } else {
    console.warn('⚠️ menu-exit-handoff: window.exitToMenu not found', options);
  }

  await ensureMenuVisibleAfterExit(options);
}
