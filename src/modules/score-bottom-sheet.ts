/**
 * Score Bottom Sheet
 * Shows high score stats and cubes cracked when user clicks on score area in HUD
 * Uses same drag and outside click functionality as end-run-modal
 */

import { boardStatsService } from '../services/board-stats-service.js';
import { arcadeStatsService } from '../services/arcade-stats-service.js';
import { pauseGame, resumeGame } from './pause-utils.js';
import { isArcadeHomeRunMode } from './run-mode.js';

let modal: HTMLElement | null = null;
let backdrop: HTMLElement | null = null;
let isVisible = false;

// Outside click handlers (same pattern as end-run-modal)
let outsideClickHandler: ((e: Event) => void) | null = null;
let outsideTouchEndHandler: ((e: TouchEvent) => void) | null = null;

function getScoreSheetStats(boardNumber: number): { highScore: number; cubesCracked: number; subtitle: string } {
  if (isArcadeHomeRunMode()) {
    const arcadeStats = arcadeStatsService.getStats();
    return {
      highScore: arcadeStats.highScore,
      cubesCracked: arcadeStats.cubesCracked,
      subtitle: 'Your Arcade trophy.<br>Beat it to earn a new one.'
    };
  }

  const boardStats = boardStatsService.getBoardStats(boardNumber);
  const boardNumberStr = boardNumber.toString().padStart(2, '0');
  return {
    highScore: boardStats.highScore,
    cubesCracked: boardStats.cubesCracked,
    subtitle: `Your board ${boardNumberStr} trophy.<br>Beat it to earn a new one.`
  };
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
  clearAllScoreSheetTimeouts();
  clearAllScoreSheetAnimationFrames();
  clearAllScoreSheetEventListeners();
  clearAllScoreSheetOnEventHandlers();
  console.log('✅ score-bottom-sheet: All resources cleaned up!');
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
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'score-sheet-title');
  modalEl.style.touchAction = 'none';
  
  // CRITICAL: Start with display: none to prevent flash
  modalEl.style.display = 'none';

  // 🔥 USER REQUEST: Get current board number for subtitle
  let currentBoardNumber = 1;
  try {
    const STATE = (window as any).STATE;
    if (STATE && Number.isFinite(STATE.boardNumber)) {
      currentBoardNumber = STATE.boardNumber;
    } else {
      // Fallback: try to get from saved game state
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
  
  const boardNumberStr = currentBoardNumber.toString().padStart(2, '0');
  const subtitleText = isArcadeHomeRunMode()
    ? 'Your Arcade trophy.<br>Beat it to earn a new one.'
    : `Your board ${boardNumberStr} trophy.<br>Beat it to earn a new one.`;
  
  modalEl.innerHTML = `
    <div class="modal-handle"></div>
    <div class="simple-content">
      <div class="simple-header">
        <div class="simple-title-section">
          <h2 id="score-sheet-title">Score Stats</h2>
          <p id="score-sheet-subtitle">${subtitleText}</p>
        </div>
        <div class="score-stats-container">
          <!-- High Score -->
          <div class="stat-item">
            <div class="stat-icon">
              <img src="./assets/highscore-icon.png" alt="" aria-hidden="true">
            </div>
            <div class="stat-content">
              <div id="score-sheet-high-score" class="stat-value">0</div>
              <div class="stat-label">High score</div>
            </div>
          </div>
          
          <!-- Cubes Cracked -->
          <div class="stat-item">
            <div class="stat-icon">
              <img src="./assets/cubes-cracked.png" alt="" aria-hidden="true">
            </div>
            <div class="stat-content">
              <div id="score-sheet-cubes-cracked" class="stat-value">0</div>
              <div class="stat-label">Cubes cracked</div>
            </div>
          </div>
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
      console.log('📊 Score sheet drag close - isVisible reset to false immediately');
      trackScoreSheetTimeout(() => {
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
      console.log('📊 Score sheet drag close (mouse) - isVisible reset to false immediately');
      trackScoreSheetTimeout(() => {
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
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
  if (outsideTouchEndHandler) {
    document.removeEventListener('touchend', outsideTouchEndHandler);
    outsideTouchEndHandler = null;
  }
  
  // Create named handlers for proper cleanup
  outsideClickHandler = (e: Event) => {
    // Check if click is outside modal AND modal is still open
    if (modalEl && modalEl.parentNode && e.target && !modalEl.contains(e.target as Node)) {
      // Check if modal is visible (has 'visible' class or isVisible flag is true)
      if (modalEl.classList.contains('visible') || isVisible) {
        console.log('📊 Outside click detected - closing score bottom sheet');
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
    if (backdrop && modalEl && modalEl.parentNode) {
      trackScoreSheetEventListener(backdrop, 'click', () => hideScoreBottomSheet());
      trackScoreSheetEventListener(backdrop, 'touchend', () => hideScoreBottomSheet(), { passive: false });
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

export function showScoreBottomSheet(): void {
  // 🔥 SAME LOGIC AS END RUN MODAL: Check if already visible
  // 🔥 CRITICAL FIX: If already visible, refresh stats instead of returning
  // This ensures stats are updated when reset is clicked on detail card modal
  if (isScoreBottomSheetVisible() && modal) {
    console.log('📊 Score bottom sheet already open - refreshing stats');
    
    // Get current board number
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
      console.warn('⚠️ Failed to get board number for score bottom sheet refresh:', error);
    }
    
    const scoreSheetStats = getScoreSheetStats(currentBoardNumber);
    
    // Update values with fresh stats
    const highScoreEl = document.getElementById('score-sheet-high-score');
    const cubesCrackedEl = document.getElementById('score-sheet-cubes-cracked');
    
    if (highScoreEl) highScoreEl.textContent = scoreSheetStats.highScore.toLocaleString();
    if (cubesCrackedEl) cubesCrackedEl.textContent = scoreSheetStats.cubesCracked.toLocaleString();
    
    console.log(`📊 Score bottom sheet stats refreshed for board ${currentBoardNumber}:`, {
      highScore: scoreSheetStats.highScore,
      cubesCracked: scoreSheetStats.cubesCracked,
      arcade: isArcadeHomeRunMode()
    });
    
    return; // Don't recreate modal, just refresh stats
  }

  console.log('📊 Opening score bottom sheet');

  // Light haptic for opening bottom sheet
  if (typeof (window as any).triggerHapticImpact === 'function') {
    (window as any).triggerHapticImpact('light');
  }

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
  
  // 🔥 USER REQUEST: Pause game to prevent tile interactions
  try {
    pauseGame();
    console.log('🔒 Game paused (score bottom sheet)');
  } catch (error) {
    console.warn('⚠️ Failed to pause game:', error);
  }

  const el = createModal();
  console.log('🎯 SCORE BOTTOM SHEET CREATED');

  // Mark modal as visible and set closing flag to false
  (el as any)._closing = false;

  // 🔥 USER REQUEST: Update subtitle with current board number
  let currentBoardNumber = 1;
  try {
    const STATE = (window as any).STATE;
    if (STATE && Number.isFinite(STATE.boardNumber)) {
      currentBoardNumber = STATE.boardNumber;
    } else {
      // Fallback: try to get from saved game state
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
  
  const boardNumberStr = currentBoardNumber.toString().padStart(2, '0');
  const subtitleEl = document.getElementById('score-sheet-subtitle');
  const scoreSheetStats = getScoreSheetStats(currentBoardNumber);
  if (subtitleEl) subtitleEl.innerHTML = scoreSheetStats.subtitle;
  
  // Update values with mode-specific stats:
  // - Journey: board-specific
  // - Arcade: arcade-only (independent from Journey)
  const highScoreEl = document.getElementById('score-sheet-high-score');
  const cubesCrackedEl = document.getElementById('score-sheet-cubes-cracked');
  
  if (highScoreEl) highScoreEl.textContent = scoreSheetStats.highScore.toLocaleString();
  if (cubesCrackedEl) cubesCrackedEl.textContent = scoreSheetStats.cubesCracked.toLocaleString();
  
  console.log(`📊 Score bottom sheet showing board ${currentBoardNumber} stats:`, {
    highScore: scoreSheetStats.highScore,
    cubesCracked: scoreSheetStats.cubesCracked,
    arcade: isArcadeHomeRunMode()
  });

  // Show modal with animation (same as end-run-modal)
  el.style.display = 'block';
  el.style.transform = 'translateY(100%)';
  
  trackScoreSheetAnimationFrame(() => {
    el.classList.add('visible');
    el.style.transition = 'transform 0.3s ease-out';
    el.style.transform = 'translateY(0)';
  });

  isVisible = true;
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
      if (outsideClickHandler) {
        document.removeEventListener('click', outsideClickHandler);
        outsideClickHandler = null;
      }
      if (outsideTouchEndHandler) {
        document.removeEventListener('touchend', outsideTouchEndHandler);
        outsideTouchEndHandler = null;
      }
      document.onclick = null;
      // 🔥 Ensure game resumes if it was paused by the sheet
      const endRunModalExists = document.querySelector('.simple-bottom-sheet:not(.score-bottom-sheet)');
      if (!endRunModalExists) {
        try { resumeGame(); } catch {}
      }
      return;
    }
  }
  
  if ((modalEl as any)._closing) {
    console.warn('⚠️ hideScoreBottomSheet: Modal already closing');
    return;
  }

  (modalEl as any)._closing = true;
  // 🔥 CRITICAL: Reset isVisible IMMEDIATELY when closing starts
  // This ensures isScoreBottomSheetVisible() returns false right away
  isVisible = false;

  console.log('📊 Closing score bottom sheet - isVisible reset to false', { isVisible });

  // 🔥 FIX: Wrap in try-catch to ensure flag is reset on error
  try {
    // 🔥 REMOVED: Haptic on close - not needed for outside click dismiss

    // Clean up outside click handlers immediately
    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler);
      outsideClickHandler = null;
    }
    if (outsideTouchEndHandler) {
      document.removeEventListener('touchend', outsideTouchEndHandler);
      outsideTouchEndHandler = null;
    }

    // Clear document.onclick if it was set (legacy cleanup)
    document.onclick = null;

    // Animate out with 0.4s duration (same as end-run-modal)
    modalEl.classList.remove('visible');
    modalEl.style.transition = 'transform 0.4s ease-in-out';
    modalEl.style.transform = 'translateY(100%)';
  } catch (error) {
    // 🔥 FIX: Reset flag on error so modal can be reopened
    console.error('❌ Error during hideScoreBottomSheet:', error);
    (modalEl as any)._closing = false;
    return;
  }

  // Remove modal after animation
  trackScoreSheetTimeout(() => {
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
    
    // 🔥 USER REQUEST: Unfreeze board when score bottom sheet closes
    // Only unfreeze if end-run modal is not open (end-run modal also freezes board)
    const endRunModalExists = document.querySelector('.simple-bottom-sheet:not(.score-bottom-sheet)');
    if (!endRunModalExists) {
      const boardContainer = document.getElementById('board-container');
      if (boardContainer) {
        boardContainer.style.pointerEvents = 'auto';
        boardContainer.style.userSelect = '';
        boardContainer.style.touchAction = '';
        console.log('🔓 Board unfrozen - ALL events enabled (score bottom sheet closed)');
      }
      
      // 🔥 USER REQUEST: Resume game when score bottom sheet closes
      try {
        resumeGame();
        console.log('🔓 Game resumed (score bottom sheet closed)');
      } catch (error) {
        console.warn('⚠️ Failed to resume game:', error);
      }
      
      // 🔥 NOTE: Combo timer now uses setTimeout and works independently
      // No need to kill/restart combo timer when bottom sheet closes
    }
    
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
    // 🔥 Ensure game resumes if it was paused by the sheet
    const endRunModalExists = document.querySelector('.simple-bottom-sheet:not(.score-bottom-sheet)');
    if (!endRunModalExists) {
      try { resumeGame(); } catch {}
    }
    return;
  }
  
  // 🔥 CRITICAL: Clean up outside click handlers FIRST (before removing modal)
  // This prevents event handlers from trying to access removed modal
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
  if (outsideTouchEndHandler) {
    document.removeEventListener('touchend', outsideTouchEndHandler);
    outsideTouchEndHandler = null;
  }
  document.onclick = null;
  
  // Reset visibility state immediately
  isVisible = false;
  (modalEl as any)._closing = false;
  cleanupAllScoreSheetResources();
  
  // Immediately hide and remove from DOM (no animation)
  modalEl.classList.remove('visible');
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
  
  // 🔥 USER REQUEST: Unfreeze board when score bottom sheet is force hidden
  // Only unfreeze if end-run modal is not open (end-run modal also freezes board)
  const endRunModalExists = document.querySelector('.simple-bottom-sheet:not(.score-bottom-sheet)');
  if (!endRunModalExists) {
    const boardContainer = document.getElementById('board-container');
    if (boardContainer) {
      boardContainer.style.pointerEvents = 'auto';
      boardContainer.style.userSelect = '';
      boardContainer.style.touchAction = '';
      console.log('🔓 Board unfrozen - ALL events enabled (score bottom sheet force hidden)');
    }
    
    // 🔥 USER REQUEST: Resume game when score bottom sheet is force hidden
    try {
      resumeGame();
      console.log('🔓 Game resumed (score bottom sheet force hidden)');
    } catch (error) {
      console.warn('⚠️ Failed to resume game:', error);
    }
  }
  
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
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
  if (outsideTouchEndHandler) {
    document.removeEventListener('touchend', outsideTouchEndHandler);
    outsideTouchEndHandler = null;
  }
  document.onclick = null;
  // 🔥 Ensure game resumes if it was paused by the sheet
  const endRunModalExists = document.querySelector('.simple-bottom-sheet:not(.score-bottom-sheet)');
  if (!endRunModalExists) {
    try { resumeGame(); } catch {}
  }
  console.log('✅ Score bottom sheet state reset');
}

// Export to window for HUD access
if (typeof window !== 'undefined') {
  (window as any).showScoreBottomSheet = showScoreBottomSheet;
  (window as any).hideScoreBottomSheet = hideScoreBottomSheet;
  (window as any).forceHideScoreBottomSheet = forceHideScoreBottomSheet;
}
