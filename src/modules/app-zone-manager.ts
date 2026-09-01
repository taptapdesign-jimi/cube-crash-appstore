import {
  RUN_MODE_ARCADE_HOME,
  RUN_MODE_JOURNEY,
  markArcadeHomeRunOrigin,
  setRunMode,
} from './run-mode.js';
import {
  cancelJourneyCardOverlayReturn,
  clearJourneyDetailReturn,
  clearJourneyInterimOrigin,
  getJourneyCardOverlayReturnBoardId,
  isJourneyInterimOriginActive,
  markJourneyGameOrigin,
} from './journey-origin-state.js';
import { logger } from '../core/logger.js';
import {
  commitHomepageNavigation,
  hideHomepageNavigation,
  primeHomepageNavigation,
} from './navigation-control.js';

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

export interface SetZoneOptions {
  preserveHomepageNavigation?: boolean;
}

export interface GameExitRoute {
  target: MenuReturnTarget;
  targetSlide: 0 | 1;
  returnToDetailModal: boolean;
  detailModalBoardId: number | null;
}

export interface GameExitRouteOptions {
  reason: string;
  fastArcadeCleanExit?: boolean;
  requestedTarget?: 'homepage' | 'auto';
  requestedHomepageSlide?: 0 | 1;
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
  return normalized >= 1 && normalized <= 25 ? normalized : null;
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

  setZone(zone: AppZone, reason = 'manual', options: SetZoneOptions = {}): void {
    this.currentZone = zone;
    try { (window as any).__ccAppZone = zone; } catch {}
    if (zone !== 'home' && options.preserveHomepageNavigation !== true) {
      hideHomepageNavigation(`app-zone:set-zone:${zone}:${reason}`);
    }
    logger.debug(`🧭 App zone set to ${zone}`, 'app-zone-manager', { reason });
  }

  prepareArcadeRunOrigin(reason = 'arcade-run'): void {
    this.markArcadeRunOrigin();
    this.enterArcadeBoardZone(reason);
  }

  markArcadeRunOrigin(): void {
    markArcadeHomeRunOrigin();
    this.lastMenuTarget = 'home';
  }

  enterArcadeBoardZone(reason = 'arcade-run'): void {
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
    this.prepareHomeMenuEnter(reason);
    primeHomepageNavigation(`app-zone:${reason}`);
  }

  /**
   * Acquire the Homepage route without painting navigation. Prepared enter
   * owners call this while the nav is still inactive, apply scale(0), and
   * only then prime the nav tree for its visible bounce.
   */
  prepareHomeMenuEnter(reason = 'home-menu-enter'): void {
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

  async resolveGameExitRoute(options: GameExitRouteOptions = { reason: 'game-exit' }): Promise<GameExitRoute> {
    const w = window as any;

    if (options.requestedTarget === 'homepage') {
      const overlayReturnBoardId = getJourneyCardOverlayReturnBoardId();
      if (overlayReturnBoardId !== null) {
        cancelJourneyCardOverlayReturn(overlayReturnBoardId);
      }
      clearJourneyDetailReturn();
      clearJourneyInterimOrigin();
      delete w.__ccReturningFromDetailModal;
      delete w.__ccSuppressJourneyShowForDirectDetailReturn;
      delete w.__ccDirectDetailModalReturnActive;
      delete w.__ccSuppressJourneyV700AutoWorldEnter;
      delete w.__ccJourneyReturnBoardId;
      delete w.__ccLastActiveJourneyBoardAreaId;
      try {
        localStorage.removeItem('__ccJourneyReturnBoardId');
        localStorage.removeItem('__ccLastActiveJourneyBoardAreaId');
      } catch {}
      this.prepareHomeMenuEnter(`${options.reason}:requested-homepage`);
      return {
        target: 'home',
        targetSlide: options.requestedHomepageSlide ?? 0,
        returnToDetailModal: false,
        detailModalBoardId: null,
      };
    }

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
      hideHomepageNavigation(`app-zone:${reason}`);
      await this.cleanupTransientVisuals(reason);
      const home = document.getElementById('home') as HTMLElement | null;
      const sliderContainer = document.getElementById('slider-container') as HTMLElement | null;
      setVisible(home, false);
      setVisible(sliderContainer, false);
      const uiManagerModule = await import('./ui-manager.js');
      uiManagerModule.default?.hideHomepage?.();
    } catch (error) {
      logger.warn('⚠️ app-zone-manager: hideHomepageForGame failed', 'app-zone-manager', { reason, error });
    }
  }

  async showHomepageShell(reason = 'show-home', targetSlideIndex: 0 | 1 = 0): Promise<void> {
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
      clearInlineHiddenState(home);
      clearInlineHiddenState(sliderContainer);
      if (sliderContainer) {
        sliderContainer.style.display = 'block';
        sliderContainer.style.visibility = 'visible';
        sliderContainer.style.opacity = '1';
        sliderContainer.style.pointerEvents = 'auto';
      }
      if (sliderWrapper) sliderWrapper.style.pointerEvents = 'auto';
      const uiManagerModule = await import('./ui-manager.js');
      const sliderManagerModule = await import('./slider-manager.js');
      uiManagerModule.default?.showHomepageQuietly?.();
      sliderManagerModule.default?.forceReady?.();
      sliderManagerModule.default?.setSlideInstant?.(targetSlideIndex);
      commitHomepageNavigation(`app-zone:${reason}:shell-ready`);
    } catch (error) {
      logger.warn('⚠️ app-zone-manager: showHomepageShell failed', 'app-zone-manager', { reason, error });
    }
  }

  async showJourneyShell(reason = 'show-journey'): Promise<void> {
    this.markJourneyMenu(reason);
    try {
      hideHomepageNavigation(`app-zone:${reason}`);
      await this.cleanupTransientVisuals(reason);
      const home = document.getElementById('home') as HTMLElement | null;
      const sliderContainer = document.getElementById('slider-container') as HTMLElement | null;
      setVisible(home, false);
      setVisible(sliderContainer, false);

      const uiManagerModule = await import('./ui-manager.js');
      uiManagerModule.default?.hideHomepage?.();
    } catch (error) {
      logger.warn('⚠️ app-zone-manager: showJourneyShell failed', 'app-zone-manager', { reason, error });
    }
  }

  async hideHomepageShell(reason = 'hide-home'): Promise<void> {
    try {
      hideHomepageNavigation(`app-zone:${reason}`);
      await this.cleanupTransientVisuals(reason);
      const home = document.getElementById('home') as HTMLElement | null;
      const sliderContainer = document.getElementById('slider-container') as HTMLElement | null;
      setVisible(home, false);
      setVisible(sliderContainer, false);
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
      const { forceClearEndgameHint } = await import('./endgame-hint.js');
      forceClearEndgameHint?.();
    } catch {}
    try {
      const { cleanupJourneySmokeEffects } = await import('./journey-card-idle-bounce.js');
      cleanupJourneySmokeEffects?.();
    } catch {}
    try {
      const { cleanupJourneyNewCardScreen } = await import('./journey-new-card-screen.js');
      cleanupJourneyNewCardScreen?.();
    } catch {}
    try {
      const { cancelArcadeStageClearModal } = await import('./arcade-stage-clear-modal.js');
      cancelArcadeStageClearModal?.();
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
