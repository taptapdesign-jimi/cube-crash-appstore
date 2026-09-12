// @ts-nocheck
import { logger } from './core/logger.js';
import {
  isJourneyViewStructurallyPrepared,
  isJourneyBackgroundPreparationAllowed,
  isJourneyVisibleEnterPreparationAllowed,
  readJourneyPreparationRuntimeState,
} from './modules/journey-background-preparation.js';
import { gsap } from 'gsap';
import {
  animateJourneyViewportScreenExit,
  cleanupCollectiblesAnimations,
  prepareJourneyViewportScreenEnter,
  unlockJourneyViewportTransition,
} from './ui/collectibles-animations.js';
import {
  isJourneyBoardCardWrapper,
  rememberJourneyBoardCardBaseTransform,
  restoreJourneyBoardCardBaseTransform,
} from './modules/journey-card-base-transform.js';
import { playNavIconCartoonBounce } from './utils/nav-icon-bounce.js';
import { emitIOSNativeDiagnostic } from './utils/ios-native-diagnostic.js';
import {
  ensureIOSJourneyRouteAudit,
  finishIOSJourneyRouteAudit,
  markIOSJourneyRouteAudit,
} from './utils/ios-journey-world-enter-audit.js';
import { resolveJourneyReturnEntryPolicy } from './modules/journey-return-entry-policy.js';
import { appZoneManager } from './modules/app-zone-manager.js';
import {
  areContinuousRuntimeDiagnosticsEnabled,
  areDetailedRuntimeDiagnosticsEnabled,
} from './utils/runtime-diagnostics-policy.js';
import { JOURNEY_SLIDE_INDEX } from './modules/homepage-slide-order.js';
// Collectibles Manager - Handles all collectibles functionality
logger.info('🎁 Collectibles Manager module loaded');

const JOURNEY_TAP_BOUNCE_ACTION_DELAY_MS = 410;
const JOURNEY_ACTIVE_AREA_ENTER_OVERLAP_DELAY_MS = 260;
const JOURNEY_POST_TERMINAL_ACTIVE_AREA_ENTER_OVERLAP_DELAY_MS = 80;
const JOURNEY_SCROLL_TOP_KEY = '__ccJourneyScrollTop';
const JOURNEY_RETURN_BOARD_ID_KEY = '__ccJourneyReturnBoardId';

function primeJourneyScreenHiddenForEnter(screen: HTMLElement, reason: string): void {
  try {
    screen.hidden = false;
    screen.removeAttribute('hidden');
    screen.classList.remove('hidden');
    screen.classList.add('show');
    screen.style.display = 'flex';
    screen.style.zIndex = '999999';
    screen.style.setProperty('opacity', '0', 'important');
    screen.style.setProperty('visibility', 'hidden', 'important');
    screen.style.pointerEvents = 'none';
    screen.style.willChange = 'opacity';
    screen.dataset.ccJourneyPrimedHidden = reason;
  } catch {}
}

function releaseJourneyScreenHiddenPrime(screen: HTMLElement): void {
  try {
    screen.style.setProperty('opacity', '0');
    screen.style.setProperty('visibility', 'visible');
    screen.style.pointerEvents = 'none';
    delete screen.dataset.ccJourneyPrimedHidden;
  } catch {}
}

function hideLastActiveJourneyBoardAreaBeforeEnter(): void {
  let boardId = 0;
  try {
    boardId = Number(
      (window as any).__ccLastActiveJourneyBoardAreaId ??
      localStorage.getItem('__ccLastActiveJourneyBoardAreaId') ??
      0
    );
  } catch {
    boardId = Number((window as any).__ccLastActiveJourneyBoardAreaId || 0);
  }

  if (!Number.isFinite(boardId) || boardId <= 0) return;

  const activeCard = document.querySelector(`.journey-board-card[data-board-id="${boardId}"]`) as HTMLElement | null;
  const activeCardWrapper = activeCard?.closest('.journey-board-card-wrapper') as HTMLElement | null;
  const targets = [
    activeCardWrapper,
    ...Array.from(document.querySelectorAll(`.journey-forest-island-${boardId}`)),
    ...Array.from(document.querySelectorAll(`.journey-forest-stump-${boardId}`)),
    ...Array.from(document.querySelectorAll(`.journey-forest-star-board-${boardId}`)),
    ...Array.from(document.querySelectorAll(`.journey-forest-cloud-board-${boardId}`)),
  ].filter((target): target is HTMLElement => target instanceof HTMLElement);

  targets.forEach((target) => {
    try {
      if (isJourneyBoardCardWrapper(target)) {
        rememberJourneyBoardCardBaseTransform(target);
        restoreJourneyBoardCardBaseTransform(target);
      } else {
        gsap.killTweensOf(target);
      }
      target.style.visibility = 'hidden';
      target.style.opacity = '0';
      target.style.transformOrigin = '50% 50%';
      target.style.willChange = 'transform, opacity';
      target.style.pointerEvents = 'none';
      gsap.set(target, {
        scale: 0.65,
        opacity: 0,
        visibility: 'hidden',
        force3D: true,
        immediateRender: true,
      });
    } catch {}
  });
}

function getJourneyReturnBoardId(): number | null {
  try {
    const raw =
      (window as any).__ccJourneyReturnBoardId ??
      (window as any).__ccDetailModalBoardId ??
      (window as any).__ccLastActiveJourneyBoardAreaId ??
      localStorage.getItem(JOURNEY_RETURN_BOARD_ID_KEY) ??
      localStorage.getItem('__ccLastActiveJourneyBoardAreaId');
    const boardId = Number(raw || 0);
    return Number.isFinite(boardId) && boardId > 0 ? boardId : null;
  } catch {
    const boardId = Number(
      (window as any).__ccJourneyReturnBoardId ||
      (window as any).__ccDetailModalBoardId ||
      (window as any).__ccLastActiveJourneyBoardAreaId ||
      0
    );
    return Number.isFinite(boardId) && boardId > 0 ? boardId : null;
  }
}

function getSavedJourneyScrollTop(): number | null {
  try {
    const raw = (window as any).__ccJourneyScrollTop ?? localStorage.getItem(JOURNEY_SCROLL_TOP_KEY);
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    const value = Number((window as any).__ccJourneyScrollTop);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
}

function getJourneyBoardAnchorScrollTop(scrollable: HTMLElement): number | null {
  const boardId = getJourneyReturnBoardId();
  if (!boardId) return null;

  const card = document.querySelector(`.journey-board-card[data-board-id="${boardId}"]`) as HTMLElement | null;
  const anchor = (card?.closest('.journey-board-card-wrapper') as HTMLElement | null) || card;
  if (!anchor) return null;

  const scrollableRect = scrollable.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const currentScrollTop = scrollable.scrollTop;
  const anchorCenter =
    currentScrollTop +
    (anchorRect.top - scrollableRect.top) +
    anchorRect.height * 0.5;
  const viewportAnchor = scrollable.clientHeight * 0.48;
  const maxScrollTop = Math.max(0, scrollable.scrollHeight - scrollable.clientHeight);

  return Math.max(0, Math.min(maxScrollTop, anchorCenter - viewportAnchor));
}

function getJourneyReturnScrollTop(scrollable: HTMLElement): number | null {
  const savedScrollTop = getSavedJourneyScrollTop();
  const returnBoardId = getJourneyReturnBoardId();
  if (savedScrollTop !== null && savedScrollTop <= 1 && returnBoardId && returnBoardId > 3) {
    const anchorScrollTop = getJourneyBoardAnchorScrollTop(scrollable);
    if (anchorScrollTop !== null) return anchorScrollTop;
  }
  if (savedScrollTop !== null) {
    const maxScrollTop = Math.max(0, scrollable.scrollHeight - scrollable.clientHeight);
    return Math.max(0, Math.min(maxScrollTop, savedScrollTop));
  }
  return getJourneyBoardAnchorScrollTop(scrollable);
}

function restoreJourneyReturnScrollPosition(reason: string): void {
  try {
    const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
    if (!scrollable) return;

    const initialTargetScrollTop = getJourneyReturnScrollTop(scrollable);
    if (initialTargetScrollTop === null) {
      logger.warn('🗺️ Journey return scroll restore skipped - no saved position or board anchor', {
        reason,
        returnBoardId: getJourneyReturnBoardId(),
      });
      return;
    }

    const apply = (phase: string) => {
      const targetScrollTop = getJourneyReturnScrollTop(scrollable);
      if (targetScrollTop === null) return;
      scrollable.scrollTop = targetScrollTop;
      logger.info('🗺️ Journey return scroll restored', {
        reason,
        phase,
        targetScrollTop,
        actualScrollTop: scrollable.scrollTop,
        returnBoardId: getJourneyReturnBoardId(),
      });
    };

    apply('sync');
    requestAnimationFrame(() => apply('raf-1'));
    requestAnimationFrame(() => requestAnimationFrame(() => apply('raf-2')));
    window.setTimeout(() => apply('layout-80'), 80);
    window.setTimeout(() => apply('layout-180'), 180);
    window.setTimeout(() => apply('layout-360'), 360);
  } catch (error) {
    logger.warn('⚠️ Failed to restore Journey return scroll position:', String(error));
  }
}

function restoreJourneyScrollableInteractivity(reason: string, unlockViewport = true): void {
  try {
    if (unlockViewport) {
      unlockJourneyViewportTransition(reason);
    }
    const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
    if (!scrollable) return;

    const screen = document.getElementById('journey-screen') as HTMLElement | null;
    const journeyContainer = document.getElementById('journey-boards-container') as HTMLElement | null;
    const screenElasticHandlers = (scrollable as any).__journeyScreenElasticHandlers;
    if (screenElasticHandlers) {
      try { scrollable.removeEventListener('touchstart', screenElasticHandlers.start); } catch {}
      try { scrollable.removeEventListener('touchmove', screenElasticHandlers.move); } catch {}
      try { scrollable.removeEventListener('touchend', screenElasticHandlers.end); } catch {}
      try { scrollable.removeEventListener('touchcancel', screenElasticHandlers.end); } catch {}
      try { scrollable.removeEventListener('scroll', screenElasticHandlers.lockX); } catch {}
      try {
        if (screenElasticHandlers.releaseTimer) window.clearTimeout(screenElasticHandlers.releaseTimer);
        if (screenElasticHandlers.releaseTween) screenElasticHandlers.releaseTween.kill?.();
      } catch {}
      delete (scrollable as any).__journeyScreenElasticHandlers;
    }

    const contentElasticHandlers = (scrollable as any).__journeyElasticOverscrollHandlers;
    if (contentElasticHandlers) {
      try { scrollable.removeEventListener('touchstart', contentElasticHandlers.start); } catch {}
      try { scrollable.removeEventListener('touchmove', contentElasticHandlers.move); } catch {}
      try { scrollable.removeEventListener('touchend', contentElasticHandlers.end); } catch {}
      try { scrollable.removeEventListener('touchcancel', contentElasticHandlers.end); } catch {}
      try {
        if (contentElasticHandlers.releaseTimer) window.clearTimeout(contentElasticHandlers.releaseTimer);
      } catch {}
      delete (scrollable as any).__journeyElasticOverscrollHandlers;
    }

    scrollable.style.touchAction = 'pan-y';
    scrollable.style.pointerEvents = '';
    scrollable.style.removeProperty('transform');
    scrollable.style.removeProperty('transition');
    scrollable.style.removeProperty('will-change');
    scrollable.style.overscrollBehavior = '';
    scrollable.style.overscrollBehaviorY = '';
    scrollable.style.webkitOverflowScrolling = 'touch';
    scrollable.style.overflow = 'auto';
    scrollable.style.overflowY = 'auto';
    scrollable.style.overflowX = 'hidden';

    if (screen) {
      screen.style.pointerEvents = '';
    }
    if (journeyContainer) {
      try { gsap.killTweensOf(journeyContainer); } catch {}
      journeyContainer.style.removeProperty('transform');
      journeyContainer.style.removeProperty('transition');
      journeyContainer.style.removeProperty('will-change');
      journeyContainer.style.pointerEvents = 'auto';
    }

    const body = document.body as HTMLElement;
    const html = document.documentElement as HTMLElement;
    if ((body as any)._originalTouchAction !== undefined) {
      body.style.touchAction = (body as any)._originalTouchAction;
      delete (body as any)._originalTouchAction;
    }
    if ((html as any)._originalTouchAction !== undefined) {
      html.style.touchAction = (html as any)._originalTouchAction;
      delete (html as any)._originalTouchAction;
    }

    if (areContinuousRuntimeDiagnosticsEnabled() && !(scrollable as any).__ccJourneyScrollProbeInstalled) {
      let probeStartY = 0;
      let probeStartScrollTop = 0;
      const onProbeStart = (event: TouchEvent) => {
        if (event.touches.length !== 1) return;
        probeStartY = event.touches[0].clientY;
        probeStartScrollTop = scrollable.scrollTop;
      };
      const onProbeMove = (event: TouchEvent) => {
        if (event.touches.length !== 1) return;
        const dy = Math.round(event.touches[0].clientY - probeStartY);
        if (Math.abs(dy) < 18) return;
        const target = event.target as HTMLElement | null;
        const computedNow = window.getComputedStyle(scrollable);
        logger.info('🧪 JourneyScrollProbe touchmove', {
          dy,
          startScrollTop: probeStartScrollTop,
          currentScrollTop: scrollable.scrollTop,
          defaultPrevented: event.defaultPrevented,
          cancelable: event.cancelable,
          targetTag: target?.tagName || null,
          targetClass: target?.className || null,
          lockFlag: (window as any).__ccJourneyViewportTransitionLocked === true,
          lockReason: (window as any).__ccJourneyViewportTransitionLockReason || null,
          screenElastic: !!(scrollable as any).__journeyScreenElasticHandlers,
          contentElastic: !!(scrollable as any).__journeyElasticOverscrollHandlers,
          touchAction: computedNow.touchAction,
          overflowY: computedNow.overflowY,
          pointerEvents: computedNow.pointerEvents,
          scrollHeight: scrollable.scrollHeight,
          clientHeight: scrollable.clientHeight,
        });
      };
      scrollable.addEventListener('touchstart', onProbeStart, { passive: true, capture: true });
      scrollable.addEventListener('touchmove', onProbeMove, { passive: true, capture: true });
      (scrollable as any).__ccJourneyScrollProbeInstalled = true;
      (scrollable as any).__ccJourneyScrollProbeHandlers = { start: onProbeStart, move: onProbeMove };
    }

    const computed = window.getComputedStyle(scrollable);
    logger.info('🧪 JourneyScrollRestore', {
      reason,
      unlockViewport,
      hadViewportLock: (window as any).__ccJourneyViewportTransitionLocked === true,
      removedScreenElastic: !!screenElasticHandlers,
      removedContentElastic: !!contentElasticHandlers,
      inlineTouchAction: scrollable.style.touchAction,
      computedTouchAction: computed.touchAction,
      inlineOverflowY: scrollable.style.overflowY,
      computedOverflowY: computed.overflowY,
      pointerEvents: computed.pointerEvents,
      scrollTop: scrollable.scrollTop,
      scrollHeight: scrollable.scrollHeight,
      clientHeight: scrollable.clientHeight,
    });
  } catch (error) {
    logger.warn('⚠️ Failed to restore Journey scroll interactivity:', String(error));
  }
}

function setupJourneyContentElasticOverscroll(scrollable: HTMLElement | null): void {
  if (!scrollable) return;

  const existing = (scrollable as any).__journeyElasticOverscrollHandlers;
  if (existing) {
    scrollable.removeEventListener('touchstart', existing.start);
    scrollable.removeEventListener('touchmove', existing.move);
    scrollable.removeEventListener('touchend', existing.end);
    scrollable.removeEventListener('touchcancel', existing.end);
    if (existing.releaseTimer) window.clearTimeout(existing.releaseTimer);
    if (existing.releaseTween) existing.releaseTween.kill();
  }
  scrollable.style.removeProperty('transition');
  scrollable.style.removeProperty('will-change');
  scrollable.style.removeProperty('transform');

  let startY = 0;
  let pullY = 0;
  let dragging = false;
  let releaseTimer: number | null = null;
  let releaseTween: gsap.core.Timeline | null = null;
  const maxPull = 86;
  const damping = 0.42;

  const clearReleaseAnimation = () => {
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    if (releaseTween) {
      releaseTween.kill();
      releaseTween = null;
    }
  };

  const setPull = (value: number) => {
    pullY = Math.max(-maxPull, Math.min(maxPull, value));
    scrollable.style.willChange = 'transform';
    scrollable.style.transition = 'none';
    gsap.set(scrollable, { y: pullY, force3D: true });
  };

  const release = () => {
    clearReleaseAnimation();
    dragging = false;
    if (Math.abs(pullY) < 0.5) {
      scrollable.style.removeProperty('transition');
      scrollable.style.removeProperty('will-change');
      scrollable.style.removeProperty('transform');
      pullY = 0;
      return;
    }

    const releaseDistance = Math.abs(pullY);
    const direction = Math.sign(pullY) || 1;
    const settleOvershoot = -direction * Math.min(6, Math.max(2, releaseDistance * 0.1));
    const firstLegDuration = Math.min(0.34, Math.max(0.22, 0.17 + releaseDistance / 260));
    const settleDuration = Math.min(0.62, Math.max(0.42, 0.36 + releaseDistance / 260));

    scrollable.style.transition = 'none';
    scrollable.style.willChange = 'transform';
    releaseTween = gsap.timeline({
      defaults: { force3D: true },
      onComplete: () => {
        releaseTween = null;
        pullY = 0;
        scrollable.style.removeProperty('transition');
        scrollable.style.removeProperty('will-change');
        scrollable.style.removeProperty('transform');
      },
    });
    releaseTween
      .to(scrollable, {
        y: settleOvershoot,
        duration: firstLegDuration,
        ease: 'power3.out',
      })
      .to(scrollable, {
        y: 0,
        duration: settleDuration,
        ease: 'elastic.out(1, 0.78)',
      }, '>-0.06');

    releaseTimer = window.setTimeout(() => {
      releaseTimer = null;
      scrollable.style.removeProperty('transition');
      scrollable.style.removeProperty('will-change');
    }, Math.ceil((firstLegDuration + settleDuration) * 1000) + 120);
  };

  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    clearReleaseAnimation();
    startY = event.touches[0].clientY;
    pullY = 0;
    dragging = true;
    scrollable.style.transition = 'none';
    scrollable.style.willChange = 'transform';
    gsap.killTweensOf(scrollable);
  };

  const onMove = (event: TouchEvent) => {
    if (!dragging || event.touches.length !== 1) return;

    const dy = event.touches[0].clientY - startY;
    const atTop = scrollable.scrollTop <= 0;
    const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
    const pullingPastTop = atTop && dy > 0;
    const pullingPastBottom = atBottom && dy < 0;

    if (!pullingPastTop && !pullingPastBottom) {
      if (pullY !== 0) setPull(0);
      return;
    }

    if (event.cancelable) event.preventDefault();
    setPull(dy * damping);
  };

  scrollable.addEventListener('touchstart', onStart, { passive: true });
  scrollable.addEventListener('touchmove', onMove, { passive: false });
  scrollable.addEventListener('touchend', release, { passive: true });
  scrollable.addEventListener('touchcancel', release, { passive: true });

  (scrollable as any).__journeyElasticOverscrollHandlers = {
    start: onStart,
    move: onMove,
    end: release,
    get releaseTimer() { return releaseTimer; },
    get releaseTween() { return releaseTween; },
  };
}

// Type definitions
interface CollectibleCard {
  id: string;
  name: string;
  description: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  event: string;
  unlocked: boolean;
  imagePath?: string;
}

interface CollectiblesData {
  common: CollectibleCard[];
  legendary: CollectibleCard[];
}

interface UnlockOptions {
  render?: boolean;
  silent?: boolean;
}

interface UnlockMeta {
  source: 'event' | 'number';
  eventName?: string;
}

interface PendingFlipItem {
  cardId: string;
  category: string;
  number: number;
  frontImage: string;
  backImage: string;
}

interface DailyVisitData {
  date: string;
  count: number;
}

interface PreloadResult {
  src: string;
  status: 'loaded' | 'error';
}

export interface CollectiblesShowOptions {
  journeyEnterTiming?: 'standard' | 'post-terminal-exit';
}

// Global window extensions - Window interface is now defined in src/types/window.d.ts

class CollectiblesManager {
  private eventListenersInitialized: boolean = false;
  private journeyPreparePromise: Promise<void> | null = null;
  private journeyPrepareEpoch = 0;

  // 🔥 MEMORY LEAK FIX: Store event handler references for cleanup
  private boundHandlers: {
    backButtonClick?: (e: Event) => void;
    titleClick?: () => void;
    showCollectiblesBackBtnClick?: (e: Event) => void;
  } = {};

  constructor() {
    this.initEventListeners();
  }

  private scheduleJourneyBackExit(backBtn: Element | null): void {
    const backButtonEl = backBtn as HTMLElement | null;

    if ((window as any).__ccIsHidingCollectibles) {
      logger.warn('⚠️ hideCollectiblesScreenWithAnimation already in progress, ignoring duplicate click');
      return;
    }

    if (backButtonEl?.getAttribute('data-journey-back-exit-pending') === 'true') {
      return;
    }

    backButtonEl?.setAttribute('data-journey-back-exit-pending', 'true');
    this.runJourneyBackExit();
    window.setTimeout(() => {
      backButtonEl?.removeAttribute('data-journey-back-exit-pending');
    }, 700);
  }

  private runJourneyBackExit(): void {
    logger.info('🎁 Collectibles back button clicked');

    // Explicitly mark this hide as "toHome" so hideCollectibles doesn't get confused by __ccCameFromJourney flags
    (window as any).__ccJourneyExitMode = 'toHome';

    // Back-to-home must start the visual exit immediately. The UI wrapper performs
    // async cleanup first, which makes the back button feel delayed.
    if (typeof window.hideCollectiblesScreen === 'function') {
      (window as any).__ccIsHidingCollectibles = true;
      logger.info('🎁 Calling window.hideCollectiblesScreen() immediately for Journey back');
      try {
        const result: any = window.hideCollectiblesScreen();
        if (result && typeof result.catch === 'function') {
          (result as Promise<void>).catch((err: any) => {
            logger.error('❌ Error in hideCollectiblesScreen:', err);
          }).finally(() => {
            (window as any).__ccIsHidingCollectibles = false;
          });
        } else {
          (window as any).__ccIsHidingCollectibles = false;
        }
      } catch (err: any) {
        logger.error('❌ Error calling hideCollectiblesScreen:', err);
        (window as any).__ccIsHidingCollectibles = false;
      }
    } else if (typeof (window as any).hideCollectiblesScreenWithAnimation === 'function') {
      logger.info('🎁 Calling window.hideCollectiblesScreenWithAnimation() fallback');
      (window as any).hideCollectiblesScreenWithAnimation().catch((err: any) => {
        logger.error('❌ Error in hideCollectiblesScreenWithAnimation:', err);
        (window as any).__ccIsHidingCollectibles = false;
      });
    } else {
      logger.warn('⚠️ window.hideCollectiblesScreen not available, using fallback');
      this.hideCollectibles().catch((err: any) => {
        logger.error('❌ Error in hideCollectibles:', err);
      }).finally(() => {
        (window as any).__ccIsHidingCollectibles = false;
      });
    }
  }

  private initEventListeners(): void {
    // Prevent duplicate initialization
    if (this.eventListenersInitialized) {
      console.log('🔄 Event listeners already initialized, skipping...');
      return;
    }

    console.log('🔌 Initializing event listeners...');

    // 🔥 MEMORY LEAK FIX: Store bound handlers for cleanup
    // Back button - use event delegation to handle clicks even if button doesn't exist yet
    this.boundHandlers.backButtonClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const backBtn = target.closest('#collectibles-back');
      if (backBtn) {
        e.preventDefault();
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();

        playNavIconCartoonBounce(backBtn);
        this.scheduleJourneyBackExit(backBtn);
      }
    };
    document.addEventListener('click', this.boundHandlers.backButtonClick);

    // Title click - scroll to top
    const titleEl = document.getElementById('collectibles-title');
    if (titleEl) {
      titleEl.style.cursor = 'pointer';
      titleEl.style.pointerEvents = 'auto'; // Override CSS pointer-events: none
      this.boundHandlers.titleClick = () => {
        console.log('🎁 Title clicked, scrolling to top');
        const scrollable = document.querySelector('.collectibles-scrollable');
        if (scrollable) {
          scrollable.scrollTo({ top: 0, behavior: 'smooth' });
          console.log('✅ Scroll to top triggered');
        } else {
          console.warn('⚠️ Scrollable not found');
        }
      };
      titleEl.addEventListener('click', this.boundHandlers.titleClick);
    }

    this.eventListenersInitialized = true;
    console.log('✅ Event listeners initialized successfully');
  }

  // 🔥 MEMORY LEAK FIX: Cleanup all event listeners (public for app-manager)
  public cleanupEventListeners(): void {
    if (!this.eventListenersInitialized) return;

    console.log('🧹 Cleaning up collectibles event listeners...');

    // Remove global document event listeners
    if (this.boundHandlers.backButtonClick) {
      document.removeEventListener('click', this.boundHandlers.backButtonClick);
    }

    // 🔥 FIX: Remove showCollectibles back button handler
    const backBtn = document.getElementById('collectibles-back');
    if (backBtn && this.boundHandlers.showCollectiblesBackBtnClick) {
      backBtn.removeEventListener('click', this.boundHandlers.showCollectiblesBackBtnClick);
      backBtn.removeAttribute('data-listener-attached');
      delete this.boundHandlers.showCollectiblesBackBtnClick;
    }

    // Remove element-specific event listeners
    const titleEl = document.getElementById('collectibles-title');
    if (titleEl && this.boundHandlers.titleClick) {
      titleEl.removeEventListener('click', this.boundHandlers.titleClick);
    }

    // Clear bound handlers
    this.boundHandlers = {};
    this.eventListenersInitialized = false;

    console.log('✅ Collectibles event listeners cleaned up');
  }

  // 🔥 CRITICAL FIX: Master cleanup method - calls ALL cleanup functions
  // This is the MAIN cleanup entry point called from main.ts exitToMenu()
  public async cleanup(): Promise<void> {
    console.log('🧹🧹🧹 collectiblesManager.cleanup() - FULL CLEANUP STARTING...');
    this.cancelJourneyScreenPreparation('collectibles cleanup');

    // 1. Cleanup event listeners (document-level, element-level)
    try {
      this.cleanupEventListeners();
      console.log('✅ collectiblesManager event listeners cleaned up');
    } catch (error) {
      console.warn('⚠️ Failed to cleanup collectibles event listeners:', error);
    }

    // 2. Cleanup journey boards manager (cards, animations, scroll listeners)
    try {
      const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
      if (journeyBoardsManager && typeof journeyBoardsManager.cleanup === 'function') {
        journeyBoardsManager.cleanup();
        console.log('✅ journeyBoardsManager.cleanup() completed');
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup journey boards manager:', error);
    }

    console.log('✅✅✅ collectiblesManager.cleanup() - FULL CLEANUP COMPLETED');
  }

  private getCardBackgroundObserver(): IntersectionObserver | null {
    if (typeof IntersectionObserver === 'undefined') return null;
    if (this.cardBackgroundObserver) return this.cardBackgroundObserver;

    this.cardBackgroundObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        const src = element.dataset.lazyBackground;
        if (src) {
          element.style.backgroundImage = `url('${src}')`;
          delete element.dataset.lazyBackground;
        }
        this.cardBackgroundObserver?.unobserve(element);
      });
    }, {
      root: null,
      rootMargin: '360px 0px',
      threshold: 0.01,
    });

    return this.cardBackgroundObserver;
  }

  private applyCardBackgroundWhenVisible(element: HTMLElement, src: string, eager = false): void {
    element.dataset.lazyBackground = src;

    if (eager) {
      element.style.backgroundImage = `url('${src}')`;
      delete element.dataset.lazyBackground;
      return;
    }

    const observer = this.getCardBackgroundObserver();
    if (!observer) {
      element.style.backgroundImage = `url('${src}')`;
      delete element.dataset.lazyBackground;
      return;
    }

    observer.observe(element);
  }

  // 🔥 NEW: Prepare Journey screen by rendering boards in background (without showing screen)
  // This allows boards to render while slider exit animation plays
  async prepareJourneyScreen(options: { requiredForVisibleEnter?: boolean } = {}): Promise<void> {
    const preparationAllowed = (): boolean => {
      const runtimeState = readJourneyPreparationRuntimeState();
      return options.requiredForVisibleEnter === true
        ? isJourneyVisibleEnterPreparationAllowed(runtimeState)
        : isJourneyBackgroundPreparationAllowed(runtimeState);
    };

    if (!preparationAllowed()) {
      logger.info('⏭️ Journey background preparation blocked outside menu ownership',
        readJourneyPreparationRuntimeState());
      return;
    }

    if (this.journeyPreparePromise) {
      return this.journeyPreparePromise;
    }

    const prepareEpoch = ++this.journeyPrepareEpoch;
    const preparePromise = (async () => {
    logger.info('🗺️ prepareJourneyScreen - rendering boards in background');
    const screen = document.getElementById('journey-screen');
    if (!screen) {
      logger.error('❌ journey-screen element not found');
      return;
    }

    // 🔥 PRODUCTION READY: Don't wait for preloading - render boards immediately
    // Images will load from Cache API or browser cache as needed (non-blocking)
    // This ensures Journey screen appears instantly, images load in background
    logger.info('🗺️ Rendering Journey boards immediately (images will load from cache as needed)');

    // Render boards in background
    const journeyContainer = document.getElementById('journey-boards-container');
    if (journeyContainer) {
      if (isJourneyViewStructurallyPrepared(journeyContainer)) {
        logger.info('🗺️ Journey boards already prepared - skipping rerender');
        return;
      }
      const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
      if (prepareEpoch !== this.journeyPrepareEpoch || !preparationAllowed()) {
        logger.info('⏭️ Discarded stale or out-of-zone Journey background preparation', {
          prepareEpoch,
          runtime: readJourneyPreparationRuntimeState(),
        });
        return;
      }
      const detailedRenderDiagnostic = areDetailedRuntimeDiagnosticsEnabled();
      const renderStartedAt = detailedRenderDiagnostic ? performance.now() : 0;
      if (detailedRenderDiagnostic) {
        emitIOSNativeDiagnostic('journey-required-render-start', {
          requiredForVisibleEnter: options.requiredForVisibleEnter === true,
        });
      }
      journeyBoardsManager.renderBoards();
      if (detailedRenderDiagnostic) {
        emitIOSNativeDiagnostic('journey-required-render-complete', {
          requiredForVisibleEnter: options.requiredForVisibleEnter === true,
          durationMs: Math.round(performance.now() - renderStartedAt),
          // Structural cardinality is emitted by the scoped renderer. Avoid a
          // second live-tree traversal on the same first-paint task.
          structurallyPrepared: isJourneyViewStructurallyPrepared(journeyContainer),
        });
      }
      journeyBoardsManager.updateCounter();
      logger.info('🗺️ Journey boards rendered in background');

    }
    })();
    this.journeyPreparePromise = preparePromise;

    try {
      await preparePromise;
    } finally {
      if (this.journeyPreparePromise === preparePromise) {
        this.journeyPreparePromise = null;
      }
    }
  }

  public cancelJourneyScreenPreparation(reason: string): void {
    this.journeyPrepareEpoch += 1;
    this.journeyPreparePromise = null;
    logger.info('🛑 Journey background preparation invalidated', { reason });
  }

  async showCollectibles(options?: CollectiblesShowOptions): Promise<void> {
    logger.info('🎁 showCollectibles method called');
    const screen = document.getElementById('journey-screen');
    if (!screen) {
      logger.error('❌ collectibles-screen element not found');
      return;
    }
    const activeAreaEnterOverlapDelayMs = options?.journeyEnterTiming === 'post-terminal-exit'
      ? JOURNEY_POST_TERMINAL_ACTIVE_AREA_ENTER_OVERLAP_DELAY_MS
      : JOURNEY_ACTIVE_AREA_ENTER_OVERLAP_DELAY_MS;
    const journeyPresentationEpoch = appZoneManager.getPresentationEpoch();
    primeJourneyScreenHiddenForEnter(screen as HTMLElement, 'showCollectibles-start');
    emitIOSNativeDiagnostic('show-start');

    const suppressDirectDetailReturn =
      (window as any).__ccSuppressJourneyShowForDirectDetailReturn === true ||
      (window as any).__ccDirectDetailModalReturnActive === true;
    if (suppressDirectDetailReturn) {
      const detailModal = document.getElementById('collectibles-detail-modal') as HTMLElement | null;
      const detailModalOpeningOrVisible =
        !!detailModal &&
        detailModal.hidden !== true &&
        detailModal.style.display !== 'none';
      if (
        detailModalOpeningOrVisible ||
        (window as any).__ccSuppressJourneyShowForDirectDetailReturn === true ||
        (window as any).__ccDirectDetailModalReturnActive === true
      ) {
        (screen as HTMLElement).style.display = 'flex';
        (screen as HTMLElement).style.opacity = '0';
        (screen as HTMLElement).style.visibility = 'hidden';
        (screen as HTMLElement).style.pointerEvents = 'none';
        logger.info('⏭️ Suppressed Journey enter animation during direct detail-modal return');
        return;
      }
    }

    const journeyContainer = document.getElementById('journey-boards-container');
    const returnBoardIdEarly = getJourneyReturnBoardId();
    const returningFromInterimBoardFlagEarly =
      !!(window as any).__ccReturningFromInterimBoard ||
      localStorage.getItem('__ccReturningFromInterimBoard') === 'true';
    const returningFromDetailModalFlagEarly = !!(window as any).__ccReturningFromDetailModal;
    const isV700WorldReturnEarly =
      !!journeyContainer &&
      (
        journeyContainer.dataset.journeyV700View === 'world' ||
        (window as any).__ccJourneyV700View === 'world' ||
        localStorage.getItem('__ccJourneyV700View') === 'world'
      );
    const hasRenderedJourneyReturnTargetEarly =
      returnBoardIdEarly !== null &&
      !!document.querySelector(`.journey-board-card[data-board-id="${returnBoardIdEarly}"]`);
    const journeyReturnPolicy = resolveJourneyReturnEntryPolicy({
      interimReturnRequested: returningFromInterimBoardFlagEarly,
      detailReturnRequested: returningFromDetailModalFlagEarly,
      returnBoardId: returnBoardIdEarly,
      hasRenderedBoardTarget: hasRenderedJourneyReturnTargetEarly,
      isWorldView: isV700WorldReturnEarly,
    });
    const hasConcreteJourneyReturnTargetEarly = journeyReturnPolicy.hasConcreteTarget;
    const returningFromInterimBoardEarly = journeyReturnPolicy.returningFromInterimBoard;
    const returningFromDetailModalEarly = journeyReturnPolicy.returningFromDetailModal;
    if (journeyReturnPolicy.clearStaleReturn) {
      delete (window as any).__ccReturningFromInterimBoard;
      delete (window as any).__ccReturningFromDetailModal;
      delete (window as any).__ccSuppressJourneyV700AutoWorldEnter;
      delete (window as any).__ccJourneyActiveAreaEnterPending;
      localStorage.removeItem('__ccReturningFromInterimBoard');
      emitIOSNativeDiagnostic('stale-journey-return-cleared-for-hub', {
        interim: returningFromInterimBoardFlagEarly,
        detail: returningFromDetailModalFlagEarly,
      });
    }
    const isReturningToJourneyWithActiveArea =
      returningFromDetailModalEarly || returningFromInterimBoardEarly;
    if (!isReturningToJourneyWithActiveArea) {
      ensureIOSJourneyRouteAudit('show-collectibles-direct-enter');
      markIOSJourneyRouteAudit('show-collectibles-start');
      unlockJourneyViewportTransition('showCollectibles-fresh-enter');
    }

    // 🔥 Hide homepage when showing Journey screen
    const homeElement = document.getElementById('home');
    if (homeElement) {
      homeElement.style.display = 'none';
      homeElement.setAttribute('hidden', 'true');
      homeElement.style.visibility = 'hidden';
      homeElement.style.opacity = '0';
      homeElement.style.zIndex = '-1';
      logger.info('✅ Homepage hidden - Journey screen is active');
    }

    // 🔥 Hide slider container when Journey screen is shown
    const sliderContainer = document.getElementById('slider-container');
    if (sliderContainer) {
      sliderContainer.style.display = 'none';
      sliderContainer.style.visibility = 'hidden';
      sliderContainer.style.opacity = '0';
      sliderContainer.style.zIndex = '-1';
      logger.info('✅ Slider container hidden - Journey screen is active');
    }

    // Forward navigation only synchronizes the hidden Homepage position.
    // forceReady() is a return/recovery API: it clears the transition lock,
    // reveals Homepage layers and reacquires Homepage idle ownership mid-handoff.
    const sliderManager = (window as any).sliderManager;
    if (sliderManager) {
      try {
        if (typeof sliderManager.syncHiddenSlideState === 'function') {
          sliderManager.syncHiddenSlideState(JOURNEY_SLIDE_INDEX);
          logger.info('✅ Hidden slider state synchronized without Homepage recovery lifecycle');
        }
      } catch (err) {
        logger.warn('⚠️ Failed to position slider for Journey:', err);
      }
    }

    // Hide navigation (Journey has its own back button)
    uiManager.hideNavigation();

    // Preload already happens in constructor, skip await to show screen immediately
    // Images will load progressively in the background

    // 🔥 CRITICAL FIX: Ensure back button event listener is attached (button might not exist when initEventListeners was called)
    const backBtn = document.getElementById('collectibles-back');
    if (backBtn && !backBtn.hasAttribute('data-listener-attached')) {
      console.log('🔌 Attaching back button listener in showCollectibles');
      // 🔥 FIX: Store handler for proper cleanup
      const backBtnHandler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();

        playNavIconCartoonBounce(backBtn);
        this.scheduleJourneyBackExit(backBtn);
      };
      backBtn.addEventListener('click', backBtnHandler);
      // 🔥 FIX: Store handler for cleanup
      this.boundHandlers.showCollectiblesBackBtnClick = backBtnHandler;
      (backBtn as any)._backBtnHandler = backBtnHandler;
      backBtn.setAttribute('data-listener-attached', 'true');
    }

    // Keep Journey hidden while DOM/render/scroll prep runs. This prevents a
    // one-frame final-state flash before enter animation start values are applied.
    primeJourneyScreenHiddenForEnter(screen as HTMLElement, 'showCollectibles-before-render-prep');
    screen.removeAttribute('hidden');
    screen.classList.remove('hidden');

    // 🔥 CRITICAL MOBILE FIX: Set opacity 0 and visibility hidden IMMEDIATELY to prevent flash
    // This must be done BEFORE display:flex to prevent any visible frame
    // Use inline styles that GSAP will override - this ensures screen is invisible until animation starts
    (screen as HTMLElement).style.setProperty('opacity', '0', 'important');
    (screen as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
    // 🔥 CRITICAL: Also set will-change for better mobile performance
    (screen as HTMLElement).style.willChange = 'opacity, transform';

    let journeyBoardsReadyPromise: Promise<void> | null = null;

    // 🔥 USER REQUEST: Restore scroll position ASAP when returning from interim board or detail modal
    // A remembered `world` view is presentation state, not proof that a game
    // is returning to a concrete Unit. It can survive a first-run Hub handoff.
    // Only an actual board identity may select the active-area/world-return path.
    const shouldUseV700WorldReturnEnter =
      !!journeyContainer && journeyReturnPolicy.useWorldReturnEnter;
    if (shouldUseV700WorldReturnEnter) {
      (window as any).__ccSuppressJourneyV700AutoWorldEnter = true;
    }
    const shouldPlayActiveBoardAreaEnter =
      !!journeyContainer && journeyReturnPolicy.playActiveBoardAreaEnter;
    emitIOSNativeDiagnostic('return-mode-selected', {
      shouldPlayActiveBoardAreaEnter,
      shouldUseV700WorldReturnEnter,
      returningFromInterimBoardEarly: !!returningFromInterimBoardEarly,
      returningFromInterimBoardFlagEarly: !!returningFromInterimBoardFlagEarly,
      hasConcreteJourneyReturnTargetEarly,
      returnBoardIdEarly,
      hasRenderedJourneyReturnTargetEarly,
      returningFromDetailModalEarly: !!returningFromDetailModalEarly,
      returningFromDetailModalFlagEarly: !!returningFromDetailModalFlagEarly,
    });
    try {
      if (shouldPlayActiveBoardAreaEnter) {
        (window as any).__ccJourneyActiveAreaEnterPending = true;
      } else {
        delete (window as any).__ccJourneyActiveAreaEnterPending;
      }
    } catch {}
    if (shouldPlayActiveBoardAreaEnter) {
      hideLastActiveJourneyBoardAreaBeforeEnter();
    }
    if (returningFromInterimBoardEarly || returningFromDetailModalEarly) {
      restoreJourneyReturnScrollPosition('early-return-before-render');
      try {
        const scrollableEarly = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
        const savedScrollTopEarly =
          (window as any).__ccJourneyScrollTop ??
          Number(localStorage.getItem('__ccJourneyScrollTop'));
        if (scrollableEarly && typeof savedScrollTopEarly === 'number') {
          // Apply multiple times to beat any layout/animation resets
          scrollableEarly.scrollTop = savedScrollTopEarly;
          requestAnimationFrame(() => {
            scrollableEarly.scrollTop = savedScrollTopEarly;
            setTimeout(() => {
              scrollableEarly.scrollTop = savedScrollTopEarly;
            }, 120);
          });
        }
      } catch {}
    }

    // 🔥 OPTIMIZATION: Check if boards are already rendered (by prepareJourneyScreen)
    // If not, render them now (non-blocking - don't await)
    if (journeyContainer) {
      const journeyViewPrepared = isJourneyViewStructurallyPrepared(journeyContainer);
      if (!journeyViewPrepared) {
        // Boards not yet rendered - prepare in background (deduped)
        logger.info('🗺️ Boards not yet rendered - preparing now (non-blocking)');
        journeyBoardsReadyPromise = this.prepareJourneyScreen({ requiredForVisibleEnter: true }).catch((error) => {
          logger.error('❌ Failed to prepare journey boards:', String(error));
        });
      } else {
        logger.info('🗺️ Boards already rendered - skipping render');
        journeyBoardsReadyPromise = Promise.resolve();
      }

      // 🔥 CRITICAL FIX: Ensure scroll is enabled when journey screen is shown
      // This fixes broken scroll when returning from game
      setTimeout(() => {
        restoreJourneyScrollableInteractivity('showCollectibles-scroll-enable-timeout', false);
      }, 100);
    }

    // 🔥 USER REQUEST: Scroll to interim card is handled AFTER enter animation completes
    // (moved to after animateCollectiblesScreenEnter call to prevent scroll during animation)

    let journeyBoardsManagerPreparedForEnter: any = null;
    let activeBoardAreaPreparedBeforeReveal = false;
    if (journeyContainer) {
      try {
        if (journeyBoardsReadyPromise) {
          logger.info('🧭 JourneyForestAnim pre-reveal-waiting-for-boards-ready', {
            shouldPlayActiveBoardAreaEnter,
          });
          await journeyBoardsReadyPromise;
          logger.info('🧭 JourneyForestAnim pre-reveal-boards-ready', {
            journeyViewPrepared: isJourneyViewStructurallyPrepared(journeyContainer),
          });
        }
        const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
        journeyBoardsManagerPreparedForEnter = journeyBoardsManager;
        restoreJourneyReturnScrollPosition('pre-reveal-after-boards-ready');
        journeyBoardsManager.prepareJourneyBoardCardTransformsForReveal?.('collectibles-pre-reveal');
        if (shouldUseV700WorldReturnEnter) {
          journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn?.('collectibles-pre-reveal-world-return');
        }
        prepareJourneyViewportScreenEnter('collectibles-pre-reveal');
        emitIOSNativeDiagnostic('viewport-prepared', { shouldPlayActiveBoardAreaEnter });
        if (shouldPlayActiveBoardAreaEnter) {
          hideLastActiveJourneyBoardAreaBeforeEnter();
          journeyBoardsManager.prepareActiveJourneyBoardAreaEnterAnimation?.();
          restoreJourneyReturnScrollPosition('pre-reveal-after-active-prepare');
          activeBoardAreaPreparedBeforeReveal = true;
        }
      } catch (error) {
        logger.warn('⚠️ Failed to prepare Journey before reveal:', String(error));
      }
    }

    // 🎬 CRITICAL: Trigger Journey screen enter animation (pop-in) using GSAP
    // Screen is now visible with opacity 0, ready for animation
    // 🔥 CRITICAL: Set display FIRST, then animate immediately (no delays)
    primeJourneyScreenHiddenForEnter(screen as HTMLElement, 'showCollectibles-before-enter-start');
    // Opacity and visibility are already set to 0/hidden above - GSAP will animate them

    try {
      let enterAnimationStarted = false;
      const revealFallbackTimer = window.setTimeout(() => {
        if (enterAnimationStarted) return;
        if (journeyBoardsReadyPromise) {
          logger.info('⏭️ Journey enter fallback delayed because boards are still preparing');
          return;
        }
        logger.warn('⚠️ Journey enter animation delayed - keeping screen primed hidden to prevent flash');
      }, 2400);

      // 🔥 CRITICAL MOBILE FIX: Use requestAnimationFrame to ensure DOM is ready on mobile
      // Then import and start animation immediately
      requestAnimationFrame(() => {
        import('./ui/collectibles-animations.js').then(({ animateCollectiblesScreenEnter }) => {
          window.clearTimeout(revealFallbackTimer);
          enterAnimationStarted = true;
          console.log('🎬 Starting Journey enter animation IMMEDIATELY...');
          releaseJourneyScreenHiddenPrime(screen as HTMLElement);
          emitIOSNativeDiagnostic('screen-prime-released');
          // 🔥 CRITICAL: Start animation immediately - screen is already prepared with opacity 0
          // Use RAF to ensure browser is ready to render animation on mobile
          requestAnimationFrame(() => {
            const enterPromise = Promise.resolve(animateCollectiblesScreenEnter());
            emitIOSNativeDiagnostic('viewport-enter-started', { shouldPlayActiveBoardAreaEnter });
            let homepageHubEnterStartedFromPreparedManager = false;
            if (
              journeyContainer &&
              journeyBoardsManagerPreparedForEnter &&
              !shouldPlayActiveBoardAreaEnter &&
              !shouldUseV700WorldReturnEnter
            ) {
              homepageHubEnterStartedFromPreparedManager = true;
              emitIOSNativeDiagnostic('hub-enter-started-from-prepared-manager');
              journeyBoardsManagerPreparedForEnter.playJourneyV700VisibleEnterFromHomepage?.();
            }
            if (journeyContainer) {
              import('./modules/journey-boards-manager.js').then(async ({ journeyBoardsManager }) => {
                const activeJourneyBoardsManager = journeyBoardsManagerPreparedForEnter || journeyBoardsManager;
                if (journeyBoardsReadyPromise && !activeBoardAreaPreparedBeforeReveal) {
                  logger.info('🧭 JourneyForestAnim collectibles-waiting-for-boards-ready', {
                    shouldPlayActiveBoardAreaEnter,
                  });
                  await journeyBoardsReadyPromise;
                  logger.info('🧭 JourneyForestAnim collectibles-boards-ready', {
                    journeyViewPrepared: isJourneyViewStructurallyPrepared(journeyContainer),
                  });
                }
                if (shouldPlayActiveBoardAreaEnter && !activeBoardAreaPreparedBeforeReveal) {
                  hideLastActiveJourneyBoardAreaBeforeEnter();
                  activeJourneyBoardsManager.prepareActiveJourneyBoardAreaEnterAnimation?.();
                }
                let v700WorldReturnEnterStarted = false;
                if (shouldUseV700WorldReturnEnter) {
                  v700WorldReturnEnterStarted = true;
                  logger.info('🧩 JourneyV700Flow collectibles-v700-world-return-enter-with-viewport', {
                    returningFromInterimBoardEarly,
                    containerView: journeyContainer.dataset.journeyV700View || null,
                    windowView: (window as any).__ccJourneyV700View || null,
                  });
                  activeJourneyBoardsManager.playJourneyV700WorldEnterFromReturn?.(
                    returningFromInterimBoardEarly ? 'interim-game-return' : 'journey-game-return'
                  );
                }
                if (!shouldPlayActiveBoardAreaEnter) {
                  if (!shouldUseV700WorldReturnEnter && !homepageHubEnterStartedFromPreparedManager) {
                    emitIOSNativeDiagnostic('hub-enter-started-from-import-fallback');
                    activeJourneyBoardsManager.playJourneyV700VisibleEnterFromHomepage?.();
                  }
                }
                let activeAreaEnterStarted = false;
                const startActiveAreaEnter = (source: string): void => {
                  if (!shouldPlayActiveBoardAreaEnter || activeAreaEnterStarted) return;
                  if (
                    !screen.isConnected
                    || !journeyContainer.isConnected
                    || !appZoneManager.isPresentationCurrent(journeyPresentationEpoch, 'journey')
                  ) {
                    try { delete (window as any).__ccJourneyActiveAreaEnterPending; } catch {}
                    logger.info('⏭️ Journey active-area enter cancelled after presentation ownership changed', {
                      source,
                      journeyPresentationEpoch,
                    });
                    return;
                  }
                  activeAreaEnterStarted = true;
                  try {
                    delete (window as any).__ccJourneyActiveAreaEnterPending;
                  } catch {}
                  logger.info('🧭 JourneyForestAnim collectibles-active-enter-fired', {
                    source,
                    delayMs: activeAreaEnterOverlapDelayMs,
                  });
                  emitIOSNativeDiagnostic('active-area-enter-fired', { source });
                  activeJourneyBoardsManager.playActiveJourneyBoardAreaEnterAnimation?.();
                };
                if (shouldPlayActiveBoardAreaEnter) {
                  logger.info('🧭 JourneyForestAnim collectibles-active-enter-scheduled', {
                    delayMs: activeAreaEnterOverlapDelayMs,
                    returningFromInterimBoardEarly,
                    returningFromDetailModalEarly,
                  });
                  window.setTimeout(() => {
                    startActiveAreaEnter('viewport-enter-overlap');
                  }, activeAreaEnterOverlapDelayMs);
                }
                const restoreScrollAfterEnter = (source: string): void => {
                  restoreJourneyScrollableInteractivity(source);
                  if (returningFromInterimBoardEarly || returningFromDetailModalEarly) {
                    restoreJourneyReturnScrollPosition(`${source}-restore-scroll`);
                  }
                  [180, 420, 900].forEach((delayMs) => {
                    window.setTimeout(() => {
                      restoreJourneyScrollableInteractivity(`${source}-settled-${delayMs}ms`);
                      if (returningFromInterimBoardEarly || returningFromDetailModalEarly) {
                        restoreJourneyReturnScrollPosition(`${source}-settled-${delayMs}ms-restore-scroll`);
                      }
                    }, delayMs);
                  });
                };
                enterPromise.then(() => {
                  if (shouldUseV700WorldReturnEnter && !v700WorldReturnEnterStarted) {
                    logger.info('🧩 JourneyV700Flow collectibles-v700-world-return-enter-visible', {
                      returningFromInterimBoardEarly,
                      containerView: journeyContainer.dataset.journeyV700View || null,
                      windowView: (window as any).__ccJourneyV700View || null,
                    });
                    activeJourneyBoardsManager.playJourneyV700WorldEnterFromReturn?.(
                      returningFromInterimBoardEarly ? 'interim-game-return' : 'journey-game-return'
                    );
                  }
                  if (shouldPlayActiveBoardAreaEnter) {
                    startActiveAreaEnter('viewport-enter-complete-fallback');
                  }
                  restoreScrollAfterEnter('journey-enter-complete');
                }).catch((error) => {
                  logger.warn('⚠️ Journey viewport enter completion failed:', String(error));
                  if (shouldUseV700WorldReturnEnter && !v700WorldReturnEnterStarted) {
                    activeJourneyBoardsManager.playJourneyV700WorldEnterFromReturn?.(
                      returningFromInterimBoardEarly
                        ? 'interim-game-return-viewport-error'
                        : 'journey-game-fail-return-viewport-error'
                    );
                  }
                  if (shouldPlayActiveBoardAreaEnter) {
                    startActiveAreaEnter('viewport-enter-error-fallback');
                  }
                  restoreScrollAfterEnter('journey-enter-error');
                });
              }).catch((error) => {
                enterPromise.finally(() => {
                  restoreJourneyScrollableInteractivity('journey-manager-import-error');
                });
                logger.warn('⚠️ Failed to start Journey forest scene enter animation:', String(error));
              });
            } else {
              Promise.resolve(animateCollectiblesScreenEnter()).finally(() => {
                restoreJourneyScrollableInteractivity('collectibles-enter-complete');
              });
            }
          });
        }).catch((error) => {
          window.clearTimeout(revealFallbackTimer);
          console.error('❌ Failed to load collectibles animations:', error);
          // Fallback: just show screen normally
          releaseJourneyScreenHiddenPrime(screen as HTMLElement);
          (screen as HTMLElement).style.opacity = '1';
          (screen as HTMLElement).style.visibility = 'visible';
          (screen as HTMLElement).style.willChange = 'auto';
          restoreJourneyScrollableInteractivity('journey-enter-import-fallback');
        });
      });

          // 🔥 CRITICAL: Delay scroll to interim card AND start idle bounce animations AFTER enter animation completes
          // Enter animation takes ~0.7s (header 0.5s + delay 0.1s + cards 0.4s)
          // 🔥 USER REQUEST: Reduced wait time by 50% for faster auto-scroll (450ms vs 900ms)
          if (journeyContainer) {
            setTimeout(async () => {
              try {
                const journeyBoardsContainer = document.getElementById('journey-boards-container') as HTMLElement | null;
                const isJourneyV700Hub =
                  (window as any).__ccJourneyV700View === 'hub' ||
                  journeyBoardsContainer?.dataset.journeyV700View === 'hub';
                if (isJourneyV700Hub) {
                  logger.info('🧭 JourneyV700Flow legacy-post-enter-skipped-v700-hub', {
                    hasJourneyBoardsContainer: !!journeyBoardsContainer,
                    containerView: journeyBoardsContainer?.dataset.journeyV700View || null,
                  });
                  return;
                }

                // 🔥 USER REQUEST: Skip auto-scroll if returning from detail modal or interim board
                // Auto-scroll should ONLY happen when entering Journey from homepage slider
                const returningFromDetailModal = (window as any).__ccReturningFromDetailModal;
                const returningFromInterimBoard =
                  (window as any).__ccReturningFromInterimBoard ||
                  localStorage.getItem('__ccReturningFromInterimBoard') === 'true';
                if (returningFromDetailModal || returningFromInterimBoard) {
                  console.log('🗺️ Skipping auto-scroll (returning from detail modal or interim board)');
                  // 🔥 USER REQUEST: Restore previous scroll position when returning from detail modal or interim board
                  if (returningFromDetailModal || returningFromInterimBoard) {
                    try {
                      const scrollable = journeyContainer.querySelector('.collectibles-scrollable') as HTMLElement | null;
                      const savedScrollTop =
                        (window as any).__ccJourneyScrollTop ??
                        Number(localStorage.getItem('__ccJourneyScrollTop'));
                      if (scrollable && typeof savedScrollTop === 'number') {
                        scrollable.scrollTop = savedScrollTop;
                        requestAnimationFrame(() => {
                          scrollable.scrollTop = savedScrollTop;
                          // Apply again after layout settles (prevents reset to top)
                          setTimeout(() => {
                            scrollable.scrollTop = savedScrollTop;
                          }, 50);
                          setTimeout(() => {
                            scrollable.scrollTop = savedScrollTop;
                          }, 150);
                        });
                      }
                    } catch {}
                  }
                  // Clear flags after checking
                  delete (window as any).__ccReturningFromDetailModal;
                  delete (window as any).__ccReturningFromInterimBoard;
                  localStorage.removeItem('__ccReturningFromInterimBoard');
                  localStorage.removeItem('__ccJourneyScrollTop');
                } else {
                  // Only auto-scroll when entering from homepage slider
                  const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
                  if (journeyBoardsManager && typeof (journeyBoardsManager as any).restoreOrScrollToInterimCard === 'function') {
                    console.log('🗺️ Starting scroll to interim card after enter animation...');
                    (journeyBoardsManager as any).restoreOrScrollToInterimCard();
                  }
                }

                try {
                  const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
                  if (journeyBoardsManager && typeof (journeyBoardsManager as any).resumeInterimCardIdleEffects === 'function') {
                    (journeyBoardsManager as any).resumeInterimCardIdleEffects(
                      returningFromDetailModal || returningFromInterimBoard
                        ? 'collectibles-return-after-modal'
                        : 'collectibles-enter-after-home'
                    );
                  }
                } catch (resumeError) {
                  logger.warn('⚠️ Failed to resume interim card idle effects after Journey enter:', String(resumeError));
                }

                // 🔥 CRITICAL: Start idle bounce animations AFTER enter animation completes
                // This prevents jerky/laggy behavior on mobile when cards try to animate during enter animation
                const { JOURNEY_CARD_IDLE_BOUNCE } = await import('./modules/journey-card-idle-bounce.js');
                const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement;
                if (JOURNEY_CARD_IDLE_BOUNCE && JOURNEY_CARD_IDLE_BOUNCE.ENABLE && cardsContainer) {
                  console.log('🎬 Starting journey card idle bounce AFTER enter animation...');
                  JOURNEY_CARD_IDLE_BOUNCE.start(cardsContainer);
                  logger.info('✅ Journey card idle bounce started after enter animation');
                }
              } catch (error) {
                console.warn('⚠️ Failed to scroll to interim card or start idle bounce:', error);
              }
            }, 450); // 🔥 USER REQUEST: Sped up by 50% (was 900ms, now 450ms) - faster auto-scroll to interim card
          }

      // 🔥 PREMIUM FIX: Position is set synchronously in renderBoards() via CSS custom properties
      // No need to refresh after animation - this would cause visible movement
    } catch (error) {
      console.error('❌ Failed to trigger collectibles enter animation:', error);
      // Fallback: just show the screen normally
      // 🔥 CRITICAL: Explicitly set all styles to ensure journey screen is visible
      releaseJourneyScreenHiddenPrime(screen as HTMLElement);
      (screen as HTMLElement).style.display = 'flex';
      (screen as HTMLElement).style.visibility = 'visible';
      (screen as HTMLElement).style.opacity = '1';
      (screen as HTMLElement).style.zIndex = '999999';
      screen.classList.add('show');
      screen.removeAttribute('hidden');
      restoreJourneyScrollableInteractivity('showCollectibles-enter-catch-fallback');

      // 🔥 PREMIUM FIX: Position is already set synchronously in renderBoards()
      // No need to refresh - CSS custom properties handle positioning without visible movement
    }
  }

  async hideCollectibles(): Promise<void> {
    this.cancelJourneyScreenPreparation('hide collectibles');
    const screen = document.getElementById('journey-screen');
    if (screen) {
      // Determine hide mode explicitly (prevents stale __ccCameFromJourney from breaking back button)
      const exitMode = (window as any).__ccJourneyExitMode;
      const isBackButton = exitMode !== 'toGame'; // default to back-to-home
      // 🔥 BUG FIX: Do NOT delete flag here - hideCollectiblesScreenWithAnimation needs it
      // Flag will be deleted by hideCollectiblesScreenWithAnimation after it reads it
      // delete (window as any).__ccJourneyExitMode;

      if (isBackButton) {
        // 🎬 BACK BUTTON pathway: Journey → Homepage Slide 2 (Journey slide)
        // Start the exit animation immediately; keep pre-cleanup synchronous so the
        // first visible response happens on the back tap, not after dynamic imports.
        console.log('🛑 Preparing Journey visual exit immediately...');

        try {
          const journeyScreen = document.getElementById('journey-screen');
          if (journeyScreen) {
            const animatedElements = journeyScreen.querySelectorAll(
              '.journey-board-card, .journey-board-card-wrapper'
            );
            if (animatedElements.length > 0) {
              gsap.killTweensOf(animatedElements);
              console.log(`✅ Killed GSAP animations on ${animatedElements.length} Journey elements`);
            }

            const interimCards = journeyScreen.querySelectorAll('.journey-board-card.interim');
            interimCards.forEach((card) => {
              const cardEl = card as HTMLElement;
              cardEl.style.animation = 'none';
              cardEl.style.animationPlayState = 'paused';
              cardEl.classList.remove('interim-idle-effects-active');
            });
          }
        } catch (error) {
          console.warn('⚠️ Failed to prepare Journey exit synchronously:', error);
        }

	        let v700HubBackExitPlayed = false;
	        try {
	          const journeyBoardsContainer = document.getElementById('journey-boards-container') as HTMLElement | null;
	          const isJourneyV700Hub =
	            (window as any).__ccJourneyV700View === 'hub' ||
	            journeyBoardsContainer?.dataset.journeyV700View === 'hub';
	          if (isJourneyV700Hub) {
	            const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
	            if (journeyBoardsManager && typeof (journeyBoardsManager as any).playJourneyV700HubExit === 'function') {
	              logger.info('🧭 JourneyV700Flow playing combined hub+nav exit before back-to-home handoff');
	              await (journeyBoardsManager as any).playJourneyV700HubExit('back-to-home');
	              v700HubBackExitPlayed = true;
	            }
	          }
	        } catch (error) {
	          logger.warn('⚠️ Failed to play Journey V700 hub exit before back-to-home:', String(error));
	        }

	        if (!v700HubBackExitPlayed) {
	          console.log('🎬 Step 1: Journey exit animation starting immediately...');
	          try {
	            await animateJourneyViewportScreenExit('journey-back-button');
	            console.log('✅ Step 1: Journey exit animation completed');
	          } catch (error) {
	            console.error('❌ Failed to trigger Journey exit animation:', error);
	          }
	        } else {
	          console.log('✅ Step 1: Combined Journey V700 hub+nav exit completed');
	        }

        const homepageEnterHandoff = (window as any).__ccPlayHomepageSliderEnterHandoff;
        if (typeof homepageEnterHandoff === 'function') {
          screen.classList.remove('show');
          screen.classList.add('hidden');
          screen.style.display = 'none';
          screen.style.visibility = 'hidden';
          screen.style.pointerEvents = 'none';
          screen.style.zIndex = '-1';
          screen.setAttribute('hidden', 'true');
          logger.info('✅ Journey screen hidden before fast homepage handoff');

          const finishJourneyBackCleanup = async () => {
            console.log('🛑 Stopping remaining Journey animations after fast homepage handoff...');

            try {
              const { JOURNEY_CARD_IDLE_BOUNCE } = await import('./modules/journey-card-idle-bounce.js');
              if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
                JOURNEY_CARD_IDLE_BOUNCE.stop();
                console.log('✅ Journey card idle bounce stopped');
              }
            } catch (error) {
              console.warn('⚠️ Failed to stop journey card idle bounce:', error);
            }

            try {
              const journeyContainer = document.getElementById('journey-boards-container');
              if (journeyContainer) {
                const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
                if (journeyBoardsManager && typeof journeyBoardsManager.stopInterimCardIdleEffects === 'function') {
                  journeyBoardsManager.stopInterimCardIdleEffects();
                  console.log('✅ Glow pulse and interim bounce stopped');
                }
                journeyBoardsManager.cleanup();
              }
            } catch (error) {
              console.warn('⚠️ Failed to cleanup Journey boards after fast handoff:', error);
            }

            try {
              const journeyScreen = document.getElementById('journey-screen');
              if (journeyScreen) {
                const cards = journeyScreen.querySelectorAll('.journey-board-card, .journey-board-card-wrapper');
                if (cards.length > 0) {
                  const { gsap } = await import('gsap');
                  gsap.killTweensOf(cards);
                  console.log(`✅ Killed GSAP animations on ${cards.length} journey cards`);
                }
              }
            } catch (error) {
              console.warn('⚠️ Failed to kill GSAP animations:', error);
            }

            cleanupCollectiblesAnimations();
          };

          void finishJourneyBackCleanup();

          console.log('🏠 Step 2: Fast showing Journey homepage slide after Journey exit animation');
          markIOSJourneyRouteAudit('homepage-return-enter');
          await homepageEnterHandoff('journey-exit-homepage-fast', {
            targetSlideIndex: JOURNEY_SLIDE_INDEX,
            skipFirstPaintReady: true,
          });
          finishIOSJourneyRouteAudit('complete');
          return;
        }

        console.log('🛑 Stopping remaining Journey animations after exit...');

        // Step 0: Stop Journey card idle bounce animations
        try {
          const { JOURNEY_CARD_IDLE_BOUNCE } = await import('./modules/journey-card-idle-bounce.js');
          if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
            JOURNEY_CARD_IDLE_BOUNCE.stop();
            console.log('✅ Journey card idle bounce stopped');
          }
        } catch (error) {
          console.warn('⚠️ Failed to stop journey card idle bounce:', error);
        }

        // Step 0b: Stop glow pulse and interim bounce animations
        try {
          const journeyContainer = document.getElementById('journey-boards-container');
          if (journeyContainer) {
            const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
            if (journeyBoardsManager && typeof journeyBoardsManager.stopInterimCardIdleEffects === 'function') {
              journeyBoardsManager.stopInterimCardIdleEffects();
              console.log('✅ Glow pulse and interim bounce stopped');
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to stop glow pulse:', error);
        }

        // Step 0c: Kill all GSAP animations on Journey cards to prevent interference
        try {
          const journeyScreen = document.getElementById('journey-screen');
          if (journeyScreen) {
            const cards = journeyScreen.querySelectorAll('.journey-board-card, .journey-board-card-wrapper');
            if (cards.length > 0) {
              const { gsap } = await import('gsap');
              gsap.killTweensOf(cards);
              console.log(`✅ Killed GSAP animations on ${cards.length} journey cards`);
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to kill GSAP animations:', error);
        }
      } else {
        // 🎮 INTERIM CARD pathway: Journey → Game
        // Skip exit animation - already played in continueFromInterimBoard
        console.log('🎮 Interim card pathway: Skipping exit animation (already played)');
      }

      // 🔥 FIX: Clean up journey board elements before hiding screen
      const journeyContainer = document.getElementById('journey-boards-container');
      if (journeyContainer) {
        const { journeyBoardsManager } = await import('./modules/journey-boards-manager.js');
        journeyBoardsManager.cleanup();
      }

      cleanupCollectiblesAnimations();

      screen.classList.remove('show');
      screen.classList.add('hidden');

      // 🔥 CRITICAL FIX: Explicitly disable journey screen to prevent click blocking
      // The .hidden class doesn't have CSS rule for pointer-events, so we must set it inline
      screen.style.display = 'none';
      screen.style.visibility = 'hidden';
      screen.style.pointerEvents = 'none';
      screen.style.zIndex = '-1';
      screen.setAttribute('hidden', 'true');
      logger.info('✅ Journey screen completely hidden and disabled');

      // 🔥 USER REQUEST: Only show homepage if this is back button pathway
      if (!isBackButton) {
        // Interim card pathway - don't show homepage
        console.log('🎮 Interim card pathway: Not showing homepage');
        return; // Exit early
      }

      // 🔥 BACK BUTTON PATHWAY: Journey exit → Homepage slide 2 enter
      console.log('🏠 Step 2: Showing homepage slide 2 after Journey exit animation');

      const homepageEnterHandoff = (window as any).__ccPlayHomepageSliderEnterHandoff;
      if (typeof homepageEnterHandoff === 'function') {
        markIOSJourneyRouteAudit('homepage-return-enter');
        await homepageEnterHandoff('journey-exit-homepage', {
          targetSlideIndex: JOURNEY_SLIDE_INDEX,
          skipFirstPaintReady: true,
        });
        finishIOSJourneyRouteAudit('complete');
        return;
      }

      console.warn('⚠️ Shared homepage enter handoff missing; using legacy Journey homepage return path');

      // 🔥 CRITICAL: Set paper background to 50% opacity IMMEDIATELY when returning to homepage
      // This prevents gray background during transition and ensures correct opacity
      try {
        const { applyPaperBackground } = await import('./modules/ui-manager.js');
        if (typeof applyPaperBackground === 'function') {
          applyPaperBackground();
          console.log('✅ Paper background set to 60% opacity on Journey exit');
        }
      } catch (error) {
        console.warn('⚠️ Failed to set paper background on Journey exit:', error);
      }

      // Step 2a: Show homepage element
      const homeElement = document.getElementById('home');
      if (homeElement) {
        homeElement.removeAttribute('hidden');
        homeElement.style.removeProperty('display');
        homeElement.style.removeProperty('visibility');
        homeElement.style.removeProperty('opacity');
        homeElement.style.removeProperty('z-index');
        homeElement.style.removeProperty('pointer-events');
        // 🔥 CRITICAL FIX: Explicitly set visibility after removing properties
        homeElement.style.display = 'block';
        homeElement.style.visibility = 'visible';
        homeElement.style.opacity = '1';
        homeElement.style.pointerEvents = 'auto';
        logger.info('✅ Homepage element shown and made interactive');
      }

      // Step 2b: Show slider container
      const sliderContainerEl = document.getElementById('slider-container');
      if (sliderContainerEl) {
        sliderContainerEl.style.removeProperty('display');
        sliderContainerEl.style.removeProperty('visibility');
        sliderContainerEl.style.removeProperty('opacity');
        sliderContainerEl.style.removeProperty('z-index');
        sliderContainerEl.style.removeProperty('pointer-events');
        // 🔥 CRITICAL FIX: Explicitly set visibility after removing properties
        // removeProperty only removes inline styles - need explicit values to ensure visibility
        sliderContainerEl.style.display = 'block';
        sliderContainerEl.style.visibility = 'visible';
        sliderContainerEl.style.opacity = '1';
        sliderContainerEl.style.pointerEvents = 'auto';
        logger.info('✅ Slider container shown and made interactive');
      }

      // 🔥 CRITICAL FIX: Also ensure slider wrapper is interactive for drag gestures
      const sliderWrapperEl = document.getElementById('slider-wrapper');
      if (sliderWrapperEl) {
        sliderWrapperEl.style.removeProperty('pointer-events');
        sliderWrapperEl.style.pointerEvents = 'auto';
        logger.info('✅ Slider wrapper made interactive for drag');
      }

      // Step 2c: Ensure ALL slides are visible (slider uses translateX)
      const allSlides = document.querySelectorAll('.slider-slide');
      allSlides.forEach((slide, index) => {
        (slide as HTMLElement).style.display = 'block';
        (slide as HTMLElement).style.visibility = 'visible';
        (slide as HTMLElement).style.opacity = '1';

        // Ensure ALL content within each slide is visible
        const slideContent = slide.querySelector('.slide-content');
        const heroImage = slide.querySelector('.hero-image');
        const slideText = slide.querySelector('.slide-text');
        const slideTagline = slide.querySelector('.slide-tagline');
        const slideButton = slide.querySelector('.slide-button');

        if (slideContent) (slideContent as HTMLElement).style.display = 'flex';
        if (heroImage) (heroImage as HTMLElement).style.display = 'block';

        // 🔥 iPad FIX: Preserve transform positions on iPad after navigation
        const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;

        if (slideText) {
          (slideText as HTMLElement).style.display = 'block';
          (slideText as HTMLElement).style.visibility = 'visible';
          (slideText as HTMLElement).style.opacity = '1';
          const isActiveSlide = slide.classList.contains('active');

          if (isIPad) {
            const currentTransform = (slideText as HTMLElement).style.transform;
            if (!currentTransform || !currentTransform.includes('translateY(64px)')) {
              (slideText as HTMLElement).style.transform = 'translateY(64px)';
              (slideText as HTMLElement).style.webkitTransform = 'translateY(64px)';
            }

            // 🔥 FIX: Za neaktivne slide-ove na iPadu, ukloniti animate-enter-initial
            if (!isActiveSlide) {
              (slideText as HTMLElement).classList.remove('animate-enter-initial');
            }
          }
        }
        if (slideTagline) {
          (slideTagline as HTMLElement).style.display = 'block';
          (slideTagline as HTMLElement).style.visibility = 'visible';
          (slideTagline as HTMLElement).style.opacity = '1';
          if (isIPad) {
            const currentTransform = (slideTagline as HTMLElement).style.transform;
            if (!currentTransform || !currentTransform.includes('translateY(-12px)')) {
              (slideTagline as HTMLElement).style.transform = 'translateY(-12px)';
              (slideTagline as HTMLElement).style.webkitTransform = 'translateY(-12px)';
            }
          }
        }
        if (slideButton) {
          // 🔥 FIX: Za iPad, osigurati da je CTA button vidljiv na neaktivnim slide-ovima
          // Animacija će se pokrenuti samo za aktivni slide
          const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
          const isActiveSlide = slide.classList.contains('active');

          if (isIPad && !isActiveSlide) {
            // Za neaktivne slide-ove na iPadu, ukloniti animate-enter-initial i postaviti display
            (slideButton as HTMLElement).classList.remove('animate-enter-initial');
            (slideButton as HTMLElement).style.display = 'flex';
            (slideButton as HTMLElement).style.visibility = 'visible';
            (slideButton as HTMLElement).style.opacity = '1';
            // 🔥 CRITICAL: Postaviti transform: scale(1) jer animate-enter-initial postavlja scale(0)
            (slideButton as HTMLElement).style.transform = 'translateY(0px) scale(1)';
            (slideButton as HTMLElement).style.webkitTransform = 'translateY(0px) scale(1)';
          }
          // Za aktivni slide, animate-enter-initial će biti uklonjen u startEnterAnimationSequence
        }
      });
      logger.info('✅ All slides and content made visible');

      // Step 2d: Position slider on the Journey slide using the atomic API
      // When exiting Journey screen, ALWAYS return to Journey slide on homepage slider
      const targetSlideIndex = JOURNEY_SLIDE_INDEX;
      console.log(`🔍 Journey exit: returning to Journey slide (index ${targetSlideIndex})`);

      // 🔥 CRITICAL FIX: Reinitialize slider FIRST before using it
      // Slider may have been destroyed in exitToMenu - must reinit for navigation to work
      const sliderManager = (window as any).sliderManager;
      if (sliderManager) {
        try {
          // First, try to reinitialize if needed
          if (typeof sliderManager.init === 'function') {
            console.log('🔧 Reinitializing slider manager for Journey exit...');
            sliderManager.init();
            console.log('✅ Slider manager reinitialized');
          }
          // 🔥 SWIPE FIX: Also call ensureReady() to reset all animation flags and unlock slider
          if (typeof sliderManager.ensureReady === 'function') {
            console.log('🔧 Calling sliderManager.ensureReady() for Journey exit...');
            sliderManager.ensureReady();
            console.log('✅ Slider ensureReady() called - slider should be interactive');
          }
        } catch (initError) {
          console.warn('⚠️ Failed to reinitialize slider:', initError);
        }
      }

      // 🔥 NEW API: Use setSlideInstant() to atomically update ALL states
      // This replaces all manual GSAP positioning + class manipulation
      if (sliderManager && typeof sliderManager.setSlideInstant === 'function') {
        sliderManager.setSlideInstant(targetSlideIndex);
        console.log(`✅ Slider positioned at slide ${targetSlideIndex} using setSlideInstant (atomic)`);
      } else {
        // Fallback: Manual positioning (if slider-manager not available)
        console.warn('⚠️ SliderManager.setSlideInstant not available, using fallback');
        const sliderWrapper = document.getElementById('slider-wrapper') as HTMLElement;
        if (sliderWrapper && sliderContainerEl) {
          const slideWidth = sliderContainerEl.offsetWidth || window.innerWidth;
          const targetOffset = -targetSlideIndex * slideWidth;

          if (typeof gsap !== 'undefined') {
            gsap.set(sliderWrapper, { x: targetOffset, immediateRender: true });
          } else {
            sliderWrapper.style.transform = `translateX(${targetOffset}px)`;
          }
        }

        // Set active classes manually
        allSlides.forEach((slide, index) => {
          if (index === targetSlideIndex) slide.classList.add('active');
          else slide.classList.remove('active');
        });

        const navButtons = document.querySelectorAll('.independent-nav-button');
        navButtons.forEach((button, index) => {
          if (index === targetSlideIndex) button.classList.add('active');
          else button.classList.remove('active');
        });
      }

      // Step 2h: Restore homepage UI state via centralized methods
      // This ensures clean, non-duplicated code with single source of truth
      try {
        const sliderManager = (window as any).sliderManager;
        const uiManager = (window as any).uiManager;

        // 1. 🔥 V140 STYLE: Use ensureReady() - simple slider mechanics reset
        // Animation is handled by animateSliderEnter() which is called in Step 3
        if (sliderManager && typeof sliderManager.ensureReady === 'function') {
          sliderManager.ensureReady();
          logger.info('✅ SliderManager.ensureReady() called - slider ready for interaction');
        } else if (typeof (window as any).unlockSlider === 'function') {
          (window as any).unlockSlider();
          logger.info('✅ Slider unlocked via fallback');
        }

        // 2. Show navigation (includes buttons) via UI Manager
        if (uiManager && typeof uiManager.showNavigation === 'function') {
          uiManager.showNavigation();
          logger.info('✅ Navigation shown via uiManager');
        }

        // 3. Reattach CTA button event listeners (Play, Journey, etc.)
        if (uiManager && typeof uiManager.reattachHomepageButtonListeners === 'function') {
          uiManager.reattachHomepageButtonListeners();
          logger.info('✅ Homepage button listeners reattached');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to restore homepage UI state:', error);
      }

      // Step 2i: Force DOM reflow to ensure .active class is applied
      const activeSlideCheck = document.querySelector('.slider-slide.active');
      if (activeSlideCheck) {
        void (activeSlideCheck as HTMLElement).offsetHeight; // Force reflow
        const slideIndex = Array.from(allSlides).indexOf(activeSlideCheck);
        console.log(`✅ Active slide verified: index ${slideIndex} (should be ${targetSlideIndex})`);
        if (slideIndex !== targetSlideIndex) {
          console.warn(`⚠️ WARNING: Active slide is ${slideIndex}, expected ${targetSlideIndex}! Fixing...`);
          // Fix: Set target slide as active again
          allSlides.forEach((slide, idx) => {
            if (idx === targetSlideIndex) slide.classList.add('active');
            else slide.classList.remove('active');
          });
        }
      }

      // 🔥 CRITICAL FIX: Ensure #app element is DISABLED when returning to homepage
      // Without this, #app remains with pointer-events: auto and z-index: 999, blocking all CTA clicks
      // This is a safety net in case hideApp() wasn't called earlier in the flow
      const appElement = document.getElementById('app');
      if (appElement) {
        appElement.setAttribute('hidden', 'true');
        appElement.style.display = 'none';
        appElement.style.visibility = 'hidden';
        appElement.style.opacity = '0';
        appElement.style.zIndex = '-1';
        appElement.style.pointerEvents = 'none';
        logger.info('✅ App element disabled - prevents blocking clicks on homepage slider');
      }

      // Step 3: Trigger homepage slide ENTER animation
      // 🔥 BUG FIX: Trigger enter animation for the ACTUAL target slide, not hardcoded slide 1
      // Use requestAnimationFrame to ensure DOM is fully updated before animation
      await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          // Final verification before animation
          const finalActiveSlide = document.querySelector('.slider-slide.active');
          const finalSlideIndex = finalActiveSlide ? Array.from(allSlides).indexOf(finalActiveSlide) : -1;
          if (finalSlideIndex === targetSlideIndex) {
            console.log(`🎬 Step 3: Triggering slide ${targetSlideIndex} enter animation...`);
            const { animateSliderEnter } = await import('./utils/animations.js');
            animateSliderEnter();
            logger.info(`✅ Homepage slide ${targetSlideIndex} enter animation triggered - Final destination: Slide ${targetSlideIndex}`);
          } else {
            console.error(`❌ CRITICAL: Active slide is ${finalSlideIndex}, not ${targetSlideIndex}! Cannot animate slide ${targetSlideIndex}.`);
          }
          resolve(undefined);
        });
      }));
    }
  }

}

let collectiblesManagerInstance: CollectiblesManager | null = null;

export async function ensureCollectiblesManager(): Promise<CollectiblesManager> {
  if (!collectiblesManagerInstance) {
    logger.info('🎁 Creating Collectibles Manager instance');
    collectiblesManagerInstance = new CollectiblesManager();
    window.collectiblesManager = collectiblesManagerInstance;
  }
  return collectiblesManagerInstance;
}

export async function showCollectiblesScreen(options?: CollectiblesShowOptions): Promise<void> {
  const manager = await ensureCollectiblesManager();
  await manager.showCollectibles(options);
}

export async function hideCollectiblesScreen(): Promise<void> {
  const manager = await ensureCollectiblesManager();
  await manager.hideCollectibles();
}

export default CollectiblesManager;
