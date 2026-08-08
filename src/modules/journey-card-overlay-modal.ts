import { boardStatsService } from '../services/board-stats-service.js';
import { registerCta, type CtaController } from './cta-system.js';
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
import { mountJourneyCardFlipSpatialMotion } from './gameplay-modal-spatial-motion.js';
import {
  createDetailModalStatsEnterDelays,
  getDetailModalStatsEnterTotalDuration,
} from './detail-modal-stats-enter-motion.js';

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
  origin: JourneyCardOriginLease;
  hasSavedState: boolean;
  scrollOwner?: HTMLElement | null;
  entryInitialOpacity?: number;
  onCardEntrySettled?: () => void;
  onPlayCardReturnStart?: () => void;
  onPlayCardExitStart?: () => void;
  onPlayCardExitComplete?: () => void;
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

let activeJourneyCardOverlayModal: JourneyCardOverlayModalController | null = null;

export const JOURNEY_CARD_FLIP_ENTER_DURATION_MS = 680;
export const JOURNEY_CARD_FLIP_DISMISS_DURATION_MS = 660;
export const JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS = 100;
export const JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS = 500;
export const JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS = 120;
export const JOURNEY_CARD_PLAY_LANDING_EXIT_DURATION_MS = 400;
export const JOURNEY_CARD_PLAY_RETURN_DURATION_MS = 1120;
export const JOURNEY_CARD_FLIP_SNAP_DURATION_MS = 520;
export const JOURNEY_CARD_FLIP_DRAG_COMMIT_RATIO = 0.2;
export const JOURNEY_CARD_FLIP_FLICK_VELOCITY_PX_PER_MS = 0.34;
export const JOURNEY_CARD_FLIP_IDLE_COACH_DELAY_MS = 5000;
export const JOURNEY_CARD_FLIP_IDLE_COACH_DURATION_MS = 2100;
export const JOURNEY_CARD_FLIP_DRAG_PREVIEW_MAX_DEG = 36;
export const JOURNEY_CARD_FLIP_STATS_ENTER_TIME_SCALE = 0.5;
const JOURNEY_CARD_FLIP_TAP_SLOP_PX = 7;

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

function renderIdleCoachLine(line: string, lineOffset: number): string {
  return `<span class="journey-card-flip-idle-line">${Array.from(line).map((letter, index) => (
    letter === ' '
      ? `<span class="journey-card-flip-idle-letter is-space" style="--journey-card-idle-letter:${lineOffset + index}">&nbsp;</span>`
      : `<span class="journey-card-flip-idle-letter" style="--journey-card-idle-letter:${lineOffset + index}">${letter}</span>`
  )).join('')}</span>`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Entry keeps the source face readable for the first third of the flight and
 * crosses the physical edge at exactly 50%. Return starts the same -180 ->
 * -360 turn 30 timeline points earlier so Close immediately reads as a
 * physical flip-back instead of a translating stats sheet.
 */
export function getJourneyCardFlightFlipAngle(
  progress: number,
  direction: 'enter' | 'return',
): number {
  const turnStartsAt = direction === 'return' ? 0.02 : 0.32;
  const turn = smoothstep((clamp01(progress) - turnStartsAt) / 0.36);
  const signedTurn = turn === 0 ? 0 : turn * -180;
  return direction === 'enter' ? signedTurn : -180 + signedTurn;
}

export function shouldCommitJourneyCardFlipDrag(
  deltaX: number,
  velocityX: number,
  cardWidth: number,
): boolean {
  const commitDistance = Math.max(1, cardWidth) * JOURNEY_CARD_FLIP_DRAG_COMMIT_RATIO;
  return Math.abs(deltaX) >= commitDistance
    || Math.abs(velocityX) >= JOURNEY_CARD_FLIP_FLICK_VELOCITY_PX_PER_MS;
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

function waitForPaints(count = 1): Promise<void> {
  return new Promise((resolve) => {
    const next = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(count);
  });
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
  const stage = document.createElement('div');
  const tiltProfile = createJourneyCardOverlayTiltProfile();
  stage.id = 'journey-card-overlay-modal';
  stage.className = 'journey-card-overlay-modal journey-card-flip-overlay';
  stage.setAttribute('role', 'dialog');
  stage.setAttribute('aria-modal', 'true');
  stage.setAttribute('aria-labelledby', 'journey-card-flip-title');
  stage.setAttribute('data-board-id', String(options.boardId));
  stage.style.setProperty('--journey-card-origin-aspect', String(options.origin.aspectRatio));
  stage.style.setProperty('--journey-card-flip-front-tilt', `${tiltProfile.cardRotationDeg}deg`);
  stage.style.setProperty('--journey-card-flip-back-tilt', `${tiltProfile.modalRotationDeg}deg`);
  stage.innerHTML = `
    <div class="journey-card-flip-backdrop" aria-hidden="true"></div>
    <div class="journey-card-flip-frame">
      <div class="journey-card-flip-spatial-shell">
        <div class="journey-card-flip-impact-shell">
          <div class="journey-card-flip-idle-shell">
            <div class="journey-card-flip-gyro-shell">
            <div class="journey-card-flip-rotor">
              <div class="journey-card-flip-face journey-card-flip-front" role="button" tabindex="0" aria-label="Turn card to view stats" aria-hidden="false">
                <div class="journey-card-flip-card-host" aria-hidden="true"></div>
                <div class="journey-card-flip-shine" aria-hidden="true"></div>
              </div>
              <div class="journey-card-flip-face journey-card-flip-back" aria-hidden="true">
                <div class="cc-gameplay-modal-idle-shell journey-card-flip-back-shell">
                  <div class="cc-gameplay-modal-paper-shell journey-card-flip-paper" data-board-id="${options.boardId}-modal">
                    <div class="journey-card-flip-title-section">
                      <h2 id="journey-card-flip-title" class="cc-gameplay-modal-title">${viewModel.stageLabel}</h2>
                    </div>
                    <div class="journey-card-flip-stats">
                      <div class="journey-card-flip-stat">
                        <div class="journey-card-flip-stat-icon">
                          <img src="./assets/highscore-icon.png" alt="" aria-hidden="true" draggable="false">
                        </div>
                        <div class="journey-card-flip-stat-content">
                          <strong>${viewModel.highScore}</strong><span>High score</span>
                        </div>
                      </div>
                      <div class="journey-card-flip-divider" aria-hidden="true"></div>
                      <div class="journey-card-flip-stat">
                        <div class="journey-card-flip-stat-icon">
                          <img src="./assets/combo-icon.png" alt="" aria-hidden="true" draggable="false">
                        </div>
                        <div class="journey-card-flip-stat-content">
                          <strong>${viewModel.longestCombo}</strong><span>Longest combo</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" class="journey-card-flip-cta cc-cta--standard-width" aria-label="${viewModel.ctaAriaLabel}">${viewModel.ctaLabel}</button>
                    <button type="button" class="journey-card-flip-turn-control" aria-label="Turn card to view artwork"></button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
      <img class="journey-card-flip-idle-hand" src="./assets/hand-pointer.png" alt="" aria-hidden="true" draggable="false">
    </div>
    <div class="journey-card-flip-idle-copy" aria-hidden="true">
      <span class="journey-card-flip-idle-message is-drag">${renderIdleCoachLine('DRAG TO FLIP', 0)}</span>
      <span class="journey-card-flip-idle-message is-tap">${renderIdleCoachLine('TAP TO FLIP', 0)}</span>
    </div>
  `;

  const backdrop = stage.querySelector<HTMLElement>('.journey-card-flip-backdrop');
  const frame = stage.querySelector<HTMLElement>('.journey-card-flip-frame');
  const spatialShell = stage.querySelector<HTMLElement>('.journey-card-flip-spatial-shell');
  const impactShell = stage.querySelector<HTMLElement>('.journey-card-flip-impact-shell');
  const idleShell = stage.querySelector<HTMLElement>('.journey-card-flip-idle-shell');
  const gyroShell = stage.querySelector<HTMLElement>('.journey-card-flip-gyro-shell');
  const rotor = stage.querySelector<HTMLElement>('.journey-card-flip-rotor');
  const front = stage.querySelector<HTMLElement>('.journey-card-flip-front');
  const back = stage.querySelector<HTMLElement>('.journey-card-flip-back');
  const backShell = stage.querySelector<HTMLElement>('.journey-card-flip-back-shell');
  const cardHost = stage.querySelector<HTMLElement>('.journey-card-flip-card-host');
  const cta = stage.querySelector<HTMLButtonElement>('.journey-card-flip-cta');
  const turnControl = stage.querySelector<HTMLButtonElement>('.journey-card-flip-turn-control');
  const idleHand = stage.querySelector<HTMLImageElement>('.journey-card-flip-idle-hand');
  const idleCopy = stage.querySelector<HTMLElement>('.journey-card-flip-idle-copy');
  if (!backdrop || !frame || !spatialShell || !impactShell || !idleShell || !gyroShell || !rotor || !front || !back || !backShell || !cardHost || !cta || !turnControl || !idleHand || !idleCopy) {
    stage.remove();
    throw new Error('Journey flip card failed to create its required owners');
  }
  const backContentElements = Array.from(
    stage.querySelectorAll<HTMLElement>('.journey-card-flip-stats > .journey-card-flip-stat, .journey-card-flip-stats > .journey-card-flip-divider'),
  );
  options.origin.mountInto(cardHost);

  const scrollOwner = options.scrollOwner ?? null;
  const previousOverflow = scrollOwner?.style.overflow ?? '';
  const previousTouchAction = scrollOwner?.style.touchAction ?? '';
  if (scrollOwner) {
    scrollOwner.style.overflow = 'hidden';
    scrollOwner.style.touchAction = 'none';
  }

  const journeyScreen = document.getElementById('journey-screen');
  const journeyWasInert = journeyScreen?.inert ?? false;
  const previouslyFocused = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  if (journeyScreen) journeyScreen.inert = true;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let resolveResult!: (result: JourneyCardOverlayModalResult) => void;
  const result = new Promise<JourneyCardOverlayModalResult>((resolve) => {
    resolveResult = resolve;
  });
  let controller!: JourneyCardOverlayModalController;
  let settled = false;
  let closing = false;
  let entering = true;
  let flipping = false;
  let stableFace: 'front' | 'back' = 'front';
  let currentAngle = 0;
  let didLandAtOrigin = false;
  let spatialFlight: JourneyCardSpatialFlightController | null = null;
  let flipAnimation: Animation | null = null;
  let impactAnimation: Animation | null = null;
  let exitNeutralAnimations: Animation[] = [];
  let idleCoachTimer = 0;
  let idleCoachRotorAnimation: Animation | null = null;
  let idleCoachHandAnimation: Animation | null = null;
  let idleCoachImpactAnimation: Animation | null = null;
  let idleCoachGeneration = 0;
  let nextIdleCoachMode: 'drag' | 'tap' = 'drag';
  let backContentEnterTimer = 0;
  let backContentRestoreTimer = 0;
  let backContentEnterScheduled = false;
  let disposeSpatialMotion: (() => void) | null = null;
  let closeController: GameplaySheetCloseController | null = null;
  let ctaController: CtaController | null = null;
  let activePointerId: number | null = null;
  let dragStartX = 0;
  let dragLastX = 0;
  let dragLastTime = 0;
  let dragVelocityX = 0;
  let dragMoved = false;
  let dragStartAngle = 0;
  let dragCardWidth = 1;
  let dragDirection = 1;
  let currentTranslateX = 0;

  const stopSurfaceIdle = () => stage.classList.remove('is-surface-idle');
  const startSurfaceIdle = () => {
    if (!prefersReducedMotion && !entering && !closing && !settled && !flipping && activePointerId === null) {
      stage.classList.add('is-surface-idle');
    }
  };

  const neutralizeExitMotionOwners = () => {
    const idleTransform = window.getComputedStyle(idleShell).transform || 'none';
    const gyroStyle = window.getComputedStyle(gyroShell);
    const gyroTranslate = gyroStyle.translate || 'none';
    const gyroTransform = gyroStyle.transform || 'none';
    stopSurfaceIdle();
    disposeSpatialMotion?.();
    disposeSpatialMotion = null;
    exitNeutralAnimations.forEach((animation) => animation.cancel());
    exitNeutralAnimations = [];
    if (prefersReducedMotion || typeof idleShell.animate !== 'function') {
      idleShell.style.transform = 'none';
      gyroShell.style.translate = 'none';
      gyroShell.style.transform = 'none';
      return;
    }
    exitNeutralAnimations = [
      idleShell.animate([
        { transform: idleTransform },
        { transform: 'none' },
      ], { duration: 260, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }),
      gyroShell.animate([
        { translate: gyroTranslate, transform: gyroTransform },
        { translate: 'none', transform: 'none' },
      ], { duration: 260, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }),
    ];
  };

  const setRotorPose = (angle: number, translateX = 0) => {
    currentAngle = angle;
    currentTranslateX = translateX;
    rotor.style.transform = `translate3d(${translateX}px, 0, 0) rotateY(${angle}deg)`;
  };

  const setRotorAngle = (angle: number) => setRotorPose(angle, 0);

  const setStableFace = (face: 'front' | 'back') => {
    stableFace = face;
    const frontActive = face === 'front';
    front.inert = !frontActive;
    back.inert = frontActive;
    front.tabIndex = frontActive ? 0 : -1;
    front.setAttribute('aria-hidden', String(!frontActive));
    back.setAttribute('aria-hidden', String(frontActive));
    stage.dataset.face = face;
  };

  const stableRotorAngle = () => stableFace === 'front' ? 0 : -180;

  const clearBackContentTimers = () => {
    if (backContentEnterTimer !== 0) {
      window.clearTimeout(backContentEnterTimer);
      backContentEnterTimer = 0;
    }
    if (backContentRestoreTimer !== 0) {
      window.clearTimeout(backContentRestoreTimer);
      backContentRestoreTimer = 0;
    }
  };

  const restoreBackContentVisible = () => {
    backContentElements.forEach((element) => {
      element.classList.remove('is-content-entering');
      element.style.removeProperty('animation-delay');
      element.style.removeProperty('opacity');
      element.style.removeProperty('visibility');
      element.style.removeProperty('transform');
      element.style.removeProperty('will-change');
    });
  };

  const primeBackContentForEnter = () => {
    clearBackContentTimers();
    backContentEnterScheduled = false;
    backContentElements.forEach((element) => {
      element.classList.remove('is-content-entering');
      element.style.removeProperty('animation-delay');
      element.style.opacity = '0';
      element.style.visibility = 'hidden';
      element.style.transform = 'scale(0)';
      element.style.willChange = 'transform, opacity';
    });
    ctaController?.prime('hidden');
  };

  const startBackContentEnter = (delayMs = 0) => {
    if (backContentEnterScheduled || closing || settled) return;
    backContentEnterScheduled = true;
    if (prefersReducedMotion) {
      restoreBackContentVisible();
      ctaController?.prime('idle');
      return;
    }
    backContentEnterTimer = window.setTimeout(() => {
      backContentEnterTimer = 0;
      if (closing || settled) return;
      const delays = createDetailModalStatsEnterDelays(backContentElements.length).map((delay) => (
        delay * JOURNEY_CARD_FLIP_STATS_ENTER_TIME_SCALE
      ));
      backContentElements.forEach((element, index) => {
        element.classList.remove('is-content-entering');
        element.style.animationDelay = `${delays[index] ?? 0}s`;
        element.classList.add('is-content-entering');
      });
      void ctaController?.enter();
      backContentRestoreTimer = window.setTimeout(() => {
        backContentRestoreTimer = 0;
        if (closing || settled) return;
        restoreBackContentVisible();
      }, Math.ceil(
        getDetailModalStatsEnterTotalDuration(backContentElements.length)
        * JOURNEY_CARD_FLIP_STATS_ENTER_TIME_SCALE
        * 1000,
      ) + 34);
    }, Math.max(0, delayMs));
  };

  const stopIdleCoach = (resetRotor = true) => {
    idleCoachGeneration += 1;
    if (idleCoachTimer !== 0) {
      window.clearTimeout(idleCoachTimer);
      idleCoachTimer = 0;
    }
    idleCoachRotorAnimation?.cancel();
    idleCoachRotorAnimation = null;
    idleCoachHandAnimation?.cancel();
    idleCoachHandAnimation = null;
    idleCoachImpactAnimation?.cancel();
    idleCoachImpactAnimation = null;
    stage.classList.remove('is-idle-coach', 'is-idle-coach-drag', 'is-idle-coach-tap');
    if (resetRotor && !entering && !closing && !settled && !flipping && activePointerId === null) {
      setRotorAngle(stableRotorAngle());
    }
  };

  const scheduleIdleCoach = () => {
    stopIdleCoach();
    if (prefersReducedMotion || entering || closing || settled || flipping || activePointerId !== null) return;
    const generation = idleCoachGeneration;
    idleCoachTimer = window.setTimeout(() => {
      idleCoachTimer = 0;
      if (generation !== idleCoachGeneration || entering || closing || settled || flipping || activePointerId !== null) return;
      disposeSpatialMotion?.();
      disposeSpatialMotion = null;
      const coachMode = nextIdleCoachMode;
      nextIdleCoachMode = coachMode === 'drag' ? 'tap' : 'drag';
      stage.classList.add('is-idle-coach', `is-idle-coach-${coachMode}`);
      const baseAngle = stableRotorAngle();
      const rotorAnimation = coachMode === 'drag'
        ? rotor.animate([
          { transform: `rotateY(${baseAngle}deg)`, offset: 0 },
          { transform: `translate3d(-34px, 0, 0) rotateY(${baseAngle - 17}deg)`, offset: 0.28 },
          { transform: `translate3d(38px, 0, 0) rotateY(${baseAngle + 19}deg)`, offset: 0.68 },
          { transform: `rotateY(${baseAngle}deg)`, offset: 1 },
        ], {
          duration: JOURNEY_CARD_FLIP_IDLE_COACH_DURATION_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        })
        : null;
      const handAnimation = idleHand.animate(coachMode === 'drag' ? [
          { opacity: 0, transform: 'translate3d(-50%, -32%, 80px) rotate(-10deg) scale(0.78)', offset: 0 },
          { opacity: 1, transform: 'translate3d(calc(-50% - 34px), -50%, 80px) rotate(-10deg) scale(0.96)', offset: 0.16 },
          { opacity: 1, transform: 'translate3d(calc(-50% + 38px), -50%, 80px) rotate(-5deg) scale(0.96)', offset: 0.68 },
          { opacity: 0, transform: 'translate3d(-50%, -32%, 80px) rotate(-7deg) scale(0.84)', offset: 1 },
        ] : [
          { opacity: 0, transform: 'translate3d(-50%, -28%, 80px) rotate(-8deg) scale(0.78)', offset: 0 },
          { opacity: 1, transform: 'translate3d(-50%, -50%, 80px) rotate(-8deg) scale(0.96)', offset: 0.2 },
          { opacity: 1, transform: 'translate3d(-50%, -38%, 80px) rotate(-6deg) scale(0.84)', offset: 0.42 },
          { opacity: 1, transform: 'translate3d(-50%, -52%, 80px) rotate(-8deg) scale(1)', offset: 0.58 },
          { opacity: 0, transform: 'translate3d(-50%, -34%, 80px) rotate(-7deg) scale(0.84)', offset: 1 },
        ], {
          duration: JOURNEY_CARD_FLIP_IDLE_COACH_DURATION_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        });
      const impactCoachAnimation = coachMode === 'tap'
        ? impactShell.animate([
          { transform: 'scale(1)', offset: 0 },
          { transform: 'scale(1)', offset: 0.34 },
          { transform: 'scale(0.965)', offset: 0.43 },
          { transform: 'scale(1.06)', offset: 0.57 },
          { transform: 'scale(0.988)', offset: 0.7 },
          { transform: 'scale(1)', offset: 0.82 },
          { transform: 'scale(1)', offset: 1 },
        ], {
          duration: JOURNEY_CARD_FLIP_IDLE_COACH_DURATION_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        })
        : null;
      idleCoachRotorAnimation = rotorAnimation;
      idleCoachHandAnimation = handAnimation;
      idleCoachImpactAnimation = impactCoachAnimation;
      const coachAnimations = [rotorAnimation, handAnimation, impactCoachAnimation]
        .filter((animation): animation is Animation => animation !== null);
      void Promise.allSettled(coachAnimations.map((animation) => animation.finished)).then(() => {
        if (
          generation !== idleCoachGeneration
          || idleCoachRotorAnimation !== rotorAnimation
          || idleCoachHandAnimation !== handAnimation
          || idleCoachImpactAnimation !== impactCoachAnimation
        ) return;
        idleCoachRotorAnimation = null;
        idleCoachHandAnimation = null;
        idleCoachImpactAnimation = null;
        stage.classList.remove('is-idle-coach', 'is-idle-coach-drag', 'is-idle-coach-tap');
        if (closing || settled) return;
        setRotorAngle(baseAngle);
        disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
        scheduleIdleCoach();
      });
    }, JOURNEY_CARD_FLIP_IDLE_COACH_DELAY_MS);
  };

  const cancelMotion = () => {
    stopIdleCoach(false);
    clearBackContentTimers();
    spatialFlight?.cancel();
    spatialFlight = null;
    flipAnimation?.cancel();
    flipAnimation = null;
    impactAnimation?.cancel();
    impactAnimation = null;
    exitNeutralAnimations.forEach((animation) => animation.cancel());
    exitNeutralAnimations = [];
    if (activePointerId !== null) {
      try { rotor.releasePointerCapture(activePointerId); } catch {}
      activePointerId = null;
    }
  };

  const readFrameGeometry = (): JourneyCardGeometry | null => (
    captureJourneyCardGeometry(frame, frame)
  );

  const restoreEnvironment = () => {
    if (scrollOwner) {
      scrollOwner.style.overflow = previousOverflow;
      scrollOwner.style.touchAction = previousTouchAction;
    }
    if (journeyScreen) journeyScreen.inert = journeyWasInert;
    if (previouslyFocused?.isConnected) {
      try { previouslyFocused.focus({ preventScroll: true }); } catch {}
    }
  };

  const cleanup = (value: JourneyCardOverlayModalResult) => {
    disposeSpatialMotion?.();
    disposeSpatialMotion = null;
    cancelMotion();
    rotor.removeEventListener('pointerdown', handlePointerDown);
    rotor.removeEventListener('pointermove', handlePointerMove);
    rotor.removeEventListener('pointerup', handlePointerUp);
    rotor.removeEventListener('pointercancel', handlePointerCancel);
    rotor.removeEventListener('keydown', handleRotorKeyDown);
    turnControl.removeEventListener('click', handleTurnControlClick);
    stage.removeEventListener('pointerdown', handleAnyPointerInteraction, true);
    stage.removeEventListener('click', handleBackdropClick);
    document.removeEventListener('keydown', handleDocumentKeyDown);
    window.removeEventListener('cc-navigation', handleRouteChange);
    window.removeEventListener('pagehide', handleRouteChange);
    closeController?.dispose();
    closeController = null;
    ctaController?.dispose();
    ctaController = null;
    if (value === 'play' && !didLandAtOrigin) options.origin.discard();
    else options.origin.restoreNow();
    restoreEnvironment();
    stage.remove();
    if (activeJourneyCardOverlayModal === controller) activeJourneyCardOverlayModal = null;
  };

  const settle = (value: JourneyCardOverlayModalResult) => {
    if (settled) return;
    settled = true;
    cleanup(value);
    resolveResult(value);
  };

  const animateInteractiveFlip = async (targetFace: 'front' | 'back'): Promise<void> => {
    if (entering || closing || settled || flipping || targetFace === stableFace) return;
    flipping = true;
    stopSurfaceIdle();
    stage.classList.add('is-flipping');
    stage.classList.toggle('is-flipping-to-front', targetFace === 'front');
    stage.classList.toggle('is-flipping-to-back', targetFace === 'back');
    disposeSpatialMotion?.();
    disposeSpatialMotion = null;
    const from = currentAngle;
    const fromTranslateX = currentTranslateX;
    const canonical = targetFace === 'back' ? -180 : 0;
    const candidates = [canonical - 360, canonical, canonical + 360];
    const to = candidates.reduce((nearest, candidate) => (
      Math.abs(candidate - from) < Math.abs(nearest - from) ? candidate : nearest
    ));
    const direction = Math.sign(to - from) || (targetFace === 'back' ? -1 : 1);
    const duration = prefersReducedMotion ? 1 : JOURNEY_CARD_FLIP_SNAP_DURATION_MS;
    if (targetFace === 'back') {
      startBackContentEnter(Math.round(duration * 0.4));
    }
    if (typeof rotor.animate === 'function') {
      const animation = rotor.animate([
        { transform: `translate3d(${fromTranslateX}px, 0, 0) rotateY(${from}deg)` },
        { transform: `translate3d(${fromTranslateX * 0.36}px, 0, 0) rotateY(${from + (to - from) * 0.58}deg)`, offset: 0.48 },
        { transform: `translate3d(0, 0, 0) rotateY(${to + direction * 7}deg)`, offset: 0.82 },
        { transform: `translate3d(0, 0, 0) rotateY(${to}deg)` },
      ], { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      flipAnimation = animation;
      try { await animation.finished; } catch {}
      if (flipAnimation === animation) flipAnimation = null;
    }
    if (closing || settled) return;
    setRotorAngle(targetFace === 'back' ? -180 : 0);
    setStableFace(targetFace);
    if (targetFace === 'front') primeBackContentForEnter();
    flipping = false;
    stage.classList.remove('is-flipping', 'is-flipping-to-front', 'is-flipping-to-back', 'is-dragging');
    disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
    startSurfaceIdle();
    try { (window as any).triggerHapticImpact?.('light'); } catch {}
    scheduleIdleCoach();
  };

  const startEntry = async () => {
    const destination = readFrameGeometry();
    if (!destination) {
      setRotorAngle(-180);
      setStableFace('back');
      entering = false;
      stage.classList.remove('is-entering', 'is-spatial-card-entry', 'is-flipping-to-back');
      stage.classList.add('is-settled');
      startBackContentEnter();
      disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
      startSurfaceIdle();
      scheduleIdleCoach();
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
      durationMs: prefersReducedMotion ? 1 : JOURNEY_CARD_FLIP_ENTER_DURATION_MS,
      pathOffset: computeJourneyCardArcOffset,
      onProgress: (progress) => {
        const angle = prefersReducedMotion ? -180 : getJourneyCardFlightFlipAngle(progress, 'enter');
        setRotorAngle(angle);
        if (angle <= -90) startBackContentEnter();
        const revealProgress = Math.min(1, progress / 0.38);
        spatialShell.style.opacity = String(initialOpacity + (1 - initialOpacity) * revealProgress);
      },
    });
    await spatialFlight.result;
    spatialFlight = null;
    if (closing || settled) return;
    setRotorAngle(-180);
    backdrop.style.opacity = '1';
    setStableFace('back');
    entering = false;
    spatialShell.style.removeProperty('transform');
    spatialShell.style.removeProperty('opacity');
    spatialShell.style.removeProperty('will-change');
    stage.classList.remove('is-entering', 'is-spatial-card-entry', 'is-flipping-to-back');
    stage.classList.add('is-settled');
    startBackContentEnter();
    impactAnimation = impactShell.animate?.([
      { transform: 'scale(1)' },
      { transform: 'scale(1.045)', offset: 0.42 },
      { transform: 'scale(0.988)', offset: 0.72 },
      { transform: 'scale(1)' },
    ], { duration: prefersReducedMotion ? 1 : 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }) ?? null;
    disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
    startSurfaceIdle();
    scheduleIdleCoach();
    options.onCardEntrySettled?.();
    try { (window as any).triggerHapticImpact?.('medium'); } catch {}
  };

  const startReturn = async (play: boolean): Promise<void> => {
    const source = readFrameGeometry();
    if (!source) {
      if (play) {
        options.onPlayCardReturnStart?.();
        options.onPlayCardExitStart?.();
        options.origin.discard();
        options.onPlayCardExitComplete?.();
      } else options.origin.restoreNow();
      return;
    }
    const target = play ? options.origin.readLiveGeometry() : null;
    if (play) options.onPlayCardReturnStart?.();
    const totalDurationMs = play
      ? JOURNEY_CARD_PLAY_RETURN_DURATION_MS
      : JOURNEY_CARD_FLIP_DISMISS_DURATION_MS;
    const travelStartsAtMs = play ? JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS : 0;
    const travelDurationMs = play ? JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS : totalDurationMs;
    const landingAtMs = travelStartsAtMs + travelDurationMs;
    const exitAtMs = landingAtMs + JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS;
    let exitNotified = false;
    setRotorAngle(stableFace === 'back' ? -180 : 0);
    spatialFlight = startJourneyCardSpatialFlight({
      motionElement: spatialShell,
      baseGeometry: source,
      from: source,
      readTarget: () => target ?? options.origin.readLiveGeometry(),
      direction: 'return',
      durationMs: prefersReducedMotion ? 1 : totalDurationMs,
      pathOffset: play ? computeJourneyCardArcOffset : undefined,
      spatialProgress: play
        ? (rawProgress) => {
          const elapsedMs = rawProgress * totalDurationMs;
          return smoothstep((elapsedMs - travelStartsAtMs) / travelDurationMs);
        }
        : undefined,
      onProgress: (rawProgress) => {
        const elapsedMs = rawProgress * totalDurationMs;
        const travelProgress = play
          ? clamp01((elapsedMs - travelStartsAtMs) / travelDurationMs)
          : rawProgress;
        if (stableFace === 'back') {
          setRotorAngle(prefersReducedMotion ? -360 : getJourneyCardFlightFlipAngle(travelProgress, 'return'));
        }
        if (!play) return;
        if (!exitNotified && elapsedMs >= exitAtMs) {
          exitNotified = true;
          options.onPlayCardExitStart?.();
        }
        const launchHalfMs = JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS / 2;
        let scale = elapsedMs <= launchHalfMs
          ? 1 + 0.06 * (elapsedMs / Math.max(1, launchHalfMs))
          : elapsedMs < JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS
            ? 1.06 - 0.06 * ((elapsedMs - launchHalfMs) / Math.max(1, launchHalfMs))
            : 1;
        if (elapsedMs >= landingAtMs && elapsedMs < exitAtMs) {
          scale = 1 + 0.14 * smoothstep((elapsedMs - landingAtMs) / JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS);
        } else if (elapsedMs >= exitAtMs) {
          const p = clamp01((elapsedMs - exitAtMs) / JOURNEY_CARD_PLAY_LANDING_EXIT_DURATION_MS);
          const backIn = p * p * (((1.7 + 1) * p) - 1.7);
          scale = Math.max(0, 1.14 * (1 - backIn));
        }
        impactShell.style.transform = `scale(${scale})`;
        impactShell.style.opacity = elapsedMs >= totalDurationMs ? '0' : '1';
      },
    });
    const outcome = await spatialFlight.result;
    spatialFlight = null;
    if (play && !exitNotified) options.onPlayCardExitStart?.();
    if (play) {
      options.origin.discard();
      options.onPlayCardExitComplete?.();
    } else {
      const restored = options.origin.restoreNow();
      didLandAtOrigin = outcome === 'complete' && restored && options.origin.anchor.isConnected;
      if (restored) await waitForPaints(2);
    }
  };

  const beginClose = async (value: JourneyCardOverlayModalResult) => {
    if (closing || settled) return;
    if (entering && spatialFlight) {
      await spatialFlight.result;
      if (!settled) void beginClose(value);
      return;
    }
    closing = true;
    flipping = false;
    clearBackContentTimers();
    neutralizeExitMotionOwners();
    stopIdleCoach(false);
    flipAnimation?.cancel();
    flipAnimation = null;
    stage.classList.remove('is-flipping', 'is-flipping-to-front', 'is-flipping-to-back', 'is-dragging');
    stage.classList.add('is-flipping-to-front');
    stage.classList.add('is-exiting', 'is-backdrop-exiting');
    stage.style.pointerEvents = 'none';
    closeController?.element.setAttribute('aria-disabled', 'true');
    await Promise.all([
      ctaController?.exit() ?? Promise.resolve(),
      startReturn(value === 'play'),
    ]);
    settle(value);
  };

  function isInteractiveControl(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('button, a, input, select, textarea');
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || entering || closing || settled || flipping || activePointerId !== null) return;
    if (isInteractiveControl(event.target)) return;
    activePointerId = event.pointerId;
    dragStartX = dragLastX = event.clientX;
    dragLastTime = event.timeStamp;
    dragVelocityX = 0;
    dragMoved = false;
    dragStartAngle = stableFace === 'front' ? 0 : -180;
    dragCardWidth = Math.max(1, frame.getBoundingClientRect().width);
    dragDirection = 1;
    stopSurfaceIdle();
    disposeSpatialMotion?.();
    disposeSpatialMotion = null;
    stage.classList.add('is-dragging');
    try { rotor.setPointerCapture(event.pointerId); } catch {}
  }

  function handleAnyPointerInteraction(): void {
    stopIdleCoach();
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return;
    const deltaX = event.clientX - dragStartX;
    const elapsed = event.timeStamp - dragLastTime;
    if (elapsed > 0) {
      const sample = (event.clientX - dragLastX) / elapsed;
      dragVelocityX = dragVelocityX * 0.35 + sample * 0.65;
    }
    dragLastX = event.clientX;
    dragLastTime = event.timeStamp;
    dragMoved ||= Math.abs(deltaX) > JOURNEY_CARD_FLIP_TAP_SLOP_PX;
    if (!dragMoved) return;
    event.preventDefault();
    dragDirection = deltaX >= 0 ? 1 : -1;
    const commitDistance = Math.max(1, dragCardWidth * JOURNEY_CARD_FLIP_DRAG_COMMIT_RATIO);
    const previewProgress = clamp01(Math.abs(deltaX) / commitDistance);
    const turn = previewProgress * JOURNEY_CARD_FLIP_DRAG_PREVIEW_MAX_DEG;
    const translateX = Math.max(-44, Math.min(44, deltaX * 0.35));
    setRotorPose(dragStartAngle + dragDirection * turn, translateX);
    if (Math.abs(deltaX) >= commitDistance) {
      activePointerId = null;
      try { rotor.releasePointerCapture(event.pointerId); } catch {}
      stage.classList.remove('is-dragging');
      event.stopPropagation();
      const targetFace = stableFace === 'front' ? 'back' : 'front';
      void animateInteractiveFlip(targetFace);
    }
  }

  function finishPointer(event: PointerEvent, allowCommit: boolean): void {
    if (event.pointerId !== activePointerId) return;
    const deltaX = event.clientX - dragStartX;
    const moved = dragMoved;
    activePointerId = null;
    try { rotor.releasePointerCapture(event.pointerId); } catch {}
    stage.classList.remove('is-dragging');
    if (!allowCommit) {
      setRotorAngle(stableFace === 'front' ? 0 : -180);
      disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
      startSurfaceIdle();
      scheduleIdleCoach();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!moved || shouldCommitJourneyCardFlipDrag(deltaX, dragVelocityX, dragCardWidth)) {
      const targetFace = stableFace === 'front' ? 'back' : 'front';
      void animateInteractiveFlip(targetFace);
      return;
    }
    setRotorAngle(stableFace === 'front' ? 0 : -180);
    disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
    startSurfaceIdle();
    scheduleIdleCoach();
  }

  function handlePointerUp(event: PointerEvent): void {
    finishPointer(event, true);
  }

  function handlePointerCancel(event: PointerEvent): void {
    finishPointer(event, false);
  }

  function handleRotorKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target !== front) return;
    stopIdleCoach();
    event.preventDefault();
    void animateInteractiveFlip(stableFace === 'front' ? 'back' : 'front');
  }

  function handleTurnControlClick(event: MouseEvent): void {
    stopIdleCoach();
    event.preventDefault();
    event.stopPropagation();
    void animateInteractiveFlip('front');
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === stage || event.target === backdrop) void beginClose('dismiss');
  }

  function handleDocumentKeyDown(event: KeyboardEvent): void {
    stopIdleCoach();
    if (event.key !== 'Escape') return;
    event.preventDefault();
    void beginClose('dismiss');
  }

  function handleRouteChange(): void {
    if (!settled) settle('dismiss');
  }

  rotor.addEventListener('pointerdown', handlePointerDown);
  rotor.addEventListener('pointermove', handlePointerMove);
  rotor.addEventListener('pointerup', handlePointerUp);
  rotor.addEventListener('pointercancel', handlePointerCancel);
  rotor.addEventListener('keydown', handleRotorKeyDown);
  turnControl.addEventListener('click', handleTurnControlClick);
  stage.addEventListener('pointerdown', handleAnyPointerInteraction, true);
  stage.addEventListener('click', handleBackdropClick);
  document.addEventListener('keydown', handleDocumentKeyDown);
  window.addEventListener('cc-navigation', handleRouteChange);
  window.addEventListener('pagehide', handleRouteChange);

  closeController = mountGameplaySheetClose(backShell, () => {
    void beginClose('dismiss');
  }, 'Close stage details');
  ctaController = registerCta(cta, {
    variant: 'primary',
    initialState: 'hidden',
    onActivate: () => {
      try { (window as any).triggerHapticSelection?.(); } catch {}
      void beginClose('play');
    },
  });
  primeBackContentForEnter();

  setStableFace('front');
  setRotorAngle(0);
  document.body.appendChild(stage);
  stage.classList.add('is-entering', 'is-spatial-card-entry', 'is-flipping-to-back');
  void startEntry();
  requestAnimationFrame(() => {
    if (settled) return;
    stage.classList.add('is-visible');
    backdrop.style.opacity = '1';
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
      if (!settled) settle('dismiss');
    },
  };
  activeJourneyCardOverlayModal = controller;
  return controller;
}
