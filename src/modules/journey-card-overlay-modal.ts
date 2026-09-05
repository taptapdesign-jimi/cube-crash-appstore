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
import {
  createDetailModalStatsEnterDelays,
  getDetailModalStatsEnterTotalDuration,
} from './detail-modal-stats-enter-motion.js';
import { getJourneyEarnedStars } from './journey-stage-balance.js';
import { formatJourneyWorldStageNumber } from './journey-world-stage.js';
import { getIosResistedModalVerticalDelta } from './modal-vertical-drag-dismiss.js';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';
import { areContinuousRuntimeDiagnosticsEnabled } from '../utils/runtime-diagnostics-policy.js';
import type { JourneyCardRarity } from './journey-card-assets.js';
import {
  clearJourneyInterimShineMask,
  setJourneyInterimShineMask,
} from './journey-interim-card-shine.js';

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
  cardImagePath1x?: string;
  cardImagePath2x?: string;
  cardRarity?: JourneyCardRarity;
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
  heading: string;
  earnedStars: number;
  highScore: string;
  longestCombo: string;
  ctaLabel: 'Play' | 'Continue';
  ctaAriaLabel: 'Play Stage' | 'Continue Stage';
}

export interface JourneyCardOverlayTiltProfile {
  cardRotationDeg: number;
  modalRotationDeg: number;
}

export function shouldShowJourneyCardLegendaryDragShine(
  rarity: JourneyCardRarity | undefined,
  targetFace: 'front' | 'back',
  prefersReducedMotion: boolean,
  isHorizontalDrag: boolean,
): boolean {
  return rarity === 'legendary'
    && targetFace === 'front'
    && !prefersReducedMotion
    && isHorizontalDrag;
}

export type JourneyCardLegendaryDragShineState = {
  active: boolean;
  opacity: number;
  backgroundPositionPercent: number;
  rainbowBackgroundPositionPercent: number;
};

export function getJourneyCardLegendaryDragShineState(
  angle: number,
): JourneyCardLegendaryDragShineState {
  if (!Number.isFinite(angle)) {
    return {
      active: false,
      opacity: 0,
      backgroundPositionPercent: 50,
      rainbowBackgroundPositionPercent: 50,
    };
  }
  const normalized = ((angle % 360) + 360) % 360;
  const signedFrontTilt = normalized <= 90 ? normalized : normalized >= 270 ? normalized - 360 : 180;
  const tilt = Math.abs(signedFrontTilt);
  if (tilt >= 88) {
    return {
      active: false,
      opacity: 0,
      backgroundPositionPercent: 50,
      rainbowBackgroundPositionPercent: 50,
    };
  }
  const reveal = smoothstep(tilt / 18);
  const edgeFade = smoothstep((88 - tilt) / 20);
  return {
    active: true,
    // Real foil retains a quiet ambient reflection at the neutral angle. The
    // previous hard cutoff at one degree caused a visible centre pop.
    opacity: Number(((0.104 + 0.39 * reveal) * edgeFade).toFixed(4)),
    backgroundPositionPercent: Number((50 + signedFrontTilt / 72 * 60).toFixed(2)),
    // A softer diffraction layer travels against the dominant gold specular,
    // like the opposing color shift on a tilted holographic foil surface.
    rainbowBackgroundPositionPercent: Number((50 - signedFrontTilt / 72 * 48).toFixed(2)),
  };
}

let activeJourneyCardOverlayModal: JourneyCardOverlayModalController | null = null;
const JOURNEY_CARD_OVERLAY_ASSETS = [
  './assets/highscore-icon.png',
  './assets/combo-icon.png',
  './assets/modals/star-empty.png',
  './assets/modals/star.png',
  './assets/hand-pointer.png',
] as const;
let journeyCardOverlayPreloadPromise: Promise<void> | null = null;

export function preloadJourneyCardOverlayAssets(): Promise<void> {
  if (journeyCardOverlayPreloadPromise) return journeyCardOverlayPreloadPromise;
  if (typeof Image === 'undefined') return Promise.resolve();
  journeyCardOverlayPreloadPromise = Promise.allSettled(
    JOURNEY_CARD_OVERLAY_ASSETS.map((src) => new Promise<void>((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        image.onload = null;
        image.onerror = null;
        resolve();
      };
      image.onload = () => {
        if (typeof image.decode === 'function') void image.decode().catch(() => undefined).then(finish);
        else finish();
      };
      image.onerror = finish;
      image.src = src;
      if (image.complete) image.onload?.(new Event('load'));
    })),
  ).then(() => undefined);
  return journeyCardOverlayPreloadPromise;
}

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
export const JOURNEY_CARD_LEGENDARY_IDLE_TILT_RATIO = 0.3;
export const JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG = JOURNEY_CARD_FLIP_DRAG_SCRUB_MAX_DEG
  * JOURNEY_CARD_LEGENDARY_IDLE_TILT_RATIO;
export const JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS = 6800;
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

export function resolveJourneyCardDragAxis(
  currentAxis: 'horizontal' | 'vertical' | null,
  deltaX: number,
  deltaY: number,
): 'horizontal' | 'vertical' {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  if (currentAxis === 'vertical') {
    return horizontalDistance > verticalDistance * 1.15 ? 'horizontal' : 'vertical';
  }
  if (currentAxis === 'horizontal') {
    // Once rotation is intentional, diagonal finger noise cannot steal it.
    return 'horizontal';
  }
  return verticalDistance > horizontalDistance * 1.15 ? 'vertical' : 'horizontal';
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

export function getJourneyCardImpactPresentationPose(transform: string, translate: string): {
  translateX: number;
  translateY: number;
  scale: number;
} {
  let translateX = Number.parseFloat(translate);
  let translateY = 0;
  let scale = 1;
  if (!Number.isFinite(translateX)) translateX = 0;

  const matrix3dMatch = transform.match(/^matrix3d\(([^)]+)\)$/);
  if (matrix3dMatch) {
    const values = matrix3dMatch[1].split(',').map(Number);
    if (values.length === 16 && values.every(Number.isFinite)) {
      translateX += values[12];
      translateY = values[13];
      scale = Math.hypot(values[0], values[1], values[2]);
    }
  } else {
    const matrixMatch = transform.match(/^matrix\(([^)]+)\)$/);
    if (matrixMatch) {
      const values = matrixMatch[1].split(',').map(Number);
      if (values.length === 6 && values.every(Number.isFinite)) {
        translateX += values[4];
        translateY = values[5];
        scale = Math.hypot(values[0], values[1]);
      }
    } else {
      const translateYMatch = transform.match(/translate3d\([^,]+,\s*(-?[\d.]+)px/i);
      const scaleMatch = transform.match(/scale\((-?[\d.]+)\)/i);
      if (translateYMatch) translateY = Number(translateYMatch[1]);
      if (scaleMatch) scale = Number(scaleMatch[1]);
    }
  }

  return {
    translateX: Number.isFinite(translateX) ? translateX : 0,
    translateY: Number.isFinite(translateY) ? translateY : 0,
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
  };
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

export function getJourneyCardRenderedRotateYAngle(transform: string): number | null {
  const rotateYMatch = transform.match(/rotateY\(\s*(-?(?:\d+\.?\d*|\.\d+))deg\s*\)/i);
  if (rotateYMatch) {
    const angle = Number(rotateYMatch[1]);
    return Number.isFinite(angle) ? angle : null;
  }
  const matrix3dMatch = transform.match(/matrix3d\(([^)]+)\)/i);
  if (!matrix3dMatch) return null;
  const values = matrix3dMatch[1].split(',').map((value) => Number(value.trim()));
  if (values.length !== 16 || values.some((value) => !Number.isFinite(value))) return null;
  const m11 = values[0];
  const m13 = values[2];
  return Math.atan2(-m13, m11) * (180 / Math.PI);
}

export function getJourneyCardUnwrappedAngleNear(angle: number, reference: number): number {
  if (!Number.isFinite(angle) || !Number.isFinite(reference)) return angle;
  const turns = Math.round((reference - angle) / 360);
  return angle + turns * 360;
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
  const safeBoardId = Math.max(1, Math.trunc(Number.isFinite(boardId) ? boardId : 1));
  const stageNumber = formatJourneyWorldStageNumber(safeBoardId);
  const heading = safeBoardId >= 21
    ? `Area ${stageNumber}`
    : safeBoardId >= 11
      ? `Beach ${stageNumber}`
      : `Forest ${stageNumber}`;
  const highScore = Math.max(0, Math.trunc(Number.isFinite(stats.highScore) ? stats.highScore : 0));
  const longestCombo = Math.max(0, Math.trunc(Number.isFinite(stats.longestCombo) ? stats.longestCombo : 0));
  return {
    heading,
    earnedStars: getJourneyEarnedStars(highScore, safeBoardId),
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
  const openProfilingEnabled = areContinuousRuntimeDiagnosticsEnabled();
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
    if (!openProfilingEnabled) return;
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
  if (openProfilingEnabled) openProfileFrameId = requestAnimationFrame(sampleOpenProfileFrame);
  markOpenProfile('modal-call');
  activeJourneyCardOverlayModal?.dispose();
  markOpenProfile('prior-modal-disposed');

  const viewModel = buildJourneyCardOverlayModalViewModel(
    options.boardId,
    boardStatsService.getBoardStats(options.boardId),
    options.hasSavedState,
  );
  const cardRarity = options.cardRarity ?? 'common';
  markOpenProfile('view-model-built');
  const stage = document.createElement('div');
  const tiltProfile = createJourneyCardOverlayTiltProfile();
  stage.id = 'journey-card-overlay-modal';
  stage.className = 'journey-card-overlay-modal journey-card-flip-overlay';
  stage.setAttribute('role', 'dialog');
  stage.setAttribute('aria-modal', 'true');
  stage.setAttribute('aria-labelledby', 'journey-card-flip-title');
  stage.setAttribute('data-board-id', String(options.boardId));
  stage.setAttribute('data-card-rarity', cardRarity);
  stage.classList.toggle('is-legendary-card', cardRarity === 'legendary');
  stage.style.setProperty('--journey-card-origin-aspect', String(options.origin.aspectRatio));
  stage.style.setProperty('--journey-card-flip-front-tilt', `${tiltProfile.cardRotationDeg}deg`);
  stage.style.setProperty('--journey-card-flip-back-tilt', `${tiltProfile.modalRotationDeg}deg`);
  stage.innerHTML = `
    <div class="journey-card-flip-backdrop" aria-hidden="true"></div>
    <div class="journey-card-flip-frame">
      <div class="journey-card-flip-spatial-shell">
        <div class="journey-card-flip-impact-shell">
          <div class="journey-card-flip-idle-shell">
            <div class="journey-card-flip-pose-shell">
            <div class="journey-card-flip-rotor">
              <div class="journey-card-flip-face journey-card-flip-front" role="button" tabindex="0" aria-label="Turn card to view stats" aria-hidden="false">
                <div class="journey-card-flip-card-host" aria-hidden="true"></div>
                <div class="journey-card-flip-shine" aria-hidden="true"></div>
                <div class="journey-card-flip-legendary-shine" aria-hidden="true"></div>
              </div>
              <div class="journey-card-flip-face journey-card-flip-back" aria-hidden="true">
                <div class="cc-gameplay-modal-idle-shell journey-card-flip-back-shell">
                  <div class="cc-gameplay-modal-paper-shell journey-card-flip-paper" data-board-id="${options.boardId}-modal">
                    <div class="journey-card-flip-title-section">
                      <div class="journey-card-flip-stars" role="img" aria-label="${viewModel.earnedStars} of 3 stars earned">
                        ${Array.from({ length: 3 }, (_, index) => `
                          <span class="journey-card-flip-star journey-card-flip-star-${index + 1}${index < viewModel.earnedStars ? ' is-earned' : ''}">
                            <img class="journey-card-flip-star-empty" src="./assets/modals/star-empty.png" alt="" aria-hidden="true" draggable="false">
                            <img class="journey-card-flip-star-filled" src="./assets/modals/star.png" alt="" aria-hidden="true" draggable="false">
                          </span>
                        `).join('')}
                      </div>
                      <h2 id="journey-card-flip-title" class="cc-gameplay-modal-title">${viewModel.heading}</h2>
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
      <img class="journey-card-flip-idle-hand" src="./assets/hand-pointer.png" srcset="./assets/hand-pointer@2x.png 2x, ./assets/hand-pointer@3x.png 3x" alt="" aria-hidden="true" draggable="false">
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
  const poseShell = stage.querySelector<HTMLElement>('.journey-card-flip-pose-shell');
  const rotor = stage.querySelector<HTMLElement>('.journey-card-flip-rotor');
  const front = stage.querySelector<HTMLElement>('.journey-card-flip-front');
  const back = stage.querySelector<HTMLElement>('.journey-card-flip-back');
  const backShell = stage.querySelector<HTMLElement>('.journey-card-flip-back-shell');
  const cardHost = stage.querySelector<HTMLElement>('.journey-card-flip-card-host');
  const commonShine = stage.querySelector<HTMLElement>('.journey-card-flip-shine');
  const legendaryShine = stage.querySelector<HTMLElement>('.journey-card-flip-legendary-shine');
  const cta = stage.querySelector<HTMLButtonElement>('.journey-card-flip-cta');
  const turnControl = stage.querySelector<HTMLButtonElement>('.journey-card-flip-turn-control');
  const idleHand = stage.querySelector<HTMLImageElement>('.journey-card-flip-idle-hand');
  const idleCopy = stage.querySelector<HTMLElement>('.journey-card-flip-idle-copy');
  if (!backdrop || !frame || !spatialShell || !impactShell || !idleShell || !poseShell || !rotor || !front || !back || !backShell || !cardHost || !commonShine || !cta || !turnControl || !idleHand || !idleCopy) {
    stage.remove();
    throw new Error('Journey flip card failed to create its required owners');
  }
  markOpenProfile('owners-resolved');
  const backContentElements = Array.from(
    stage.querySelectorAll<HTMLElement>('.journey-card-flip-stats > .journey-card-flip-stat, .journey-card-flip-stats > .journey-card-flip-divider'),
  );
  options.origin.mountInto(cardHost);
  const portaledCard = cardHost.querySelector<HTMLElement>('.journey-card-overlay-portaled-card');
  if (portaledCard && options.cardImagePath2x) {
    portaledCard.style.backgroundImage = `url("${options.cardImagePath2x.replace(/"/g, '\\"')}")`;
    const preloader = portaledCard.querySelector<HTMLImageElement>('.journey-board-image-preload');
    if (preloader) preloader.src = options.cardImagePath2x;
  }
  if (cardRarity === 'legendary' && options.cardImagePath2x) {
    setJourneyInterimShineMask(legendaryShine, options.cardImagePath2x);
  }
  const commonShineMaskPath = options.cardImagePath2x ?? options.cardImagePath1x;
  if (cardRarity === 'common' && commonShineMaskPath) {
    setJourneyInterimShineMask(commonShine, commonShineMaskPath);
  }
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
  let flipGeneration = 0;
  let impactAnimation: Animation | null = null;
  let dragPreviewSettleAnimation: Animation | null = null;
  let idleShellHandoffAnimation: Animation | null = null;
  let idleCoachImpactHandoffAnimation: Animation | null = null;
  let exitNeutralAnimations: Animation[] = [];
  let idleCoachTimer = 0;
  let idleCoachCardAnimation: Animation | null = null;
  let idleCoachHandAnimation: Animation | null = null;
  let legendaryIdleRotorAnimation: Animation | null = null;
  let legendaryIdleShineAnimation: Animation | null = null;
  let commonIdleShineAnimation: Animation | null = null;
  let idleCoachGeneration = 0;
  let nextIdleCoachMode: 'drag' | 'tap' = 'drag';
  let backContentEnterTimer = 0;
  let backContentRestoreTimer = 0;
  let flipEdgeRaf = 0;
  let legendaryShinePaintRaf = 0;
  let pendingLegendaryShineAngle: number | null = null;
  let backContentEnterScheduled = false;
  let closeController: GameplaySheetCloseController | null = null;
  let ctaController: CtaController | null = null;
  let activePointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragLatestX = 0;
  let dragLatestY = 0;
  let dragStartAngle = 0;
  let dragFlipProgress = 0;
  let dragFlipCommitted = false;
  let dragAllowedDirection: -1 | 0 | 1 = 0;
  let dragMoved = false;
  let dragCardHeight = 1;
  let dragCardRect: DOMRect | null = null;
  let dragViewportHeight = 0;
  let dragViewportWidth = 0;
  let dragHorizontalMinX = 0;
  let dragHorizontalMaxX = 0;
  let dragImpactStartTranslateX = 0;
  let dragImpactStartTranslateY = 0;
  let dragImpactStartScale = 1;
  let dragPresentationTranslateX = 0;
  let dragAxis: 'horizontal' | 'vertical' | null = null;
  let dismissDragReleaseY = 0;
  let dismissDragReleaseScale = 1;
  let exitImpactReleaseX = 0;
  let pointerTraceSequence = 0;
  let pointerTraceMoveCount = 0;
  let pointerTraceStartedAt = 0;
  let pointerTakeoverAuditRaf = 0;
  const tracePointerOwnership = (
    event: string,
    detail: Record<string, unknown> = {},
  ): void => {
    emitNativeConsoleDiagnostic('[CC_JOURNEY_CARD_POINTER]', event, {
      boardId: options.boardId,
      sequence: pointerTraceSequence,
      elapsedMs: pointerTraceStartedAt > 0
        ? Number((performance.now() - pointerTraceStartedAt).toFixed(2))
        : null,
      activePointerId,
      entering,
      closing,
      settled,
      flipping,
      flipAnimationActive: flipAnimation !== null,
      recoilActive: flipRecoilAnimation !== null,
      stableFace,
      currentAngle: Number(currentAngle.toFixed(2)),
      idleRotorActive: legendaryIdleRotorAnimation !== null,
      idleCoachActive: idleCoachCardAnimation !== null || idleCoachHandAnimation !== null,
      impactSettleActive: impactAnimation !== null,
      previewSettleActive: dragPreviewSettleAnimation !== null,
      ...detail,
    });
  };
  const clearLegendaryDragShine = (removeMask = false): void => {
    if (legendaryShinePaintRaf !== 0) {
      cancelAnimationFrame(legendaryShinePaintRaf);
      legendaryShinePaintRaf = 0;
    }
    pendingLegendaryShineAngle = null;
    stage.classList.remove('is-legendary-drag-shine');
    legendaryShine?.style.removeProperty('background-position');
    legendaryShine?.style.removeProperty('opacity');
    if (removeMask) clearJourneyInterimShineMask(legendaryShine);
  };

  const paintLegendaryDragShine = (angle: number, allowSettling = false): void => {
    const face = getJourneyCardFlipFaceForAngle(angle);
    const isHorizontalDrag = allowSettling || (
      activePointerId !== null
      && stage.classList.contains('is-dragging')
      && dragMoved
    );
    if (
      !legendaryShine
      || !options.cardImagePath2x
      || entering
      || closing
      || settled
      || !stage.isConnected
      || !shouldShowJourneyCardLegendaryDragShine(
        cardRarity,
        face,
        prefersReducedMotion,
        isHorizontalDrag,
      )
    ) {
      clearLegendaryDragShine();
      return;
    }
    const shine = getJourneyCardLegendaryDragShineState(angle);
    if (!shine.active) {
      clearLegendaryDragShine();
      return;
    }
    stage.classList.add('is-legendary-drag-shine');
    legendaryShine.style.backgroundPosition = [
      `${shine.backgroundPositionPercent}% 50%`,
      `${shine.rainbowBackgroundPositionPercent}% 50%`,
    ].join(', ');
    legendaryShine.style.opacity = String(shine.opacity);
  };

  const queueLegendaryDragShine = (angle: number): void => {
    pendingLegendaryShineAngle = angle;
    if (legendaryShinePaintRaf !== 0) return;
    legendaryShinePaintRaf = requestAnimationFrame(() => {
      legendaryShinePaintRaf = 0;
      const nextAngle = pendingLegendaryShineAngle;
      pendingLegendaryShineAngle = null;
      if (nextAngle !== null) paintLegendaryDragShine(nextAngle);
    });
  };

  const setPaintFaceForAngle = (angle: number) => {
    const normalized = ((angle % 360) + 360) % 360;
    const edgeDistance = Math.abs(normalized - 90) < 0.001 || Math.abs(normalized - 270) < 0.001;
    if (edgeDistance) return;
    stage.dataset.paintFace = normalized > 90 && normalized < 270 ? 'back' : 'front';
  };

  const neutralizeExitMotionOwners = (durationMs: number) => {
    const idleTransform = window.getComputedStyle(idleShell).transform || 'none';
    const poseStyle = window.getComputedStyle(poseShell);
    const poseTranslate = poseStyle.translate || 'none';
    const poseTransform = poseStyle.transform || 'none';
    const safeDurationMs = Math.max(1, Math.round(durationMs));
    stage.style.setProperty('--journey-card-exit-neutral-duration', `${safeDurationMs}ms`);
    stopSurfaceIdle();
    idleShellHandoffAnimation?.cancel();
    idleShellHandoffAnimation = null;
    exitNeutralAnimations.forEach((animation) => animation.cancel());
    exitNeutralAnimations = [];
    if (prefersReducedMotion || typeof idleShell.animate !== 'function') {
      idleShell.style.transform = 'none';
      poseShell.style.translate = 'none';
      poseShell.style.transform = 'none';
      return;
    }
    exitNeutralAnimations = [
      idleShell.animate([
        { transform: idleTransform },
        { transform: 'none' },
      ], { duration: safeDurationMs, easing: 'linear', fill: 'forwards' }),
      poseShell.animate([
        { translate: poseTranslate, transform: poseTransform },
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
    // Stable presentation is an atomic invariant: accessibility ownership and
    // the WebKit paint-face culler must never point at different faces.
    stage.dataset.paintFace = face;
  };

  const stableRotorAngle = () => stableFace === 'front' ? 0 : -180;

  const readPointerHandoffAngle = (): number => {
    if (
      !legendaryIdleRotorAnimation
      && !dragPreviewSettleAnimation
      && !flipAnimation
      && !flipRecoilAnimation
    ) {
      return stableRotorAngle();
    }
    const renderedTransform = window.getComputedStyle(rotor).transform || rotor.style.transform;
    const renderedAngle = getJourneyCardRenderedRotateYAngle(renderedTransform);
    return renderedAngle === null
      ? stableRotorAngle()
      : getJourneyCardUnwrappedAngleNear(renderedAngle, currentAngle);
  };

  const stopLegendaryIdleHolo = (): void => {
    legendaryIdleRotorAnimation?.cancel();
    legendaryIdleRotorAnimation = null;
    legendaryIdleShineAnimation?.cancel();
    legendaryIdleShineAnimation = null;
    stage.classList.remove('is-legendary-idle-holo');
    if (!stage.classList.contains('is-legendary-drag-shine')) {
      legendaryShine?.style.removeProperty('background-position');
      legendaryShine?.style.removeProperty('opacity');
    }
  };

  const stopCommonIdleShine = (): void => {
    commonIdleShineAnimation?.cancel();
    commonIdleShineAnimation = null;
    commonShine.style.removeProperty('background-position');
    commonShine.style.removeProperty('opacity');
  };

  const startCommonIdleShine = (): void => {
    stopCommonIdleShine();
    if (
      cardRarity !== 'common'
      || stableFace !== 'front'
      || prefersReducedMotion
      || entering
      || closing
      || settled
      || flipping
      || activePointerId !== null
      || stage.classList.contains('has-new-ribbon')
      || stage.classList.contains('is-idle-coach')
      || typeof commonShine.animate !== 'function'
    ) return;

    commonIdleShineAnimation = commonShine.animate([
      { backgroundPosition: '240% 50%', opacity: 0, offset: 0 },
      { backgroundPosition: '240% 50%', opacity: 0, offset: 0.4 },
      { backgroundPosition: '205% 50%', opacity: 0.55, offset: 0.46 },
      { backgroundPosition: '-105% 50%', opacity: 0.55, offset: 0.78 },
      { backgroundPosition: '-140% 50%', opacity: 0, offset: 0.84 },
      { backgroundPosition: '-140% 50%', opacity: 0, offset: 1 },
    ], {
      duration: 3000,
      easing: 'ease-in-out',
      iterations: Infinity,
    });
  };

  const startLegendaryIdleHolo = (): void => {
    stopLegendaryIdleHolo();
    if (
      cardRarity !== 'legendary'
      || stableFace !== 'front'
      || prefersReducedMotion
      || entering
      || closing
      || settled
      || flipping
      || activePointerId !== null
      || stage.classList.contains('is-idle-coach')
      || typeof rotor.animate !== 'function'
      || typeof legendaryShine?.animate !== 'function'
    ) return;

    const idleAngles = [
      0,
      -JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG,
      0,
      JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG,
      0,
    ];
    const offsets = [0, 0.25, 0.5, 0.75, 1];
    const shineKeyframes = idleAngles.map((angle, index): Keyframe => {
      const shine = getJourneyCardLegendaryDragShineState(angle);
      const leftLightCatch = angle < 0
        ? Math.min(1, Math.abs(angle) / JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG)
        : 0;
      const idleOpacity = Math.max(0.13, shine.opacity * 0.68);
      return {
        backgroundPosition: [
          `${shine.backgroundPositionPercent}% 50%`,
          `${shine.rainbowBackgroundPositionPercent}% 50%`,
        ].join(', '),
        // Idle uses a slightly clearer diffraction read than the neutral drag
        // pose. The artwork remains visible, while the cyan/violet/pink/mint
        // layer no longer disappears at the shallow automatic tilt angles.
        // The leftward pass gets one small extra lift so the existing near-white
        // specular band reads as a natural light catch instead of another sweep.
        opacity: Number((idleOpacity * (1 + leftLightCatch * 0.12)).toFixed(4)),
        offset: offsets[index],
      };
    });

    stage.classList.add('is-legendary-idle-holo');
    legendaryIdleRotorAnimation = rotor.animate(
      idleAngles.map((angle, index): Keyframe => ({
        transform: `rotateY(${angle}deg)`,
        offset: offsets[index],
      })),
      {
        duration: JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS,
        easing: 'ease-in-out',
        iterations: Infinity,
      },
    );
    legendaryIdleShineAnimation = legendaryShine.animate(shineKeyframes, {
      duration: JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS,
      easing: 'ease-in-out',
      iterations: Infinity,
    });
  };

  const stopSurfaceIdle = () => {
    stage.classList.remove('is-surface-idle');
    stopLegendaryIdleHolo();
    stopCommonIdleShine();
  };
  const handoffSurfaceIdle = (mode: 'settle' | 'freeze-for-pointer' = 'settle'): void => {
    const renderedTransform = window.getComputedStyle(idleShell).transform || idleShell.style.transform || 'none';
    stopSurfaceIdle();
    idleShellHandoffAnimation?.cancel();
    idleShellHandoffAnimation = null;
    idleShell.style.transform = renderedTransform;
    // A live finger is the sole presentation owner. Continuing the former
    // 160ms idle-shell handoff under that finger makes the card appear to
    // ignore the first drag frames even though rotor pointer events arrive.
    if (mode === 'freeze-for-pointer') return;
    if (prefersReducedMotion || typeof idleShell.animate !== 'function') {
      idleShell.style.transform = 'none';
      return;
    }
    const animation = idleShell.animate([
      { transform: renderedTransform },
      { transform: 'none' },
    ], {
      duration: 160,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    });
    idleShellHandoffAnimation = animation;
    void animation.finished.catch(() => undefined).then(() => {
      if (idleShellHandoffAnimation !== animation) return;
      idleShellHandoffAnimation = null;
      animation.cancel();
      idleShell.style.transform = 'none';
    });
  };
  const startSurfaceIdle = () => {
    if (
      !prefersReducedMotion
      && !entering
      && !closing
      && !settled
      && !flipping
      && !flipAnimation
      && !flipRecoilAnimation
      && !impactAnimation
      && !dragPreviewSettleAnimation
      && activePointerId === null
    ) {
      idleShellHandoffAnimation?.cancel();
      idleShellHandoffAnimation = null;
      idleShell.style.removeProperty('transform');
      stage.classList.add('is-surface-idle');
      startLegendaryIdleHolo();
      startCommonIdleShine();
    }
  };

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

  const stopIdleCoach = () => {
    idleCoachGeneration += 1;
    if (idleCoachTimer !== 0) {
      window.clearTimeout(idleCoachTimer);
      idleCoachTimer = 0;
    }
    idleCoachCardAnimation?.cancel();
    idleCoachCardAnimation = null;
    idleCoachHandAnimation?.cancel();
    idleCoachHandAnimation = null;
    stage.classList.remove('is-idle-coach', 'is-idle-coach-drag', 'is-idle-coach-tap');
  };

  const freezeIdleCoachImpact = (): { transform: string; translate: string } | null => {
    const hasPresentedCoachPose = idleCoachCardAnimation !== null
      || idleCoachImpactHandoffAnimation !== null;
    if (!hasPresentedCoachPose) {
      stopIdleCoach();
      return null;
    }
    const renderedStyle = window.getComputedStyle(impactShell);
    const renderedTransform = renderedStyle.transform || impactShell.style.transform || 'none';
    const renderedTranslate = renderedStyle.translate || impactShell.style.translate || 'none';
    stopIdleCoach();
    idleCoachImpactHandoffAnimation?.cancel();
    idleCoachImpactHandoffAnimation = null;
    impactShell.style.transform = renderedTransform;
    impactShell.style.translate = renderedTranslate;
    return { transform: renderedTransform, translate: renderedTranslate };
  };

  const handoffIdleCoachImpact = (): void => {
    const pose = freezeIdleCoachImpact();
    if (!pose) return;
    const { transform: renderedTransform, translate: renderedTranslate } = pose;
    if (prefersReducedMotion || typeof impactShell.animate !== 'function') {
      impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
      impactShell.style.translate = 'none';
      return;
    }
    const animation = impactShell.animate([
      { transform: renderedTransform, translate: renderedTranslate },
      { transform: 'translate3d(0, 0, 0) scale(1)', translate: 'none' },
    ], {
      duration: 160,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    });
    idleCoachImpactHandoffAnimation = animation;
    void animation.finished.catch(() => undefined).then(() => {
      if (idleCoachImpactHandoffAnimation !== animation) return;
      idleCoachImpactHandoffAnimation = null;
      animation.cancel();
      impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
      impactShell.style.translate = 'none';
    });
  };

  const scheduleIdleCoach = () => {
    stopIdleCoach();
    if (
      prefersReducedMotion
      || entering
      || closing
      || settled
      || flipping
      || flipAnimation
      || flipRecoilAnimation
      || impactAnimation
      || dragPreviewSettleAnimation
      || activePointerId !== null
    ) return;
    const generation = idleCoachGeneration;
    idleCoachTimer = window.setTimeout(() => {
      idleCoachTimer = 0;
      if (generation !== idleCoachGeneration || entering || closing || settled || flipping || activePointerId !== null) return;
      const coachMode = nextIdleCoachMode;
      nextIdleCoachMode = coachMode === 'drag' ? 'tap' : 'drag';
      stage.classList.add('is-idle-coach', `is-idle-coach-${coachMode}`);
      const cardAnimation = coachMode === 'drag'
        ? impactShell.animate([
          { transform: 'translate3d(0, 0, 0)', offset: 0 },
          { transform: 'translate3d(-34px, 0, 0)', offset: 0.28 },
          { transform: 'translate3d(38px, 0, 0)', offset: 0.68 },
          { transform: 'translate3d(0, 0, 0)', offset: 1 },
        ], {
          duration: JOURNEY_CARD_FLIP_IDLE_COACH_DURATION_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        })
        : impactShell.animate([
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
        });
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
      idleCoachCardAnimation = cardAnimation;
      idleCoachHandAnimation = handAnimation;
      const coachAnimations = [cardAnimation, handAnimation];
      void Promise.allSettled(coachAnimations.map((animation) => animation.finished)).then(() => {
        if (
          generation !== idleCoachGeneration
          || idleCoachCardAnimation !== cardAnimation
          || idleCoachHandAnimation !== handAnimation
        ) return;
        idleCoachCardAnimation = null;
        idleCoachHandAnimation = null;
        stage.classList.remove('is-idle-coach', 'is-idle-coach-drag', 'is-idle-coach-tap');
        if (closing || settled) return;
        scheduleIdleCoach();
      });
    }, JOURNEY_CARD_FLIP_IDLE_COACH_DELAY_MS);
  };

  const cancelMotion = () => {
    flipGeneration += 1;
    stopSurfaceIdle();
    if (pointerTakeoverAuditRaf !== 0) {
      cancelAnimationFrame(pointerTakeoverAuditRaf);
      pointerTakeoverAuditRaf = 0;
    }
    clearLegendaryDragShine(true);
    clearJourneyInterimShineMask(commonShine);
    stopIdleCoach();
    clearBackContentTimers();
    spatialFlight?.cancel();
    spatialFlight = null;
    flipAnimation?.cancel();
    flipAnimation = null;
    flipRecoilAnimation?.cancel();
    flipRecoilAnimation = null;
    idleShellHandoffAnimation?.cancel();
    idleShellHandoffAnimation = null;
    idleShell.style.removeProperty('transform');
    idleCoachImpactHandoffAnimation?.cancel();
    idleCoachImpactHandoffAnimation = null;
    impactAnimation?.cancel();
    impactAnimation = null;
    dragPreviewSettleAnimation?.cancel();
    dragPreviewSettleAnimation = null;
    stage.classList.remove('is-face-settling');
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
    cancelMotion();
    rotor.removeEventListener('pointerdown', handlePointerDown);
    rotor.removeEventListener('pointermove', handlePointerMove);
    rotor.removeEventListener('pointerup', handlePointerUp);
    rotor.removeEventListener('pointercancel', handlePointerCancel);
    rotor.removeEventListener('lostpointercapture', handleLostPointerCapture);
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerUp);
    window.removeEventListener('pointercancel', handleWindowPointerCancel);
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
    pointerReleaseAngle?: number,
  ): Promise<void> => {
    if (entering || closing || settled || flipping || impactAnimation || dragPreviewSettleAnimation) return;
    // An in-contact handoff must continue from the exact angle last painted by
    // the pointer. readPointerHandoffAngle() intentionally falls back to the
    // stable face when no WAAPI owner exists, which would otherwise jump a
    // ±72deg manual scrub back to 0/-180 before auto-completing the flip.
    const from = Number.isFinite(pointerReleaseAngle)
      ? Number(pointerReleaseAngle)
      : activePointerId !== null && stage.classList.contains('is-dragging')
        ? currentAngle
        : readPointerHandoffAngle();
    const generation = ++flipGeneration;
    paintLegendaryDragShine(from, true);
    if (flipRecoilAnimation) {
      flipRecoilAnimation.cancel();
      flipRecoilAnimation = null;
    }
    flipping = true;
    handoffSurfaceIdle(activePointerId !== null ? 'freeze-for-pointer' : 'settle');
    setRotorAngle(from);
    stage.classList.add('is-flipping');
    stage.classList.toggle('is-flipping-to-front', targetFace === 'front');
    stage.classList.toggle('is-flipping-to-back', targetFace === 'back');
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
        let faceEdgeCommitted = false;
        const watchPhysicalEdge = () => {
          if (closing || settled || flipAnimation !== animation) {
            flipEdgeRaf = 0;
            return;
          }
          const progress = clamp01(Number(animation.currentTime ?? 0) / Math.max(1, duration));
          const liveAngle = from + (to - from) * progress;
          currentAngle = liveAngle;
          if (!faceEdgeCommitted && progress >= edgeProgress) {
            stage.dataset.paintFace = targetFace;
            faceEdgeCommitted = true;
          }
          paintLegendaryDragShine(liveAngle, true);
          if (progress >= 1) {
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
    if (generation !== flipGeneration || closing || settled) return;
    setRotorAngle(targetFace === 'back' ? -180 : 0);
    setStableFace(targetFace);
    if (targetFace === 'back') restoreBackContentVisible();
    flipping = false;
    stage.classList.remove('is-flipping', 'is-flipping-to-front', 'is-flipping-to-back');
    if (activePointerId === null) stage.classList.remove('is-dragging');
    if (activePointerId === null && !prefersReducedMotion && typeof rotor.animate === 'function') {
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
      const watchRecoilShine = () => {
        if (closing || settled || flipRecoilAnimation !== recoil) {
          flipEdgeRaf = 0;
          return;
        }
        const renderedTransform = window.getComputedStyle(rotor).transform || rotor.style.transform;
        const renderedAngle = getJourneyCardRenderedRotateYAngle(renderedTransform) ?? stableRotorAngle();
        setPaintFaceForAngle(renderedAngle);
        paintLegendaryDragShine(renderedAngle, true);
        flipEdgeRaf = requestAnimationFrame(watchRecoilShine);
      };
      if (flipEdgeRaf !== 0) cancelAnimationFrame(flipEdgeRaf);
      flipEdgeRaf = requestAnimationFrame(watchRecoilShine);
      void recoil.finished.catch(() => undefined).then(() => {
        if (flipRecoilAnimation !== recoil || closing || settled) return;
        flipRecoilAnimation = null;
        if (flipEdgeRaf !== 0) {
          cancelAnimationFrame(flipEdgeRaf);
          flipEdgeRaf = 0;
        }
        recoil.cancel();
        setRotorAngle(stableRotorAngle());
        if (activePointerId === null && !flipping && !impactAnimation && !dragPreviewSettleAnimation) {
          startSurfaceIdle();
          clearLegendaryDragShine();
          scheduleIdleCoach();
        }
      });
    } else if (activePointerId === null && !impactAnimation && !dragPreviewSettleAnimation) {
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
          impactShell.style.translate = `${(exitImpactReleaseX * remaining).toFixed(2)}px 0`;
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
        const handoffRemaining = 1 - smoothstep(elapsedMs / 160);
        const composedScale = scale * (1 + (dismissDragReleaseScale - 1) * handoffRemaining);
        impactShell.style.translate = `${(exitImpactReleaseX * handoffRemaining).toFixed(2)}px 0`;
        impactShell.style.transform = `translate3d(0, ${(dismissDragReleaseY * handoffRemaining).toFixed(2)}px, 0) scale(${composedScale})`;
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
      // Restore the resident card with its landing guard in the same class
      // write. This prevents its settled contact shadow from painting during
      // the two-frame portal handoff before the squeeze owner starts.
      const restored = options.origin.restoreNow({
        preserveLandingSuppression: outcome === 'complete',
      });
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
    freezeIdleCoachImpact();
    closing = true;
    options.onPerformancePhase?.(`${value}-close-owned`);
    flipGeneration += 1;
    flipping = false;
    clearBackContentTimers();
    const exitNeutralDurationMs = value === 'play'
      ? JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS + JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS
      : JOURNEY_CARD_FLIP_DISMISS_DURATION_MS;
    neutralizeExitMotionOwners(prefersReducedMotion ? 1 : exitNeutralDurationMs);
    stopIdleCoach();
    flipAnimation?.cancel();
    flipAnimation = null;
    flipRecoilAnimation?.cancel();
    flipRecoilAnimation = null;
    setRotorAngle(stableRotorAngle());
    if (value === 'dismiss') options.onPerformancePhase?.('dismiss-style-snapshot-start');
    const visibleRotorTransform = window.getComputedStyle(rotor).transform || rotor.style.transform;
    const visibleImpactTransform = window.getComputedStyle(impactShell).transform || impactShell.style.transform;
    const visibleImpactTranslate = window.getComputedStyle(impactShell).translate || impactShell.style.translate;
    const visibleImpactPose = getJourneyCardImpactPresentationPose(
      visibleImpactTransform,
      visibleImpactTranslate,
    );
    exitImpactReleaseX = visibleImpactPose.translateX;
    dismissDragReleaseY = visibleImpactPose.translateY;
    dismissDragReleaseScale = visibleImpactPose.scale;
    if (value === 'dismiss') options.onPerformancePhase?.('dismiss-style-snapshot-complete');
    impactAnimation?.cancel();
    impactAnimation = null;
    dragPreviewSettleAnimation?.cancel();
    dragPreviewSettleAnimation = null;
    rotor.style.transform = visibleRotorTransform;
    impactShell.style.transform = visibleImpactTransform;
    impactShell.style.translate = visibleImpactTranslate;
    stage.classList.remove('is-flipping', 'is-flipping-to-front', 'is-flipping-to-back', 'is-dragging', 'is-face-settling');
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
    const isUnsupportedMouseButton = event.pointerType === 'mouse' && event.button !== 0;
    const interactiveControl = isInteractiveControl(event.target);
    const blockedBy = isUnsupportedMouseButton ? 'mouse-button'
      : event.isPrimary === false ? 'non-primary'
        : entering ? 'entering'
          : closing ? 'closing'
            : settled ? 'settled'
              : activePointerId !== null ? 'active-pointer'
                  : interactiveControl ? 'interactive-control'
                    : null;
    if (blockedBy) {
      tracePointerOwnership('pointerdown-rejected', {
        blockedBy,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        button: event.button,
        isPrimary: event.isPrimary,
      });
      return;
    }
    pointerTraceSequence += 1;
    pointerTraceMoveCount = 0;
    pointerTraceStartedAt = performance.now();
    // A fresh finger always owns the card immediately. In particular, do not
    // drop pointerdown during the short release snapback: freeze its rendered
    // rotor pose, invalidate both settle owners, and hand that exact pose to
    // the new drag. Their completion callbacks are identity-guarded below.
    const dragHandoffAngle = readPointerHandoffAngle();
    const idleRotorBeforeTakeover = legendaryIdleRotorAnimation;
    const renderedRotorBeforeTakeover = window.getComputedStyle(rotor).transform || rotor.style.transform || 'none';
    tracePointerOwnership('pointerdown-preflight', {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      renderedAngle: getJourneyCardRenderedRotateYAngle(renderedRotorBeforeTakeover),
      idleRotorPlayState: idleRotorBeforeTakeover?.playState ?? null,
      idleRotorCurrentTime: Number(idleRotorBeforeTakeover?.currentTime ?? 0),
      rotorAnimationCount: rotor.getAnimations?.().length ?? null,
      idleShellAnimationCount: idleShell.getAnimations?.().length ?? null,
    });
    const renderedImpactStyle = window.getComputedStyle(impactShell);
    const impactHandoffPose = getJourneyCardImpactPresentationPose(
      renderedImpactStyle.transform || impactShell.style.transform,
      renderedImpactStyle.translate || impactShell.style.translate,
    );
    handoffSurfaceIdle('freeze-for-pointer');
    stopIdleCoach();
    idleCoachImpactHandoffAnimation?.cancel();
    idleCoachImpactHandoffAnimation = null;
    const interruptedFlip = flipping;
    const interruptedFlipAnimation = flipAnimation;
    if (interruptedFlip) {
      flipGeneration += 1;
      flipAnimation = null;
      interruptedFlipAnimation?.cancel();
      flipping = false;
      stage.classList.remove('is-flipping', 'is-flipping-to-front', 'is-flipping-to-back');
    }
    flipRecoilAnimation?.cancel();
    flipRecoilAnimation = null;
    const interruptedImpactAnimation = impactAnimation;
    const interruptedPreviewAnimation = dragPreviewSettleAnimation;
    impactAnimation = null;
    dragPreviewSettleAnimation = null;
    interruptedImpactAnimation?.cancel();
    interruptedPreviewAnimation?.cancel();
    stage.classList.remove('is-face-settling');
    if (flipEdgeRaf !== 0) {
      cancelAnimationFrame(flipEdgeRaf);
      flipEdgeRaf = 0;
    }
    setRotorAngle(dragHandoffAngle);
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragLatestX = event.clientX;
    dragLatestY = event.clientY;
    dragStartAngle = dragHandoffAngle;
    dragFlipProgress = 0;
    dragFlipCommitted = false;
    dragAllowedDirection = 0;
    dragMoved = false;
    dragCardRect = frame.getBoundingClientRect();
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
    dragImpactStartTranslateX = impactHandoffPose.translateX;
    dragImpactStartTranslateY = impactHandoffPose.translateY;
    dragImpactStartScale = impactHandoffPose.scale;
    dragPresentationTranslateX = impactHandoffPose.translateX;
    dragAxis = null;
    dismissDragReleaseY = 0;
    dismissDragReleaseScale = 1;
    impactShell.style.transform = `translate3d(0, ${dragImpactStartTranslateY}px, 0) scale(${dragImpactStartScale})`;
    impactShell.style.translate = dragImpactStartTranslateX === 0
      ? 'none'
      : `${dragImpactStartTranslateX}px 0`;
    stage.classList.add('is-dragging');
    paintLegendaryDragShine(dragHandoffAngle, true);
    let captureRequested = false;
    try {
      rotor.setPointerCapture(event.pointerId);
      captureRequested = true;
    } catch {}
    tracePointerOwnership('pointerdown-owned', {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      dragHandoffAngle: Number(dragHandoffAngle.toFixed(2)),
      interruptedImpactSettle: interruptedImpactAnimation !== null,
      interruptedPreviewSettle: interruptedPreviewAnimation !== null,
      interruptedFlip,
      captureRequested,
      hasPointerCapture: rotor.hasPointerCapture?.(event.pointerId) ?? null,
    });
    if (pointerTakeoverAuditRaf !== 0) cancelAnimationFrame(pointerTakeoverAuditRaf);
    const takeoverSequence = pointerTraceSequence;
    const takeoverPointerId = event.pointerId;
    pointerTakeoverAuditRaf = requestAnimationFrame(() => {
      pointerTakeoverAuditRaf = 0;
      if (pointerTraceSequence !== takeoverSequence || activePointerId !== takeoverPointerId) return;
      const renderedTransform = window.getComputedStyle(rotor).transform || rotor.style.transform || 'none';
      tracePointerOwnership('pointerdown-next-paint', {
        pointerId: takeoverPointerId,
        renderedAngle: getJourneyCardRenderedRotateYAngle(renderedTransform),
        rotorAnimationCount: rotor.getAnimations?.().length ?? null,
        idleShellAnimationCount: idleShell.getAnimations?.().length ?? null,
      });
    });
  }

  function handleAnyPointerInteraction(event: PointerEvent): void {
    // Let the rotor owner snapshot the painted coach pose before cancellation.
    if (event.composedPath().includes(rotor)) return;
    handoffIdleCoachImpact();
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return;
    pointerTraceMoveCount += 1;
    dragLatestX = event.clientX;
    dragLatestY = event.clientY;
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;
    if (pointerTraceMoveCount === 1) {
      tracePointerOwnership('pointermove-first', {
        pointerId: event.pointerId,
        deltaX: Number(deltaX.toFixed(2)),
        deltaY: Number(deltaY.toFixed(2)),
        eventTargetInsideRotor: event.composedPath().includes(rotor),
        hasPointerCapture: rotor.hasPointerCapture?.(event.pointerId) ?? null,
      });
    }
    dragMoved ||= Math.max(Math.abs(deltaX), Math.abs(deltaY)) > JOURNEY_CARD_FLIP_TAP_SLOP_PX;
    if (!dragMoved) return;
    event.preventDefault();
    const previousAxis = dragAxis;
    dragAxis = resolveJourneyCardDragAxis(dragAxis, deltaX, deltaY);
    if (dragAxis !== previousAxis) {
      tracePointerOwnership('pointer-axis-change', {
        pointerId: event.pointerId,
        previousAxis,
        axis: dragAxis,
        moveCount: pointerTraceMoveCount,
        deltaX: Number(deltaX.toFixed(2)),
        deltaY: Number(deltaY.toFixed(2)),
      });
      // Intent may change, but presentation continues from the same live 2D
      // vector below. Never reset either channel on the switching frame.
    }
    const verticalDistance = Math.abs(deltaY);
    const commitDistance = getJourneyCardDismissDragDistance(dragCardHeight);
    const previewProgress = clamp01(verticalDistance / commitDistance);
    const boundedDeltaY = dragCardRect
      ? getIosResistedModalVerticalDelta(deltaY, dragCardRect, dragViewportHeight)
      : deltaY;
    // Both axes stay live. Vertical movement can preview dismiss while the
    // same contact remains free to become a horizontal card rotation.
    dismissDragReleaseY = dragImpactStartTranslateY + boundedDeltaY;
    dismissDragReleaseScale = Math.max(0.9, dragImpactStartScale - previewProgress * 0.035);
    impactShell.style.transform = `translate3d(0, ${dismissDragReleaseY}px, 0) scale(${dismissDragReleaseScale})`;
    const translateX = Math.max(
      dragHorizontalMinX,
      Math.min(dragHorizontalMaxX, dragImpactStartTranslateX + deltaX * 0.12),
    );
    dragPresentationTranslateX = translateX;
    impactShell.style.translate = `${translateX.toFixed(2)}px 0`;
    if (dragFlipCommitted) return;
    const direction = Math.sign(deltaX) as -1 | 0 | 1;
    if (dragAllowedDirection !== 0 && direction !== 0 && direction !== dragAllowedDirection) {
      dragFlipProgress = 0;
      setRotorAngle(dragStartAngle);
      queueLegendaryDragShine(dragStartAngle);
      return;
    }
    const handoffDistance = Math.max(
      1,
      dragViewportWidth * JOURNEY_CARD_FLIP_DRAG_HANDOFF_VIEWPORT_RATIO,
    );
    dragFlipProgress = clamp01(Math.abs(deltaX) / handoffDistance);
    const dragAngle = getJourneyCardDragFlipAngle(dragStartAngle, deltaX, dragViewportWidth);
    setRotorAngle(dragAngle);
    queueLegendaryDragShine(dragAngle);
    if (dragAxis === 'horizontal' && dragFlipProgress >= 1) {
      dragFlipCommitted = true;
      const committedDirection = direction || 1;
      const committedPointerId = activePointerId;
      const committedPointerSequence = pointerTraceSequence;
      tracePointerOwnership('pointer-flip-commit', {
        pointerId: event.pointerId,
        moveCount: pointerTraceMoveCount,
        direction: committedDirection,
        deltaX: Number(deltaX.toFixed(2)),
      });
      void animateInteractiveFlip(stableFace === 'front' ? 'back' : 'front').then(() => {
        if (
          activePointerId === null
          || activePointerId !== committedPointerId
          || pointerTraceSequence !== committedPointerSequence
          || closing
          || settled
          || flipping
        ) return;
        dragStartX = dragLatestX;
        dragStartY = dragLatestY;
        dragImpactStartTranslateX = dragPresentationTranslateX;
        dragImpactStartTranslateY = dismissDragReleaseY;
        dragImpactStartScale = dismissDragReleaseScale;
        dragStartAngle = stableRotorAngle();
        dragFlipProgress = 0;
        dragFlipCommitted = false;
        dragAllowedDirection = committedDirection === -1 ? 1 : -1;
        dragAxis = 'horizontal';
      });
    }
  }

  function finishPointer(
    event: PointerEvent,
    allowCommit: boolean,
    source: 'rotor-up' | 'rotor-cancel' | 'lost-capture' | 'window-up' | 'window-cancel',
    releaseX = event.clientX,
    releaseY = event.clientY,
  ): void {
    if (event.pointerId !== activePointerId) return;
    const deltaX = releaseX - dragStartX;
    const deltaY = releaseY - dragStartY;
    const moved = dragMoved;
    tracePointerOwnership('pointer-finish', {
      source,
      pointerId: event.pointerId,
      allowCommit,
      moveCount: pointerTraceMoveCount,
      axis: dragAxis,
      moved,
      deltaX: Number(deltaX.toFixed(2)),
      deltaY: Number(deltaY.toFixed(2)),
      hasPointerCapture: rotor.hasPointerCapture?.(event.pointerId) ?? null,
    });
    activePointerId = null;
    try { rotor.releasePointerCapture(event.pointerId); } catch {}
    stage.classList.remove('is-dragging');
    const shouldDismiss = allowCommit
      && dragAxis !== 'horizontal'
      && Math.abs(deltaY) >= getJourneyCardDismissDragDistance(dragCardHeight)
      && isJourneyCardVerticalDismissGesture(deltaX, deltaY);
    if (shouldDismiss) {
      clearLegendaryDragShine();
      event.preventDefault();
      event.stopPropagation();
      void beginClose('dismiss');
      return;
    }
    if (!allowCommit) {
      clearLegendaryDragShine();
      if (flipping) {
        impactShell.style.translate = 'none';
        impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
        return;
      }
      setRotorAngle(stableFace === 'front' ? 0 : -180);
      impactShell.style.translate = 'none';
      impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
      startSurfaceIdle();
      scheduleIdleCoach();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!moved) {
      impactShell.style.translate = 'none';
      impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
      const targetFace = stableFace === 'front' ? 'back' : 'front';
      void animateInteractiveFlip(targetFace, targetFace === 'back' ? 1 : -1);
      return;
    }
    const releaseDirection = Math.sign(deltaX) as -1 | 0 | 1;
    const shouldCommitReleasedDrag = !flipping
      && !dragFlipCommitted
      && dragAxis === 'horizontal'
      && shouldCommitJourneyCardReleasedDrag(deltaX, dragViewportWidth, dragAllowedDirection);
    if (shouldCommitReleasedDrag) {
      clearLegendaryDragShine();
      impactShell.style.translate = 'none';
      impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
      const targetFace = stableFace === 'front' ? 'back' : 'front';
      void animateInteractiveFlip(
        targetFace,
        releaseDirection === 0 ? undefined : releaseDirection,
        currentAngle,
      );
      return;
    }
    // Releasing any partial horizontal scrub returns to its starting face.
    // A short release below the KING threshold returns to its starting face;
    // crossing the live 40% handoff while held still commits immediately.
    const fromTranslate = impactShell.style.translate || 'none';
    const fromImpactTransform = impactShell.style.transform || 'translate3d(0, 0, 0) scale(1)';
    const previewFromAngle = currentAngle;
    const committedFlipInFlight = allowCommit && dragFlipCommitted;
    const previewToAngle = committedFlipInFlight ? previewFromAngle : stableRotorAngle();
    handoffSurfaceIdle();
    const animation = impactShell.animate?.([
      { translate: fromTranslate, transform: fromImpactTransform },
      { translate: 'none', transform: 'translate3d(0, 0, 0) scale(1)' },
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
    if (dragPreviewSettleAnimation) stage.classList.add('is-face-settling');
    if (!animation) {
      clearLegendaryDragShine();
      impactShell.style.translate = 'none';
      impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
      setRotorAngle(previewToAngle);
      if (!flipping) {
        startSurfaceIdle();
        scheduleIdleCoach();
      }
      stage.classList.remove('is-face-settling');
      return;
    }
    const previewAnimation = dragPreviewSettleAnimation;
    if (previewAnimation) {
      paintLegendaryDragShine(previewFromAngle, true);
      const settleDuration = prefersReducedMotion ? 1 : 180;
      const watchSettlePaintFace = () => {
        if (closing || settled || dragPreviewSettleAnimation !== previewAnimation) {
          flipEdgeRaf = 0;
          return;
        }
        const progress = clamp01(Number(previewAnimation.currentTime ?? 0) / settleDuration);
        const settleAngle = previewFromAngle + (previewToAngle - previewFromAngle) * progress;
        setPaintFaceForAngle(settleAngle);
        paintLegendaryDragShine(settleAngle, true);
        if (progress >= 1) {
          flipEdgeRaf = 0;
          return;
        }
        flipEdgeRaf = requestAnimationFrame(watchSettlePaintFace);
      };
      flipEdgeRaf = requestAnimationFrame(watchSettlePaintFace);
    } else paintLegendaryDragShine(previewFromAngle, true);
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
      stage.classList.remove('is-face-settling');
      impactShell.style.translate = 'none';
      impactShell.style.transform = 'translate3d(0, 0, 0) scale(1)';
      if (!flipping) {
        setRotorAngle(previewToAngle);
      }
      previewAnimation?.cancel();
      animation.cancel();
      if (!flipping) {
        startSurfaceIdle();
        clearLegendaryDragShine();
        scheduleIdleCoach();
      } else {
        clearLegendaryDragShine();
      }
    });
  }

  function handlePointerUp(event: PointerEvent): void {
    finishPointer(event, true, 'rotor-up');
  }

  function handlePointerCancel(event: PointerEvent): void {
    finishPointer(event, false, 'rotor-cancel');
  }

  function handleLostPointerCapture(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return;
    // Capture loss is only a transport change. Window listeners keep the same
    // gesture alive until a real pointerup/pointercancel arrives.
    tracePointerOwnership('pointer-capture-fallback', {
      pointerId: event.pointerId,
      moveCount: pointerTraceMoveCount,
    });
  }

  function handleWindowPointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId || event.composedPath().includes(rotor)) return;
    handlePointerMove(event);
  }

  function handleWindowPointerUp(event: PointerEvent): void {
    finishPointer(event, true, 'window-up');
  }

  function handleWindowPointerCancel(event: PointerEvent): void {
    finishPointer(event, false, 'window-cancel');
  }

  function handleRotorKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target !== front) return;
    handoffIdleCoachImpact();
    event.preventDefault();
    const targetFace = stableFace === 'front' ? 'back' : 'front';
    void animateInteractiveFlip(targetFace, targetFace === 'back' ? 1 : -1);
  }

  function handleTurnControlClick(event: MouseEvent): void {
    handoffIdleCoachImpact();
    event.preventDefault();
    event.stopPropagation();
    void animateInteractiveFlip('front', -1);
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === stage || event.target === backdrop) void beginClose('dismiss');
  }

  function handleDocumentKeyDown(event: KeyboardEvent): void {
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
  rotor.addEventListener('lostpointercapture', handleLostPointerCapture);
  window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
  window.addEventListener('pointerup', handleWindowPointerUp);
  window.addEventListener('pointercancel', handleWindowPointerCancel);
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
