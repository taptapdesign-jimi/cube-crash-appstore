/**
 * Score Bottom Sheet
 * Shows high score stats and cubes cracked when user clicks on score area in HUD
 * Uses same drag and outside click functionality as end-run-modal
 */

import { boardStatsService } from '../services/board-stats-service.js';
import { arcadeStatsService } from '../services/arcade-stats-service.js';
import { resumeGame } from './pause-utils.js';
import { isArcadeHomeRunMode } from './run-mode.js';
import { container } from '../core/dependency-injection.js';
import { gsap } from 'gsap';
import { animateBottomSheetEntrance } from './resume-sheet-animations.js';

let modal: HTMLElement | null = null;
let backdrop: HTMLElement | null = null;
let isVisible = false;
type ScoreSheetMode = 'score' | 'combo';
let activeMode: ScoreSheetMode = 'score';
let scoreSheetLifecycleId = 0;
let scoreSheetEntranceTimeline: gsap.core.Timeline | null = null;

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

function cleanupStaleScoreSheetBeforeOpen(reason: string): void {
  const domSheet = document.querySelector('.score-bottom-sheet') as HTMLElement | null;
  const hasClosingSheet = !!(modal && (modal as any)._closing);
  if (!domSheet && !backdrop && !hasClosingSheet) return;

  console.log(`🧯 Cleaning stale score sheet before open (${reason})`);
  scoreSheetLifecycleId += 1;
  cleanupOutsideScoreSheetHandlers();
  cleanupAllScoreSheetResources();
  disableScoreSheetBackdrop();

  try {
    document.querySelectorAll('.score-bottom-sheet').forEach((el) => el.remove());
    document.querySelectorAll('.score-bottom-sheet-backdrop').forEach((el) => el.remove());
  } catch {
    /* non-fatal */
  }

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
      secondaryLabel: 'Stages opened',
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
const _scoreSheetOnEventHandlers: Array<{
  element: HTMLElement | Document;
  property: string;
  oldHandler: any;
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

function trackScoreSheetOnEventHandler(element: HTMLElement | Document, property: string, newHandler: any): void {
  const oldHandler = (element as any)[property];
  _scoreSheetOnEventHandlers.push({ element, property, oldHandler });
  (element as any)[property] = newHandler;
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

function clearAllScoreSheetOnEventHandlers(): void {
  console.log(`🧹 score-bottom-sheet: Clearing ${_scoreSheetOnEventHandlers.length} .on* event handlers`);
  _scoreSheetOnEventHandlers.forEach(({ element, property, oldHandler }) => {
    try {
      (element as any)[property] = oldHandler;
    } catch (e) {
      console.warn(`⚠️ score-bottom-sheet: Failed to clear ${property} handler:`, e);
    }
  });
  _scoreSheetOnEventHandlers.length = 0;
}

function cleanupAllScoreSheetResources(): void {
  if (scoreSheetEntranceTimeline) {
    try { scoreSheetEntranceTimeline.kill(); } catch {}
    scoreSheetEntranceTimeline = null;
  }
  clearAllScoreSheetTimeouts();
  clearAllScoreSheetAnimationFrames();
  clearAllScoreSheetEventListeners();
  clearAllScoreSheetOnEventHandlers();
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
    document.querySelectorAll('.score-bottom-sheet-backdrop').forEach((el) => {
      try {
        el.remove();
      } catch {
        /* non-fatal */
      }
    });
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
  if (modal) {
    modal.remove();
    modal = null;
  }
  if (backdrop) {
    backdrop.remove();
    backdrop = null;
  }

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
  modalEl.className = 'simple-bottom-sheet score-bottom-sheet';
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
    <div class="modal-handle"></div>
    <div class="simple-content">
      <div class="simple-header">
        <div class="simple-title-section">
          <h2 id="score-sheet-title">${titleText}</h2>
          <p id="score-sheet-subtitle">${subtitleText}</p>
        </div>
        <div class="score-stats-container">
${renderStatsItems(scoreSheetStats)}
        </div>
      </div>
    </div>
  `;

  // Add drag functionality (same as end-run-modal)
  addDragFunctionality(modalEl);
  
  // Add outside click functionality (same as end-run-modal)
  addOutsideClickFunctionality(modalEl);

  document.body.appendChild(backdropEl);
  document.body.appendChild(modalEl);
  modal = modalEl;
  return modalEl;
}

function addDragFunctionality(modalEl: HTMLElement): void {
  console.log('🎯 ADDING DRAG TO SCORE BOTTOM SHEET');

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  // Function to ensure modal is ALWAYS horizontally centered
  function forceCenterModal(): void {
    const currentTransform = modalEl.style.transform;
    const translateYMatch = currentTransform.match(/translateY\(([^)]+)\)/);
    const translateY = translateYMatch ? translateYMatch[1] : '0';
    const centeredTransform = `translateY(${translateY})`;
    modalEl.style.transform = centeredTransform;
  }

  // Touch events on entire modal
  trackScoreSheetOnEventHandler(modalEl, 'ontouchstart', (e: TouchEvent) => {
    console.log('🎯 DRAG START ON SCORE SHEET:', e.touches[0].clientY);
    e.preventDefault();
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    modalEl.style.transition = 'none';
    
    if (modalEl.classList.contains('visible')) {
      forceCenterModal();
    }
  });

  trackScoreSheetOnEventHandler(modalEl, 'ontouchmove', (e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    
    if (deltaY > 0) {
      const newTransform = `translateY(${deltaY}px)`;
      modalEl.style.transform = newTransform;
    }
  });

  trackScoreSheetOnEventHandler(modalEl, 'ontouchend', (e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    isDragging = false;
    
    modalEl.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    
    if (deltaY > 80) {
      console.log('🎯 CLOSING SCORE SHEET - calling hideScoreBottomSheet in 400ms');
      modalEl.style.transition = 'transform 0.4s ease-in-out';
      modalEl.style.transform = 'translateY(100vh)';
      // 🔥 CRITICAL: Reset isVisible IMMEDIATELY when drag closes (before animation)
      isVisible = false;
      disableScoreSheetBackdrop();
      modalEl.classList.remove('score-sheet-shadow-active');
      modalEl.classList.add('score-sheet-shadow-fade-out');
      unfreezeScoreSheetGameplay('drag-close-touch');
      console.log('📊 Score sheet drag close - isVisible reset to false immediately');
      const dragCloseLifecycleId = scoreSheetLifecycleId;
      trackScoreSheetTimeout(() => {
        if (dragCloseLifecycleId !== scoreSheetLifecycleId || modalEl !== modal) {
          console.log('📊 Skipping stale score sheet drag close timeout');
          return;
        }
        console.log('📊 setTimeout callback - calling hideScoreBottomSheet()');
        hideScoreBottomSheet();
      }, 400);
    } else {
      console.log('🎯 SNAPPING BACK');
      modalEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      modalEl.style.transform = 'translateY(0)';
    }
    
    trackScoreSheetTimeout(() => forceCenterModal(), 50);
  });
  
  // Mouse events on entire modal
  trackScoreSheetOnEventHandler(modalEl, 'onmousedown', (e: MouseEvent) => {
    console.log('🎯 MOUSE DOWN ON SCORE SHEET:', e.clientY);
    e.preventDefault();
    startY = e.clientY;
    currentY = startY;
    isDragging = true;
    modalEl.style.transition = 'none';
    
    if (modalEl.classList.contains('visible')) {
      forceCenterModal();
    }
  });
  
  trackScoreSheetOnEventHandler(document, 'onmousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    
    currentY = e.clientY;
    const deltaY = currentY - startY;
    
    if (deltaY > 0) {
      const newTransform = `translateY(${deltaY}px)`;
      modalEl.style.transform = newTransform;
    }
  });
  
  trackScoreSheetOnEventHandler(document, 'onmouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    
    modalEl.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    
    if (deltaY > 80) {
      console.log('🎯 CLOSING SCORE SHEET (mouse) - calling hideScoreBottomSheet in 400ms');
      modalEl.style.transition = 'transform 0.4s ease-in-out';
      modalEl.style.transform = 'translateY(100vh)';
      // 🔥 CRITICAL: Reset isVisible IMMEDIATELY when drag closes (before animation)
      isVisible = false;
      disableScoreSheetBackdrop();
      modalEl.classList.remove('score-sheet-shadow-active');
      modalEl.classList.add('score-sheet-shadow-fade-out');
      unfreezeScoreSheetGameplay('drag-close-mouse');
      console.log('📊 Score sheet drag close (mouse) - isVisible reset to false immediately');
      const dragCloseLifecycleId = scoreSheetLifecycleId;
      trackScoreSheetTimeout(() => {
        if (dragCloseLifecycleId !== scoreSheetLifecycleId || modalEl !== modal) {
          console.log('📊 Skipping stale score sheet mouse drag close timeout');
          return;
        }
        console.log('📊 setTimeout callback (mouse) - calling hideScoreBottomSheet()');
        hideScoreBottomSheet();
      }, 400);
    } else {
      console.log('🎯 SNAPPING BACK (mouse)');
      modalEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      modalEl.style.transform = 'translateY(0)';
    }
    
    trackScoreSheetTimeout(() => forceCenterModal(), 50);
  });
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
        if (deltaY > 28) {
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
      return false;
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
  // 🔥 SAME LOGIC AS END RUN MODAL: Check if already visible
  // 🔥 CRITICAL FIX: If already visible, refresh stats instead of returning
  // This ensures stats are updated when reset is clicked on detail card modal
  if (isScoreBottomSheetVisible() && modal) {
    console.log(`📊 ${mode === 'combo' ? 'Combo' : 'Score'} bottom sheet already open - refreshing stats`);
    refreshScoreSheetContent(mode);
    return; // Don't recreate modal, just refresh stats
  }

  cleanupStaleScoreSheetBeforeOpen('show');
  scoreSheetLifecycleId += 1;
  const openLifecycleId = scoreSheetLifecycleId;

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
    ensureScoreStatDividerExists();
    console.log('🎯 SCORE BOTTOM SHEET CREATED');

    // Mark modal as visible and set closing flag to false
    (el as any)._closing = false;

    const currentBoardNumber = getCurrentBoardNumber();
    const scoreSheetStats = getScoreSheetStats(currentBoardNumber, mode);
    refreshScoreSheetContent(mode);

    console.log(`📊 ${mode === 'combo' ? 'Combo' : 'Score'} bottom sheet showing board ${currentBoardNumber} stats:`, {
      primaryValue: scoreSheetStats.primaryValue,
      primaryLabel: scoreSheetStats.primaryLabel,
      secondaryValue: scoreSheetStats.secondaryValue,
      secondaryLabel: scoreSheetStats.secondaryLabel,
      arcade: isArcadeHomeRunMode()
    });

    el.classList.remove('score-sheet-container-boing');
    el.classList.remove('score-sheet-shadow-fade-out');
    el.classList.add('score-sheet-shadow-active');

    trackScoreSheetAnimationFrame(() => {
      if (openLifecycleId !== scoreSheetLifecycleId || el !== modal) return;
      if (scoreSheetEntranceTimeline) {
        try { scoreSheetEntranceTimeline.kill(); } catch {}
        scoreSheetEntranceTimeline = null;
      }

      animateBottomSheetEntrance(el).catch((error) => {
        console.error('❌ Failed to animate score bottom sheet:', error);
        if (openLifecycleId !== scoreSheetLifecycleId || el !== modal) return;
        el.classList.add('visible');
      });
    });

    isVisible = true;
  } catch (error) {
    console.error('❌ Failed to open score bottom sheet — restoring gameplay:', error);
    restoreGameplayAfterScoreSheetDismissed('show:failed');
  }
}

export function hideScoreBottomSheet(): void {
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
      cleanupAllScoreSheetResources();
      // Clean up handlers anyway
      cleanupOutsideScoreSheetHandlers();
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
  const closeLifecycleId = scoreSheetLifecycleId;
  // 🔥 CRITICAL: Reset isVisible IMMEDIATELY when closing starts
  // This ensures isScoreBottomSheetVisible() returns false right away
  isVisible = false;

  console.log('📊 Closing score bottom sheet - isVisible reset to false', { isVisible });
  disableScoreSheetBackdrop();
  modalEl.classList.remove('score-sheet-shadow-active');
  modalEl.classList.add('score-sheet-shadow-fade-out');
  unfreezeScoreSheetGameplay('hide:start');

  if (scoreSheetEntranceTimeline) {
    try { scoreSheetEntranceTimeline.kill(); } catch {}
    scoreSheetEntranceTimeline = null;
  }
  gsap.killTweensOf(modalEl);

  // 🔥 FIX: Wrap in try-catch to ensure flag is reset on error
  try {
    // Clean up outside click handlers immediately
    cleanupOutsideScoreSheetHandlers();

    // Animate out with 0.4s duration (same as end-run-modal)
    modalEl.classList.remove('visible');
    modalEl.style.transition = 'transform 0.4s ease-in-out';
    modalEl.style.transform = 'translateY(100%)';
  } catch (error) {
    // 🔥 FIX: Reset flag on error so modal can be reopened
    console.error('❌ Error during hideScoreBottomSheet:', error);
    (modalEl as any)._closing = false;
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
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
    
    // 🔥 CRITICAL: Reset all state AFTER modal is removed from DOM
    (modalEl as any)._closing = false;
    modal = null;
    backdrop = null;
    isVisible = false;
    
    restoreGameplayAfterScoreSheetDismissed('hide:closed');
    
    console.log('✅ Score bottom sheet fully closed and reset - modal removed, isVisible=false');
  }, 400);
}

// 🔥 USER REQUEST: Force hide score bottom sheet immediately (no animation)
// Used when opening end-run modal to prevent overlapping bottom sheets
export function forceHideScoreBottomSheet(): void {
  console.log('📊 Force hiding score bottom sheet immediately (no animation)');
  
  const modalEl = modal;
  if (!modalEl) {
    console.log('📊 No score bottom sheet modal reference, but checking DOM...');
    // Even if modal reference is null, check DOM and reset state
    const domElement = document.querySelector('.score-bottom-sheet');
    if (domElement) {
      console.log('📊 Found score bottom sheet in DOM - removing it');
      domElement.remove();
    }
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
    // 🔥 CRITICAL: Always reset state even if modal reference is null
    isVisible = false;
    modal = null;
    backdrop = null;
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
  unfreezeScoreSheetGameplay('forceHide:start');
  cleanupAllScoreSheetResources();
  
  // Immediately hide and remove from DOM (no animation)
  modalEl.classList.remove('visible');
  modalEl.classList.remove('score-sheet-shadow-active');
  modalEl.classList.add('score-sheet-shadow-fade-out');
  modalEl.style.display = 'none';
  modalEl.style.visibility = 'hidden';
  modalEl.style.transform = 'translateY(100%)';
  modalEl.style.transition = 'none';
  
  // Remove from DOM immediately
  if (modalEl.parentNode) {
    modalEl.parentNode.removeChild(modalEl);
  }
  if (backdrop && backdrop.parentNode) {
    backdrop.parentNode.removeChild(backdrop);
  }
  
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
  if (backdrop && backdrop.parentNode) {
    backdrop.parentNode.removeChild(backdrop);
  }
  backdrop = null;
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
