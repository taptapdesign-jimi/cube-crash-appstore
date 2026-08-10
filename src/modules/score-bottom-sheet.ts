/**
 * Score Bottom Sheet
 * Shows high score stats and cubes cracked when user clicks on score area in HUD
 * Uses the shared centered gameplay-modal presentation and outside dismissal.
 */

import { boardStatsService } from '../services/board-stats-service.js';
import { arcadeStatsService } from '../services/arcade-stats-service.js';
import { resumeGame } from './pause-utils.js';
import { isArcadeHomeRunMode } from './run-mode.js';
import { container } from '../core/dependency-injection.js';
import { gsap } from 'gsap';
import {
  mountGameplaySheetClose,
  type GameplaySheetCloseController,
} from './gameplay-sheet-close.ts';
import { GAMEPLAY_MODAL_BENCHMARK } from './gameplay-modal-benchmark.ts';
import {
  createDetailModalStatsEnterDelays,
  getDetailModalStatsEnterTotalDuration,
} from './detail-modal-stats-enter-motion.js';
import { mountGameplayModalSpatialMotion } from './gameplay-modal-spatial-motion.js';
import { installGameplayOverlayModalDragMotion } from './modal-vertical-drag-dismiss.js';

let modal: HTMLElement | null = null;
let backdrop: HTMLElement | null = null;
let isVisible = false;
type ScoreSheetMode = 'score' | 'combo';
let activeMode: ScoreSheetMode = 'score';
let scoreSheetLifecycleId = 0;
let scoreSheetTransitionInProgress = false;
let scoreSheetCloseController: GameplaySheetCloseController | null = null;
let scoreSheetStatsEnterCleanupTimeout: ReturnType<typeof setTimeout> | null = null;
let disposeScoreSheetSpatialMotion: (() => void) | null = null;
let disposeScoreSheetDragDismiss: (() => void) | null = null;

function cleanupScoreSheetSpatialMotion(): void {
  disposeScoreSheetSpatialMotion?.();
  disposeScoreSheetSpatialMotion = null;
}

function disposeScoreSheetClose(): void {
  scoreSheetCloseController?.dispose();
  scoreSheetCloseController = null;
}

// Outside click handlers (same pattern as end-run-modal)
let outsideClickHandler: ((e: Event) => void) | null = null;
let outsideTouchEndHandler: ((e: TouchEvent) => void) | null = null;
let outsideTouchCancelHandler: ((e: TouchEvent) => void) | null = null;

function cleanupOutsideScoreSheetHandlers(): void {
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
  if (outsideTouchEndHandler) {
    document.removeEventListener('touchend', outsideTouchEndHandler);
    outsideTouchEndHandler = null;
  }
  if (outsideTouchCancelHandler) {
    document.removeEventListener('touchcancel', outsideTouchCancelHandler);
    outsideTouchCancelHandler = null;
  }
  document.onclick = null;
}

function getScoreSheetElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.score-bottom-sheet'))
    .filter((el): el is HTMLElement => el instanceof HTMLElement);
}

function getScoreSheetBackdropElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.score-bottom-sheet-backdrop'))
    .filter((el): el is HTMLElement => el instanceof HTMLElement);
}

function hideAndRemoveScoreSheetDom(reason: string): void {
  disposeScoreSheetDragDismiss?.();
  disposeScoreSheetDragDismiss = null;
  cleanupScoreSheetSpatialMotion();
  disposeScoreSheetClose();
  const sheets = getScoreSheetElements();
  const backdrops = getScoreSheetBackdropElements();
  if (sheets.length > 0 || backdrops.length > 0) {
    console.log(`🧯 Removing score sheet DOM (${reason})`, {
      sheets: sheets.length,
      backdrops: backdrops.length
    });
  }

  sheets.forEach((el) => {
    try {
      gsap.killTweensOf(el);
      el.classList.remove('visible');
      el.classList.remove('score-sheet-shadow-active');
      el.classList.add('score-sheet-shadow-fade-out');
      el.style.pointerEvents = 'none';
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.transform = 'none';
      el.style.transition = 'none';
      el.remove();
    } catch {
      /* non-fatal */
    }
  });

  backdrops.forEach((el) => {
    try {
      el.style.pointerEvents = 'none';
      el.style.display = 'none';
      el.remove();
    } catch {
      /* non-fatal */
    }
  });
}

function cleanupStaleScoreSheetBeforeOpen(reason: string): void {
  const domSheets = getScoreSheetElements();
  const domBackdrops = getScoreSheetBackdropElements();
  const hasClosingSheet = !!(modal && (modal as any)._closing);
  if (domSheets.length === 0 && domBackdrops.length === 0 && !backdrop && !hasClosingSheet) return;

  console.log(`🧯 Cleaning stale score sheet before open (${reason})`);
  scoreSheetLifecycleId += 1;
  scoreSheetTransitionInProgress = false;
  cleanupOutsideScoreSheetHandlers();
  cleanupAllScoreSheetResources();
  disableScoreSheetBackdrop();
  hideAndRemoveScoreSheetDom(`stale-cleanup:${reason}`);

  modal = null;
  backdrop = null;
  isVisible = false;
  unfreezeScoreSheetGameplay(`stale-cleanup:${reason}`);
}

function ensureScoreStatDividerExists(): void {
  const container = document.querySelector('.score-bottom-sheet .score-stats-container') as HTMLElement | null;
  if (!container) return;
  if (container.querySelector('.score-stat-divider')) return;

  const statItems = container.querySelectorAll('.stat-item');
  if (statItems.length < 2) return;

  const divider = document.createElement('div');
  divider.className = 'score-stat-divider';
  divider.setAttribute('aria-hidden', 'true');
  container.insertBefore(divider, statItems[1]);
}

function getCurrentBoardNumber(): number {
  let currentBoardNumber = 1;
  try {
    const STATE = (window as any).STATE;
    if (STATE && Number.isFinite(STATE.boardNumber)) {
      currentBoardNumber = STATE.boardNumber;
    } else {
      const savedGame = localStorage.getItem('cc_saved_game');
      if (savedGame) {
        const gameState = JSON.parse(savedGame);
        if (Number.isFinite(gameState.boardNumber)) {
          currentBoardNumber = gameState.boardNumber;
        } else if (Number.isFinite(gameState.level)) {
          currentBoardNumber = gameState.level;
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to get board number for score bottom sheet:', error);
  }
  return currentBoardNumber;
}

function getScoreSheetStats(boardNumber: number, mode: ScoreSheetMode = activeMode): {
  title: string;
  primaryValue: number | string;
  primaryLabel: string;
  primaryIcon: string;
  secondaryValue?: number | string;
  secondaryLabel?: string;
  secondaryIcon?: string;
  subtitle: string;
} {
  if (mode === 'combo') {
    const longestCombo = isArcadeHomeRunMode()
      ? arcadeStatsService.getStats().longestCombo
      : boardStatsService.getBoardStats(boardNumber).longestCombo;
    return {
      title: 'Combo',
      primaryValue: longestCombo,
      primaryLabel: 'Longest combo',
      primaryIcon: './assets/combo-icon.png',
      subtitle: 'Stack and merge quickly<br>to boost your score.'
    };
  }

  if (isArcadeHomeRunMode()) {
    const arcadeStats = arcadeStatsService.getStats();
    const highestStageOpened = Math.max(1, arcadeStats.highestStageOpened || 1);
    return {
      title: 'High Score',
      primaryValue: arcadeStats.highScore,
      primaryLabel: 'High score',
      primaryIcon: './assets/highscore-icon.png',
      secondaryValue: highestStageOpened.toString().padStart(2, '0'),
      secondaryLabel: 'Rounds cleared',
      secondaryIcon: './assets/clean-board.png',
      subtitle: 'Your best score so far.'
    };
  }

  const boardStats = boardStatsService.getBoardStats(boardNumber);
  return {
    title: 'High Score',
    primaryValue: boardStats.highScore,
    primaryLabel: 'High score',
    primaryIcon: './assets/highscore-icon.png',
    subtitle: 'Your best score so far.'
  };
}

function formatScoreSheetStatValue(value: number | string): string {
  return typeof value === 'number' ? value.toLocaleString() : value;
}

function renderStatsItems(scoreSheetStats: ReturnType<typeof getScoreSheetStats>): string {
  const hasSecondary = scoreSheetStats.secondaryValue !== undefined && scoreSheetStats.secondaryValue !== null;
  return `
          <div class="stat-item">
            <div class="stat-icon">
              <img id="score-sheet-primary-icon" src="${scoreSheetStats.primaryIcon}" alt="" aria-hidden="true">
            </div>
            <div class="stat-content">
              <div id="score-sheet-high-score" class="stat-value">${formatScoreSheetStatValue(scoreSheetStats.primaryValue)}</div>
              <div id="score-sheet-primary-label" class="stat-label">${scoreSheetStats.primaryLabel}</div>
            </div>
          </div>
          ${hasSecondary ? `
          <div class="score-stat-divider" aria-hidden="true"></div>
          <div class="stat-item">
            <div class="stat-icon">
              <img id="score-sheet-secondary-icon" src="${scoreSheetStats.secondaryIcon}" alt="" aria-hidden="true">
            </div>
            <div class="stat-content">
              <div id="score-sheet-secondary-value" class="stat-value">${formatScoreSheetStatValue(scoreSheetStats.secondaryValue!)}</div>
              <div id="score-sheet-secondary-label" class="stat-label">${scoreSheetStats.secondaryLabel}</div>
            </div>
          </div>` : ''}
  `;
}

function refreshScoreSheetContent(mode: ScoreSheetMode = activeMode): void {
  const currentBoardNumber = getCurrentBoardNumber();
  const scoreSheetStats = getScoreSheetStats(currentBoardNumber, mode);
  const titleEl = document.getElementById('score-sheet-title');
  const subtitleEl = document.getElementById('score-sheet-subtitle');
  const sheetEl = document.querySelector('.score-bottom-sheet') as HTMLElement | null;
  const statsContainer = document.querySelector('.score-bottom-sheet .score-stats-container') as HTMLElement | null;

  if (sheetEl) {
    sheetEl.classList.toggle('score-sheet-combo-mode', mode === 'combo');
    sheetEl.classList.toggle('score-sheet-score-mode', mode !== 'combo');
  }
  if (titleEl) titleEl.textContent = scoreSheetStats.title;
  if (subtitleEl) subtitleEl.innerHTML = scoreSheetStats.subtitle;
  if (statsContainer) statsContainer.innerHTML = renderStatsItems(scoreSheetStats);
  ensureScoreStatDividerExists();

  console.log(`📊 ${mode === 'combo' ? 'Combo' : 'Score'} bottom sheet stats refreshed for board ${currentBoardNumber}:`, {
    primaryValue: scoreSheetStats.primaryValue,
    primaryLabel: scoreSheetStats.primaryLabel,
    secondaryValue: scoreSheetStats.secondaryValue,
    secondaryLabel: scoreSheetStats.secondaryLabel,
    arcade: isArcadeHomeRunMode()
  });
}

function getPointerClientPoint(e: Event): { x: number; y: number } | null {
  const touchEvent = e as TouchEvent;
  const touch = touchEvent.changedTouches?.[0] || touchEvent.touches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  const mouseEvent = e as MouseEvent;
  if (Number.isFinite(mouseEvent.clientX) && Number.isFinite(mouseEvent.clientY)) {
    return { x: mouseEvent.clientX, y: mouseEvent.clientY };
  }
  return null;
}

function maybeBounceHudAreaFromOutsideTap(e: Event): void {
  const point = getPointerClientPoint(e);
  if (!point) return;

  try {
    const hudRoot = (window as any).HUD_ROOT;
    const hudApi = (window as any).HUD;
    const touchArea = activeMode === 'combo' ? hudRoot?._comboTouchArea : hudRoot?._scoreTouchArea;
    if (!touchArea || typeof touchArea.getBounds !== 'function') return;

    const bounds = touchArea.getBounds();
    const withinHudArea =
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height;

    if (!withinHudArea) return;

    if (activeMode === 'combo' && typeof hudApi?.bounceComboArea === 'function') {
      hudApi.bounceComboArea();
    } else if (typeof hudApi?.bounceScoreArea === 'function') {
      hudApi.bounceScoreArea();
    }
  } catch (error) {
    console.warn('⚠️ Failed to bounce HUD area from score sheet outside tap:', error);
  }
}

// 🔥 MEMORY LEAK FIX: Track all timeouts, rAFs, and event listeners for cleanup
const _scoreSheetTimeouts = new Set<ReturnType<typeof setTimeout>>();
const _scoreSheetAnimationFrames = new Set<number>();
const _scoreSheetEventListeners: Array<{
  element: HTMLElement | Document;
  event: string;
  handler: EventListener;
  options?: AddEventListenerOptions;
}> = [];

function trackScoreSheetTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timeout = setTimeout(() => {
    callback();
    _scoreSheetTimeouts.delete(timeout);
  }, delay);
  _scoreSheetTimeouts.add(timeout);
  return timeout;
}

function trackScoreSheetAnimationFrame(callback: (now: number) => void): number {
  const rafId = requestAnimationFrame((now: number) => {
    callback(now);
    _scoreSheetAnimationFrames.delete(rafId);
  });
  _scoreSheetAnimationFrames.add(rafId);
  return rafId;
}

function trackScoreSheetEventListener(
  element: HTMLElement | Document,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): void {
  element.addEventListener(event, handler, options);
  _scoreSheetEventListeners.push({ element, event, handler, options });
}

function clearAllScoreSheetTimeouts(): void {
  console.log(`🧹 score-bottom-sheet: Clearing ${_scoreSheetTimeouts.size} timeouts`);
  _scoreSheetTimeouts.forEach(timeout => clearTimeout(timeout));
  _scoreSheetTimeouts.clear();
}

function clearAllScoreSheetAnimationFrames(): void {
  console.log(`🧹 score-bottom-sheet: Clearing ${_scoreSheetAnimationFrames.size} animation frames`);
  _scoreSheetAnimationFrames.forEach(rafId => cancelAnimationFrame(rafId));
  _scoreSheetAnimationFrames.clear();
}

function clearAllScoreSheetEventListeners(): void {
  console.log(`🧹 score-bottom-sheet: Clearing ${_scoreSheetEventListeners.length} event listeners`);
  _scoreSheetEventListeners.forEach(({ element, event, handler, options }) => {
    try {
      element.removeEventListener(event, handler, options);
    } catch (e) {
      console.warn(`⚠️ score-bottom-sheet: Failed to remove ${event} listener:`, e);
    }
  });
  _scoreSheetEventListeners.length = 0;
}

function getScoreSheetStatElements(sheet: HTMLElement): HTMLElement[] {
  const statsContainer = sheet.querySelector<HTMLElement>('.score-stats-container');
  if (!statsContainer) return [];
  return Array.from(statsContainer.children).filter((element): element is HTMLElement => (
    element instanceof HTMLElement && (
      element.classList.contains('stat-item') ||
      element.classList.contains('score-stat-divider')
    )
  ));
}

function clearScoreSheetStatsMotion(sheet: HTMLElement | null): void {
  if (scoreSheetStatsEnterCleanupTimeout) {
    clearTimeout(scoreSheetStatsEnterCleanupTimeout);
    _scoreSheetTimeouts.delete(scoreSheetStatsEnterCleanupTimeout);
    scoreSheetStatsEnterCleanupTimeout = null;
  }
  if (!sheet) return;
  sheet.classList.remove('score-sheet-stats-enter-primed');
  getScoreSheetStatElements(sheet).forEach((element) => {
    element.classList.remove('score-sheet-stat-entering', 'score-sheet-stat-exiting');
    element.style.removeProperty('animation-delay');
  });
}

function prepareScoreSheetStatsEnter(sheet: HTMLElement): void {
  clearScoreSheetStatsMotion(sheet);
  sheet.classList.add('score-sheet-stats-enter-primed');
}

function playScoreSheetStatsEnter(sheet: HTMLElement): void {
  const statElements = getScoreSheetStatElements(sheet);
  if (!statElements.length) {
    sheet.classList.remove('score-sheet-stats-enter-primed');
    return;
  }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
    sheet.classList.remove('score-sheet-stats-enter-primed');
    return;
  }

  const delays = createDetailModalStatsEnterDelays(statElements.length);
  statElements.forEach((element, index) => {
    element.style.animationDelay = `${delays[index] ?? 0}s`;
    element.classList.add('score-sheet-stat-entering');
  });
  sheet.classList.remove('score-sheet-stats-enter-primed');
  scoreSheetStatsEnterCleanupTimeout = trackScoreSheetTimeout(() => {
    scoreSheetStatsEnterCleanupTimeout = null;
    statElements.forEach((element) => {
      element.classList.remove('score-sheet-stat-entering');
      element.style.removeProperty('animation-delay');
    });
  }, Math.ceil(getDetailModalStatsEnterTotalDuration(statElements.length) * 1000) + 34);
}

function replayScoreSheetStatsEnter(sheet: HTMLElement): void {
  prepareScoreSheetStatsEnter(sheet);
  trackScoreSheetAnimationFrame(() => {
    if (sheet !== modal || !sheet.isConnected || (sheet as any)._closing) return;
    playScoreSheetStatsEnter(sheet);
  });
}

function playScoreSheetStatsExit(sheet: HTMLElement): void {
  const statElements = getScoreSheetStatElements(sheet);
  if (scoreSheetStatsEnterCleanupTimeout) {
    clearTimeout(scoreSheetStatsEnterCleanupTimeout);
    _scoreSheetTimeouts.delete(scoreSheetStatsEnterCleanupTimeout);
    scoreSheetStatsEnterCleanupTimeout = null;
  }
  sheet.classList.remove('score-sheet-stats-enter-primed');
  statElements.forEach((element) => {
    element.classList.remove('score-sheet-stat-entering', 'score-sheet-stat-exiting');
    element.style.removeProperty('animation-delay');
  });
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) return;

  // Restart the same shared keyframe in its forward direction even when close
  // interrupts the enter cascade.
  void sheet.offsetHeight;
  const delays = createDetailModalStatsEnterDelays(statElements.length);
  statElements.forEach((element, index) => {
    element.style.animationDelay = `${delays[index] ?? 0}s`;
    element.classList.add('score-sheet-stat-exiting');
  });
}

function cleanupAllScoreSheetResources(): void {
  clearScoreSheetStatsMotion(modal);
  disposeScoreSheetClose();
  clearAllScoreSheetTimeouts();
  clearAllScoreSheetAnimationFrames();
  clearAllScoreSheetEventListeners();
  console.log('✅ score-bottom-sheet: All resources cleaned up!');
}

function disableScoreSheetBackdrop(): void {
  try {
    if (backdrop) {
      backdrop.style.pointerEvents = 'none';
      backdrop.style.display = 'none';
    }
    document.querySelectorAll('.score-bottom-sheet-backdrop').forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
      }
    });
  } catch {
    /* non-fatal */
  }
}

function unfreezeScoreSheetGameplay(reason: string): void {
  const boardContainer = document.getElementById('board-container');
  if (boardContainer) {
    boardContainer.style.removeProperty('pointer-events');
    boardContainer.style.removeProperty('user-select');
    boardContainer.style.removeProperty('touch-action');
  }
  try {
    if (container && typeof (container as any).set === 'function') {
      (container as any).set('gamePaused', false);
    }
  } catch {
    /* non-fatal */
  }
  (window as any)._gamePaused = false;
  console.log(`🔓 Score sheet gameplay unfrozen (${reason})`);
}

/** Undo freeze + pause from opening the sheet; skip if end-run (other) bottom sheet is open. */
function restoreGameplayAfterScoreSheetDismissed(reason: string): void {
  if (document.querySelector('.simple-bottom-sheet:not(.score-bottom-sheet)')) {
    console.log(`📊 restoreGameplayAfterScoreSheetDismissed(${reason}): skipped — other bottom sheet open`);
    return;
  }
  try {
    getScoreSheetBackdropElements().forEach((el) => el.remove());
  } catch {
    /* non-fatal */
  }
  const boardContainer = document.getElementById('board-container');
  if (boardContainer) {
    boardContainer.style.removeProperty('pointer-events');
    boardContainer.style.removeProperty('user-select');
    boardContainer.style.removeProperty('touch-action');
    console.log(`🔓 Board unfrozen (${reason})`);
  }
  unfreezeScoreSheetGameplay(reason);
  try {
    resumeGame();
    console.log(`🔓 Game resumed (${reason})`);
  } catch (error) {
    console.warn('⚠️ Failed to resume game after score sheet:', error);
  }
}

function createModal(): HTMLElement {
  hideAndRemoveScoreSheetDom('create');
  modal = null;
  backdrop = null;

  const backdropEl = document.createElement('div');
  backdropEl.className = 'score-bottom-sheet-backdrop';
  backdropEl.style.cssText = `
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 999999998;
    pointer-events: auto;
  `;
  backdrop = backdropEl;

  const modalEl = document.createElement('div');
  modalEl.className = 'simple-bottom-sheet score-bottom-sheet cc-gameplay-modal-stage';
  modalEl.classList.add(activeMode === 'combo' ? 'score-sheet-combo-mode' : 'score-sheet-score-mode');
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'score-sheet-title');
  modalEl.style.touchAction = 'none';
  
  // CRITICAL: Start with display: none to prevent flash
  modalEl.style.display = 'none';

  const currentBoardNumber = getCurrentBoardNumber();
  const scoreSheetStats = getScoreSheetStats(currentBoardNumber, activeMode);
  const titleText = scoreSheetStats.title;
  const subtitleText = scoreSheetStats.subtitle;
  
  modalEl.innerHTML = `
    <div class="cc-gameplay-modal-bounce-shell">
      <div class="cc-gameplay-modal-flip-shell">
        <div class="cc-gameplay-modal-idle-shell">
          <div class="cc-gameplay-modal-gyro-shell">
            <div class="cc-gameplay-modal-paper-shell">
              <div class="simple-content">
                <div class="simple-header">
                  <div class="simple-title-section">
                    <h2 id="score-sheet-title" class="cc-gameplay-modal-title">${titleText}</h2>
                    <p id="score-sheet-subtitle">${subtitleText}</p>
                  </div>
                  <div class="score-stats-container">
${renderStatsItems(scoreSheetStats)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const scoreCloseHost = modalEl.querySelector('.cc-gameplay-modal-gyro-shell') as HTMLElement | null;
  scoreSheetCloseController = mountGameplaySheetClose(scoreCloseHost ?? modalEl, () => {
    console.log('✕ Score bottom sheet close control activated');
    hideScoreBottomSheet();
  }, `Close ${titleText}`);
  const bounceShell = modalEl.querySelector<HTMLElement>('.cc-gameplay-modal-bounce-shell');
  const restTilt = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.65);
  modalEl.style.setProperty('--score-modal-rest-tilt', `${restTilt.toFixed(2)}deg`);
  disposeScoreSheetDragDismiss = bounceShell ? installGameplayOverlayModalDragMotion(modalEl, {
    onDismiss: hideScoreBottomSheet,
    motionElement: bounceShell,
    restTiltDeg: restTilt,
  }) : null;

  // Backdrop input remains a separate close path; the paper drag above owns
  // the shared finger-follow and snapback motion.
  addOutsideClickFunctionality(modalEl);

  document.body.appendChild(backdropEl);
  document.body.appendChild(modalEl);
  modal = modalEl;
  return modalEl;
}

function addOutsideClickFunctionality(modalEl: HTMLElement): void {
  // Clean up previous handlers first
  cleanupOutsideScoreSheetHandlers();
  let backdropStartY: number | null = null;
  let backdropDragCloseStarted = false;
  
  // Create named handlers for proper cleanup
  outsideClickHandler = (e: Event) => {
    // Check if click is outside modal AND modal is still open
    if (modalEl && modalEl.parentNode && e.target && !modalEl.contains(e.target as Node)) {
      // Check if modal is visible (has 'visible' class or isVisible flag is true)
      if (modalEl.classList.contains('visible') || isVisible) {
        console.log('📊 Outside click detected - closing score bottom sheet');
        maybeBounceHudAreaFromOutsideTap(e);
        hideScoreBottomSheet();
      }
    }
  };
  
  outsideTouchEndHandler = (e: TouchEvent) => {
    // Check if touch is outside modal AND modal is still open
    if (modalEl && modalEl.parentNode && e.target && !modalEl.contains(e.target as Node)) {
      // Check if modal is visible (has 'visible' class or isVisible flag is true)
      if (modalEl.classList.contains('visible') || isVisible) {
        console.log('📊 Outside touch detected - closing score bottom sheet');
        maybeBounceHudAreaFromOutsideTap(e);
        hideScoreBottomSheet();
      }
    }
  };

  outsideTouchCancelHandler = (e: TouchEvent) => {
    if (modalEl && modalEl.parentNode && e.target && !modalEl.contains(e.target as Node)) {
      if (modalEl.classList.contains('visible') || isVisible) {
        console.log('📊 Outside touch cancelled - closing score bottom sheet safely');
        maybeBounceHudAreaFromOutsideTap(e);
        hideScoreBottomSheet();
      }
    }
  };
  
  // Attach with small delay to avoid capturing the click that opened the modal
  trackScoreSheetTimeout(() => {
    if (outsideClickHandler && modalEl && modalEl.parentNode) {
      trackScoreSheetEventListener(document, 'click', outsideClickHandler, { passive: false });
      console.log('📊 Outside click handler attached for score bottom sheet');
    }
    if (outsideTouchEndHandler && modalEl && modalEl.parentNode) {
      trackScoreSheetEventListener(document, 'touchend', outsideTouchEndHandler, { passive: false });
      console.log('📊 Outside touch handler attached for score bottom sheet');
    }
    if (outsideTouchCancelHandler && modalEl && modalEl.parentNode) {
      trackScoreSheetEventListener(document, 'touchcancel', outsideTouchCancelHandler, { passive: false });
      console.log('📊 Outside touchcancel handler attached for score bottom sheet');
    }
    if (backdrop && modalEl && modalEl.parentNode) {
      trackScoreSheetEventListener(backdrop, 'touchstart', (event) => {
        const point = getPointerClientPoint(event);
        backdropStartY = point?.y ?? null;
        backdropDragCloseStarted = false;
      }, { passive: true });
      trackScoreSheetEventListener(backdrop, 'touchmove', (event) => {
        if (backdropDragCloseStarted || backdropStartY === null) return;
        const point = getPointerClientPoint(event);
        if (!point) return;

        const deltaY = point.y - backdropStartY;
        if (Math.abs(deltaY) > 28) {
          backdropDragCloseStarted = true;
          event.preventDefault();
          console.log('📊 Outside downward drag detected - closing score bottom sheet safely');
          hideScoreBottomSheet();
        }
      }, { passive: false });
      trackScoreSheetEventListener(backdrop, 'click', (event) => {
        maybeBounceHudAreaFromOutsideTap(event);
        hideScoreBottomSheet();
      });
      trackScoreSheetEventListener(backdrop, 'touchend', (event) => {
        maybeBounceHudAreaFromOutsideTap(event);
        hideScoreBottomSheet();
      }, { passive: false });
      trackScoreSheetEventListener(backdrop, 'touchcancel', (event) => {
        maybeBounceHudAreaFromOutsideTap(event);
        hideScoreBottomSheet();
      }, { passive: false });
    }
  }, 200);
}

// 🔥 SAME LOGIC AS END RUN MODAL: Export function to check if modal is visible
export function isScoreBottomSheetVisible(): boolean {
  const result = (() => {
    // 🔥 CRITICAL: First check if modal exists in DOM (most reliable check)
    const domElement = document.querySelector('.score-bottom-sheet');
    const hasDomElement = domElement && domElement.parentNode;
    
    // 🔥 CRITICAL: If isVisible is true but modal is null and no DOM element, reset state
    if (isVisible && !modal && !hasDomElement) {
      console.log('🔍 isScoreBottomSheetVisible: isVisible=true but no modal or DOM element - resetting state');
      isVisible = false;
      restoreGameplayAfterScoreSheetDismissed('visible-flag-stale');
      return false;
    }
    
    // 🔥 CRITICAL: If modal is closing, it's not visible
    if (modal && (modal as any)._closing) {
      console.log('🔍 isScoreBottomSheetVisible: modal is closing');
      return true;
    }
    
    // 🔥 CRITICAL: Check if modal exists and is actually visible (has 'visible' class)
    if (modal && modal.parentNode) {
      // Check if modal has 'visible' class (actually shown)
      if (modal.classList.contains('visible')) {
        console.log('🔍 isScoreBottomSheetVisible: modal has visible class');
        return true;
      }
    }
    
    // 🔥 CRITICAL: Also check DOM directly as fallback
    if (hasDomElement && domElement.classList.contains('visible')) {
      console.log('🔍 isScoreBottomSheetVisible: DOM element has visible class');
      return true;
    }
    
    // 🔥 CRITICAL: Check isVisible flag last (can be stale if modal was removed)
    if (isVisible && (modal || hasDomElement)) {
      console.log('🔍 isScoreBottomSheetVisible: isVisible=true and modal/DOM exists');
      return true;
    }
    
    console.log('🔍 isScoreBottomSheetVisible: returning false', { 
      isVisible, 
      hasModal: !!modal, 
      hasParent: modal ? !!modal.parentNode : false,
      hasVisibleClass: modal ? modal.classList.contains('visible') : false,
      hasDomElement: !!hasDomElement,
      _closing: modal ? (modal as any)._closing : 'N/A'
    });
    return false;
  })();
  
  return result;
}

// Export to window for HUD click handler (same as end-run-modal)
if (typeof window !== 'undefined') {
  (window as any).isScoreBottomSheetVisible = isScoreBottomSheetVisible;
}

export function getScoreBottomSheetMode(): ScoreSheetMode {
  return activeMode;
}

export function showScoreBottomSheet(mode: ScoreSheetMode = 'score'): void {
  activeMode = mode;
  const domSheets = getScoreSheetElements();
  if (scoreSheetTransitionInProgress && domSheets.length > 0) {
    const closing = domSheets.some((el) => (el as any)._closing);
    if (closing) {
      console.warn(`⚠️ ${mode === 'combo' ? 'Combo' : 'Score'} bottom sheet is closing - ignoring duplicate show call`);
      return;
    }
    if (modal && modal.parentNode) {
      console.log(`📊 ${mode === 'combo' ? 'Combo' : 'Score'} bottom sheet transition active - refreshing stats`);
      refreshScoreSheetContent(mode);
      replayScoreSheetStatsEnter(modal);
      return;
    }
  }

  // 🔥 SAME LOGIC AS END RUN MODAL: Check if already visible
  // 🔥 CRITICAL FIX: If already visible, refresh stats instead of returning
  // This ensures stats are updated when reset is clicked on detail card modal
  if (isScoreBottomSheetVisible() && modal) {
    console.log(`📊 ${mode === 'combo' ? 'Combo' : 'Score'} bottom sheet already open - refreshing stats`);
    refreshScoreSheetContent(mode);
    replayScoreSheetStatsEnter(modal);
    return; // Don't recreate modal, just refresh stats
  }

  cleanupStaleScoreSheetBeforeOpen('show');
  scoreSheetLifecycleId += 1;
  const openLifecycleId = scoreSheetLifecycleId;
  scoreSheetTransitionInProgress = true;

  console.log(`📊 Opening ${mode === 'combo' ? 'combo' : 'score'} bottom sheet`);

  // Light haptic for opening bottom sheet
  if (typeof (window as any).triggerHapticImpact === 'function') {
    (window as any).triggerHapticImpact('light');
  }

  try {
    // 🔥 USER REQUEST: Freeze board to prevent tile dragging when score bottom sheet is open
    const boardContainer = document.getElementById('board-container');
    if (boardContainer) {
      boardContainer.style.pointerEvents = 'none';
      boardContainer.style.userSelect = 'none';
      boardContainer.style.touchAction = 'none';
      console.log('🔒 Board frozen - ALL events disabled (score bottom sheet)');
    }

    // 🔥 NOTE: Combo timer now uses setTimeout and works independently
    // No need to kill/restart combo timer when bottom sheet opens/closes

    // Soft-pause only: block interactions, but keep GSAP/PIXI running so HUD tap bounces render.
    try {
      if (container && typeof (container as any).set === 'function') {
        (container as any).set('gamePaused', true);
      }
      (window as any)._gamePaused = true;
      console.log('🔒 Game soft-paused (score bottom sheet)');
    } catch (error) {
      console.warn('⚠️ Failed to soft-pause game:', error);
    }

    const el = createModal();
    disposeScoreSheetSpatialMotion = mountGameplayModalSpatialMotion(
      el,
      el.querySelector<HTMLElement>('.cc-gameplay-modal-gyro-shell'),
    );
    ensureScoreStatDividerExists();
    console.log('🎯 SCORE BOTTOM SHEET CREATED');

    // Mark modal as visible and set closing flag to false
    (el as any)._closing = false;

    const currentBoardNumber = getCurrentBoardNumber();
    const scoreSheetStats = getScoreSheetStats(currentBoardNumber, mode);
    refreshScoreSheetContent(mode);
    prepareScoreSheetStatsEnter(el);

    console.log(`📊 ${mode === 'combo' ? 'Combo' : 'Score'} bottom sheet showing board ${currentBoardNumber} stats:`, {
      primaryValue: scoreSheetStats.primaryValue,
      primaryLabel: scoreSheetStats.primaryLabel,
      secondaryValue: scoreSheetStats.secondaryValue,
      secondaryLabel: scoreSheetStats.secondaryLabel,
      arcade: isArcadeHomeRunMode()
    });

    el.classList.remove('score-sheet-container-boing', 'cc-gameplay-modal-exiting', 'cc-gameplay-modal-idle');
    el.classList.remove('score-sheet-shadow-fade-out');
    el.classList.add('score-sheet-shadow-active');

    trackScoreSheetAnimationFrame(() => {
      if (openLifecycleId !== scoreSheetLifecycleId || el !== modal) return;
      el.style.display = 'flex';
      el.style.visibility = 'visible';
      el.style.transform = 'none';
      el.style.webkitTransform = 'none';
      el.classList.add('visible', 'cc-gameplay-modal-entering');
      backdrop?.classList.add('cc-gameplay-modal-backdrop-visible');
      playScoreSheetStatsEnter(el);

      trackScoreSheetTimeout(() => {
        if (openLifecycleId !== scoreSheetLifecycleId || el !== modal) return;
        el.classList.remove('cc-gameplay-modal-entering');
        el.classList.add('cc-gameplay-modal-idle');
        scoreSheetTransitionInProgress = false;
      }, GAMEPLAY_MODAL_BENCHMARK.enterDurationMs + GAMEPLAY_MODAL_BENCHMARK.enterCleanupBufferMs);
    });

    isVisible = true;
  } catch (error) {
    console.error('❌ Failed to open score bottom sheet — restoring gameplay:', error);
    scoreSheetTransitionInProgress = false;
    restoreGameplayAfterScoreSheetDismissed('show:failed');
  }
}

export function hideScoreBottomSheet(): void {
  scoreSheetTransitionInProgress = true;
  console.log('🔍 hideScoreBottomSheet() called', { 
    modal: !!modal, 
    modalEl: !!modal, 
    _closing: modal ? (modal as any)._closing : 'N/A',
    isVisible: isVisible 
  });
  
  let modalEl = modal;
  
  // 🔥 CRITICAL: If modal reference is null, try to find it in DOM
  if (!modalEl) {
    const domElement = document.querySelector('.score-bottom-sheet');
    if (domElement && domElement.parentNode) {
      console.log('📊 Found score bottom sheet in DOM - using it to close');
      modalEl = domElement as HTMLElement;
      // Update modal reference
      modal = modalEl;
    } else {
      // No modal in DOM either - just reset state
      console.warn('⚠️ hideScoreBottomSheet: No modal element in reference or DOM - resetting state');
      isVisible = false;
      modal = null;
      backdrop = null;
      scoreSheetTransitionInProgress = false;
      cleanupAllScoreSheetResources();
      // Clean up handlers anyway
      cleanupOutsideScoreSheetHandlers();
      hideAndRemoveScoreSheetDom('hide:no-modal-ref');
      restoreGameplayAfterScoreSheetDismissed('hide:no-modal-ref');
      return;
    }
  }
  
  if ((modalEl as any)._closing) {
    console.warn('⚠️ hideScoreBottomSheet: Modal already closing');
    disableScoreSheetBackdrop();
    cleanupOutsideScoreSheetHandlers();
    unfreezeScoreSheetGameplay('hide:already-closing');
    return;
  }

  (modalEl as any)._closing = true;
  cleanupScoreSheetSpatialMotion();
  const closeLifecycleId = scoreSheetLifecycleId;
  // 🔥 CRITICAL: Reset isVisible IMMEDIATELY when closing starts
  // This ensures isScoreBottomSheetVisible() returns false right away
  isVisible = false;

  console.log('📊 Closing score bottom sheet - isVisible reset to false', { isVisible });
  if (backdrop) {
    backdrop.style.pointerEvents = 'none';
    backdrop.classList.remove('cc-gameplay-modal-backdrop-visible');
  }
  modalEl.classList.remove('score-sheet-shadow-active');
  modalEl.classList.add('score-sheet-shadow-fade-out');
  unfreezeScoreSheetGameplay('hide:start');

  gsap.killTweensOf(modalEl);

  // 🔥 FIX: Wrap in try-catch to ensure flag is reset on error
  try {
    // 🔥 REMOVED: Haptic on close - not needed for outside click dismiss

    // Clean up outside click handlers immediately
    cleanupOutsideScoreSheetHandlers();

    modalEl.classList.remove('cc-gameplay-modal-entering');
    modalEl.classList.add('cc-gameplay-modal-exiting');
    playScoreSheetStatsExit(modalEl);
    modalEl.style.transition = 'none';
    modalEl.style.transform = 'none';
  } catch (error) {
    // 🔥 FIX: Reset flag on error so modal can be reopened
    console.error('❌ Error during hideScoreBottomSheet:', error);
    (modalEl as any)._closing = false;
    scoreSheetTransitionInProgress = false;
    restoreGameplayAfterScoreSheetDismissed('hide:error');
    return;
  }

  // Remove modal after animation
  trackScoreSheetTimeout(() => {
    if (closeLifecycleId !== scoreSheetLifecycleId || modalEl !== modal) {
      console.log('📊 Skipping stale score sheet close timeout');
      return;
    }
    // 🔥 MEMORY LEAK FIX: Cleanup all resources before removing modal
    cleanupAllScoreSheetResources();
    
    // 🔥 CRITICAL: Remove 'visible' class and hide modal before removing from DOM
    if (modalEl) {
      modalEl.classList.remove('visible');
      modalEl.style.display = 'none';
      modalEl.style.visibility = 'hidden';
    }
    
    if (modalEl && modalEl.parentNode) {
      modalEl.parentNode.removeChild(modalEl);
    }
    hideAndRemoveScoreSheetDom('hide:closed');
    
    // 🔥 CRITICAL: Reset all state AFTER modal is removed from DOM
    (modalEl as any)._closing = false;
    modal = null;
    backdrop = null;
    isVisible = false;
    scoreSheetTransitionInProgress = false;
    
    restoreGameplayAfterScoreSheetDismissed('hide:closed');
    
    console.log('✅ Score bottom sheet fully closed and reset - modal removed, isVisible=false');
  }, GAMEPLAY_MODAL_BENCHMARK.exitDurationMs);
}

// 🔥 USER REQUEST: Force hide score bottom sheet immediately (no animation)
// Used when opening end-run modal to prevent overlapping bottom sheets
export function forceHideScoreBottomSheet(): void {
  console.log('📊 Force hiding score bottom sheet immediately (no animation)');
  
  const modalEl = modal;
  if (!modalEl) {
    console.log('📊 No score bottom sheet modal reference, but checking DOM...');
    // Even if modal reference is null, check DOM and reset state
    hideAndRemoveScoreSheetDom('forceHide:no-modal-ref');
    // 🔥 CRITICAL: Always reset state even if modal reference is null
    isVisible = false;
    modal = null;
    backdrop = null;
    scoreSheetTransitionInProgress = false;
    cleanupAllScoreSheetResources();
    restoreGameplayAfterScoreSheetDismissed('forceHide:no-modal-ref');
    return;
  }
  
  // 🔥 CRITICAL: Clean up outside click handlers FIRST (before removing modal)
  // This prevents event handlers from trying to access removed modal
  cleanupOutsideScoreSheetHandlers();
  
  // Reset visibility state immediately
  isVisible = false;
  (modalEl as any)._closing = false;
  scoreSheetTransitionInProgress = false;
  unfreezeScoreSheetGameplay('forceHide:start');
  cleanupAllScoreSheetResources();
  
  // Immediately hide and remove from DOM (no animation)
  modalEl.classList.remove('visible');
  modalEl.classList.remove('score-sheet-shadow-active');
  modalEl.classList.add('score-sheet-shadow-fade-out');
  modalEl.style.display = 'none';
  modalEl.style.visibility = 'hidden';
  modalEl.style.transform = 'none';
  modalEl.style.transition = 'none';
  
  hideAndRemoveScoreSheetDom('forceHide:immediate');
  
  // Reset state AFTER removing from DOM
  modal = null;
  backdrop = null;
  
  restoreGameplayAfterScoreSheetDismissed('forceHide:immediate');
  
  console.log('✅ Score bottom sheet force hidden and removed - isVisible=false, modal=null');
}

// 🔥 Helper function to reset score bottom sheet state (used when element is removed directly from DOM)
export function resetScoreBottomSheetState(): void {
  console.log('📊 Resetting score bottom sheet state');
  isVisible = false;
  modal = null;
  backdrop = null;
  scoreSheetTransitionInProgress = false;
  hideAndRemoveScoreSheetDom('reset-state');
  cleanupAllScoreSheetResources();
  cleanupOutsideScoreSheetHandlers();
  unfreezeScoreSheetGameplay('reset-state:start');
  restoreGameplayAfterScoreSheetDismissed('reset-state');
  console.log('✅ Score bottom sheet state reset');
}

// Export to window for HUD access
if (typeof window !== 'undefined') {
  (window as any).showScoreBottomSheet = showScoreBottomSheet;
  (window as any).showComboBottomSheet = () => showScoreBottomSheet('combo');
  (window as any).getScoreBottomSheetMode = getScoreBottomSheetMode;
  (window as any).hideScoreBottomSheet = hideScoreBottomSheet;
  (window as any).forceHideScoreBottomSheet = forceHideScoreBottomSheet;
}
