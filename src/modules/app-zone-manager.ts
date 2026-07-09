import {
  RUN_MODE_ARCADE_HOME,
  RUN_MODE_JOURNEY,
  markArcadeHomeRunOrigin,
  setRunMode,
} from './run-mode.js';
import {
  clearJourneyDetailReturn,
  isJourneyInterimOriginActive,
  markJourneyGameOrigin,
} from './journey-origin-state.js';
import { logger } from '../core/logger.js';

export type AppZone =
  | 'loader'
  | 'home'
  | 'journey'
  | 'settings'
  | 'board-arcade'
  | 'board-journey'
  | 'clean-board'
  | 'new-card'
  | 'stage-complete'
  | 'fail-screen';

export type MenuReturnTarget = 'home' | 'journey' | 'detail-modal';

export interface ZoneTransitionOptions {
  reason: string;
  boardId?: number | null;
  fromInterim?: boolean;
  fromDetailModal?: boolean;
}

export interface GameExitRoute {
  target: MenuReturnTarget;
  targetSlide: 0 | 1;
  returnToDetailModal: boolean;
  detailModalBoardId: number | null;
}

function setStorageFlag(key: string, enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(key, 'true');
    } else {
      localStorage.removeItem(key);
    }
  } catch {}
}

function setVisible(el: HTMLElement | null, visible: boolean): void {
  if (!el) return;
  if (visible) {
    el.hidden = false;
    el.removeAttribute('hidden');
    el.style.display = 'block';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '';
  } else {
    el.hidden = true;
    el.setAttribute('hidden', 'true');
    el.style.display = 'none';
    el.style.visibility = 'hidden';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '-1';
  }
}

function clearInlineHiddenState(el: HTMLElement | null): void {
  if (!el) return;
  el.hidden = false;
  el.removeAttribute('hidden');
  el.style.removeProperty('display');
  el.style.removeProperty('visibility');
  el.style.removeProperty('opacity');
  el.style.removeProperty('pointer-events');
  el.style.removeProperty('z-index');
}

function normalizeBoardId(boardId: unknown): number | null {
  const value = Number(boardId);
  if (!Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized >= 1 && normalized <= 30 ? normalized : null;
}

class AppZoneManager {
  private currentZone: AppZone = 'loader';
  private lastMenuTarget: MenuReturnTarget = 'home';

  getCurrentZone(): AppZone {
    return this.currentZone;
  }

  getLastMenuTarget(): MenuReturnTarget {
    return this.lastMenuTarget;
  }

  setZone(zone: AppZone, reason = 'manual'): void {
    this.currentZone = zone;
    try { (window as any).__ccAppZone = zone; } catch {}
    logger.debug(`🧭 App zone set to ${zone}`, 'app-zone-manager', { reason });
  }

  prepareArcadeRunOrigin(reason = 'arcade-run'): void {
    markArcadeHomeRunOrigin();
    this.lastMenuTarget = 'home';
    this.setZone('board-arcade', reason);
  }

  prepareJourneyRunOrigin(options: ZoneTransitionOptions): void {
    setRunMode(RUN_MODE_JOURNEY);
    markJourneyGameOrigin({
      fromInterim: options.fromInterim ?? isJourneyInterimOriginActive(),
      fromDetailModal: options.fromDetailModal,
      detailBoardId: options.boardId ?? null,
      returningFromInterim: (window as any).__ccReturningFromInterimBoard === true,
    });
    this.lastMenuTarget = options.fromDetailModal ? 'detail-modal' : 'journey';
    this.setZone('board-journey', options.reason);
  }

  markHomeMenu(reason = 'home-menu'): void {
    this.lastMenuTarget = 'home';
    this.setZone('home', reason);
    try {
      (window as any).__ccCameFromHomepage = true;
      (window as any).__ccCameFromJourney = false;
      delete (window as any).__ccCameFromDetailModal;
      delete (window as any).__ccDetailModalBoardId;
      setStorageFlag('__ccCameFromHomepage', true);
      setStorageFlag('__ccCameFromJourney', false);
    } catch {}
  }

  markJourneyMenu(reason = 'journey-menu'): void {
    this.lastMenuTarget = 'journey';
    this.setZone('journey', reason);
    try {
      (window as any).__ccCameFromHomepage = false;
      (window as any).__ccCameFromJourney = true;
      setStorageFlag('__ccCameFromHomepage', false);
      setStorageFlag('__ccCameFromJourney', true);
    } catch {}
  }

  resolveMenuReturnTarget(): MenuReturnTarget {
    const w = window as any;
    if (w.__ccRunMode === RUN_MODE_ARCADE_HOME) return 'home';
    if (w.__ccCameFromDetailModal === true && Number.isFinite(w.__ccDetailModalBoardId)) {
      return 'detail-modal';
    }
    const cameFromJourney =
      w.__ccCameFromJourney === true ||
      w.__ccFromInterimBoard === true ||
      localStorage.getItem('__ccCameFromJourney') === 'true' ||
      localStorage.getItem('__ccFromInterimBoard') === 'true';
    return cameFromJourney ? 'journey' : 'home';
  }

  async resolveGameExitRoute(options: { reason: string; fastArcadeCleanExit?: boolean } = { reason: 'game-exit' }): Promise<GameExitRoute> {
    const w = window as any;

    if (options.fastArcadeCleanExit === true || w.__ccRunMode === RUN_MODE_ARCADE_HOME) {
      markArcadeHomeRunOrigin();
      this.lastMenuTarget = 'home';
      logger.debug('🎮 App zone exit route: arcade -> home', 'app-zone-manager', options);
      return { target: 'home', targetSlide: 0, returnToDetailModal: false, detailModalBoardId: null };
    }

    const detailBoardId = normalizeBoardId(w.__ccDetailModalBoardId);
    if (w.__ccCameFromDetailModal === true && detailBoardId) {
      try {
        const { journeyBoardsManager } = await import('./journey-boards-manager.js');
        const board = journeyBoardsManager.getBoardById?.(detailBoardId);
        if (board?.unlocked === true) {
          delete w.__ccCameFromDetailModal;
          delete w.__ccDetailModalBoardId;
          this.lastMenuTarget = 'detail-modal';
          this.setZone('journey', `${options.reason}:detail-modal`);
          return { target: 'detail-modal', targetSlide: 1, returnToDetailModal: true, detailModalBoardId: detailBoardId };
        }
      } catch (error) {
        logger.warn('⚠️ app-zone-manager: failed to verify detail-modal board, returning to detail modal fallback', 'app-zone-manager', { detailBoardId, error });
        delete w.__ccCameFromDetailModal;
        delete w.__ccDetailModalBoardId;
        this.lastMenuTarget = 'detail-modal';
        this.setZone('journey', `${options.reason}:detail-modal-fallback`);
        return { target: 'detail-modal', targetSlide: 1, returnToDetailModal: true, detailModalBoardId: detailBoardId };
      }

      delete w.__ccCameFromDetailModal;
      delete w.__ccDetailModalBoardId;
    } else if (w.__ccCameFromDetailModal === true) {
      delete w.__ccCameFromDetailModal;
      delete w.__ccDetailModalBoardId;
    }

    const cameFromJourneyStorage = localStorage.getItem('__ccCameFromJourney') === 'true';
    const cameFromHomepageStorage = localStorage.getItem('__ccCameFromHomepage') === 'true';
    const fromInterimBoardStorage = localStorage.getItem('__ccFromInterimBoard') === 'true';
    const cameFromJourneyWindow = w.__ccCameFromJourney === true;
    const cameFromHomepageWindow = w.__ccCameFromHomepage === true;
    const fromInterimBoardWindow = w.__ccFromInterimBoard === true;

    let cameFromJourney = cameFromJourneyWindow || cameFromJourneyStorage || fromInterimBoardWindow || fromInterimBoardStorage;
    const cameFromHomepage = cameFromHomepageWindow || cameFromHomepageStorage;

    if (!cameFromJourney && !cameFromHomepage) {
      try {
        const { journeyProgressionState } = await import('./journey-progression-state.js');
        const lastOpenedBoardId = journeyProgressionState.getLastOpenedBoardId?.();
        if (lastOpenedBoardId !== null && lastOpenedBoardId >= 1) {
          cameFromJourney = true;
        }
      } catch {}
    }

    delete w.__ccCameFromHomepage;
    delete w.__ccCameFromJourney;
    localStorage.removeItem('__ccCameFromJourney');
    localStorage.removeItem('__ccCameFromHomepage');

    if (cameFromJourney) {
      this.lastMenuTarget = 'journey';
      this.setZone('journey', `${options.reason}:journey`);
      return { target: 'journey', targetSlide: 1, returnToDetailModal: false, detailModalBoardId: null };
    }

    this.lastMenuTarget = 'home';
    this.setZone('home', `${options.reason}:home`);
    return { target: 'home', targetSlide: 0, returnToDetailModal: false, detailModalBoardId: null };
  }

  async hideHomepageForGame(reason = 'enter-game'): Promise<void> {
    try {
      await this.cleanupTransientVisuals(reason);
      const home = document.getElementById('home') as HTMLElement | null;
      const sliderContainer = document.getElementById('slider-container') as HTMLElement | null;
      const nav = document.getElementById('independent-nav') as HTMLElement | null;
      setVisible(home, false);
      setVisible(sliderContainer, false);
      if (nav) {
        nav.style.pointerEvents = 'none';
      }
      const uiManagerModule = await import('./ui-manager.js');
      uiManagerModule.default?.hideHomepage?.();
    } catch (error) {
      logger.warn('⚠️ app-zone-manager: hideHomepageForGame failed', 'app-zone-manager', { reason, error });
    }
  }

  async showHomepageShell(reason = 'show-home'): Promise<void> {
    this.markHomeMenu(reason);
    try {
      await this.cleanupTransientVisuals(reason);
      try {
        const { assetPreloader } = await import('./asset-preloader.js');
        await assetPreloader.preloadHTMLImages?.();
      } catch {}
      const home = document.getElementById('home') as HTMLElement | null;
      const sliderContainer = document.getElementById('slider-container') as HTMLElement | null;
      const sliderWrapper = document.getElementById('slider-wrapper') as HTMLElement | null;
      const nav = document.getElementById('independent-nav') as HTMLElement | null;
      clearInlineHiddenState(home);
      clearInlineHiddenState(sliderContainer);
      if (sliderContainer) {
        sliderContainer.style.display = 'block';
        sliderContainer.style.visibility = 'visible';
        sliderContainer.style.opacity = '1';
        sliderContainer.style.pointerEvents = 'auto';
      }
      if (sliderWrapper) sliderWrapper.style.pointerEvents = 'auto';
      if (nav) {
        nav.style.display = 'block';
        nav.style.visibility = 'visible';
        nav.style.opacity = '1';
        nav.style.pointerEvents = 'auto';
        nav.removeAttribute('aria-hidden');
      }

      const uiManagerModule = await import('./ui-manager.js');
      const sliderManagerModule = await import('./slider-manager.js');
      uiManagerModule.default?.showNavigation?.();
      uiManagerModule.default?.showHomepageQuietly?.();
      sliderManagerModule.default?.forceReady?.();
      sliderManagerModule.default?.setSlideInstant?.(0);
    } catch (error) {
      logger.warn('⚠️ app-zone-manager: showHomepageShell failed', 'app-zone-manager', { reason, error });
    }
  }

  async showJourneyShell(reason = 'show-journey'): Promise<void> {
    this.markJourneyMenu(reason);
    try {
      await this.cleanupTransientVisuals(reason);
      const home = document.getElementById('home') as HTMLElement | null;
      const sliderContainer = document.getElementById('slider-container') as HTMLElement | null;
      const nav = document.getElementById('independent-nav') as HTMLElement | null;
      setVisible(home, false);
      setVisible(sliderContainer, false);
      setVisible(nav, false);

      const uiManagerModule = await import('./ui-manager.js');
      uiManagerModule.default?.hideHomepage?.();
    } catch (error) {
      logger.warn('⚠️ app-zone-manager: showJourneyShell failed', 'app-zone-manager', { reason, error });
    }
  }

  async hideHomepageShell(reason = 'hide-home'): Promise<void> {
    try {
      await this.cleanupTransientVisuals(reason);
      const home = document.getElementById('home') as HTMLElement | null;
      const sliderContainer = document.getElementById('slider-container') as HTMLElement | null;
      const nav = document.getElementById('independent-nav') as HTMLElement | null;
      setVisible(home, false);
      setVisible(sliderContainer, false);
      setVisible(nav, false);
      const uiManagerModule = await import('./ui-manager.js');
      uiManagerModule.default?.hideHomepage?.();
    } catch (error) {
      logger.warn('⚠️ app-zone-manager: hideHomepageShell failed', 'app-zone-manager', { reason, error });
    }
  }

  clearDetailReturn(): void {
    clearJourneyDetailReturn();
  }

  async cleanupTransientVisuals(reason = 'zone-handoff'): Promise<void> {
    try {
      const { cleanupJourneySmokeEffects } = await import('./journey-card-idle-bounce.js');
      cleanupJourneySmokeEffects?.();
    } catch {}
    try {
      const { cleanupJourneyNewCardScreen } = await import('./journey-new-card-screen.js');
      cleanupJourneyNewCardScreen?.();
    } catch {}
    try {
      const { cleanupArcadeStageClearModal } = await import('./arcade-stage-clear-modal.js');
      cleanupArcadeStageClearModal?.(false);
    } catch {}
    try {
      const fx = await import('./fx.js');
      fx.cleanupAllFxContainers?.();
      fx.cleanupAllTntIdleEffects?.(`app-zone:${reason}`);
    } catch {}
  }
}

export const appZoneManager = new AppZoneManager();
export default appZoneManager;
