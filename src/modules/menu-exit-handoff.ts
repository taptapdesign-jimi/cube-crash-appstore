// @ts-nocheck

type MenuExitTarget = 'homepage' | 'auto';

type MenuExitOptions = {
  reason: string;
  target?: MenuExitTarget;
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

async function forceHomepageVisible(reason: string): Promise<void> {
  try {
    (window as any).__ccCameFromHomepage = true;
    (window as any).__ccCameFromJourney = false;
    delete (window as any).__ccCameFromDetailModal;
    delete (window as any).__ccDetailModalBoardId;
    delete (window as any).__skipBoardExitAnimation;
    delete (window as any).__ccFastArcadeCleanExit;
    localStorage.setItem('__ccCameFromHomepage', 'true');
    localStorage.removeItem('__ccCameFromJourney');
  } catch {}

  try {
    const uiManagerModule = await import('./ui-manager.js');
    const uiManager = uiManagerModule.default;
    uiManager?.showNavigation?.();
    uiManager?.showHomepageQuietly?.();
    try {
      const sliderManagerModule = await import('./slider-manager.js');
      const sliderManager = sliderManagerModule.default;
      sliderManager?.forceReady?.();
      sliderManager?.setSlideInstant?.(0);
    } catch {}
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
    (window as any).__ccCameFromJourney === true ||
    localStorage.getItem('__ccCameFromJourney') === 'true' ||
    (window as any).__ccFromInterimBoard === true ||
    localStorage.getItem('__ccFromInterimBoard') === 'true';

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
    const { ensureCollectiblesManager, showCollectiblesScreen } = await import('../collectibles-manager.js');
    await ensureCollectiblesManager?.();
    await showCollectiblesScreen?.();
    const uiManagerModule = await import('./ui-manager.js');
    uiManagerModule.default?.hideApp?.();
  } catch (error) {
    console.warn('⚠️ menu-exit-handoff: force journey fallback failed, using homepage', { reason, error });
    await forceHomepageVisible(reason);
  }
}

export async function ensureMenuVisibleAfterExit(options: MenuExitOptions): Promise<void> {
  await wait(320);
  if (isAnyMenuScreenVisible()) return;
  console.warn('⚠️ menu-exit-handoff: no visible menu after exit, applying fallback', options);
  (window as any).exitingToMenu = false;
  if (options.target === 'homepage') {
    await forceHomepageVisible(options.reason);
  } else {
    await forceAutoMenuVisible(options.reason);
  }
}

export async function requestExitToMenu(options: MenuExitOptions): Promise<void> {
  try {
    if (options.skipBoardExit) (window as any).__skipBoardExitAnimation = true;
    if (options.fastArcadeCleanExit) (window as any).__ccFastArcadeCleanExit = true;
    if (options.target === 'homepage') {
      (window as any).__ccCameFromHomepage = true;
      (window as any).__ccCameFromJourney = false;
      localStorage.setItem('__ccCameFromHomepage', 'true');
      localStorage.removeItem('__ccCameFromJourney');
      delete (window as any).__ccCameFromDetailModal;
      delete (window as any).__ccDetailModalBoardId;
    }
  } catch {}

  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? (options.skipBoardExit ? 2500 : 4500);

  if ((window as any).exitingToMenu === true) {
    while ((window as any).exitingToMenu === true && Date.now() - startedAt < timeoutMs) {
      await wait(120);
      if (isAnyMenuScreenVisible()) return;
    }
  } else if (typeof (window as any).exitToMenu === 'function') {
    try {
      await Promise.race([
        Promise.resolve((window as any).exitToMenu()),
        wait(timeoutMs),
      ]);
    } catch (error) {
      console.warn('⚠️ menu-exit-handoff: exitToMenu failed', { reason: options.reason, error });
    }
  } else {
    console.warn('⚠️ menu-exit-handoff: window.exitToMenu not found', options);
  }

  await ensureMenuVisibleAfterExit(options);
}
