// Simple End Run Modal
import { safePauseGame, safeResumeGame, safeUnlockSlider } from '../utils/animations.js';
import { setModalVisible, isModalVisible } from './end-run-utils.js';
import { pauseGame, resumeGame } from './pause-utils.js';
import { forceHideScoreBottomSheet, isScoreBottomSheetVisible, resetScoreBottomSheetState } from './score-bottom-sheet.js';
import { clearArcadeSaveState, getBoardSaveKey } from '../utils/board-save-utils.js';
import { isArcadeHomeRunMode } from './run-mode.js';
import { requestExitToMenu } from './menu-exit-handoff.ts';
import { resolveJourneyReturnTarget } from './journey-origin-state.js';
import { gsap } from 'gsap';
import { container } from '../core/dependency-injection.js';

let modal: HTMLElement | null = null;

// 🔥 MEMORY LEAK FIX: Track all timeouts, intervals, rAFs, and event listeners for cleanup
const _endRunTimeouts = new Set<ReturnType<typeof setTimeout>>();
const _endRunIntervals = new Set<ReturnType<typeof setInterval>>();
const _endRunAnimationFrames = new Set<number>();
const _endRunEventListeners: Array<{
  element: HTMLElement | Document;
  event: string;
  handler: EventListener;
  options?: AddEventListenerOptions;
}> = [];
const _endRunOnEventHandlers: Array<{
  element: HTMLElement | Document;
  property: string;
  oldHandler: any;
}> = [];

function trackEndRunTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timeout = setTimeout(() => {
    callback();
    _endRunTimeouts.delete(timeout);
  }, delay);
  _endRunTimeouts.add(timeout);
  return timeout;
}

function trackEndRunInterval(callback: () => void, delay: number): ReturnType<typeof setInterval> {
  const interval = setInterval(callback, delay);
  _endRunIntervals.add(interval);
  return interval;
}

function trackEndRunAnimationFrame(callback: (now: number) => void): number {
  const rafId = requestAnimationFrame((now: number) => {
    callback(now);
    _endRunAnimationFrames.delete(rafId);
  });
  _endRunAnimationFrames.add(rafId);
  return rafId;
}

function trackEndRunEventListener(
  element: HTMLElement | Document,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): void {
  element.addEventListener(event, handler, options);
  _endRunEventListeners.push({ element, event, handler, options });
}

function clearAllEndRunTimeouts(): void {
  console.log(`🧹 end-run-modal: Clearing ${_endRunTimeouts.size} timeouts`);
  _endRunTimeouts.forEach(timeout => clearTimeout(timeout));
  _endRunTimeouts.clear();
}

function clearAllEndRunIntervals(): void {
  console.log(`🧹 end-run-modal: Clearing ${_endRunIntervals.size} intervals`);
  _endRunIntervals.forEach(interval => clearInterval(interval));
  _endRunIntervals.clear();
}

function clearAllEndRunAnimationFrames(): void {
  console.log(`🧹 end-run-modal: Clearing ${_endRunAnimationFrames.size} animation frames`);
  _endRunAnimationFrames.forEach(rafId => cancelAnimationFrame(rafId));
  _endRunAnimationFrames.clear();
}

function clearAllEndRunEventListeners(): void {
  console.log(`🧹 end-run-modal: Clearing ${_endRunEventListeners.length} event listeners`);
  _endRunEventListeners.forEach(({ element, event, handler, options }) => {
    try {
      element.removeEventListener(event, handler, options);
    } catch (e) {
      console.warn(`⚠️ end-run-modal: Failed to remove ${event} listener:`, e);
    }
  });
  _endRunEventListeners.length = 0;
}

function clearAllEndRunOnEventHandlers(): void {
  console.log(`🧹 end-run-modal: Clearing ${_endRunOnEventHandlers.length} .on* event handlers`);
  _endRunOnEventHandlers.forEach(({ element, property, oldHandler }) => {
    try {
      (element as any)[property] = oldHandler;
    } catch (e) {
      console.warn(`⚠️ end-run-modal: Failed to clear ${property} handler:`, e);
    }
  });
  _endRunOnEventHandlers.length = 0;
}

function trackOnEventHandler(element: HTMLElement | Document, property: string, newHandler: any): void {
  const oldHandler = (element as any)[property];
  _endRunOnEventHandlers.push({ element, property, oldHandler });
  (element as any)[property] = newHandler;
}

function cleanupAllEndRunResources(): void {
  clearAllEndRunTimeouts();
  clearAllEndRunIntervals();
  clearAllEndRunAnimationFrames();
  clearAllEndRunEventListeners();
  clearAllEndRunOnEventHandlers();
  console.log('✅ end-run-modal: All resources cleaned up!');
}

function removeEndRunOverlay(): void {
  const existing = document.getElementById('end-run-overlay');
  if (existing) {
    existing.remove();
    console.log('🔓 Overlay protection removed (early cleanup)');
  }
}

// Ensure PIXI HUD hit areas (X + score) always stay interactive after modal closes
function restoreHudInteractivity(context: string): void {
  try {
    const hudRoot = (window as any).HUD_ROOT;
    if (!hudRoot || hudRoot.destroyed) return;

    hudRoot.eventMode = 'static';
    hudRoot.interactive = true;
    hudRoot.interactiveChildren = true;

    const xButton = hudRoot._xButton;
    if (xButton && !xButton.destroyed) {
      xButton.eventMode = 'static';
      xButton.interactive = true;
      xButton.interactiveChildren = true;
      const debugBg = xButton.children.find((child: any) => child.zIndex === 1000);
      if (debugBg && !debugBg.destroyed) {
        debugBg.eventMode = 'static';
        debugBg.interactive = true;
        debugBg.interactiveChildren = true;
      }
    }

    const scoreTouchArea = hudRoot._scoreTouchArea;
    if (scoreTouchArea && !scoreTouchArea.destroyed) {
      scoreTouchArea.eventMode = 'static';
      scoreTouchArea.interactive = true;
      scoreTouchArea.interactiveChildren = true;
      const scoreDebugBg = scoreTouchArea.children.find((child: any) => child.zIndex === 1000);
      if (scoreDebugBg && !scoreDebugBg.destroyed) {
        scoreDebugBg.eventMode = 'static';
        scoreDebugBg.interactive = true;
        scoreDebugBg.interactiveChildren = true;
      }
    }

    console.log(`🔓 PIXI HUD restored (${context}) - events enabled`);
  } catch (err) {
    console.warn('⚠️ Error restoring PIXI HUD interactivity:', err);
  }
}

function unfreezeGameAndHud(context: string): void {
  const boardContainer = document.getElementById('board-container');
  if (boardContainer) {
    boardContainer.style.pointerEvents = 'auto';
    boardContainer.style.userSelect = '';
    boardContainer.style.touchAction = '';
    console.log(`🔓 Board unfrozen (${context})`);
  }

  const hudElements = document.querySelectorAll('#hud-container, #score-text, #level-text, #combo-text, .wild-meter, #hud');
  hudElements.forEach(el => {
    if (el instanceof HTMLElement) {
      el.style.pointerEvents = 'auto';
      el.style.userSelect = '';
      el.style.touchAction = '';
    }
  });

  restoreHudInteractivity(context);
}

function forceCompleteClosing(reason: string): void {
  // Clear overlay first so clicks are never blocked
  removeEndRunOverlay();
  // Unfreeze DOM + PIXI
  unfreezeGameAndHud(`force-close:${reason}`);

  if (modal) {
    try {
      modal.remove();
    } catch {}
    modal = null;
  }

  setModalVisible(false);
  try {
    if (typeof (window as any).setEndRunModalVisible === 'function') {
      (window as any).setEndRunModalVisible(false);
    }
  } catch (err) {
    console.warn('⚠️ Error resetting modal visibility during force close:', err);
  }
}

function createModal(): HTMLElement {
  if (modal) {
    modal.remove();
    modal = null;
  }

  const isArcadeRun = isArcadeHomeRunMode();
  const currentBoardNum = (window as any).STATE?.boardNumber || (window as any).__ccStartAtLevel || 1;
  const boardNumStr = String(currentBoardNum).padStart(2, '0');
  const titleText = isArcadeRun ? 'Exit Game?' : 'Exit Board?';
  const subtitleText = isArcadeRun
    ? `Come back anytime.<br>Stage ${boardNumStr} is safe.`
    : `Come back anytime.<br>Board ${boardNumStr} is safe.`;
  const exitBtnLabel = isArcadeRun ? 'Exit Game' : 'Exit Board';

  modal = document.createElement('div');
  modal.className = 'simple-bottom-sheet';
  
  // CRITICAL: Start with display: none to prevent flash
  modal.style.display = 'none';
  
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <div class="simple-content">
      <div class="simple-header">
        <div class="simple-title-section">
          <h2>${titleText}</h2>
          <p>${subtitleText}</p>
        </div>
        <div class="simple-buttons">
          <div class="simple-button-row">
            <button type="button" class="restart-btn">${isArcadeRun ? 'New Game' : 'Restart'}</button>
            ${isArcadeRun ? '' : '<button type="button" class="new-card-btn">New Card</button>'}
            <button type="button" class="exit-btn">${exitBtnLabel}</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners
  const restartBtn = modal.querySelector('.restart-btn') as HTMLButtonElement;
  const newCardBtn = modal.querySelector('.new-card-btn') as HTMLButtonElement;
  const exitBtn = modal.querySelector('.exit-btn') as HTMLButtonElement;
  
  if (restartBtn) {
    const restartClickHandler = () => {
      console.log('🔄 Restart button clicked - starting restart sequence');
      
      // Haptic for Restart button
      if (typeof (window as any).triggerHapticSelection === 'function') {
        (window as any).triggerHapticSelection();
      }
      
      // Step 1: Animate modal exit
      hideModal();
      
      // Step 2: Wait for modal animation to complete (400ms), then restart
      // 🔥 CRITICAL: Use setTimeout directly (NOT trackEndRunTimeout) because this action
      // MUST execute even after modal cleanup - cleanupAllEndRunResources would cancel it!
      setTimeout(() => {
        console.log('🎯 Modal hidden, calling restart');
        try {
          const currentBoardNumber = (window as any).STATE?.boardNumber || (window as any).__ccStartAtLevel || 1;
          if (isArcadeRun) {
            clearArcadeSaveState();
            delete (window as any).__ccStartAtLevel;
            delete (window as any).__ccArcadeStageContinuePreserveWild;
            delete (window as any).__ccArcadeStageWildMeterCarryover;
            delete (window as any).__ccFailScreenPending;
            (window as any).__ccForceArcadeRestartStage01 = true;
            console.log('✅ end-run-modal: Arcade New Run will restart from Stage 01');
          } else {
            const saveKey = getBoardSaveKey(currentBoardNumber);
            localStorage.removeItem(saveKey);
            console.log(`✅ end-run-modal: Cleared saved game state for board ${currentBoardNumber} (${saveKey}) on restart`);
          }
          localStorage.removeItem('cubeCrash_gameState');
        } catch (error) {
          console.warn('⚠️ end-run-modal: Failed to clear saved game state on restart:', error);
        }
        if ((window as any).CC && (window as any).CC.restart) {
          (window as any).CC.restart();
        }
      }, 400); // Wait for modal close animation to complete
    };
    trackEndRunEventListener(restartBtn, 'click', restartClickHandler);
    const restartTouchHandler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      restartClickHandler();
    };
    trackEndRunEventListener(restartBtn, 'touchend', restartTouchHandler, { passive: false });
  }
  
  if (newCardBtn) {
    const newCardClickHandler = async (e?: Event) => {
      try {
        e?.preventDefault();
        e?.stopPropagation();
      } catch {}
      console.log('🎁 New Card dev button clicked');

      if (typeof (window as any).triggerHapticSelection === 'function') {
        (window as any).triggerHapticSelection();
      }

      const currentBoardNumber = (window as any).STATE?.boardNumber || (window as any).__ccStartAtLevel || 1;
      const safeBoardNumber = Number.isFinite(currentBoardNumber) && currentBoardNumber >= 1 && currentBoardNumber <= 16
        ? currentBoardNumber
        : 1;

      hideModal();

      setTimeout(async () => {
        try {
          const { journeyBoardsManager } = await import('./journey-boards-manager.js');
          const board = journeyBoardsManager.getBoardById?.(safeBoardNumber);
          const paddedBoardNumber = String(safeBoardNumber).padStart(2, '0');
          const { showJourneyNewCardScreen } = await import('./journey-new-card-screen.js');
          await showJourneyNewCardScreen({
            boardNumber: safeBoardNumber,
            cardImagePath: board?.imagePath || `./assets/colelctibles/common/${paddedBoardNumber}.png`,
            cardName: board?.name || `Board ${safeBoardNumber}`,
          });
          console.log(`✅ New Card dev screen completed for board ${safeBoardNumber}`);
        } catch (error) {
          console.error('❌ Failed to show New Card dev screen:', error);
        }
      }, 420);
    };
    trackEndRunEventListener(newCardBtn, 'click', newCardClickHandler);
    trackEndRunEventListener(newCardBtn, 'touchend', newCardClickHandler, { passive: false });
  }
  
  if (exitBtn) {
    const exitClickHandler = async () => {
      console.log('🚪 Exit button clicked - starting ULTRA INSTANT exit sequence');
      
      // Haptic for Exit button
      if (typeof (window as any).triggerHapticSelection === 'function') {
        (window as any).triggerHapticSelection();
      }
      
      // 🔥 CRITICAL FIX: Get current board number FIRST (before checking existing flag)
      const currentBoardNumber = (window as any).STATE?.boardNumber || (window as any).__ccStartAtLevel || 1;
      const returnDecision = await resolveJourneyReturnTarget(currentBoardNumber);
      console.log('🎯 end-run-modal: Journey return target prepared:', returnDecision);
      
      // 🔥 CRITICAL FIX: Kill all GSAP tweens on PIXI objects to prevent _x null errors
      // The issue is that GSAP tweens hold references to PIXI objects that may be destroyed
      // Don't stop ticker yet - we need it for the exit animation
      try {
        const STATE = (window as any).STATE;
        const gsapLib = (window as any).gsap || gsap;
        
        // Kill all tweens on tiles (which might have destroyed positions)
        if (STATE?.tiles && STATE.tiles.length > 0) {
          STATE.tiles.forEach((tile: any) => {
            try {
              if (tile && !tile.destroyed) {
                gsapLib.killTweensOf(tile);
                if (tile.scale) gsapLib.killTweensOf(tile.scale);
                if (tile.position) gsapLib.killTweensOf(tile.position);
              }
            } catch {}
          });
          console.log('✅ Killed GSAP tweens on tiles (Exit click)');
        }
        
        // Kill tweens on board and stage
        if (STATE?.board && !STATE.board.destroyed) {
          gsapLib.killTweensOf(STATE.board);
        }
        if (STATE?.stage) {
          gsapLib.killTweensOf(STATE.stage);
        }
        
        console.log('✅ GSAP tweens killed on Exit click');
      } catch (gsapError) {
        console.warn('⚠️ Failed to kill GSAP tweens on Exit:', gsapError);
      }
      
      // Step 1: Animate modal exit (non-blocking, parallel with detail modal)
      hideModal();
      
      // Step 2: Wait for modal animation to complete, then start board exit
      // 🔥 CRITICAL: Use setTimeout directly (NOT trackEndRunTimeout) because this action
      // MUST execute even after modal cleanup - cleanupAllEndRunResources would cancel it!
      setTimeout(() => {
        console.log('🎯 Modal hidden, starting board exit...');
        
        // 🔥 CRITICAL FIX: Reset gamePaused flag BEFORE exitToMenu
        // This ensures the new game can start with clean state
        try {
          if (container && typeof (container as any).set === 'function') {
            (container as any).set('gamePaused', false);
          }
        } catch (e) { /* ignore */ }
        (window as any)._gamePaused = false;
        console.log('🔓 gamePaused flag reset before exitToMenu');
        
        // 🔥 CRITICAL FIX: Clear any skip flags to ensure exit animation always plays
        // This ensures board exit animation (HUD + tiles) always plays before returning to Journey screen
        delete (window as any).__skipBoardExitAnimation;
        console.log('✅ Cleared __skipBoardExitAnimation flag - exit animation will play');
        
        // Clear saved game state ONLY if user hasn't made any moves
        // If user made moves (stack/merge), the state is already saved and should be kept
        try {
          const userMadeMove = (window as any)._userMadeMove;
          if (!userMadeMove) {
            console.log('💾 User made no moves - clearing saved game state (board-specific)');
            const currentBoardNumber = (window as any).STATE?.boardNumber || (window as any).__ccStartAtLevel || 1;
            const saveKey = getBoardSaveKey(currentBoardNumber);
            localStorage.removeItem(saveKey);
            localStorage.removeItem('cubeCrash_gameState');
            console.log(`✅ end-run-modal: Cleared saved game state for board ${currentBoardNumber} (${saveKey}) on exit (no moves made)`);
          } else {
            console.log('💾 User made moves - keeping saved game state for resume');
          }
        } catch (error) {
          console.warn('⚠️ end-run-modal: Failed to check/clear saved game state on exit:', error);
        }
        
        console.log('🎯 Requesting menu exit handoff (will play board exit animation first if available)...');
        requestExitToMenu({
          reason: 'end-run-modal-exit',
          target: isArcadeHomeRunMode() ? 'homepage' : 'auto',
        }).catch((error) => {
          console.warn('⚠️ end-run-modal: menu exit handoff failed:', error);
        });
      }, 400); // Wait for modal close animation to complete
    };
    trackEndRunEventListener(exitBtn, 'click', exitClickHandler);
    const exitTouchHandler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      exitClickHandler();
    };
    trackEndRunEventListener(exitBtn, 'touchend', exitTouchHandler, { passive: false });
  }

  // Add drag functionality
  addDragFunctionality(modal);
  
  // Add outside click functionality
  addOutsideClickFunctionality(modal);
  
  document.body.appendChild(modal);
  return modal;
}

export function showEndRunModal(): void {
  // 🔥 CRITICAL FIX: Check if modal is already visible/open before opening new one
  if (modal && modal.parentNode && !(modal as any)._closing) {
    console.warn('⚠️ End Run modal already open - ignoring duplicate show call');
    return; // Prevent opening multiple modals
  }
  
  // 🔥 CRITICAL FIX: Check if modal is in closing state
  if (modal && (modal as any)._closing) {
    console.warn('⚠️ End Run modal is closing - forcing cleanup so we can reopen');
    forceCompleteClosing('reopen');
  }
  
  console.log('🎯 Pausing game for End This Run modal');
  
  // Light haptic for opening bottom sheet
  if (typeof (window as any).triggerHapticImpact === 'function') {
    (window as any).triggerHapticImpact('light');
  }
  
  safePauseGame();
  
  // 🔥 CRITICAL FIX: Use "soft pause" - only block interactions, DON'T pause animations
  // This prevents the exploit where magnet/merge animations get interrupted
  // Animations continue in background while bottom sheet is open (looks nice, prevents exploits)
  // Only set gamePaused flag to block new drag interactions
  try {
    if (container && typeof (container as any).set === 'function') {
      (container as any).set('gamePaused', true);
    }
  } catch (error) {
    console.warn('⚠️ Failed to set gamePaused via DI:', error);
  }
  (window as any)._gamePaused = true;
  console.log('🔒 Game soft-paused (interactions blocked, animations continue)');
  
  // 🔥 NOTE: We intentionally DON'T call pauseGame() here anymore
  // pauseGame() would pause GSAP timeline and stop PIXI ticker, breaking ongoing animations
  // Instead, we only block pointer events and set gamePaused flag
  
  // 🔥 NOTE: Combo timer now uses setTimeout and works independently
  // No need to kill/restart combo timer when bottom sheet opens/closes
  
  // CRITICAL: Freeze entire game - disable ALL interactions
  // 1. Freeze board container
  const boardContainer = document.getElementById('board-container');
  if (boardContainer) {
    boardContainer.style.pointerEvents = 'none';
    boardContainer.style.userSelect = 'none';
    boardContainer.style.touchAction = 'none';
    console.log('🔒 Board frozen - ALL events disabled');
  }
  
  // 2. Freeze HUD elements (DOM only - PIXI elements handled separately)
  const hudElements = document.querySelectorAll('#hud-container, #score-text, #level-text, #combo-text, .wild-meter, #hud');
  hudElements.forEach(el => {
    if (el instanceof HTMLElement) {
      el.style.pointerEvents = 'none';
      el.style.userSelect = 'none';
      el.style.touchAction = 'none';
    }
  });
  
  // 🔥 CRITICAL: Freeze PIXI HUD elements BUT keep X button and score button interactive
  // These are PIXI Graphics elements, not DOM, so they need special handling
  // 🔥 USER REQUEST: Keep X button and score button interactive so they can close the modal
  try {
    const hudRoot = (window as any).HUD_ROOT;
    if (hudRoot && !hudRoot.destroyed) {
      // Disable interaction on HUD_ROOT but allow children to be interactive
      hudRoot.eventMode = 'passive'; // Allow children to receive events
      hudRoot.interactive = false;
      
      // 🔥 CRITICAL: Keep X button interactive so it can close the modal
      const xButton = hudRoot._xButton;
      if (xButton && !xButton.destroyed) {
        xButton.eventMode = 'static';
        xButton.interactive = true;
        xButton.interactiveChildren = true;
        const debugBg = xButton.children.find((child: any) => child.zIndex === 1000);
        if (debugBg && !debugBg.destroyed) {
          debugBg.eventMode = 'static';
          debugBg.interactive = true;
        }
      }
      
      // 🔥 CRITICAL: Keep score touch area interactive so it can close the modal
      const scoreTouchArea = hudRoot._scoreTouchArea;
      if (scoreTouchArea && !scoreTouchArea.destroyed) {
        scoreTouchArea.eventMode = 'static';
        scoreTouchArea.interactive = true;
        scoreTouchArea.interactiveChildren = true;
        const scoreDebugBg = scoreTouchArea.children.find((child: any) => child.zIndex === 1000);
        if (scoreDebugBg && !scoreDebugBg.destroyed) {
          scoreDebugBg.eventMode = 'static';
          scoreDebugBg.interactive = true;
        }
      }
      
      console.log('🔒 PIXI HUD frozen - X button and score button remain interactive');
    }
  } catch (err) {
    console.warn('⚠️ Error freezing PIXI HUD:', err);
  }
  
  console.log('🔒 HUD frozen - X button and score button remain interactive');
  
  // 3. Freeze entire app container as final safety
  const appContainer = document.getElementById('app');
  if (appContainer) {
    // Remove any stale overlay from previous run to avoid blocking clicks
    removeEndRunOverlay();
    
    // Don't set pointer-events: none on entire app, just add overlay protection
    // 🔥 USER REQUEST: Overlay should not block clicks on HUD buttons (X and score)
    // HUD is at top of screen, so we'll use pointer-events: none and handle clicks manually
    const overlay = document.createElement('div');
    overlay.id = 'end-run-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      z-index: 999998;
      pointer-events: none;
      touch-action: none;
      user-select: none;
    `;
    document.body.appendChild(overlay);
    console.log('🔒 Overlay protection added (pointer-events: none to allow HUD clicks)');
  }
  
  const el = createModal();
  console.log('🎯 END RUN MODAL CREATED');
  
  // 🔥 CRITICAL FIX: Mark modal as visible and set closing flag to false
  (el as any)._closing = false;
  
  // 🔥 CRITICAL FIX: Update modal visibility state
  setModalVisible(true);
  try {
    if (typeof window.setEndRunModalVisible === 'function') {
      window.setEndRunModalVisible(true);
    }
  } catch (err) {
    console.warn('⚠️ Error setting modal visibility state:', err);
  }
  
  // Import and run animation - same as resume modal
  trackEndRunAnimationFrame(() => {
    import('./resume-sheet-animations.js').then(({ animateBottomSheetEntrance }) => {
      animateBottomSheetEntrance(el).then(() => {
        console.log('✅ End run modal entrance complete');
      });
    }).catch((error) => {
      console.error('❌ Failed to load animation:', error);
      el.classList.add('end-run-shadow-active');
      el.classList.add('visible');
    });
  });
}

// Simple drag functionality - DRAG ON ENTIRE BOTTOM SHEET
function addDragFunctionality(modalEl: HTMLElement): void {
  console.log('🎯 ADDING DRAG TO ENTIRE MODAL');

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  // Function to ensure modal is ALWAYS horizontally centered
  function forceCenterModal(): void {
    const currentTransform = modalEl.style.transform;
    console.log('🎯 FORCE CENTERING - Current:', currentTransform);
    
    // Extract only translateY value, NO translateX needed (CSS handles centering)
    const translateYMatch = currentTransform.match(/translateY\(([^)]+)\)/);
    const translateY = translateYMatch ? translateYMatch[1] : '0';
    
    const centeredTransform = `translateY(${translateY})`;
    modalEl.style.transform = centeredTransform;
    console.log('🎯 FORCE CENTERING - New:', centeredTransform);
  }

  // Touch events on entire modal
  trackOnEventHandler(modalEl, 'ontouchstart', (e: TouchEvent) => {
    // Don't start drag if clicking on buttons
    if (e.target && ((e.target as HTMLElement).closest('.restart-btn') || 
        (e.target as HTMLElement).closest('.exit-btn') ||
        (e.target as HTMLElement).closest('.new-card-btn'))) {
      console.log('🎯 CLICK ON BUTTON - NO DRAG');
      return;
    }
    
    console.log('🎯 DRAG START ON MODAL:', e.touches[0].clientY);
    e.preventDefault();
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    modalEl.style.transition = 'none';
    
    // Force center before starting drag (only if modal is visible)
    if (modalEl.classList.contains('visible')) {
      forceCenterModal();
    }
  });

  trackOnEventHandler(modalEl, 'ontouchmove', (e: TouchEvent) => {
    // Handle button touch move for cancel on drag off
    if (e.target && ((e.target as HTMLElement).closest('.restart-btn') || 
        (e.target as HTMLElement).closest('.exit-btn') ||
        (e.target as HTMLElement).closest('.new-card-btn'))) {
      // Let button handle its own touch move
      return;
    }
    
    if (!isDragging) return;
    e.preventDefault();
    
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    
    console.log('🎯 DRAG MOVE ON MODAL:', { currentY, startY, deltaY });
    console.log('🎯 CURRENT TRANSFORM:', modalEl.style.transform);
    
    if (deltaY > 0) {
      // ONLY vertical movement - NO translateX needed
      const newTransform = `translateY(${deltaY}px)`;
      modalEl.style.transform = newTransform;
      console.log('🎯 NEW TRANSFORM:', newTransform);
    }
  });

  trackOnEventHandler(modalEl, 'ontouchend', (e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    isDragging = false;
    
    modalEl.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    console.log('🎯 DRAG END ON MODAL:', { deltaY, threshold: 80 });
    
      if (deltaY > 80) {
        console.log('🎯 CLOSING MODAL');
        modalEl.style.transition = 'transform 0.4s ease-in-out';
        modalEl.style.transform = 'translateY(100vh)';
        // Remove overlay immediately so HUD clicks aren't blocked while waiting for hideModal
        removeEndRunOverlay();
        // 🔥 SAME AS SCORE BOTTOM SHEET: Reset visibility IMMEDIATELY when drag closes
        // This makes modal instantly available for reopening
        // 🔥 CRITICAL: Remove 'visible' class IMMEDIATELY so drag-core.ts doesn't block drag
        if (modalEl) {
          modalEl.classList.remove('visible');
          modalEl.classList.remove('end-run-shadow-active');
        }
        setModalVisible(false);
      try {
        if (typeof window.setEndRunModalVisible === 'function') {
          window.setEndRunModalVisible(false);
        }
      } catch (err) {
        console.warn('⚠️ Error resetting modal visibility state:', err);
      }
      console.log('📊 End run modal drag close - visibility reset immediately');
      
      // 🔓 Restore HUD interactivity immediately so hit areas keep working
      restoreHudInteractivity('drag close (touch)');
      
      // 🔥 CRITICAL FIX: Unfreeze board and reset gamePaused IMMEDIATELY on drag close
      // This allows dragging tiles immediately, not after 400ms
      unfreezeGameAndHud('drag close immediate');
      // Reset gamePaused flag immediately
      try {
        if (container && typeof (container as any).set === 'function') {
          (container as any).set('gamePaused', false);
        }
      } catch (e) { /* ignore */ }
      (window as any)._gamePaused = false;
      console.log('🔓 Game resumed immediately on drag close');
      
      trackEndRunTimeout(() => hideModal(), 400);
    } else {
      console.log('🎯 SNAPPING BACK');
      modalEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      modalEl.style.transform = 'translateY(0)';
    }
    
    // Force center after drag ends
    trackEndRunTimeout(() => forceCenterModal(), 50);
  });
  
  // Mouse events on entire modal
  trackOnEventHandler(modalEl, 'onmousedown', (e: MouseEvent) => {
    // Don't start drag if clicking on buttons
    if (e.target && ((e.target as HTMLElement).closest('.restart-btn') || 
        (e.target as HTMLElement).closest('.exit-btn') ||
        (e.target as HTMLElement).closest('.new-card-btn'))) {
      console.log('🎯 MOUSE CLICK ON BUTTON - NO DRAG');
      return;
    }
    
    console.log('🎯 MOUSE DOWN ON MODAL:', e.clientY);
    e.preventDefault();
    startY = e.clientY;
    currentY = startY;
    isDragging = true;
    modalEl.style.transition = 'none';
    
    // Force center before starting drag (only if modal is visible)
    if (modalEl.classList.contains('visible')) {
      forceCenterModal();
    }
  });
  
  trackOnEventHandler(document, 'onmousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    
    currentY = e.clientY;
    const deltaY = currentY - startY;
    
    console.log('🎯 MOUSE MOVE:', { currentY, startY, deltaY });
    console.log('🎯 CURRENT TRANSFORM (MOUSE):', modalEl.style.transform);
    
    if (deltaY > 0) {
      // ONLY vertical movement - NO translateX needed
      const newTransform = `translateY(${deltaY}px)`;
      modalEl.style.transform = newTransform;
      console.log('🎯 NEW TRANSFORM (MOUSE):', newTransform);
    }
  });
  
  trackOnEventHandler(document, 'onmouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    
    modalEl.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    console.log('🎯 MOUSE UP:', { deltaY, threshold: 80 });
    
      if (deltaY > 80) {
        console.log('🎯 CLOSING MODAL (mouse)');
        modalEl.style.transition = 'transform 0.4s ease-in-out';
        modalEl.style.transform = 'translateY(100vh)';
        // Remove overlay immediately so HUD clicks aren't blocked while waiting for hideModal
        removeEndRunOverlay();
        // 🔥 SAME AS SCORE BOTTOM SHEET: Reset visibility IMMEDIATELY when drag closes
        // This makes modal instantly available for reopening
        // 🔥 CRITICAL: Remove 'visible' class IMMEDIATELY so drag-core.ts doesn't block drag
        if (modalEl) {
          modalEl.classList.remove('visible');
          modalEl.classList.remove('end-run-shadow-active');
        }
        setModalVisible(false);
      try {
        if (typeof window.setEndRunModalVisible === 'function') {
          window.setEndRunModalVisible(false);
        }
      } catch (err) {
        console.warn('⚠️ Error resetting modal visibility state:', err);
      }
      console.log('📊 End run modal drag close (mouse) - visibility reset immediately');
      
      // 🔓 Restore HUD interactivity immediately so hit areas keep working
      restoreHudInteractivity('drag close (mouse)');
      
      // 🔥 CRITICAL FIX: Unfreeze board and reset gamePaused IMMEDIATELY on drag close
      // This allows dragging tiles immediately, not after 400ms
      unfreezeGameAndHud('drag close mouse immediate');
      // Reset gamePaused flag immediately
      try {
        if (container && typeof (container as any).set === 'function') {
          (container as any).set('gamePaused', false);
        }
      } catch (e) { /* ignore */ }
      (window as any)._gamePaused = false;
      console.log('🔓 Game resumed immediately on mouse drag close');
      
      trackEndRunTimeout(() => hideModal(), 400);
    } else {
      console.log('🎯 SNAPPING BACK (mouse)');
      modalEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      modalEl.style.transform = 'translateY(0)';
    }
    
    // Force center after mouse drag ends
    trackEndRunTimeout(() => forceCenterModal(), 50);
  });
}

// Simple outside click functionality
// 🔥 CRITICAL FIX: Store outside click handler reference for proper cleanup
let outsideClickHandler: ((e: Event) => void) | null = null;
let outsideTouchEndHandler: ((e: TouchEvent) => void) | null = null;

function addOutsideClickFunctionality(modalEl: HTMLElement): void {
  // 🔥 CRITICAL FIX: Clean up previous handlers first
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
      // Don't close if clicking on overlay (it's part of modal structure)
      const target = e.target as HTMLElement;
      if (target.id !== 'end-run-overlay' && !target.closest('#end-run-overlay')) {
        // 🔥 CRITICAL FIX: Resume game IMMEDIATELY on outside click (same as drag close)
        unfreezeGameAndHud('outside click immediate');
        // Reset gamePaused flag immediately
        try {
          if (container && typeof (container as any).set === 'function') {
            (container as any).set('gamePaused', false);
          }
        } catch (err) { /* ignore */ }
        (window as any)._gamePaused = false;
        console.log('🔓 Game resumed immediately on outside click');
        hideModal();
      }
    }
  };
  
  outsideTouchEndHandler = (e: TouchEvent) => {
    // Check if touch is outside modal AND modal is still open
    if (modalEl && modalEl.parentNode && e.target && !modalEl.contains(e.target as Node)) {
      const target = e.target as HTMLElement;
      if (target.id !== 'end-run-overlay' && !target.closest('#end-run-overlay')) {
        // 🔥 CRITICAL FIX: Resume game IMMEDIATELY on outside touch (same as drag close)
        unfreezeGameAndHud('outside touch immediate');
        // Reset gamePaused flag immediately
        try {
          if (container && typeof (container as any).set === 'function') {
            (container as any).set('gamePaused', false);
          }
        } catch (err) { /* ignore */ }
        (window as any)._gamePaused = false;
        console.log('🔓 Game resumed immediately on outside touch');
        hideModal();
      }
    }
    };
  
  // Attach with small delay to avoid capturing the click that opened the modal
  trackEndRunTimeout(() => {
    if (outsideClickHandler) {
      trackEndRunEventListener(document, 'click', outsideClickHandler);
    }
    if (outsideTouchEndHandler) {
      trackEndRunEventListener(document, 'touchend', outsideTouchEndHandler);
    }
  }, 200);
}

export function hideModal(): void {
  let modalEl = modal;
  
  // 🔥 CRITICAL: If modal reference is null, try to find it in DOM
  if (!modalEl) {
    const domElements = document.querySelectorAll('.simple-bottom-sheet');
    for (let i = 0; i < domElements.length; i++) {
      const el = domElements[i] as HTMLElement;
      if (!el.classList.contains('score-bottom-sheet')) {
        modalEl = el;
        // Update modal reference
        modal = modalEl;
        break;
      }
    }
    
    // If still no modal, just reset state
    if (!modalEl) {
      console.warn('⚠️ hideModal: No modal element in reference or DOM - resetting state');
      setModalVisible(false);
      modal = null;
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
      removeEndRunOverlay();
      unfreezeGameAndHud('hideModal');
      return;
    }
  }
  
  if ((modalEl as any)._closing) {
    return;
  }

  (modalEl as any)._closing = true;
  
  // 🔥 CRITICAL FIX: Clean up outside click handlers immediately
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
  if (outsideTouchEndHandler) {
    document.removeEventListener('touchend', outsideTouchEndHandler);
    outsideTouchEndHandler = null;
  }
  
  // 🔥 CRITICAL FIX: Clear document.onclick if it was set (legacy cleanup)
  document.onclick = null;
  
  // 🔥 SAME AS SCORE BOTTOM SHEET: Visibility already reset in drag handler
  // Only reset here if called directly (not from drag handler)
  // Check if visibility is still true (means hideModal was called directly, not from drag)
  // 🔥 CRITICAL: Remove 'visible' class IMMEDIATELY so drag-core.ts doesn't block drag
  if (modalEl) {
    modalEl.classList.remove('visible');
    modalEl.classList.remove('end-run-shadow-active');
  }
  if (isModalVisible()) {
    console.log('📊 hideModal called directly (not from drag) - resetting visibility');
    setModalVisible(false);
    try {
      if (typeof window.setEndRunModalVisible === 'function') {
        window.setEndRunModalVisible(false);
      }
    } catch (err) {
      console.warn('⚠️ Error updating modal visibility state:', err);
    }
  } else {
    console.log('📊 hideModal called - visibility already reset (from drag handler)');
  }
  
  // Animate out with 0.4s duration (same as resume modal)
  modalEl.style.transition = 'transform 0.4s ease-in-out';
  modalEl.style.transform = 'translateY(100%)';
  
  // CRITICAL: Remove overlay protection first
  removeEndRunOverlay();
  
  // Unfreeze game board and HUD - re-enable interactions
  unfreezeGameAndHud('hideModal');
  
  console.log('🔓 HUD unfrozen - ALL events enabled');
  
  // WAIT for animation to complete before final cleanup
  trackEndRunTimeout(() => {
    // 🔥 CRITICAL FIX: Reset gamePaused flag FIRST so drag-core.ts allows dragging again
    // We used "soft pause" so GSAP/ticker were never paused - just need to reset the flag
    console.log('🎯 Resuming game after End This Run modal closed');
    
    // Reset gamePaused flag via DI container
    try {
      if (container && typeof (container as any).set === 'function') {
        (container as any).set('gamePaused', false);
      }
    } catch (error) {
      console.warn('⚠️ Failed to reset gamePaused via DI:', error);
    }
    // Also reset window fallback
    (window as any)._gamePaused = false;
    console.log('🔓 Game resumed (gamePaused flag reset)');
    
    // Call resumeGame() for safety - it's a no-op if already running
    try {
      resumeGame();
    } catch (error) {
      console.warn('⚠️ resumeGame() failed (probably fine):', error);
    }
    
    safeResumeGame();
    
    // Unlock slider
    safeUnlockSlider();
    
    // 🔥 MEMORY LEAK FIX: Cleanup all resources AFTER resuming game
    cleanupAllEndRunResources();
    
    // Remove modal from DOM
    modalEl.classList.remove('visible');
    
    // CRITICAL: Force hide bottom sheet to prevent it from blocking animations
    modalEl.style.display = 'none';
    modalEl.style.visibility = 'hidden';
    modalEl.style.zIndex = '-999999999';
    modalEl.style.transform = 'translateY(100vh)';
    modalEl.style.transition = 'none';
    
    if (modalEl) {
      modalEl.remove();
      modal = null;
    }
    
    // 🔥 SAME AS SCORE BOTTOM SHEET: Visibility already reset in drag handler
    // Only ensure it's still false (safety check)
    if (isModalVisible()) {
      console.log('📊 setTimeout callback - visibility still true, resetting');
      setModalVisible(false);
      try {
        if (typeof window.setEndRunModalVisible === 'function') {
          window.setEndRunModalVisible(false);
        }
      } catch (err) {
        console.warn('⚠️ Error clearing modal visibility state:', err);
      }
    } else {
      console.log('📊 setTimeout callback - visibility already false (from drag handler)');
    }
    
    console.log('✅ End Run modal cleanup complete - game resumed');
  }, 400);
}

export function showEndRunModalFromGame(): void {
  // 🔥 CRITICAL FIX: Check if modal is already visible before opening
  if (modal && modal.parentNode && !(modal as any)._closing) {
    console.warn('⚠️ End Run modal already open - ignoring HUD click');
    return;
  }
  
  // 🔥 CRITICAL FIX: Also check via isModalVisible function
  if (isModalVisible()) {
    console.warn('⚠️ End Run modal already visible (via isModalVisible) - ignoring HUD click');
    return;
  }
  
  // 🔥 USER REQUEST: If score bottom sheet is open, force hide it immediately before opening end-run modal
  // This prevents the end-run modal from appearing over the score bottom sheet
  // Check both via function AND directly in DOM to be absolutely sure
  const scoreSheetInDOM = document.querySelector('.score-bottom-sheet');
  const scoreSheetVisible = isScoreBottomSheetVisible();
  
  if (scoreSheetVisible || scoreSheetInDOM) {
    console.log('📊 Score bottom sheet is open - force hiding it immediately before opening end-run modal', {
      scoreSheetVisible,
      scoreSheetInDOM: !!scoreSheetInDOM
    });
    
    // Force hide via function
    forceHideScoreBottomSheet();
    
    // 🔥 CRITICAL: Also directly remove from DOM if it still exists (double safety)
    if (scoreSheetInDOM && scoreSheetInDOM.parentNode) {
      console.log('📊 Force removing score bottom sheet directly from DOM');
      scoreSheetInDOM.remove();
      // 🔥 CRITICAL: Reset state after direct DOM removal
      resetScoreBottomSheetState();
    }
    
    // Wait a bit to ensure DOM is fully cleaned up before opening new modal
    trackEndRunTimeout(() => {
      // Final check - if still exists, remove it
      const stillExists = document.querySelector('.score-bottom-sheet');
      if (stillExists) {
        console.warn('⚠️ Score bottom sheet still exists after cleanup - force removing');
        stillExists.remove();
        // 🔥 CRITICAL: Reset state after final cleanup
        resetScoreBottomSheetState();
      }
      showEndRunModal();
    }, 50); // Small delay to ensure DOM cleanup
    return;
  }
  
  showEndRunModal();
}

// 🔥 CRITICAL FIX: Export function to check if modal is visible (for HUD click guard)
export function isEndRunModalVisible(): boolean {
  // 🔥 CRITICAL: First check if modal exists in DOM (most reliable check)
  // Look for .simple-bottom-sheet but NOT .score-bottom-sheet
  const domElements = document.querySelectorAll('.simple-bottom-sheet');
  let endRunModalInDOM: HTMLElement | null = null;
  for (let i = 0; i < domElements.length; i++) {
    const el = domElements[i] as HTMLElement;
    if (!el.classList.contains('score-bottom-sheet')) {
      endRunModalInDOM = el;
      break;
    }
  }
  const hasDomElement = endRunModalInDOM && endRunModalInDOM.parentNode;
  
  // 🔥 CRITICAL: Check utility function (checks isModalVisibleState flag)
  const utilityVisible = isModalVisible();
  
  // 🔥 CRITICAL: If utility says visible but no modal in DOM, reset state
  if (utilityVisible && !modal && !hasDomElement) {
    console.log('🔍 isEndRunModalVisible: utilityVisible=true but no modal or DOM element - resetting state');
    setModalVisible(false);
    return false;
  }
  
  // 🔥 CRITICAL: If modal is closing, it's not visible
  if (modal && (modal as any)._closing) {
    return false;
  }
  
  // 🔥 CRITICAL: Check if modal exists and is actually visible (has 'visible' class)
  if (modal && modal.parentNode) {
    // Check if modal has 'visible' class (actually shown)
    if (modal.classList.contains('visible')) {
      return true;
    }
  }
  
  // 🔥 CRITICAL: Also check DOM directly as fallback
  if (hasDomElement && endRunModalInDOM.classList.contains('visible')) {
    return true;
  }
  
  // 🔥 CRITICAL: Check utility flag last (can be stale if modal was removed)
  if (utilityVisible && (modal || hasDomElement)) {
    return true;
  }
  
  return false;
}

// Export to window for HUD click handler
if (typeof window !== 'undefined') {
  (window as any).isEndRunModalVisible = isEndRunModalVisible;
  (window as any).hideEndRunModal = hideModal;
  (window as any).setEndRunModalVisible = (visible: boolean) => {
    // Update visibility state via utility function
    setModalVisible(visible);
    // Helper function for closing state management
    if (!visible && modal) {
      (modal as any)._closing = true;
    }
  };
}
