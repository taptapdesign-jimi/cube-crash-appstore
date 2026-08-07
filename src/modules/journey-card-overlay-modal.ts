import { boardStatsService } from '../services/board-stats-service.js';
import { registerCta, type CtaController } from './cta-system.js';
import {
  GAMEPLAY_MODAL_BENCHMARK,
  runGameplayModalParallelExit,
} from './gameplay-modal-benchmark.js';
import {
  createDetailModalStatsEnterDelays,
  getDetailModalStatsEnterTotalDuration,
} from './detail-modal-stats-enter-motion.js';
import {
  mountGameplaySheetClose,
  type GameplaySheetCloseController,
} from './gameplay-sheet-close.js';
import {
  captureJourneyCardGeometry,
  computeJourneyCardArcOffset,
  startJourneyCardSpatialFlight,
  type JourneyCardGeometry,
  type JourneyCardOriginLease,
  type JourneyCardSpatialFlightController,
} from './journey-card-portal-transition.js';

export type JourneyCardOverlayModalResult = 'dismiss' | 'play';

export interface JourneyCardOverlayModalController {
  readonly element: HTMLElement;
  readonly result: Promise<JourneyCardOverlayModalResult>;
  readonly didLandAtOrigin: boolean;
  close(): void;
  dispose(): void;
}

interface JourneyCardOverlayModalOptions {
  boardId: number;
  imagePath: string;
  origin: JourneyCardOriginLease;
  hasSavedState: boolean;
  scrollOwner?: HTMLElement | null;
  entryInitialOpacity?: number;
  onCardEntrySettled?: () => void;
  onPlayCardReturnStart?: () => void;
  onPlayCardExitStart?: () => void;
  onPlayCardExitComplete?: () => void;
}

let activeJourneyCardOverlayModal: JourneyCardOverlayModalController | null = null;
export const JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS = 580;
export const JOURNEY_CARD_MODAL_ENTER_START_PROGRESS = 0.55;
export const JOURNEY_CARD_INITIAL_IMPACT_PROGRESS = 0.55;
export const JOURNEY_CARD_OVERLAY_EXIT_DURATION_MS = 950;
export const JOURNEY_CARD_MODAL_EXIT_DURATION_MS = 320;
export const JOURNEY_CARD_STATS_EXIT_DURATION_MS = 240;
export const JOURNEY_CARD_STATS_EXIT_STAGGER_MS = 30;
export const JOURNEY_CARD_REAR_EXIT_START_PROGRESS = 0.4;
export const JOURNEY_CARD_DEPTH_SWAP_SEPARATE_MS = 110;
export const JOURNEY_CARD_DEPTH_SWAP_SETTLE_MS = 280;
export const JOURNEY_CARD_DRAG_COMMIT_DISTANCE_PX = 100;
export const JOURNEY_CARD_FLICK_VELOCITY_PX_PER_MS = 0.35;
export const JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_X = 0.216;
export const JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_Y = 0.252;
export const JOURNEY_CARD_SPATIAL_FLIGHT_DURATION_MS = 580;
export const JOURNEY_CARD_SPATIAL_RETURN_DURATION_MS = 620;
export const JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS = 100;
export const JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS = 500;
export const JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS = 120;
export const JOURNEY_CARD_PLAY_LANDING_EXIT_DURATION_MS = 400;
export const JOURNEY_CARD_PLAY_RETURN_DURATION_MS = 1120;
export const JOURNEY_CARD_SWIPE_COACH_IDLE_MS = 5000;
export const JOURNEY_CARD_SWIPE_COACH_DURATION_MS = 1900;
const JOURNEY_CARD_DRAG_TAP_SLOP_PX = 6;
const JOURNEY_CARD_DRAG_SNAPBACK_MS = 320;

export interface JourneyCardOverlayExitTiming {
  foregroundDurationMs: number;
  rearStartDelayMs: number;
  rearDurationMs: number;
  backdropExitDurationMs: number;
}

/**
 * Derives the staged exit from the surface that is actually in front. The
 * Stage paper has a deliberately fast close, while the card always uses the
 * exact reverse-FLIP duration needed to land back on its Unit.
 */
export function getJourneyCardOverlayExitTiming(
  value: JourneyCardOverlayModalResult,
  foregroundIsCard: boolean,
): JourneyCardOverlayExitTiming {
  const cardDurationMs = value === 'play'
    ? JOURNEY_CARD_PLAY_RETURN_DURATION_MS
    : JOURNEY_CARD_SPATIAL_RETURN_DURATION_MS;
  const foregroundDurationMs = foregroundIsCard
    ? cardDurationMs
    : JOURNEY_CARD_MODAL_EXIT_DURATION_MS;
  const rearDurationMs = foregroundIsCard
    ? JOURNEY_CARD_MODAL_EXIT_DURATION_MS
    : cardDurationMs;
  const rearStartDelayMs = Math.round(
    foregroundDurationMs * JOURNEY_CARD_REAR_EXIT_START_PROGRESS,
  );
  const totalDurationMs = Math.max(
    foregroundDurationMs,
    rearStartDelayMs + rearDurationMs,
  );

  return {
    foregroundDurationMs,
    rearStartDelayMs,
    rearDurationMs,
    backdropExitDurationMs: Math.max(1, totalDurationMs - rearStartDelayMs),
  };
}

export interface JourneyCardOverlayModalViewModel {
  stageLabel: string;
  highScore: string;
  longestCombo: string;
  ctaLabel: 'Play' | 'Continue';
  ctaAriaLabel: 'Play Stage' | 'Continue Stage';
}

export interface JourneyCardOverlayTiltProfile {
  cardRotationDeg: number;
  modalRotationDeg: number;
}

export interface JourneyCardSwipeCoachCopy {
  ariaLabel: 'Swipe to view your card' | 'Swipe to view stats';
  lines: readonly string[];
}

export function getJourneyCardSwipeCoachCopy(cardFront: boolean): JourneyCardSwipeCoachCopy {
  return cardFront
    ? { ariaLabel: 'Swipe to view stats', lines: ['SWIPE TO VIEW', 'STATS'] }
    : { ariaLabel: 'Swipe to view your card', lines: ['SWIPE TO VIEW', 'YOUR CARD'] };
}

function renderJourneyCardSwipeCoachCopy(copy: JourneyCardSwipeCoachCopy): string {
  let letterIndex = 0;
  return copy.lines.map((line) => `
        <span class="journey-card-overlay-swipe-line">
          ${Array.from(line).map((letter) => {
            const currentIndex = letterIndex;
            letterIndex += 1;
            return letter === ' '
              ? `<span class="journey-card-overlay-swipe-letter is-space" style="--journey-card-swipe-letter:${currentIndex}">&nbsp;</span>`
              : `<span class="journey-card-overlay-swipe-letter ${currentIndex < 5 ? 'is-accent' : 'is-secondary'}" style="--journey-card-swipe-letter:${currentIndex}">${letter}</span>`;
          }).join('')}
        </span>`).join('');
}

export function createJourneyCardOverlayTiltProfile(
  random: () => number = Math.random,
): JourneyCardOverlayTiltProfile {
  const sample = (): number => {
    const value = random();
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
  };
  const cardDirection = sample() < 0.5 ? -1 : 1;
  const cardMagnitude = 4.75 + sample() * 1.5;
  const modalMagnitude = 2 + sample() * 1.25;
  return {
    cardRotationDeg: Number((cardDirection * cardMagnitude).toFixed(2)),
    modalRotationDeg: Number((cardDirection * -modalMagnitude).toFixed(2)),
  };
}

export function shouldCommitJourneyCardDepthDrag(
  deltaX: number,
  deltaY: number,
  velocityX: number,
  velocityY: number,
): boolean {
  return Math.hypot(deltaX, deltaY) >= JOURNEY_CARD_DRAG_COMMIT_DISTANCE_PX
    || Math.hypot(velocityX, velocityY) >= JOURNEY_CARD_FLICK_VELOCITY_PX_PER_MS;
}

export function buildJourneyCardOverlayModalViewModel(
  boardId: number,
  stats: { highScore: number; longestCombo: number },
  hasSavedState: boolean,
): JourneyCardOverlayModalViewModel {
  const safeBoardId = Math.max(1, Math.trunc(Number.isFinite(boardId) ? boardId : 1));
  const highScore = Math.max(0, Math.trunc(Number.isFinite(stats.highScore) ? stats.highScore : 0));
  const longestCombo = Math.max(0, Math.trunc(Number.isFinite(stats.longestCombo) ? stats.longestCombo : 0));
  return {
    stageLabel: `Stage ${String(safeBoardId).padStart(2, '0')}`,
    highScore: highScore.toLocaleString(),
    longestCombo: longestCombo.toLocaleString(),
    ctaLabel: hasSavedState ? 'Continue' : 'Play',
    ctaAriaLabel: hasSavedState ? 'Continue Stage' : 'Play Stage',
  };
}

export function presentJourneyCardOverlayModal(
  options: JourneyCardOverlayModalOptions,
): JourneyCardOverlayModalController {
  activeJourneyCardOverlayModal?.dispose();

  const viewModel = buildJourneyCardOverlayModalViewModel(
    options.boardId,
    boardStatsService.getBoardStats(options.boardId),
    options.hasSavedState,
  );
  const initialSwipeCoachCopy = getJourneyCardSwipeCoachCopy(false);

  const stage = document.createElement('div');
  const tiltProfile = createJourneyCardOverlayTiltProfile();
  stage.id = 'journey-card-overlay-modal';
  stage.className = 'journey-card-overlay-modal cc-gameplay-modal-stage';
  stage.setAttribute('role', 'dialog');
  stage.setAttribute('aria-modal', 'true');
  stage.setAttribute('aria-labelledby', 'journey-card-overlay-title');
  stage.setAttribute('data-board-id', String(options.boardId));
  stage.style.setProperty('--journey-card-pair-card-rotate', `${tiltProfile.cardRotationDeg}deg`);
  stage.style.setProperty('--journey-card-pair-modal-rotate', `${tiltProfile.modalRotationDeg}deg`);
  stage.innerHTML = `
    <div class="journey-card-overlay-preview-bounce-shell">
      <div class="journey-card-overlay-spatial-shell">
        <div class="journey-card-overlay-preview-flip-shell">
          <button
            type="button"
            class="journey-card-overlay-preview"
            aria-label="Show ${viewModel.stageLabel} card"
            aria-pressed="false"
          >
            <span class="journey-card-overlay-card-host" aria-hidden="true"></span>
            <span class="journey-card-overlay-shimmer" aria-hidden="true"></span>
            <span class="journey-card-overlay-card-burn" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </div>
    <div class="journey-card-overlay-depth-shell">
      <div class="cc-gameplay-modal-bounce-shell journey-card-overlay-modal-shell">
        <div class="cc-gameplay-modal-flip-shell">
          <div class="cc-gameplay-modal-idle-shell">
            <div class="cc-gameplay-modal-paper-shell journey-card-overlay-paper">
            <div class="journey-card-overlay-title-section">
              <h2 id="journey-card-overlay-title" class="cc-gameplay-modal-title">${viewModel.stageLabel}</h2>
            </div>
            <div class="journey-card-overlay-stats">
              <div class="journey-card-overlay-stat">
                <div class="journey-card-overlay-stat-icon">
                  <img src="./assets/highscore-icon.png" alt="" aria-hidden="true" draggable="false">
                </div>
                <div class="journey-card-overlay-stat-content">
                  <div class="journey-card-overlay-stat-value">${viewModel.highScore}</div>
                  <div class="journey-card-overlay-stat-label">High score</div>
                </div>
              </div>
              <div class="journey-card-overlay-stat-divider" aria-hidden="true"></div>
              <div class="journey-card-overlay-stat">
                <div class="journey-card-overlay-stat-icon">
                  <img src="./assets/combo-icon.png" alt="" aria-hidden="true" draggable="false">
                </div>
                <div class="journey-card-overlay-stat-content">
                  <div class="journey-card-overlay-stat-value">${viewModel.longestCombo}</div>
                  <div class="journey-card-overlay-stat-label">Longest combo</div>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="journey-card-overlay-cta cc-cta--standard-width"
              aria-label="${viewModel.ctaAriaLabel}"
            >${viewModel.ctaLabel}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="journey-card-overlay-swipe-coach" aria-hidden="true">
      <div
        class="journey-card-overlay-swipe-copy"
        aria-label="${initialSwipeCoachCopy.ariaLabel}"
        data-swipe-coach-surface="stats"
      >
        ${renderJourneyCardSwipeCoachCopy(initialSwipeCoachCopy)}
      </div>
      <img
        class="journey-card-overlay-swipe-hand"
        src="./assets/hand-pointer.png"
        alt=""
        draggable="false"
      >
    </div>
  `;

  const preview = stage.querySelector<HTMLButtonElement>('.journey-card-overlay-preview');
  const spatialShell = stage.querySelector<HTMLElement>('.journey-card-overlay-spatial-shell');
  const previewFlipShell = stage.querySelector<HTMLElement>('.journey-card-overlay-preview-flip-shell');
  const cardHost = preview?.querySelector<HTMLElement>('.journey-card-overlay-card-host');
  const previewShimmer = preview?.querySelector<HTMLElement>('.journey-card-overlay-shimmer');
  const previewBurn = preview?.querySelector<HTMLElement>('.journey-card-overlay-card-burn');
  const depthShell = stage.querySelector<HTMLElement>('.journey-card-overlay-depth-shell');
  const modalShell = stage.querySelector<HTMLElement>('.journey-card-overlay-modal-shell');
  const idleShell = stage.querySelector<HTMLElement>('.cc-gameplay-modal-idle-shell');
  const paper = stage.querySelector<HTMLElement>('.journey-card-overlay-paper');
  const statElements = Array.from(stage.querySelectorAll<HTMLElement>(
    '.journey-card-overlay-stats > .journey-card-overlay-stat, ' +
    '.journey-card-overlay-stats > .journey-card-overlay-stat-divider',
  ));
  const cta = stage.querySelector<HTMLButtonElement>('.journey-card-overlay-cta');
  const swipeCoach = stage.querySelector<HTMLElement>('.journey-card-overlay-swipe-coach');
  const swipeCopy = stage.querySelector<HTMLElement>('.journey-card-overlay-swipe-copy');
  const swipeHand = stage.querySelector<HTMLImageElement>('.journey-card-overlay-swipe-hand');
  if (!preview || !spatialShell || !previewFlipShell || !cardHost || !previewShimmer || !previewBurn || !depthShell || !modalShell || !idleShell || !paper || statElements.length !== 3 || !cta || !swipeCoach || !swipeCopy || !swipeHand) {
    stage.remove();
    throw new Error('Journey card overlay modal failed to create its required owners');
  }
  stage.style.setProperty('--journey-card-origin-aspect', String(options.origin.aspectRatio));
  cardHost.style.setProperty('--journey-card-origin-aspect', String(options.origin.aspectRatio));
  options.origin.mountInto(cardHost);
  preview.setAttribute('data-board-id', `${options.boardId}-card`);
  paper.setAttribute('data-board-id', `${options.boardId}-modal`);
  const escapedMaskPath = options.imagePath.replace(/["\\]/g, '\\$&');
  previewShimmer.style.setProperty('-webkit-mask-image', `url("${escapedMaskPath}")`);
  previewShimmer.style.setProperty('mask-image', `url("${escapedMaskPath}")`);
  previewBurn.style.setProperty('-webkit-mask-image', `url("${escapedMaskPath}")`);
  previewBurn.style.setProperty('mask-image', `url("${escapedMaskPath}")`);

  const scrollOwner = options.scrollOwner ?? null;
  const previousOverflow = scrollOwner?.style.overflow ?? '';
  const previousTouchAction = scrollOwner?.style.touchAction ?? '';
  if (scrollOwner) {
    scrollOwner.style.overflow = 'hidden';
    scrollOwner.style.touchAction = 'none';
  }

  let resolveResult!: (result: JourneyCardOverlayModalResult) => void;
  const result = new Promise<JourneyCardOverlayModalResult>((resolve) => {
    resolveResult = resolve;
  });
  let settled = false;
  let closing = false;
  let closeQueuedForCardLanding = false;
  let didLandAtOrigin = false;
  let cardFront = false;
  let enterRafOne = 0;
  let enterRafTwo = 0;
  let cardToModalTimer = 0;
  let cardImpactTimer = 0;
  let cardEnterCleanupTimer = 0;
  let enterCleanupTimer = 0;
  let statsEnterCleanupTimer = 0;
  let depthSwapCommitTimer = 0;
  let depthSwapCleanupTimer = 0;
  let dragSnapbackTimer = 0;
  let dragRaf = 0;
  let swipeCoachIdleTimer = 0;
  let swipeCoachRaf = 0;
  let swipeCoachRunning = false;
  let impactAnimation: Animation | null = null;
  let cardImpactCleanupTimer = 0;
  const exitDelayResolvers = new Map<number, () => void>();
  let spatialFlight: JourneyCardSpatialFlightController | null = null;
  let closeController: GameplaySheetCloseController | null = null;
  let ctaController: CtaController | null = null;
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const journeyScreen = document.getElementById('journey-screen');
  const journeyWasInert = journeyScreen?.inert ?? false;
  let controller!: JourneyCardOverlayModalController;
  let activePointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragCurrentX = 0;
  let dragCurrentY = 0;
  let dragLastX = 0;
  let dragLastY = 0;
  let dragLastTime = 0;
  let dragVelocityX = 0;
  let dragVelocityY = 0;
  let dragMoved = false;
  let dragStartedOnRear = false;
  let suppressClickUntil = 0;
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const enterDelay = (durationMs: number): number => prefersReducedMotion ? 0 : durationMs;

  if (journeyScreen) journeyScreen.inert = true;

  const restoreScrollOwner = () => {
    if (!scrollOwner) return;
    scrollOwner.style.overflow = previousOverflow;
    scrollOwner.style.touchAction = previousTouchAction;
  };

  const clearScheduledWork = () => {
    if (enterRafOne) cancelAnimationFrame(enterRafOne);
    if (enterRafTwo) cancelAnimationFrame(enterRafTwo);
    if (cardToModalTimer) window.clearTimeout(cardToModalTimer);
    if (cardImpactTimer) window.clearTimeout(cardImpactTimer);
    if (cardEnterCleanupTimer) window.clearTimeout(cardEnterCleanupTimer);
    if (enterCleanupTimer) window.clearTimeout(enterCleanupTimer);
    if (statsEnterCleanupTimer) window.clearTimeout(statsEnterCleanupTimer);
    if (depthSwapCommitTimer) window.clearTimeout(depthSwapCommitTimer);
    if (depthSwapCleanupTimer) window.clearTimeout(depthSwapCleanupTimer);
    if (dragSnapbackTimer) window.clearTimeout(dragSnapbackTimer);
    if (dragRaf) cancelAnimationFrame(dragRaf);
    if (swipeCoachIdleTimer) window.clearTimeout(swipeCoachIdleTimer);
    if (swipeCoachRaf) cancelAnimationFrame(swipeCoachRaf);
    if (cardImpactCleanupTimer) window.clearTimeout(cardImpactCleanupTimer);
    impactAnimation?.cancel();
    impactAnimation = null;
    spatialFlight?.cancel();
    spatialFlight = null;
    exitDelayResolvers.forEach((resolve, timer) => {
      window.clearTimeout(timer);
      resolve();
    });
    exitDelayResolvers.clear();
    enterRafOne = 0;
    enterRafTwo = 0;
    cardToModalTimer = 0;
    cardImpactTimer = 0;
    cardEnterCleanupTimer = 0;
    enterCleanupTimer = 0;
    statsEnterCleanupTimer = 0;
    depthSwapCommitTimer = 0;
    depthSwapCleanupTimer = 0;
    dragSnapbackTimer = 0;
    dragRaf = 0;
    swipeCoachIdleTimer = 0;
    swipeCoachRaf = 0;
    stage.classList.remove('is-swipe-coach-active');
    cardImpactCleanupTimer = 0;
  };

  const cleanup = (resultValue: JourneyCardOverlayModalResult) => {
    clearScheduledWork();
    preview.removeEventListener('click', handleCardTapDepthSwap);
    preview.removeEventListener('pointerdown', handleDragPointerDown, true);
    depthShell.removeEventListener('pointerdown', handleDragPointerDown, true);
    paper.removeEventListener('pointerdown', handleDragPointerDown, true);
    stage.removeEventListener('pointerdown', handleDragPointerDown, true);
    stage.removeEventListener('pointermove', handleDragPointerMove, true);
    stage.removeEventListener('pointerup', handleDragPointerUp, true);
    stage.removeEventListener('pointercancel', handleDragPointerCancel, true);
    stage.removeEventListener('click', handleSuppressedDragClick, true);
    stage.removeEventListener('click', handleBackdropClick);
    stage.removeEventListener('pointerdown', handleSwipeCoachInteraction, true);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('cc-navigation', handleRouteChange);
    window.removeEventListener('pagehide', handleRouteChange);
    closeController?.dispose();
    closeController = null;
    ctaController?.dispose();
    ctaController = null;
    restoreScrollOwner();
    if (resultValue === 'play' && !didLandAtOrigin) options.origin.discard();
    else options.origin.restoreNow();
    stage.remove();
    if (journeyScreen) journeyScreen.inert = journeyWasInert;
    if (previouslyFocused?.isConnected) {
      try { previouslyFocused.focus({ preventScroll: true }); } catch {}
    }
    if (activeJourneyCardOverlayModal === controller) activeJourneyCardOverlayModal = null;
  };

  const playLightScreenImpact = (strength: number) => {
    if (prefersReducedMotion || closing || settled || typeof stage.animate !== 'function') return;
    impactAnimation?.cancel();
    const animation = stage.animate([
      { transform: 'translate3d(0, 0, 0)' },
      { transform: `translate3d(${strength}px, ${-strength * 0.35}px, 0)`, offset: 0.18 },
      { transform: `translate3d(${-strength * 0.72}px, ${strength * 0.28}px, 0)`, offset: 0.38 },
      { transform: `translate3d(${strength * 0.42}px, ${-strength * 0.16}px, 0)`, offset: 0.58 },
      { transform: `translate3d(${-strength * 0.18}px, ${strength * 0.08}px, 0)`, offset: 0.78 },
      { transform: 'translate3d(0, 0, 0)' },
    ], {
      duration: 260,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    impactAnimation = animation;
    animation.onfinish = () => {
      if (impactAnimation === animation) impactAnimation = null;
    };
    animation.oncancel = () => {
      if (impactAnimation === animation) impactAnimation = null;
    };
  };

  const playCardSettleImpact = () => {
    if (closing || settled) return;
    stage.classList.add('is-card-revealed', 'is-card-impact');
    playLightScreenImpact(4);
    try { (window as any).triggerHapticImpact?.('medium'); } catch {}
    cardImpactCleanupTimer = window.setTimeout(() => {
      cardImpactCleanupTimer = 0;
      stage.classList.remove('is-card-impact');
    }, 560);
  };

  const playModalSettleImpact = () => {
    if (closing || settled) return;
    playLightScreenImpact(3);
    try { (window as any).triggerHapticImpact?.('light'); } catch {}
  };

  const playStatsEnter = () => {
    if (closing || settled) return;
    const delays = createDetailModalStatsEnterDelays(statElements.length);
    statElements.forEach((element, index) => {
      element.style.animationDelay = `${delays[index] ?? 0}s`;
      element.classList.add('journey-card-overlay-stat-entering');
    });
    stage.classList.remove('is-stats-enter-primed');
    statsEnterCleanupTimer = window.setTimeout(() => {
      statsEnterCleanupTimer = 0;
      statElements.forEach((element) => {
        element.classList.remove('journey-card-overlay-stat-entering');
        element.style.removeProperty('animation-delay');
      });
    }, enterDelay(Math.ceil(
      getDetailModalStatsEnterTotalDuration(statElements.length) * 1000,
    ) + 34));
  };

  const playStatsExit = () => {
    if (statsEnterCleanupTimer) {
      window.clearTimeout(statsEnterCleanupTimer);
      statsEnterCleanupTimer = 0;
    }
    statElements.forEach((element) => {
      element.classList.remove('journey-card-overlay-stat-entering');
      element.style.removeProperty('animation-delay');
    });
    // Restart the shared keyframe in its forward (exit) direction even if the
    // player closes while the enter cascade is still finishing.
    void paper.offsetHeight;
    statElements.forEach((element, index) => {
      element.style.animationDelay = `${index * JOURNEY_CARD_STATS_EXIT_STAGGER_MS}ms`;
      element.classList.add('journey-card-overlay-stat-exiting');
    });
  };

  const settle = (value: JourneyCardOverlayModalResult) => {
    if (settled) return;
    settled = true;
    cleanup(value);
    resolveResult(value);
  };

  const readOverlayCardGeometry = (): JourneyCardGeometry | null => (
    captureJourneyCardGeometry(cardHost, preview, [previewFlipShell])
  );

  const startSpatialEntry = (): void => {
    const destination = readOverlayCardGeometry();
    if (!destination) {
      stage.classList.remove('is-spatial-card-entry');
      return;
    }
    const initialOpacity = Math.max(0, Math.min(1, options.entryInitialOpacity ?? 1));
    spatialShell.style.opacity = String(initialOpacity);
    spatialFlight = startJourneyCardSpatialFlight({
      motionElement: spatialShell,
      baseGeometry: destination,
      from: options.origin.origin,
      readTarget: () => destination,
      direction: 'enter',
      durationMs: prefersReducedMotion ? 1 : JOURNEY_CARD_SPATIAL_FLIGHT_DURATION_MS,
      onProgress: (rawProgress) => {
        const revealProgress = Math.min(1, rawProgress / 0.38);
        spatialShell.style.opacity = String(
          initialOpacity + (1 - initialOpacity) * revealProgress,
        );
      },
    });
    void spatialFlight.result.then(() => {
      if (closing || settled) return;
      spatialFlight = null;
      spatialShell.style.removeProperty('transform');
      spatialShell.style.removeProperty('will-change');
      spatialShell.style.removeProperty('opacity');
      stage.classList.remove('is-spatial-card-entry');
      options.onCardEntrySettled?.();
    });
  };

  const startSpatialReturn = async (hideAfterLanding = false): Promise<void> => {
    const source = readOverlayCardGeometry();
    if (!source) {
      if (hideAfterLanding) {
        options.onPlayCardReturnStart?.();
        options.onPlayCardExitStart?.();
        options.origin.discard();
        options.onPlayCardExitComplete?.();
      } else options.origin.restoreNow();
      return;
    }
    // Sample the live idle frame first, then disable that animation owner and
    // sample the stable base. Spatial progress zero recreates the sampled idle
    // pose exactly, so close cannot snap to the neutral card before flight.
    stage.classList.remove('is-card-revealed', 'is-card-impact');
    clearDragStyles();
    stage.classList.add('is-spatial-card-return');
    const base = readOverlayCardGeometry() ?? source;
    // Play uses one uninterrupted, portaled timeline. The target is captured
    // before the World starts exiting, so the card never chases a moving Unit.
    if (hideAfterLanding) options.onPlayCardReturnStart?.();
    const frozenTarget = hideAfterLanding ? options.origin.readLiveGeometry() : null;
    const playTravelStartsAtMs = JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS;
    const playLandingAtMs = playTravelStartsAtMs + JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS;
    const playLandingExitAtMs = playLandingAtMs
      + JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS;
    const totalDurationMs = hideAfterLanding
      ? JOURNEY_CARD_PLAY_RETURN_DURATION_MS
      : JOURNEY_CARD_SPATIAL_RETURN_DURATION_MS;
    let didNotifyPlayCardExitStart = false;
    spatialFlight = startJourneyCardSpatialFlight({
      motionElement: spatialShell,
      baseGeometry: base,
      from: source,
      readTarget: () => frozenTarget ?? options.origin.readLiveGeometry(),
      direction: 'return',
      durationMs: prefersReducedMotion ? 1 : totalDurationMs,
      spatialProgress: hideAfterLanding
        ? (rawProgress) => {
          const elapsedMs = rawProgress * totalDurationMs;
          const flightProgress = Math.min(1, Math.max(0,
            (elapsedMs - playTravelStartsAtMs) / JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS,
          ));
          return flightProgress * flightProgress * (3 - 2 * flightProgress);
        }
        : undefined,
      pathOffset: hideAfterLanding ? computeJourneyCardArcOffset : undefined,
      onProgress: (rawProgress) => {
        if (!hideAfterLanding) return;
        const elapsedMs = rawProgress * totalDurationMs;
        if (!didNotifyPlayCardExitStart && elapsedMs >= playLandingExitAtMs) {
          didNotifyPlayCardExitStart = true;
          options.onPlayCardExitStart?.();
        }
        const launchHalfMs = JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS / 2;
        let cardScale = elapsedMs <= launchHalfMs
          ? 1 + 0.06 * (elapsedMs / launchHalfMs)
          : elapsedMs < JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS
            ? 1.06 - 0.06 * (
              (elapsedMs - launchHalfMs) / launchHalfMs
            )
            : 1;
        if (elapsedMs >= playLandingAtMs && elapsedMs < playLandingExitAtMs) {
          const punchProgress = Math.min(1, Math.max(0,
            (elapsedMs - playLandingAtMs) / JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS,
          ));
          const punchEase = 1 - Math.pow(1 - punchProgress, 3);
          cardScale = 1 + (0.14 * punchEase);
        } else if (elapsedMs >= playLandingExitAtMs) {
          const exitProgress = Math.min(1, Math.max(0,
            (elapsedMs - playLandingExitAtMs) / JOURNEY_CARD_PLAY_LANDING_EXIT_DURATION_MS,
          ));
          const overshoot = 1.7;
          const backIn = exitProgress * exitProgress
            * (((overshoot + 1) * exitProgress) - overshoot);
          cardScale = Math.max(0, 1.14 * (1 - backIn));
        }
        previewFlipShell.style.transformOrigin = '50% 50%';
        previewFlipShell.style.transform = `scale(${cardScale})`;
        previewFlipShell.style.opacity = elapsedMs >= totalDurationMs ? '0' : '1';
      },
    });
    const outcome = await spatialFlight.result;
    spatialFlight = null;
    if (hideAfterLanding && !didNotifyPlayCardExitStart) options.onPlayCardExitStart?.();
    // Never cross DOM/transform owners while pixels are visible. Play removes
    // the fully hidden portal node; dismiss restores the visible card at rest.
    if (hideAfterLanding) {
      options.origin.discard();
      options.onPlayCardExitComplete?.();
    } else {
      const restored = options.origin.restoreNow();
      didLandAtOrigin = outcome === 'complete' && restored && options.origin.anchor.isConnected;
    }
    previewFlipShell.style.removeProperty('transform');
    previewFlipShell.style.removeProperty('transform-origin');
    previewFlipShell.style.removeProperty('opacity');
    spatialShell.style.removeProperty('transform');
    spatialShell.style.removeProperty('will-change');
    stage.classList.remove('is-spatial-card-return');
    if (outcome === 'target-lost') {
      stage.classList.add('is-backdrop-exiting');
    }
  };

  const waitForExitDelay = (delayMs: number): Promise<void> => new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      exitDelayResolvers.delete(timer);
      resolve();
    }, prefersReducedMotion ? 0 : delayMs);
    exitDelayResolvers.set(timer, resolve);
  });

  const beginClose = async (value: JourneyCardOverlayModalResult) => {
    if (closing || settled || closeQueuedForCardLanding) return;
    if (stage.classList.contains('is-card-entering') && spatialFlight) {
      closeQueuedForCardLanding = true;
      await spatialFlight.result;
      closeQueuedForCardLanding = false;
      if (!settled) void beginClose(value);
      return;
    }
    closing = true;
    clearScheduledWork();
    stage.classList.remove(
      'is-card-entering',
      'cc-gameplay-modal-entering',
      'cc-gameplay-modal-idle',
    );
    stage.classList.add('is-exiting');
    stage.style.pointerEvents = 'none';
    preview.setAttribute('aria-pressed', 'false');
    closeController?.element.setAttribute('aria-disabled', 'true');

    await runGameplayModalParallelExit(
      () => ctaController?.exit() ?? Promise.resolve(),
      async () => {
        const foregroundIsCard = cardFront;
        const timing = getJourneyCardOverlayExitTiming(value, foregroundIsCard);
        stage.style.setProperty(
          '--journey-card-overlay-backdrop-exit-duration',
          `${timing.backdropExitDurationMs}ms`,
        );
        if (value === 'dismiss') {
          if (foregroundIsCard) {
            const cardReturn = startSpatialReturn();
            stage.classList.add('is-exiting-card-first');
            await waitForExitDelay(timing.rearStartDelayMs);
            if (settled) return;
            stage.classList.add(
              'is-backdrop-exiting',
              'cc-gameplay-modal-exiting',
              'is-exiting-modal-second',
            );
            playStatsExit();
            await Promise.all([
              cardReturn,
              waitForExitDelay(timing.rearDurationMs),
            ]);
            return;
          }

          stage.classList.add('cc-gameplay-modal-exiting', 'is-exiting-modal-first');
          playStatsExit();
          const modalExit = waitForExitDelay(timing.foregroundDurationMs);
          await waitForExitDelay(timing.rearStartDelayMs);
          if (settled) return;
          const cardReturn = startSpatialReturn();
          stage.classList.add('is-backdrop-exiting', 'is-exiting-card-second');
          await Promise.all([modalExit, cardReturn]);
          return;
        }

        let foregroundExit: Promise<void>;
        if (foregroundIsCard) {
          stage.classList.add('is-exiting-card-first');
          foregroundExit = startSpatialReturn(true);
        } else {
          stage.classList.add('cc-gameplay-modal-exiting', 'is-exiting-modal-first');
          playStatsExit();
          foregroundExit = waitForExitDelay(timing.foregroundDurationMs);
        }
        await waitForExitDelay(timing.rearStartDelayMs);
        if (settled) return;
        stage.classList.add('is-backdrop-exiting');
        let rearExit: Promise<void>;
        if (foregroundIsCard) {
          stage.classList.add('cc-gameplay-modal-exiting', 'is-exiting-modal-second');
          playStatsExit();
          rearExit = waitForExitDelay(timing.rearDurationMs);
        } else {
          stage.classList.add('is-exiting-card-second');
          rearExit = startSpatialReturn(true);
        }
        await Promise.all([foregroundExit, rearExit]);
      },
    );
    settle(value);
  };

  function clearDragStyles(): void {
    stage.style.removeProperty('--journey-card-drag-x');
    stage.style.removeProperty('--journey-card-drag-y');
    stage.style.removeProperty('--journey-card-drag-rotate');
    stage.style.removeProperty('--journey-card-drag-tilt-x');
    stage.style.removeProperty('--journey-card-rear-drag-x');
    stage.style.removeProperty('--journey-card-rear-drag-y');
    stage.style.removeProperty('--journey-card-rear-drag-rotate');
    stage.style.removeProperty('--journey-card-rear-drag-tilt-x');
    stage.style.removeProperty('--journey-card-swap-front-x');
    stage.style.removeProperty('--journey-card-swap-front-y');
    stage.style.removeProperty('--journey-card-swap-front-rotate');
    stage.style.removeProperty('--journey-card-swap-front-tilt-x');
    stage.style.removeProperty('--journey-card-swap-rear-x');
    stage.style.removeProperty('--journey-card-swap-rear-y');
    stage.style.removeProperty('--journey-card-swap-rear-rotate');
    stage.style.removeProperty('--journey-card-swap-rear-tilt-x');
  }

  function stopSwipeCoach(): void {
    if (swipeCoachIdleTimer) window.clearTimeout(swipeCoachIdleTimer);
    if (swipeCoachRaf) cancelAnimationFrame(swipeCoachRaf);
    swipeCoachIdleTimer = 0;
    swipeCoachRaf = 0;
    swipeCoachRunning = false;
    stage.classList.remove('is-swipe-coach-active');
    swipeHand.style.removeProperty('left');
    swipeHand.style.removeProperty('top');
    swipeHand.style.removeProperty('--journey-card-coach-hand-x');
    clearDragStyles();
  }

  function updateSwipeCoachCopy(): void {
    const surface = cardFront ? 'card' : 'stats';
    if (swipeCopy.dataset.swipeCoachSurface === surface) return;
    const copy = getJourneyCardSwipeCoachCopy(cardFront);
    swipeCopy.dataset.swipeCoachSurface = surface;
    swipeCopy.setAttribute('aria-label', copy.ariaLabel);
    swipeCopy.innerHTML = renderJourneyCardSwipeCoachCopy(copy);
  }

  function runSwipeCoach(): void {
    swipeCoachIdleTimer = 0;
    if (
      swipeCoachRunning || prefersReducedMotion || closing || settled || activePointerId !== null
      || stage.classList.contains('is-card-entering')
      || stage.classList.contains('is-depth-swapping')
    ) {
      scheduleSwipeCoach();
      return;
    }
    swipeCoachRunning = true;
    updateSwipeCoachCopy();
    const foreground = cardFront ? preview : paper;
    const bounds = foreground.getBoundingClientRect();
    swipeHand.style.left = `${bounds.left + bounds.width * 0.62}px`;
    swipeHand.style.top = `${bounds.top + bounds.height * 0.56}px`;
    stage.classList.add('is-swipe-coach-active');
    const startedAt = performance.now();
    const direction = Math.random() < 0.5 ? -1 : 1;
    const amplitude = 1 + Math.random() * 0.4;
    const keyframes = [
      { at: 0, x: 0 },
      { at: 0.18, x: -18 * direction * amplitude },
      { at: 0.39, x: -34 * direction * amplitude },
      { at: 0.58, x: 30 * direction * amplitude },
      { at: 0.76, x: 40 * direction * amplitude },
      { at: 0.9, x: -7 * direction * amplitude },
      { at: 1, x: 0 },
    ];
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / JOURNEY_CARD_SWIPE_COACH_DURATION_MS);
      let frameIndex = 0;
      while (frameIndex < keyframes.length - 2 && progress > keyframes[frameIndex + 1].at) {
        frameIndex += 1;
      }
      const from = keyframes[frameIndex];
      const to = keyframes[frameIndex + 1];
      const rawSegment = Math.max(0, Math.min(1, (progress - from.at) / (to.at - from.at)));
      const easedSegment = 1 - Math.pow(1 - rawSegment, 3);
      const x = from.x + (to.x - from.x) * easedSegment;
      const rotation = Math.max(-3.2, Math.min(3.2, x / 12));
      stage.style.setProperty('--journey-card-drag-x', `${x}px`);
      stage.style.setProperty('--journey-card-drag-rotate', `${rotation}deg`);
      stage.style.setProperty('--journey-card-rear-drag-x', `${x * -0.2}px`);
      stage.style.setProperty('--journey-card-rear-drag-rotate', `${rotation * 0.2}deg`);
      swipeHand.style.setProperty('--journey-card-coach-hand-x', `${x}px`);
      if (progress < 1 && !closing && !settled) {
        swipeCoachRaf = requestAnimationFrame(tick);
        return;
      }
      swipeCoachRaf = 0;
      swipeCoachRunning = false;
      stage.classList.remove('is-swipe-coach-active');
      clearDragStyles();
      scheduleSwipeCoach();
    };
    swipeCoachRaf = requestAnimationFrame(tick);
  }

  function scheduleSwipeCoach(): void {
    if (prefersReducedMotion || closing || settled || swipeCoachRunning) return;
    if (swipeCoachIdleTimer) window.clearTimeout(swipeCoachIdleTimer);
    swipeCoachIdleTimer = window.setTimeout(runSwipeCoach, JOURNEY_CARD_SWIPE_COACH_IDLE_MS);
  }

  function handleSwipeCoachInteraction(): void {
    stopSwipeCoach();
    scheduleSwipeCoach();
  }

  function beginDepthSwap(
    event?: Event,
    dragVector?: { x: number; y: number; startedOnRear?: boolean },
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (
      closing ||
      settled ||
      stage.classList.contains('is-card-entering') ||
      stage.classList.contains('is-depth-swapping') ||
      (!cardFront && !stage.classList.contains('is-card-peeked'))
    ) return;
    const nextCardFront = !cardFront;
    const directionClass = nextCardFront
      ? 'is-swapping-card-forward'
      : 'is-swapping-modal-forward';
    if (dragVector) {
      const magnitude = Math.max(1, Math.hypot(dragVector.x, dragVector.y));
      const directionX = dragVector.x / magnitude;
      const directionY = dragVector.y / magnitude;
      const frontDistance = dragVector.startedOnRear ? -26 : 48;
      const rearDistance = dragVector.startedOnRear ? 48 : -26;
      const frontRotation = dragVector.startedOnRear ? -6 : 8;
      const rearRotation = dragVector.startedOnRear ? 8 : -6;
      const frontTilt = dragVector.startedOnRear ? 3.5 : -5;
      const rearTilt = dragVector.startedOnRear ? -5 : 3.5;
      stage.style.setProperty('--journey-card-swap-front-x', `${directionX * frontDistance}px`);
      stage.style.setProperty('--journey-card-swap-front-y', `${directionY * frontDistance}px`);
      stage.style.setProperty('--journey-card-swap-front-rotate', `${(directionX + directionY * 0.35) * frontRotation}deg`);
      stage.style.setProperty('--journey-card-swap-front-tilt-x', `${directionY * frontTilt}deg`);
      stage.style.setProperty('--journey-card-swap-rear-x', `${directionX * rearDistance}px`);
      stage.style.setProperty('--journey-card-swap-rear-y', `${directionY * rearDistance}px`);
      stage.style.setProperty('--journey-card-swap-rear-rotate', `${(directionX + directionY * 0.35) * rearRotation}deg`);
      stage.style.setProperty('--journey-card-swap-rear-tilt-x', `${directionY * rearTilt}deg`);
      stage.classList.add('is-gesture-swapping');
    }
    stage.classList.remove('is-depth-dragging', 'is-depth-snapback');
    stage.classList.add('is-depth-swapping', directionClass);
    try { (window as any).triggerHapticImpact?.('light'); } catch {}

    depthSwapCommitTimer = window.setTimeout(() => {
      depthSwapCommitTimer = 0;
      if (closing || settled) return;
      stage.classList.add('is-depth-swap-settling');
      stage.classList.remove(directionClass);
      stage.style.setProperty('--journey-card-drag-x', '0px');
      stage.style.setProperty('--journey-card-drag-y', '0px');
      stage.style.setProperty('--journey-card-drag-rotate', '0deg');
      stage.style.setProperty('--journey-card-drag-tilt-x', '0deg');
      stage.style.setProperty('--journey-card-rear-drag-x', '0px');
      stage.style.setProperty('--journey-card-rear-drag-y', '0px');
      stage.style.setProperty('--journey-card-rear-drag-rotate', '0deg');
      stage.style.setProperty('--journey-card-rear-drag-tilt-x', '0deg');
      cardFront = nextCardFront;
      stage.classList.toggle('is-card-front', cardFront);
      updateSwipeCoachCopy();
      modalShell.inert = cardFront;
      preview.setAttribute('aria-pressed', String(cardFront));
      preview.setAttribute(
        'aria-label',
        cardFront ? `Return to ${viewModel.stageLabel} details` : `Show ${viewModel.stageLabel} card`,
      );
      depthShell.removeAttribute('role');
      depthShell.removeAttribute('tabindex');
      depthShell.removeAttribute('aria-label');
      if (!cardFront) {
        closeController?.element.focus({ preventScroll: true });
      }
      depthSwapCleanupTimer = window.setTimeout(() => {
        depthSwapCleanupTimer = 0;
        if (closing || settled) return;
        stage.classList.remove(
          'is-depth-swapping',
          'is-depth-swap-settling',
          'is-gesture-swapping',
        );
        clearDragStyles();
      }, enterDelay(JOURNEY_CARD_DEPTH_SWAP_SETTLE_MS));
    }, enterDelay(JOURNEY_CARD_DEPTH_SWAP_SEPARATE_MS));
  }

  function handleCardTapDepthSwap(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (
      closing || settled || performance.now() <= suppressClickUntil
      || stage.classList.contains('is-card-entering')
      || stage.classList.contains('is-depth-swapping')
    ) return;
    beginDepthSwap(event);
  }

  function getDragTargetDepth(target: EventTarget | null): 'front' | 'rear' | null {
    if (!(target instanceof Element)) return null;
    if (preview.contains(target)) return cardFront ? 'front' : 'rear';
    if (!depthShell.contains(target)) return null;
    if (target.closest('button, a, input, select, textarea')) return null;
    return cardFront ? 'rear' : 'front';
  }

  function resolveDragTargetDepth(event: PointerEvent): 'front' | 'rear' | null {
    const directDepth = getDragTargetDepth(event.target);
    if (directDepth) return directDepth;
    if (
      event.target instanceof Element
      && event.target.closest('button, a, input, select, textarea')
    ) return null;

    // Transformed 3D shells can leave the visible peekaboo paper/card pixels
    // targeting the stage itself on iOS. Recover that exposed rear hit area
    // geometrically, but never steal any pixel owned by the foreground.
    const foreground = cardFront ? preview : paper;
    const rear = cardFront ? paper : preview;
    const foregroundRect = foreground.getBoundingClientRect();
    const rearRect = rear.getBoundingClientRect();
    const contains = (rect: DOMRect): boolean => (
      event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom
    );
    if (contains(foregroundRect)) return 'front';
    if (contains(rearRect)) return 'rear';
    return null;
  }

  function paintDepthDrag(): void {
    dragRaf = 0;
    const deltaX = dragCurrentX - dragStartX;
    const deltaY = dragCurrentY - dragStartY;
    const visualDeltaX = deltaX * JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_X;
    const visualDeltaY = deltaY * JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_Y;
    const rotate = Math.max(-8, Math.min(8, visualDeltaX / 16));
    const tiltX = Math.max(-5, Math.min(5, visualDeltaY / -22));
    const frontFollow = dragStartedOnRear ? 0.2 : 1;
    const rearFollow = dragStartedOnRear ? 1 : 0.2;
    const frontRotation = dragStartedOnRear ? -0.28 : 1;
    const rearRotation = dragStartedOnRear ? 1 : -0.28;
    stage.style.setProperty('--journey-card-drag-x', `${visualDeltaX * frontFollow}px`);
    stage.style.setProperty('--journey-card-drag-y', `${visualDeltaY * frontFollow}px`);
    stage.style.setProperty('--journey-card-drag-rotate', `${rotate * frontRotation}deg`);
    stage.style.setProperty('--journey-card-drag-tilt-x', `${tiltX * frontRotation}deg`);
    stage.style.setProperty('--journey-card-rear-drag-x', `${visualDeltaX * rearFollow}px`);
    stage.style.setProperty('--journey-card-rear-drag-y', `${visualDeltaY * rearFollow}px`);
    stage.style.setProperty('--journey-card-rear-drag-rotate', `${rotate * rearRotation}deg`);
    stage.style.setProperty('--journey-card-rear-drag-tilt-x', `${tiltX * rearRotation}deg`);
  }

  function handleDragPointerDown(event: PointerEvent): void {
    const targetDepth = resolveDragTargetDepth(event);
    if (
      event.button !== 0 ||
      activePointerId !== null ||
      closing ||
      settled ||
      stage.classList.contains('is-card-entering') ||
      stage.classList.contains('is-depth-swapping') ||
      targetDepth === null
    ) return;
    activePointerId = event.pointerId;
    dragStartX = dragCurrentX = dragLastX = event.clientX;
    dragStartY = dragCurrentY = dragLastY = event.clientY;
    dragLastTime = event.timeStamp;
    dragVelocityX = 0;
    dragVelocityY = 0;
    dragMoved = false;
    dragStartedOnRear = targetDepth === 'rear';
    stage.classList.remove('is-depth-snapback');
    stage.classList.add('is-depth-dragging');
    try { stage.setPointerCapture(event.pointerId); } catch {}
  }

  function handleDragPointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return;
    const elapsed = event.timeStamp - dragLastTime;
    if (elapsed > 0) {
      const sampleVelocityX = (event.clientX - dragLastX) / elapsed;
      const sampleVelocityY = (event.clientY - dragLastY) / elapsed;
      dragVelocityX = dragVelocityX * 0.35 + sampleVelocityX * 0.65;
      dragVelocityY = dragVelocityY * 0.35 + sampleVelocityY * 0.65;
    }
    dragCurrentX = event.clientX;
    dragCurrentY = event.clientY;
    dragLastX = event.clientX;
    dragLastY = event.clientY;
    dragLastTime = event.timeStamp;
    dragMoved ||= Math.hypot(dragCurrentX - dragStartX, dragCurrentY - dragStartY)
      > JOURNEY_CARD_DRAG_TAP_SLOP_PX;
    if (!dragMoved) return;
    event.preventDefault();
    if (!dragRaf) dragRaf = requestAnimationFrame(paintDepthDrag);
  }

  function finishDepthDrag(event: PointerEvent, allowCommit: boolean): void {
    if (event.pointerId !== activePointerId) return;
    dragCurrentX = event.clientX;
    dragCurrentY = event.clientY;
    if (event.timeStamp - dragLastTime > 80) {
      dragVelocityX = 0;
      dragVelocityY = 0;
    }
    if (dragRaf) {
      cancelAnimationFrame(dragRaf);
      dragRaf = 0;
      paintDepthDrag();
    }
    const deltaX = dragCurrentX - dragStartX;
    const deltaY = dragCurrentY - dragStartY;
    const moved = dragMoved;
    activePointerId = null;
    try { stage.releasePointerCapture(event.pointerId); } catch {}
    if (!moved) {
      stage.classList.remove('is-depth-dragging');
      clearDragStyles();
      // Tap and drag share the same geometry-aware pointer owner. This is
      // required for the transformed modal/card shells, whose synthetic click
      // target can be the stage instead of the visible foreground surface.
      if (allowCommit) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil = performance.now() + JOURNEY_CARD_DEPTH_SWAP_SEPARATE_MS
          + JOURNEY_CARD_DEPTH_SWAP_SETTLE_MS;
        beginDepthSwap();
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressClickUntil = performance.now() + JOURNEY_CARD_DEPTH_SWAP_SEPARATE_MS
      + JOURNEY_CARD_DEPTH_SWAP_SETTLE_MS;
    if (allowCommit && shouldCommitJourneyCardDepthDrag(
      deltaX,
      deltaY,
      dragVelocityX,
      dragVelocityY,
    )) {
      // Commit from the actually painted drag pose so the release cannot snap
      // before the directional split transition acquires ownership.
      void preview.getBoundingClientRect();
      beginDepthSwap(undefined, {
        x: deltaX || dragVelocityX,
        y: deltaY || dragVelocityY,
        startedOnRear: dragStartedOnRear,
      });
      return;
    }
    stage.classList.remove('is-depth-dragging');
    stage.classList.add('is-depth-snapback');
    stage.style.setProperty('--journey-card-drag-x', '0px');
    stage.style.setProperty('--journey-card-drag-y', '0px');
    stage.style.setProperty('--journey-card-drag-rotate', '0deg');
    stage.style.setProperty('--journey-card-drag-tilt-x', '0deg');
    stage.style.setProperty('--journey-card-rear-drag-x', '0px');
    stage.style.setProperty('--journey-card-rear-drag-y', '0px');
    stage.style.setProperty('--journey-card-rear-drag-rotate', '0deg');
    stage.style.setProperty('--journey-card-rear-drag-tilt-x', '0deg');
    dragSnapbackTimer = window.setTimeout(() => {
      dragSnapbackTimer = 0;
      stage.classList.remove('is-depth-snapback');
      clearDragStyles();
    }, JOURNEY_CARD_DRAG_SNAPBACK_MS);
  }

  function handleDragPointerUp(event: PointerEvent): void {
    finishDepthDrag(event, true);
  }

  function handleDragPointerCancel(event: PointerEvent): void {
    finishDepthDrag(event, false);
  }

  function handleSuppressedDragClick(event: MouseEvent): void {
    if (performance.now() > suppressClickUntil) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target !== stage || stage.classList.contains('is-depth-swapping')) return;
    void beginClose('dismiss');
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      const candidates: Array<HTMLElement | undefined> = cardFront
        ? [preview]
        : [closeController?.element, preview, cta];
      const focusable = candidates.filter((element): element is HTMLElement => (
        !!element && (!(element instanceof HTMLButtonElement) || !element.disabled)
      ));
      if (!focusable.length) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault();
      focusable[nextIndex].focus({ preventScroll: true });
      return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault();
    void beginClose('dismiss');
  }

  function handleRouteChange(): void {
    if (!settled) settle('dismiss');
  }

  preview.addEventListener('click', handleCardTapDepthSwap);
  preview.addEventListener('pointerdown', handleDragPointerDown, true);
  depthShell.addEventListener('pointerdown', handleDragPointerDown, true);
  paper.addEventListener('pointerdown', handleDragPointerDown, true);
  stage.addEventListener('pointerdown', handleDragPointerDown, true);
  stage.addEventListener('pointermove', handleDragPointerMove, true);
  stage.addEventListener('pointerup', handleDragPointerUp, true);
  stage.addEventListener('pointercancel', handleDragPointerCancel, true);
  stage.addEventListener('click', handleSuppressedDragClick, true);
  stage.addEventListener('click', handleBackdropClick);
  stage.addEventListener('pointerdown', handleSwipeCoachInteraction, true);
  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('cc-navigation', handleRouteChange);
  window.addEventListener('pagehide', handleRouteChange);
  closeController = mountGameplaySheetClose(idleShell, () => {
    void beginClose('dismiss');
  }, 'Close stage details');
  ctaController = registerCta(cta, {
    variant: 'primary',
    initialState: 'hidden',
    onActivate: () => beginClose('play'),
  });

  document.body.appendChild(stage);
  stage.classList.add(
    'is-visible',
    'is-card-entering',
    'is-card-peeked',
    'is-spatial-card-entry',
    'is-stats-enter-primed',
  );
  startSpatialEntry();
  enterRafOne = requestAnimationFrame(() => {
    enterRafOne = 0;
    stage.classList.add('is-backdrop-visible');
    enterRafTwo = requestAnimationFrame(() => {
      enterRafTwo = 0;
      if (closing || settled) return;
      cardToModalTimer = window.setTimeout(() => {
        cardToModalTimer = 0;
        if (closing || settled) return;
        stage.classList.add('is-modal-visible', 'cc-gameplay-modal-entering');
        playStatsEnter();
        closeController?.element.focus({ preventScroll: true });
        void ctaController?.enter();
        enterCleanupTimer = window.setTimeout(() => {
          enterCleanupTimer = 0;
          if (closing || settled) return;
          stage.classList.remove('cc-gameplay-modal-entering');
          stage.classList.add('cc-gameplay-modal-idle');
          playModalSettleImpact();
          scheduleSwipeCoach();
        }, enterDelay(
          JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS + GAMEPLAY_MODAL_BENCHMARK.enterCleanupBufferMs,
        ));
      }, enterDelay(Math.round(
        JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS * JOURNEY_CARD_MODAL_ENTER_START_PROGRESS,
      )));
      cardEnterCleanupTimer = window.setTimeout(() => {
        cardEnterCleanupTimer = 0;
        if (closing || settled) return;
        stage.classList.remove('is-card-entering');
      }, enterDelay(
        JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS + GAMEPLAY_MODAL_BENCHMARK.enterCleanupBufferMs,
      ));
      cardImpactTimer = window.setTimeout(() => {
        cardImpactTimer = 0;
        if (closing || settled) return;
        playCardSettleImpact();
      }, enterDelay(Math.round(
        JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS * JOURNEY_CARD_INITIAL_IMPACT_PROGRESS,
      )));
    });
  });

  controller = {
    element: stage,
    result,
    get didLandAtOrigin() {
      return didLandAtOrigin;
    },
    close() {
      void beginClose('dismiss');
    },
    dispose() {
      if (settled) return;
      settle('dismiss');
    },
  };
  activeJourneyCardOverlayModal = controller;
  return controller;
}
