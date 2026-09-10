// @ts-nocheck

import {
  isJourneyDetailModalPresentationReady,
  isJourneyScreenPresentationReady,
  prepareJourneyWorldRecovery,
  waitForJourneyReturnPresentation,
} from './journey-return-presentation.js';
import { isNoMovesNavigationLocked } from './terminal-navigation-lock.ts';
import { emitSettingsRouteDiagnostic } from './settings-route-diagnostic.js';
import {
  ARCADE_SLIDE_INDEX,
  JOURNEY_SLIDE_INDEX,
  type PrimaryHomepageSlideIndex,
} from './homepage-slide-order.js';

type MenuExitTarget = 'homepage' | 'auto';
type ExpectedMenuDestination = {
  target: 'home' | 'journey' | 'detail-modal';
  boardId: number | null;
};

type MenuExitOptions = {
  reason: string;
  target?: MenuExitTarget;
  homepageSlideIndex?: PrimaryHomepageSlideIndex;
  onHomepageEnterPrepared?: () => void;
  timeoutMs?: number;
  skipBoardExit?: boolean;
  fastArcadeCleanExit?: boolean;
  visualExitAlreadyComplete?: boolean;
  allowTerminalNoMovesExit?: boolean;
};

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
let activeExpectedDestination: ExpectedMenuDestination | null = null;

function isVisible(el: HTMLElement | null): boolean {
  if (!el || el.hidden) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0.01;
}

export function isAnyMenuScreenVisible(): boolean {
  return isHomepageMenuReady(JOURNEY_SLIDE_INDEX)
    || isHomepageMenuReady(ARCADE_SLIDE_INDEX)
    || isJourneyScreenPresentationReady()
    || isJourneyDetailModalPresentationReady();
}

function isHomepageMenuReady(targetSlideIndex: PrimaryHomepageSlideIndex = ARCADE_SLIDE_INDEX): boolean {
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
    && (hasArea(hero) || hasArea(cta))
    && !isVisible(document.getElementById('journey-screen') as HTMLElement | null)
    && !isVisible(document.getElementById('collectibles-detail-modal') as HTMLElement | null);
}

function isAnyHomepageSlideReady(): boolean {
  const activeSlide = document.querySelector('.slider-slide.active') as HTMLElement | null;
  const activeSlideIndex = Number(activeSlide?.dataset.slide);
  return Number.isInteger(activeSlideIndex) && isHomepageMenuReady(activeSlideIndex);
}

function isMenuZone(zone: string): boolean {
  return zone === 'home' || zone === 'journey' || zone === 'settings';
}

function readRecoveryBoardId(): number | null {
  const value = Number(
    (window as any).__ccDetailModalBoardId
    || (window as any).__ccJourneyReturnBoardId
    || (window as any).__ccLastActiveJourneyBoardAreaId
    || (window as any).__ccStartAtLevel
    || 0
  );
  return Number.isInteger(value) && value >= 1 && value <= 30 ? value : null;
}

async function resolveExpectedDestination(options: MenuExitOptions): Promise<ExpectedMenuDestination> {
  if (options.target === 'homepage') return { target: 'home', boardId: null };
  try {
    const { appZoneManager } = await import('./app-zone-manager.js');
    return {
      target: appZoneManager.resolveMenuReturnTarget(),
      boardId: readRecoveryBoardId(),
    };
  } catch {
    return {
      target: (window as any).__ccRunMode === 'arcade_home' ? 'home' : 'journey',
      boardId: readRecoveryBoardId(),
    };
  }
}

function isExpectedDestinationReady(
  expected: ExpectedMenuDestination,
  homepageSlideIndex: PrimaryHomepageSlideIndex = ARCADE_SLIDE_INDEX,
): boolean {
  if (expected.target === 'home') return isHomepageMenuReady(homepageSlideIndex);
  if ((window as any).__ccAppZone !== 'journey') return false;
  return expected.target === 'detail-modal'
    ? isJourneyDetailModalPresentationReady() || isJourneyScreenPresentationReady()
    : isJourneyScreenPresentationReady();
}

async function forceHomepageVisible(
  reason: string,
  targetSlideIndex: PrimaryHomepageSlideIndex = ARCADE_SLIDE_INDEX,
  onHomepageEnterPrepared?: () => void,
): Promise<void> {
  emitSettingsRouteDiagnostic('force-homepage-start', {
    reason,
    targetSlideIndex,
  });
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
    emitSettingsRouteDiagnostic('force-homepage-complete', {
      reason,
      targetSlideIndex,
    });
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

async function forceAutoMenuVisible(
  reason: string,
  expected: ExpectedMenuDestination,
): Promise<void> {
  if (expected.target === 'home') {
    await forceHomepageVisible(reason);
    return;
  }

  try {
    // A failed direct-detail return degrades only to its Journey World. The
    // immutable destination captured before exit prevents consumed origin
    // flags from ever redirecting a Journey run to Homepage.
    prepareJourneyWorldRecovery({
      boardId: expected.boardId,
      reason: `menu-exit-handoff:${reason}`,
    });
    const { appZoneManager } = await import('./app-zone-manager.js');
    await appZoneManager.showJourneyShell(`menu-exit-handoff:${reason}`);
    const { ensureCollectiblesManager, showCollectiblesScreen } = await import('../collectibles-manager.js');
    await ensureCollectiblesManager?.();
    await showCollectiblesScreen?.();
    const journeyReady = await waitForJourneyReturnPresentation('screen');
    if (!journeyReady) {
      throw new Error('Journey recovery did not present a visible Hub or World Unit');
    }
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
    console.warn('⚠️ menu-exit-handoff: Journey recovery failed; preserving Journey ownership', {
      reason,
      expected,
      error,
    });
  }
}

export async function ensureMenuVisibleAfterExit(
  options: MenuExitOptions,
  expectedDestination?: ExpectedMenuDestination,
): Promise<void> {
  const expected = expectedDestination ?? await resolveExpectedDestination(options);
  const targetSlideIndex = options.homepageSlideIndex ?? ARCADE_SLIDE_INDEX;
  const readyBeforeWait = isExpectedDestinationReady(expected, targetSlideIndex);
  if (readyBeforeWait) {
    emitSettingsRouteDiagnostic('post-exit-ready-immediate', {
      reason: options.reason,
      expectedTarget: expected.target,
      targetSlideIndex,
    });
    return;
  }

  const { appZoneManager } = await import('./app-zone-manager.js');
  const recoveryEpoch = appZoneManager.getPresentationEpoch();
  const recoveryZone = appZoneManager.getCurrentZone();
  const expectedZone = expected.target === 'home' ? 'home' : 'journey';

  // A completed exit may be followed immediately by a legitimate menu route.
  // That successor owns presentation even when it no longer matches the exit's
  // original destination, so the old recovery must not reclaim Homepage.
  if (
    (isMenuZone(recoveryZone) && recoveryZone !== expectedZone)
    || (expected.target === 'home' && recoveryZone === 'home' && isAnyHomepageSlideReady())
  ) {
    emitSettingsRouteDiagnostic('post-exit-check-retired-before-wait', {
      reason: options.reason,
      expectedTarget: expected.target,
      targetSlideIndex,
      recoveryEpoch,
      recoveryZone,
    });
    return;
  }

  emitSettingsRouteDiagnostic('post-exit-check-armed', {
    reason: options.reason,
    expectedTarget: expected.target,
    targetSlideIndex,
    readyBeforeWait,
    recoveryEpoch,
    recoveryZone,
  });
  await wait(320);

  if (!appZoneManager.isPresentationCurrent(recoveryEpoch, recoveryZone)) {
    emitSettingsRouteDiagnostic('post-exit-check-retired-after-wait', {
      reason: options.reason,
      expectedTarget: expected.target,
      targetSlideIndex,
      recoveryEpoch,
      recoveryZone,
      currentEpoch: appZoneManager.getPresentationEpoch(),
      currentZone: appZoneManager.getCurrentZone(),
    });
    return;
  }

  const readyAfterWait = isExpectedDestinationReady(expected, targetSlideIndex);
  const newerHomepageSlideReady = expected.target === 'home'
    && recoveryZone === 'home'
    && isAnyHomepageSlideReady();
  emitSettingsRouteDiagnostic('post-exit-check-fired', {
    reason: options.reason,
    expectedTarget: expected.target,
    targetSlideIndex,
    readyBeforeWait,
    readyAfterWait,
    newerHomepageSlideReady,
    recoveryEpoch,
    recoveryZone,
  });
  if (newerHomepageSlideReady) return;
  if (expected.target === 'home') {
    if (readyAfterWait) return;
    console.warn('⚠️ menu-exit-handoff: homepage shell incomplete after exit, applying fallback', options);
    emitSettingsRouteDiagnostic('homepage-fallback-start', {
      reason: options.reason,
      expectedTarget: expected.target,
      targetSlideIndex,
    });
    (window as any).exitingToMenu = false;
    await forceHomepageVisible(options.reason, targetSlideIndex, options.onHomepageEnterPrepared);
    return;
  }
  if (isExpectedDestinationReady(expected)) return;
  console.warn('⚠️ menu-exit-handoff: expected Journey destination incomplete after exit, applying fallback', {
    ...options,
    expected,
  });
  (window as any).exitingToMenu = false;
  await forceAutoMenuVisible(options.reason, expected);
}

export async function requestExitToMenu(options: MenuExitOptions): Promise<void> {
  if (!options.allowTerminalNoMovesExit && isNoMovesNavigationLocked()) {
    console.warn('🔒 menu-exit-handoff blocked while NO MOVES owns navigation', {
      reason: options.reason,
    });
    return;
  }
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? (options.skipBoardExit ? 2500 : 4500);
  const requestedDestination = await resolveExpectedDestination(options);
  let expectedDestination = requestedDestination;
  emitSettingsRouteDiagnostic('request-exit-start', {
    reason: options.reason,
    requestedTarget: options.target ?? 'auto',
    expectedTarget: requestedDestination.target,
    targetSlideIndex: options.homepageSlideIndex ?? ARCADE_SLIDE_INDEX,
  });

  if ((window as any).exitingToMenu === true) {
    expectedDestination = activeExpectedDestination ?? requestedDestination;
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
    activeExpectedDestination = requestedDestination;
    let watchdog: number | undefined;
    try {
      const exitPromise = Promise.resolve((window as any).exitToMenu({
        target: options.target,
        homepageSlideIndex: options.homepageSlideIndex,
        onHomepageEnterPrepared: options.onHomepageEnterPrepared,
        skipBoardExit: options.skipBoardExit,
        fastArcadeCleanExit: options.fastArcadeCleanExit,
        visualExitAlreadyComplete: options.visualExitAlreadyComplete,
        expectedMenuDestination: expectedDestination.target,
        allowTerminalNoMovesExit: options.allowTerminalNoMovesExit,
      }));
      watchdog = window.setTimeout(() => {
        console.warn('⚠️ menu-exit-handoff: exit exceeded watchdog; waiting for the authoritative owner', {
          reason: options.reason,
          timeoutMs,
        });
      }, timeoutMs);
      await exitPromise;
      emitSettingsRouteDiagnostic('authoritative-exit-resolved', {
        reason: options.reason,
        expectedTarget: expectedDestination.target,
        targetSlideIndex: options.homepageSlideIndex ?? ARCADE_SLIDE_INDEX,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.warn('⚠️ menu-exit-handoff: exitToMenu failed', { reason: options.reason, error });
    } finally {
      if (watchdog !== undefined) window.clearTimeout(watchdog);
    }
  } else {
    console.warn('⚠️ menu-exit-handoff: window.exitToMenu not found', options);
  }

  try {
    await ensureMenuVisibleAfterExit(options, expectedDestination);
  } finally {
    if (activeExpectedDestination === expectedDestination) activeExpectedDestination = null;
  }
}
