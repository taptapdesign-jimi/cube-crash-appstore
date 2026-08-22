import { boardStatsService } from '../services/board-stats-service.js';
import { registerCta, type CtaController } from './cta-system.js';
import {
  mountGameplaySheetClose,
  type GameplaySheetCloseController,
} from './gameplay-sheet-close.js';
import {
  captureJourneyCardGeometry,
  computeJourneyCardArcOffset,
  primeJourneyCardSpatialFlight,
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
import { formatJourneyWorldStageNumber } from './journey-world-stage.js';
import { getIosResistedModalVerticalDelta } from './modal-vertical-drag-dismiss.js';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

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
  openProfileStartedAt?: number;
  openProfileManagerMarks?: Readonly<Record<string, number>>;
  onCardEntrySettled?: () => void;
  onPerformancePhase?: (phase: string) => void;
  onDismissCardLanded?: () => void;
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

export const JOURNEY_CARD_FLIP_ENTER_DURATION_MS = 520;
export const JOURNEY_CARD_SHADOW_EARLY_REVEAL_MS = 200;
export const JOURNEY_CARD_FLIP_DISMISS_DURATION_MS = JOURNEY_CARD_FLIP_ENTER_DURATION_MS;
export const JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS = 100;
export const JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS = 500;
export const JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS = 120;
export const JOURNEY_CARD_PLAY_LANDING_EXIT_DURATION_MS = 400;
export const JOURNEY_CARD_PLAY_RETURN_DURATION_MS = 1120;
export const JOURNEY_CARD_FLIP_SNAP_DURATION_MS = 200;
export const JOURNEY_CARD_FLIP_RECOIL_DURATION_MS = 260;
export const JOURNEY_CARD_FLIP_RECOIL_EASE = 'cubic-bezier(0.45, 0, 0.55, 1)';
export const JOURNEY_CARD_FLIP_FINAL_SETTLE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const JOURNEY_CARD_FLIP_RECOIL_STOPS = Object.freeze([
  { offset: 0.38, degrees: 12, easing: JOURNEY_CARD_FLIP_FINAL_SETTLE_EASE },
]);
export const JOURNEY_CARD_FLIP_DRAG_HANDOFF_VIEWPORT_RATIO = 0.4;
export const JOURNEY_CARD_FLIP_DRAG_RELEASE_VIEWPORT_RATIO = 0.1;
export const JOURNEY_CARD_FLIP_DRAG_SCRUB_MAX_DEG = 72;
export const JOURNEY_CARD_FLIP_IDLE_COACH_DELAY_MS = 5000;
export const JOURNEY_CARD_FLIP_IDLE_COACH_DURATION_MS = 2100;
export const JOURNEY_CARD_FLIP_STATS_ENTER_TIME_SCALE = 0.5;
export const JOURNEY_CARD_DISMISS_DRAG_COMMIT_RATIO = 0.22;
export const JOURNEY_CARD_DISMISS_DRAG_MIN_PX = 88;
export const JOURNEY_CARD_DISMISS_DRAG_MAX_PX = 140;
const JOURNEY_CARD_FLIP_TAP_SLOP_PX = 7;

export function getJourneyCardDismissDragDistance(cardHeight: number): number {
  const proportionalDistance = Math.max(1, cardHeight) * JOURNEY_CARD_DISMISS_DRAG_COMMIT_RATIO;
  return Math.min(
    JOURNEY_CARD_DISMISS_DRAG_MAX_PX,
    Math.max(JOURNEY_CARD_DISMISS_DRAG_MIN_PX, proportionalDistance),
  );
}

export function isJourneyCardVerticalDismissGesture(deltaX: number, deltaY: number): boolean {
  const verticalDistance = Math.abs(deltaY);
  return verticalDistance > JOURNEY_CARD_FLIP_TAP_SLOP_PX
    && verticalDistance > Math.abs(deltaX) * 1.15;
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
 * Entry and return are the same physical turn in opposite spatial directions.
 * Both keep the source face readable for the first third of the flight and
 * cross the physical edge at exactly 50%.
 */
export function getJourneyCardFlightFlipAngle(
  progress: number,
  direction: 'enter' | 'return',
): number {
  const turnStartsAt = 0.32;
  const turn = smoothstep((clamp01(progress) - turnStartsAt) / 0.36);
  const signedTurn = turn === 0 ? 0 : turn * -180;
  return direction === 'enter' ? signedTurn : -180 - signedTurn;
}

export function getJourneyCardFlipEdgeProgress(fromAngle: number, toAngle: number): number {
  const distance = toAngle - fromAngle;
  if (!Number.isFinite(distance) || Math.abs(distance) < 0.001) return 0.5;
  const direction = Math.sign(distance);
  const edge = direction < 0
    ? Math.floor((fromAngle + 90) / 180) * 180 - 90
    : Math.ceil((fromAngle - 90) / 180) * 180 + 90;
  return clamp01((edge - fromAngle) / distance);
}

export function getJourneyCardFlipFaceForAngle(angle: number): 'front' | 'back' {
  if (!Number.isFinite(angle)) return 'front';
  const normalized = ((angle % 360) + 360) % 360;
  return normalized > 90 && normalized < 270 ? 'back' : 'front';
}

export function getJourneyCardDragFlipAngle(
  stableAngle: number,
  deltaX: number,
  viewportWidth: number,
): number {
  const handoffDistance = Math.max(
    1,
    Math.abs(viewportWidth) * JOURNEY_CARD_FLIP_DRAG_HANDOFF_VIEWPORT_RATIO,
  );
  const progress = clamp01(Math.abs(deltaX) / handoffDistance);
  const direction = Math.sign(deltaX);
  return stableAngle + direction * JOURNEY_CARD_FLIP_DRAG_SCRUB_MAX_DEG * progress;
}

export function shouldCommitJourneyCardReleasedDrag(
  deltaX: number,
  viewportWidth: number,
  allowedDirection: -1 | 0 | 1 = 0,
): boolean {
  const direction = Math.sign(deltaX) as -1 | 0 | 1;
  const releaseCommitDistance = Math.max(
    1,
    Math.abs(viewportWidth) * JOURNEY_CARD_FLIP_DRAG_RELEASE_VIEWPORT_RATIO,
  );
  return Math.abs(deltaX) >= releaseCommitDistance
    && (allowedDirection === 0 || direction === allowedDirection);
}

export function buildJourneyCardOverlayModalViewModel(
  boardId: number,
  stats: { highScore: number; longestCombo: number },
  hasSavedState: boolean,
): JourneyCardOverlayModalViewModel {
  const highScore = Math.max(0, Math.trunc(Number.isFinite(stats.highScore) ? stats.highScore : 0));
  const longestCombo = Math.max(0, Math.trunc(Number.isFinite(stats.longestCombo) ? stats.longestCombo : 0));
  return {
    stageLabel: `Stage ${formatJourneyWorldStageNumber(boardId)}`,
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

function waitForModalImageReady(image: HTMLImageElement, timeoutMs = 800): Promise<void> {
  if (!image.src) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      image.removeEventListener('load', onReady);
      image.removeEventListener('error', onReady);
      resolve();
    };
    const onReady = () => {
      if (typeof image.decode === 'function') void image.decode().catch(() => undefined).then(finish);
      else finish();
    };
    const timeoutId = window.setTimeout(finish, timeoutMs);
    if (image.complete) {
      onReady();
      return;
    }
    image.addEventListener('load', onReady, { once: true });
    image.addEventListener('error', onReady, { once: true });
  });
}

export function presentJourneyCardOverlayModal(
  options: JourneyCardOverlayModalOptions,
): JourneyCardOverlayModalController {
  const openProfileStartedAt = options.openProfileStartedAt ?? performance.now();
  const openProfileMarks: Record<string, number> = {
    ...(options.openProfileManagerMarks ?? {}),
  };
  const openProfileLongFrames: Array<{ phase: string; frameMs: number }> = [];
  let openProfilePhase = 'modal-call';
  let openProfilePreviousFrameAt = openProfileStartedAt;
  let openProfileFrameId = 0;
  let openProfileWorstFrameMs = 0;
  let openProfileWorstFramePhase = openProfilePhase;
  let openProfileOver20 = 0;
  let openProfileOver34 = 0;
  let openProfileOver50 = 0;
  let openProfileSettlePaintsRemaining: number | null = null;
  let openProfileEmitted = false;
  const markOpenProfile = (phase: string): void => {
    openProfilePhase = phase;
    openProfileMarks[phase] = Number((performance.now() - openProfileStartedAt).toFixed(2));
  };
  const emitOpenProfile = (result: 'entry-stable' | 'disposed-before-stable'): void => {
    if (openProfileEmitted) return;
    openProfileEmitted = true;
    if (openProfileFrameId !== 0) {
      cancelAnimationFrame(openProfileFrameId);
      openProfileFrameId = 0;
    }
    emitNativeConsoleDiagnostic('[CC_JOURNEY_CARD_OPEN]', 'summary', {
      boardId: options.boardId,
      result,
      totalMs: Number((performance.now() - openProfileStartedAt).toFixed(2)),
      marks: openProfileMarks,
      worstFrameMs: Number(openProfileWorstFrameMs.toFixed(2)),
      worstFramePhase: openProfileWorstFramePhase,
      over20: openProfileOver20,
      over34: openProfileOver34,
      over50: openProfileOver50,
      longFrames: openProfileLongFrames,
    });
  };
  const sampleOpenProfileFrame = (now: number): void => {
    openProfileFrameId = 0;
    if (openProfileEmitted) return;
    const frameMs = Math.max(0, now - openProfilePreviousFrameAt);
    openProfilePreviousFrameAt = now;
    if (frameMs > openProfileWorstFrameMs) {
      openProfileWorstFrameMs = frameMs;
      openProfileWorstFramePhase = openProfilePhase;
    }
    if (frameMs > 20) {
      openProfileOver20 += 1;
      if (openProfileLongFrames.length < 8) {
        openProfileLongFrames.push({
          phase: openProfilePhase,
          frameMs: Number(frameMs.toFixed(2)),
        });
      }
    }
    if (frameMs > 34) openProfileOver34 += 1;
    if (frameMs > 50) openProfileOver50 += 1;
    if (openProfileSettlePaintsRemaining !== null) {
      openProfileSettlePaintsRemaining -= 1;
      if (openProfileSettlePaintsRemaining <= 0) {
        markOpenProfile('entry-stable');
        emitOpenProfile('entry-stable');
        return;
      }
    }
    openProfileFrameId = requestAnimationFrame(sampleOpenProfileFrame);
  };
  openProfileFrameId = requestAnimationFrame(sampleOpenProfileFrame);
  markOpenProfile('modal-call');
  activeJourneyCardOverlayModal?.dispose();
  markOpenProfile('prior-modal-disposed');

  const viewModel = buildJourneyCardOverlayModalViewModel(
    options.boardId,
    boardStatsService.getBoardStats(options.boardId),
    options.hasSavedState,
  );
  markOpenProfile('view-model-built');
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
  markOpenProfile('template-built');

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
  markOpenProfile('owners-resolved');
  const backContentElements = Array.from(
    stage.querySelectorAll<HTMLElement>('.journey-card-flip-stats > .journey-card-flip-stat, .journey-card-flip-stats > .journey-card-flip-divider'),
  );
  options.origin.mountInto(cardHost);
  markOpenProfile('origin-mounted');
  stage.classList.toggle(
    'has-new-ribbon',
    cardHost.querySelector('.journey-card-ribbon') !== null,
  );

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
  markOpenProfile('environment-locked');

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
  let flipRecoilAnimation: Animation | null = null;
  let impactAnimation: Animation | null = null;
  let dragPreviewSettleAnimation: Animation | null = null;
  let exitNeutralAnimations: Animation[] = [];
  let idleCoachTimer = 0;
  let idleCoachRotorAnimation: Animation | null = null;
  let idleCoachHandAnimation: Animation | null = null;
  let idleCoachImpactAnimation: Animation | null = null;
  let idleCoachGeneration = 0;
  let nextIdleCoachMode: 'drag' | 'tap' = 'drag';
  let backContentEnterTimer = 0;
  let backContentRestoreTimer = 0;
  let flipEdgeRaf = 0;
  let backContentEnterScheduled = false;
  let disposeSpatialMotion: (() => void) | null = null;
  let closeController: GameplaySheetCloseController | null = null;
  let ctaController: CtaController | null = null;
  let activePointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragLatestX = 0;
  let dragStartAngle = 0;
  let dragFlipProgress = 0;
  let dragFlipCommitted = false;
  let dragAllowedDirection: -1 | 0 | 1 = 0;
  let dragMoved = false;
  let dragCardWidth = 1;
  let dragCardHeight = 1;
  let dragCardRect: DOMRect | null = null;
  let dragViewportHeight = 0;
  let dragViewportWidth = 0;
  let dragHorizontalMinX = 0;
  let dragHorizontalMaxX = 0;
  let dragAxis: 'horizontal' | 'vertical' | null = null;
  let dismissDragReleaseY = 0;
  let dismissDragReleaseScale = 1;

  const setPaintFaceForAngle = (angle: number) => {
    const normalized = ((angle % 360) + 360) % 360;
    const edgeDistance = Math.abs(normalized - 90) < 0.001 || Math.abs(normalized - 270) < 0.001;
    if (edgeDistance) return;
    stage.dataset.paintFace = normalized > 90 && normalized < 270 ? 'back' : 'front';
  };

  const stopSurfaceIdle = () => stage.classList.remove('is-surface-idle');
  const startSurfaceIdle = () => {
    if (!prefersReducedMotion && !entering && !closing && !settled && !flipping && activePointerId === null) {
      stage.classList.add('is-surface-idle');
    }
  };

  const neutralizeExitMotionOwners = (durationMs: number) => {
    const idleTransform = window.getComputedStyle(idleShell).transform || 'none';
    const gyroStyle = window.getComputedStyle(gyroShell);
    const gyroTranslate = gyroStyle.translate || 'none';
    const gyroTransform = gyroStyle.transform || 'none';
    const safeDurationMs = Math.max(1, Math.round(durationMs));
    stage.style.setProperty('--journey-card-exit-neutral-duration', `${safeDurationMs}ms`);
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
      ], { duration: safeDurationMs, easing: 'linear', fill: 'forwards' }),
      gyroShell.animate([
        { translate: gyroTranslate, transform: gyroTransform },
        { translate: 'none', transform: 'none' },
      ], { duration: safeDurationMs, easing: 'linear', fill: 'forwards' }),
    ];
  };

  const setRotorAngle = (angle: number) => {
    currentAngle = angle;
    rotor.style.transform = `rotateY(${angle}deg)`;
    setPaintFaceForAngle(angle);
  };

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
    if (flipEdgeRaf !== 0) {
      cancelAnimationFrame(flipEdgeRaf);
      flipEdgeRaf = 0;
    }
  };

  const restoreBackContentVisible = () => {
    backContentElements.forEach((element) => {
      element.classList.remove('is-content-entering');
      element.classList.remove('is-content-exiting');
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
      element.classList.remove('is-content-exiting');
      element.style.removeProperty('animation-delay');
      element.style.opacity = '0';
      element.style.visibility = 'hidden';
      element.style.transform = 'scale(0)';
      element.style.willChange = 'transform, opacity';
    });
    ctaController?.prime('hidden');
  };

  const startBackContentExit = (physicalEdgeAtMs: number) => {
    const totalMs = Math.ceil(
      getDetailModalStatsEnterTotalDuration(backContentElements.length)
      * JOURNEY_CARD_FLIP_STATS_ENTER_TIME_SCALE
      * 1000,
    );
    const delayMs = Math.max(0, physicalEdgeAtMs - totalMs);
    backContentEnterTimer = window.setTimeout(() => {
      backContentEnterTimer = 0;
      if (!closing || settled) return;
      const delays = createDetailModalStatsEnterDelays(backContentElements.length)
        .map((delay) => delay * JOURNEY_CARD_FLIP_STATS_ENTER_TIME_SCALE)
        .reverse();
      backContentElements.forEach((element, index) => {
        element.classList.remove('is-content-entering');
        element.style.animationDelay = `${delays[index] ?? 0}s`;
        element.classList.add('is-content-exiting');
      });
    }, delayMs);
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
    flipRecoilAnimation?.cancel();
    flipRecoilAnimation = null;
    impactAnimation?.cancel();
    impactAnimation = null;
    dragPreviewSettleAnimation?.cancel();
    dragPreviewSettleAnimation = null;
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
    if (value === 'dismiss') options.onPerformancePhase?.('dismiss-cleanup-start');
    if (!openProfileEmitted) emitOpenProfile('disposed-before-stable');
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
    if (value === 'dismiss') options.onPerformancePhase?.('dismiss-cleanup-complete');
  };

  const settle = (value: JourneyCardOverlayModalResult) => {
    if (settled) return;
    settled = true;
    cleanup(value);
    resolveResult(value);
  };

  const animateInteractiveFlip = async (
    targetFace: 'front' | 'back',
    preferredDirection?: -1 | 1,
  ): Promise<void> => {
    if (entering || closing || settled || flipping || impactAnimation || dragPreviewSettleAnimation) return;
    if (flipRecoilAnimation) {
      flipRecoilAnimation.cancel();
      flipRecoilAnimation = null;
      setRotorAngle(stableRotorAngle());
    }
    flipping = true;
    stopSurfaceIdle();
    stage.classList.add('is-flipping');
    stage.classList.toggle('is-flipping-to-front', targetFace === 'front');
    stage.classList.toggle('is-flipping-to-back', targetFace === 'back');
    disposeSpatialMotion?.();
    disposeSpatialMotion = null;
    const from = currentAngle;
    const canonical = targetFace === 'back' ? -180 : 0;
    const candidates = [canonical - 360, canonical, canonical + 360];
    const directionalCandidates = preferredDirection === undefined
      ? candidates
      : candidates.filter((candidate) => Math.sign(candidate - from) === preferredDirection);
    const candidatesForTurn = directionalCandidates.length > 0 ? directionalCandidates : candidates;
    const to = candidatesForTurn.reduce((nearest, candidate) => (
      Math.abs(candidate - from) < Math.abs(nearest - from) ? candidate : nearest
    ));
    const direction = Math.sign(to - from) || (targetFace === 'back' ? -1 : 1);
    const duration = prefersReducedMotion ? 1 : JOURNEY_CARD_FLIP_SNAP_DURATION_MS;
    const edgeProgress = getJourneyCardFlipEdgeProgress(from, to);
    const crossesFaceEdge = getJourneyCardFlipFaceForAngle(from) !== targetFace;
    if (typeof rotor.animate === 'function') {
      const keyframes: Keyframe[] = [
        { transform: `rotateY(${from}deg)` },
      ];
      if (crossesFaceEdge && edgeProgress < 1) {
        keyframes.push({
          transform: `rotateY(${from + (to - from) * edgeProgress}deg)`,
          offset: edgeProgress,
        });
      }
      keyframes.push({ transform: `rotateY(${to}deg)` });
      const animation = rotor.animate(keyframes, { duration, easing: 'linear' });
      flipAnimation = animation;
      if (crossesFaceEdge) {
        const watchPhysicalEdge = () => {
          if (closing || settled || flipAnimation !== animation) {
            flipEdgeRaf = 0;
            return;
          }
          const elapsed = Number(animation.currentTime ?? 0);
          if (elapsed / Math.max(1, duration) >= edgeProgress) {
            stage.dataset.paintFace = targetFace;
            flipEdgeRaf = 0;
            return;
          }
          flipEdgeRaf = requestAnimationFrame(watchPhysicalEdge);
        };
        flipEdgeRaf = requestAnimationFrame(watchPhysicalEdge);
      }
      try { await animation.finished; } catch {}
      if (flipAnimation === animation) flipAnimation = null;
    }
    if (closing || settled) return;
    setRotorAngle(targetFace === 'back' ? -180 : 0);
    setStableFace(targetFace);
    flipping = false;
    stage.classList.remove('is-flipping', 'is-flipping-to-front', 'is-flipping-to-back');
    if (activePointerId === null) stage.classList.remove('is-dragging');
    if (!prefersReducedMotion && typeof rotor.animate === 'function') {
      const recoil = rotor.animate([
        { transform: `rotateY(${to}deg)`, easing: JOURNEY_CARD_FLIP_RECOIL_EASE },
        ...JOURNEY_CARD_FLIP_RECOIL_STOPS.map((stop): Keyframe => ({
          transform: `rotateY(${to + direction * stop.degrees}deg)`,
          offset: stop.offset,
          easing: stop.easing,
        })),
        { transform: `rotateY(${to}deg)` },
      ], { duration: JOURNEY_CARD_FLIP_RECOIL_DURATION_MS, easing: 'linear' });
      flipRecoilAnimation = recoil;
      void recoil.finished.catch(() => undefined).then(() => {
        if (flipRecoilAnimation !== recoil || closing || settled) return;
        flipRecoilAnimation = null;
        recoil.cancel();
        setRotorAngle(stableRotorAngle());
        if (activePointerId === null && !flipping && !impactAnimation && !dragPreviewSettleAnimation) {
          disposeSpatialMotion?.();
          disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
          startSurfaceIdle();
          scheduleIdleCoach();
        }
      });
    } else if (activePointerId === null && !impactAnimation && !dragPreviewSettleAnimation) {
      disposeSpatialMotion?.();
      disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
      startSurfaceIdle();
      scheduleIdleCoach();
    }
    try { (window as any).triggerHapticImpact?.('light'); } catch {}
  };

  const startEntry = async (preparedDestination?: JourneyCardGeometry | null) => {
    markOpenProfile('geometry-read-start');
    const destination = preparedDestination === undefined
      ? readFrameGeometry()
      : preparedDestination;
    markOpenProfile('geometry-read-complete');
    if (!destination) {
      setRotorAngle(-180);
      setStableFace('back');
      entering = false;
      stage.classList.remove('is-entering', 'is-spatial-card-entry', 'is-flipping-to-back');
      stage.classList.remove('is-shadow-ready');
      stage.classList.add('is-settled');
      startBackContentEnter();
      disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
      markOpenProfile('modal-gyro-mounted');
      startSurfaceIdle();
      scheduleIdleCoach();
      openProfileSettlePaintsRemaining = 2;
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
        const flightPhase = progress < 0.32
          ? 'flight-front-static'
          : progress < 0.5
            ? 'flight-front-turn'
            : progress < 0.68
              ? 'flight-back-turn'
              : 'flight-back-settle';
        if (openProfilePhase !== flightPhase) markOpenProfile(flightPhase);
        const shadowRevealProgress = 1 - (
          JOURNEY_CARD_SHADOW_EARLY_REVEAL_MS / JOURNEY_CARD_FLIP_ENTER_DURATION_MS
        );
        if (!prefersReducedMotion && progress >= shadowRevealProgress) {
          stage.classList.add('is-shadow-ready');
        }
        const angle = prefersReducedMotion ? -180 : getJourneyCardFlightFlipAngle(progress, 'enter');
        setRotorAngle(angle);
        if (angle <= -90) startBackContentEnter();
        const revealProgress = Math.min(1, progress / 0.38);
        spatialShell.style.opacity = String(initialOpacity + (1 - initialOpacity) * revealProgress);
      },
      transformOriginPrimed: preparedDestination !== undefined && preparedDestination !== null,
    });
    markOpenProfile('flight-started');
    await spatialFlight.result;
    markOpenProfile('flight-complete');
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
    stage.classList.remove('is-shadow-ready');
    stage.classList.add('is-settled');
    startBackContentEnter();
    disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
    markOpenProfile('modal-gyro-mounted');
    startSurfaceIdle();
    scheduleIdleCoach();
    options.onCardEntrySettled?.();
    openProfileSettlePaintsRemaining = 2;
    try { (window as any).triggerHapticImpact?.('medium'); } catch {}
  };

  const startReturn = async (play: boolean): Promise<void> => {
    if (!play) options.onPerformancePhase?.('dismiss-geometry-read-start');
    const source = readFrameGeometry();
    if (!play) options.onPerformancePhase?.('dismiss-geometry-read-complete');
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
    if (!play) options.onPerformancePhase?.('dismiss-return-flight-start');
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
          setRotorAngle(prefersReducedMotion ? 0 : getJourneyCardFlightFlipAngle(travelProgress, 'return'));
        }
        if (!play) {
          // Compose the release pose into the spatial return and settle it only
          // while the card is already travelling toward its Unit.
          const remaining = 1 - smoothstep(rawProgress);
          const scale = 1 - (1 - dismissDragReleaseScale) * remaining;
          impactShell.style.transform = `translate3d(0, ${(dismissDragReleaseY * remaining).toFixed(2)}px, 0) scale(${scale})`;
          return;
        }
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
    if (!play) options.onPerformancePhase?.('dismiss-return-flight-complete');
    spatialFlight = null;
    if (play && !exitNotified) options.onPlayCardExitStart?.();
    if (play) {
      options.origin.discard();
      options.onPlayCardExitComplete?.();
    } else {
      const restored = options.origin.restoreNow();
      options.onPerformancePhase?.('dismiss-origin-restored');
      didLandAtOrigin = outcome === 'complete' && restored && options.origin.anchor.isConnected;
      if (restored) {
        await waitForPaints(2);
        options.onPerformancePhase?.('dismiss-origin-stable-paints');
        if (didLandAtOrigin) options.onDismissCardLanded?.();
      }
    }
  };

  let closeRequestProfiled = false;
  const beginClose = async (value: JourneyCardOverlayModalResult) => {
    if (!closeRequestProfiled) {
      closeRequestProfiled = true;
      options.onPerformancePhase?.(`${value}-requested`);
    }
    if (closing || settled) return;
    if (entering && spatialFlight) {
      await spatialFlight.result;
      if (!settled) void beginClose(value);
      return;
    }
    if (flipping && flipAnimation) {
      const activeFlip = flipAnimation;
      try { await activeFlip.finished; } catch {}
      if (!settled) void beginClose(value);
      return;
    }
    if (impactAnimation || dragPreviewSettleAnimation) {
      const activeImpactSettle = impactAnimation;
      const activePreviewSettle = dragPreviewSettleAnimation;
      await Promise.allSettled([
        activeImpactSettle?.finished ?? Promise.resolve(),
        activePreviewSettle?.finished ?? Promise.resolve(),
      ]);
      if (!settled) void beginClose(value);
      return;
    }
    closing = true;
    options.onPerformancePhase?.(`${value}-close-owned`);
    flipping = false;
    clearBackContentTimers();
    const exitNeutralDurationMs = value === 'play'
      ? JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS + JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS
      : JOURNEY_CARD_FLIP_DISMISS_DURATION_MS;
    neutralizeExitMotionOwners(prefersReducedMotion ? 1 : exitNeutralDurationMs);
    stopIdleCoach(false);
    flipAnimation?.cancel();
    flipAnimation = null;
    flipRecoilAnimation?.cancel();
    flipRecoilAnimation = null;
    setRotorAngle(stableRotorAngle());
    if (value === 'dismiss') options.onPerformancePhase?.('dismiss-style-snapshot-start');
    const visibleRotorTransform = window.getComputedStyle(rotor).transform || rotor.style.transform;
    const visibleImpactTransform = window.getComputedStyle(impactShell).transform || impactShell.style.transform;
    const visibleImpactTranslate = window.getComputedStyle(impactShell).translate || impactShell.style.translate;
    if (value === 'dismiss') options.onPerformancePhase?.('dismiss-style-snapshot-complete');
    impactAnimation?.cancel();
    impactAnimation = null;
    dragPreviewSettleAnimation?.cancel();
    dragPreviewSettleAnimation = null;
    rotor.style.transform = visibleRotorTransform;
    impactShell.style.transform = visibleImpactTransform;
    impactShell.style.translate = visibleImpactTranslate;
    stage.classList.remove('is-flipping', 'is-flipping-to-front', 'is-flipping-to-back', 'is-dragging');
    stage.classList.add('is-flipping-to-front');
    stage.classList.add('is-exiting', 'is-backdrop-exiting');
    const returnEdgeAtMs = value === 'play'
      ? JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS + JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS / 2
      : JOURNEY_CARD_FLIP_DISMISS_DURATION_MS / 2;
    startBackContentExit(prefersReducedMotion ? 0 : returnEdgeAtMs);
    stage.style.pointerEvents = 'none';
    closeController?.element.setAttribute('aria-disabled', 'true');
    if (value === 'dismiss') options.onPerformancePhase?.('dismiss-return-and-cta-start');
    await Promise.all([
      ctaController?.exit() ?? Promise.resolve(),
      startReturn(value === 'play'),
    ]);
    if (value === 'dismiss') options.onPerformancePhase?.('dismiss-return-and-cta-complete');
    settle(value);
    if (value === 'dismiss') options.onPerformancePhase?.('dismiss-settled');
  };

  function isInteractiveControl(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('button, a, input, select, textarea');
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || entering || closing || settled || flipping || impactAnimation || dragPreviewSettleAnimation || activePointerId !== null) return;
    if (isInteractiveControl(event.target)) return;
    flipRecoilAnimation?.cancel();
    flipRecoilAnimation = null;
    setRotorAngle(stableRotorAngle());
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragLatestX = event.clientX;
    dragStartAngle = stableRotorAngle();
    dragFlipProgress = 0;
    dragFlipCommitted = false;
    dragAllowedDirection = 0;
    dragMoved = false;
    dragCardRect = frame.getBoundingClientRect();
    dragCardWidth = Math.max(1, dragCardRect.width);
    dragCardHeight = Math.max(1, dragCardRect.height);
    dragViewportHeight = window.innerHeight;
    dragViewportWidth = window.innerWidth;
    const horizontalSafeInset = 8;
    dragHorizontalMinX = -Math.max(
      0,
      Math.min(4, dragCardRect.left - horizontalSafeInset),
    );
    dragHorizontalMaxX = Math.max(
      0,
      Math.min(4, dragViewportWidth - horizontalSafeInset - dragCardRect.right),
    );
    dragAxis = null;
    dismissDragReleaseY = 0;
    dismissDragReleaseScale = 1;
    impactAnimation?.cancel();
    impactAnimation = null;
    dragPreviewSettleAnimation?.cancel();
    dragPreviewSettleAnimation = null;
    impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
    impactShell.style.translate = 'none';
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
    dragLatestX = event.clientX;
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;
    dragMoved ||= Math.max(Math.abs(deltaX), Math.abs(deltaY)) > JOURNEY_CARD_FLIP_TAP_SLOP_PX;
    if (!dragMoved) return;
    event.preventDefault();
    if (dragAxis === null) {
      dragAxis = Math.abs(deltaY) > Math.abs(deltaX) * 1.15 ? 'vertical' : 'horizontal';
    }
    if (dragAxis === 'vertical') {
      const verticalDistance = Math.abs(deltaY);
      const commitDistance = getJourneyCardDismissDragDistance(dragCardHeight);
      const previewProgress = clamp01(verticalDistance / commitDistance);
      const boundedDeltaY = dragCardRect
        ? getIosResistedModalVerticalDelta(deltaY, dragCardRect, dragViewportHeight)
        : deltaY;
      // Vertical dismiss is release-owned: keep following the live pointer even
      // after it crosses the commit distance. Returning near the origin before
      // pointerup therefore cancels the close and runs the normal snapback.
      dismissDragReleaseY = boundedDeltaY;
      dismissDragReleaseScale = 1 - previewProgress * 0.035;
      impactShell.style.transform = `translate3d(0, ${boundedDeltaY}px, 0) scale(${dismissDragReleaseScale})`;
      return;
    }
    const translateX = Math.max(
      dragHorizontalMinX,
      Math.min(dragHorizontalMaxX, deltaX * 0.12),
    );
    impactShell.style.translate = `${translateX.toFixed(2)}px 0`;
    if (dragFlipCommitted) return;
    const direction = Math.sign(deltaX) as -1 | 0 | 1;
    if (dragAllowedDirection !== 0 && direction !== 0 && direction !== dragAllowedDirection) {
      dragFlipProgress = 0;
      setRotorAngle(dragStartAngle);
      return;
    }
    const handoffDistance = Math.max(
      1,
      dragViewportWidth * JOURNEY_CARD_FLIP_DRAG_HANDOFF_VIEWPORT_RATIO,
    );
    dragFlipProgress = clamp01(Math.abs(deltaX) / handoffDistance);
    setRotorAngle(getJourneyCardDragFlipAngle(dragStartAngle, deltaX, dragViewportWidth));
    if (dragFlipProgress >= 1) {
      dragFlipCommitted = true;
      const committedDirection = direction || 1;
      void animateInteractiveFlip(stableFace === 'front' ? 'back' : 'front').then(() => {
        if (activePointerId === null || closing || settled || flipping) return;
        dragStartX = dragLatestX;
        dragStartAngle = stableRotorAngle();
        dragFlipProgress = 0;
        dragFlipCommitted = false;
        dragAllowedDirection = committedDirection === -1 ? 1 : -1;
      });
    }
  }

  function finishPointer(event: PointerEvent, allowCommit: boolean): void {
    if (event.pointerId !== activePointerId) return;
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;
    const moved = dragMoved;
    activePointerId = null;
    try { rotor.releasePointerCapture(event.pointerId); } catch {}
    stage.classList.remove('is-dragging');
    if (dragAxis === 'vertical') {
      event.preventDefault();
      event.stopPropagation();
      const shouldDismiss = allowCommit
        && Math.abs(deltaY) >= getJourneyCardDismissDragDistance(dragCardHeight)
        && isJourneyCardVerticalDismissGesture(deltaX, deltaY);
      if (shouldDismiss) {
        void beginClose('dismiss');
        return;
      }
      const verticalSettle = impactShell.animate?.([
        { transform: impactShell.style.transform || 'translate3d(0, 0, 0) scale(1)' },
        { transform: 'translate3d(0, 0, 0) scale(1)' },
      ], { duration: prefersReducedMotion ? 1 : 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }) ?? null;
      impactAnimation = verticalSettle;
      if (!verticalSettle) {
        impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
        disposeSpatialMotion?.();
        disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
        startSurfaceIdle();
        scheduleIdleCoach();
        return;
      }
      void verticalSettle.finished.catch(() => undefined).then(() => {
        if (impactAnimation !== verticalSettle || closing || settled) return;
        impactAnimation = null;
        impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
        verticalSettle.cancel();
        disposeSpatialMotion?.();
        disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
        startSurfaceIdle();
        scheduleIdleCoach();
      });
      return;
    }
    if (!allowCommit) {
      if (flipping) {
        impactShell.style.translate = 'none';
        return;
      }
      setRotorAngle(stableFace === 'front' ? 0 : -180);
      impactShell.style.translate = 'none';
      disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
      startSurfaceIdle();
      scheduleIdleCoach();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!moved) {
      impactShell.style.translate = 'none';
      const targetFace = stableFace === 'front' ? 'back' : 'front';
      void animateInteractiveFlip(targetFace, targetFace === 'back' ? 1 : -1);
      return;
    }
    const shouldCommitReleasedDrag = !flipping
      && !dragFlipCommitted
      && shouldCommitJourneyCardReleasedDrag(deltaX, dragViewportWidth, dragAllowedDirection);
    if (shouldCommitReleasedDrag) {
      impactShell.style.translate = 'none';
      void animateInteractiveFlip(stableFace === 'front' ? 'back' : 'front');
      return;
    }
    const fromTranslate = impactShell.style.translate || 'none';
    const previewFromAngle = currentAngle;
    const committedFlipInFlight = allowCommit && dragFlipCommitted;
    const previewToAngle = committedFlipInFlight ? previewFromAngle : dragStartAngle;
    const animation = impactShell.animate?.([
      { translate: fromTranslate },
      { translate: 'none' },
    ], {
      duration: prefersReducedMotion ? 1 : 180,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    }) ?? null;
    impactAnimation = animation;
    dragPreviewSettleAnimation = !flipping && Math.abs(previewFromAngle - previewToAngle) > 0.001
      ? rotor.animate?.([
        { transform: `rotateY(${previewFromAngle}deg)` },
        { transform: `rotateY(${previewToAngle}deg)` },
      ], {
        duration: prefersReducedMotion ? 1 : 180,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      }) ?? null
      : null;
    if (!animation) {
      impactShell.style.translate = 'none';
      setRotorAngle(previewToAngle);
      if (!flipping) {
        disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
        startSurfaceIdle();
        scheduleIdleCoach();
      }
      return;
    }
    const previewAnimation = dragPreviewSettleAnimation;
    if (previewAnimation) {
      const settleDuration = prefersReducedMotion ? 1 : 180;
      const watchSettlePaintFace = () => {
        if (closing || settled || dragPreviewSettleAnimation !== previewAnimation) {
          flipEdgeRaf = 0;
          return;
        }
        const progress = clamp01(Number(previewAnimation.currentTime ?? 0) / settleDuration);
        setPaintFaceForAngle(previewFromAngle + (previewToAngle - previewFromAngle) * progress);
        if (progress >= 1) {
          flipEdgeRaf = 0;
          return;
        }
        flipEdgeRaf = requestAnimationFrame(watchSettlePaintFace);
      };
      flipEdgeRaf = requestAnimationFrame(watchSettlePaintFace);
    }
    void Promise.allSettled([
      animation.finished,
      previewAnimation?.finished ?? Promise.resolve(),
    ]).then(() => {
      if (impactAnimation !== animation || closing || settled) return;
      if (flipEdgeRaf !== 0) {
        cancelAnimationFrame(flipEdgeRaf);
        flipEdgeRaf = 0;
      }
      impactAnimation = null;
      if (dragPreviewSettleAnimation === previewAnimation) dragPreviewSettleAnimation = null;
      impactShell.style.translate = 'none';
      if (!flipping) {
        setRotorAngle(previewToAngle);
      }
      previewAnimation?.cancel();
      animation.cancel();
      if (!flipping) {
        disposeSpatialMotion?.();
        disposeSpatialMotion = mountJourneyCardFlipSpatialMotion(stage, gyroShell);
        startSurfaceIdle();
        scheduleIdleCoach();
      }
    });
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
    const targetFace = stableFace === 'front' ? 'back' : 'front';
    void animateInteractiveFlip(targetFace, targetFace === 'back' ? 1 : -1);
  }

  function handleTurnControlClick(event: MouseEvent): void {
    stopIdleCoach();
    event.preventDefault();
    event.stopPropagation();
    void animateInteractiveFlip('front', -1);
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
  markOpenProfile('controls-mounted');

  setStableFace('front');
  setRotorAngle(0);
  stage.classList.add('is-entering', 'is-spatial-card-entry', 'is-flipping-to-back', 'is-prepainting');
  markOpenProfile('dom-append-start');
  document.body.appendChild(stage);
  markOpenProfile('dom-appended');
  const prepareAndStartEntry = async () => {
    markOpenProfile('prepaint-shell-wait');
    await waitForPaints(1);
    if (settled) return;

    markOpenProfile('prepaint-geometry-read-start');
    const destination = readFrameGeometry();
    markOpenProfile('prepaint-geometry-read-complete');
    if (destination) {
      primeJourneyCardSpatialFlight(
        spatialShell,
        destination,
        options.origin.origin,
        destination,
        {
          left: destination.centerX - destination.width / 2,
          top: destination.centerY - destination.height / 2,
        },
      );
      const initialOpacity = Math.max(0, Math.min(1, options.entryInitialOpacity ?? 1));
      spatialShell.style.opacity = String(initialOpacity);
    }
    await Promise.all(
      Array.from(stage.querySelectorAll<HTMLImageElement>('img')).map((image) => waitForModalImageReady(image)),
    );
    if (settled) return;

    // Warm both exact preserve-3d faces while the original World card remains
    // visible underneath. Each face gets a real WebKit presentation frame, so
    // the visible flight never owns first raster or texture upload.
    markOpenProfile('prepaint-front-face');
    setRotorAngle(0);
    await waitForPaints(1);
    if (settled) return;
    markOpenProfile('prepaint-back-face');
    setRotorAngle(-180);
    await waitForPaints(1);
    if (settled) return;
    setRotorAngle(0);
    await waitForPaints(1);
    if (settled) return;

    options.origin.activatePortal();
    const entryPromise = startEntry(destination);
    stage.classList.remove('is-prepainting');
    stage.classList.add('is-visible');
    backdrop.style.opacity = '1';
    markOpenProfile('first-visible-paint');
    void entryPromise;
  };
  void prepareAndStartEntry();

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
