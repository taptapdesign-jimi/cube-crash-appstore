// Simple End Run Modal
import { showCleanBoardModal } from './clean-board-modal.js';
import { safePauseGame, safeResumeGame, safeUnlockSlider } from '../utils/animations.js';
import { setModalVisible, isModalVisible } from './end-run-utils.js';
import { pauseGame, resumeGame } from './pause-utils.js';
import { forceHideScoreBottomSheet, isScoreBottomSheetVisible, resetScoreBottomSheetState } from './score-bottom-sheet.js';

let modal: HTMLElement | null = null;

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

  modal = document.createElement('div');
  modal.className = 'simple-bottom-sheet';
  
  // CRITICAL: Start with display: none to prevent flash
  modal.style.display = 'none';
  
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <div class="simple-content">
      <div class="simple-header">
        <div class="simple-title-section">
          <h2>End This Run?</h2>
          <p>Think twice, your progress <br>disappears once you leave.</p>
        </div>
        <div class="simple-buttons">
          <div class="simple-button-row">
            <button class="restart-btn">Restart</button>
            <button class="complete-board-btn">Clean Board</button>
            <button class="exit-btn">Exit</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners
  const restartBtn = modal.querySelector('.restart-btn') as HTMLButtonElement;
  const completeBoardBtn = modal.querySelector('.complete-board-btn') as HTMLButtonElement;
  const exitBtn = modal.querySelector('.exit-btn') as HTMLButtonElement;
  
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      console.log('🔄 Restart button clicked - starting restart sequence');
      
      // Haptic for Restart button
      if (typeof (window as any).triggerHapticSelection === 'function') {
        (window as any).triggerHapticSelection();
      }
      
      // Step 1: Animate modal exit
      hideModal();
      
      // Step 2: Wait for modal animation to complete (400ms), then restart
      // 🔥 MEMORY LEAK FIX: Store timeout ID for cleanup
      const timeout = setTimeout(() => {
        console.log('🎯 Modal hidden, calling restart');
        // Clear saved game state when restarting
        try {
          localStorage.removeItem('cc_saved_game');
          localStorage.removeItem('cubeCrash_gameState');
          console.log('✅ end-run-modal: Cleared both saved game states on restart');
        } catch (error) {
          console.warn('⚠️ end-run-modal: Failed to clear saved game state on restart:', error);
        }
        if ((window as any).CC && (window as any).CC.restart) {
          (window as any).CC.restart();
        }
        // 🔥 Remove from global tracker
        if ((window as any)._activeTimeouts) {
          (window as any)._activeTimeouts.delete(timeout);
        }
      }, 400); // Wait for modal close animation to complete
      
      // 🔥 MEMORY LEAK FIX: Track timeout globally for cleanup
      if (!(window as any)._activeTimeouts) {
        (window as any)._activeTimeouts = new Set();
      }
      (window as any)._activeTimeouts.add(timeout);
    });
  }
  
  if (completeBoardBtn) {
    completeBoardBtn.addEventListener('click', async () => {
      console.log('🎯 Complete Board button clicked');
      
      // Haptic for Complete Board button
      if (typeof (window as any).triggerHapticSelection === 'function') {
        (window as any).triggerHapticSelection();
      }
      
      hideModal();
      
      // Call showCleanBoardModal instantly
      try {
        const { showCleanBoardModal } = await import('./clean-board-modal.js');
        
        // Get current game context
        const getScore = () => {
          const scoreEl = document.querySelector('#score-text');
          if (scoreEl) {
            const text = scoreEl.textContent || '0';
            return parseInt(text.replace(/,/g, '')) || 0;
          }
          return 0;
        };
        
        const setScore = (score: number) => {
          const scoreEl = document.querySelector('#score-text');
          if (scoreEl) {
            scoreEl.textContent = score.toLocaleString();
          }
        };
        
        const animateScore = (newScore: number, duration: number) => {
          const scoreEl = document.querySelector('#score-text');
          if (scoreEl) {
            const currentScore = parseInt(scoreEl.textContent?.replace(/,/g, '') || '0');
            const diff = newScore - currentScore;
            const steps = 60;
            const stepSize = diff / steps;
            let current = currentScore;
            let step = 0;
            
            // 🔥 MEMORY LEAK FIX: Store interval ID for cleanup
            const interval = setInterval(() => {
              step++;
              current += stepSize;
              if (step >= steps) {
                scoreEl.textContent = newScore.toLocaleString();
                clearInterval(interval);
                // 🔥 Remove from global tracker
                if ((window as any)._activeIntervals) {
                  (window as any)._activeIntervals.delete(interval);
                }
              } else {
                scoreEl.textContent = Math.round(current).toLocaleString();
              }
            }, duration / steps);
            
            // 🔥 MEMORY LEAK FIX: Track interval globally for cleanup
            if (!(window as any)._activeIntervals) {
              (window as any)._activeIntervals = new Set();
            }
            (window as any)._activeIntervals.add(interval);
          }
        };
        
        const updateHUD = () => {
          // Update HUD if needed
          console.log('✅ HUD updated');
        };
        
        await showCleanBoardModal({
          app: (window as any).app,
          stage: (window as any).stage,
          getScore,
          setScore,
          animateScore,
          updateHUD,
          bonus: 500,
          scoreCap: 999999,
          boardNumber: 1
        });
        
        console.log('✅ Clean board modal shown');
      } catch (error) {
        console.error('❌ Failed to show clean board modal:', error);
      }
    });
  }
  
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      console.log('🚪 Exit button clicked - starting exit sequence');
      
      // Haptic for Exit button
      if (typeof (window as any).triggerHapticSelection === 'function') {
        (window as any).triggerHapticSelection();
      }
      
      // Step 1: Animate modal exit (non-blocking)
      hideModal();
      
      // Step 2: Start board exit animation IMMEDIATELY (don't wait for modal to finish)
      console.log('🎯 Starting board exit immediately - modal exits in parallel');
        
        // Guard: Prevent multiple calls
        if ((window as any).exitingToMenu) {
          console.log('⚠️ exitToMenu already in progress, skipping duplicate call');
          return;
        }
        
      // Clear saved game state ONLY if user hasn't made any moves
      // If user made moves (stack/merge), the state is already saved and should be kept
        try {
        const userMadeMove = (window as any)._userMadeMove;
        if (!userMadeMove) {
          console.log('💾 User made no moves - clearing saved game state');
          localStorage.removeItem('cc_saved_game');
          localStorage.removeItem('cubeCrash_gameState');
          console.log('✅ end-run-modal: Cleared both saved game states on exit (no moves made)');
        } else {
          console.log('💾 User made moves - keeping saved game state for resume');
        }
        } catch (error) {
        console.warn('⚠️ end-run-modal: Failed to check/clear saved game state on exit:', error);
        }
        if ((window as any).exitToMenu) {
          (window as any).exitToMenu();
        }
    });
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
  
  // 🔥 USER REQUEST: Pause game to prevent tile interactions
  try {
    pauseGame();
    console.log('🔒 Game paused (end-run modal)');
  } catch (error) {
    console.warn('⚠️ Failed to pause game:', error);
  }
  
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
  requestAnimationFrame(() => {
    import('./resume-sheet-animations.js').then(({ animateBottomSheetEntrance }) => {
      animateBottomSheetEntrance(el).then(() => {
        console.log('✅ End run modal entrance complete');
      });
    }).catch((error) => {
      console.error('❌ Failed to load animation:', error);
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
  modalEl.ontouchstart = (e: TouchEvent) => {
    // Don't start drag if clicking on buttons
    if (e.target && ((e.target as HTMLElement).closest('.restart-btn') || 
        (e.target as HTMLElement).closest('.complete-board-btn') ||
        (e.target as HTMLElement).closest('.exit-btn'))) {
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
  };

  modalEl.ontouchmove = (e: TouchEvent) => {
    // Handle button touch move for cancel on drag off
    if (e.target && ((e.target as HTMLElement).closest('.restart-btn') || 
        (e.target as HTMLElement).closest('.complete-board-btn') ||
        (e.target as HTMLElement).closest('.exit-btn'))) {
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
  };

  modalEl.ontouchend = (e: TouchEvent) => {
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
      
      setTimeout(() => hideModal(), 400);
    } else {
      console.log('🎯 SNAPPING BACK');
      modalEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      modalEl.style.transform = 'translateY(0)';
    }
    
    // Force center after drag ends
    setTimeout(() => forceCenterModal(), 50);
  };
  
  // Mouse events on entire modal
  modalEl.onmousedown = (e: MouseEvent) => {
    // Don't start drag if clicking on buttons
    if (e.target && ((e.target as HTMLElement).closest('.restart-btn') || 
        (e.target as HTMLElement).closest('.complete-board-btn') ||
        (e.target as HTMLElement).closest('.exit-btn'))) {
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
  };
  
  document.onmousemove = (e: MouseEvent) => {
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
  };
  
  document.onmouseup = () => {
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
      
      setTimeout(() => hideModal(), 400);
    } else {
      console.log('🎯 SNAPPING BACK (mouse)');
      modalEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      modalEl.style.transform = 'translateY(0)';
    }
    
    // Force center after mouse drag ends
    setTimeout(() => forceCenterModal(), 50);
  };
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
        hideModal();
      }
    }
  };
  
  outsideTouchEndHandler = (e: TouchEvent) => {
    // Check if touch is outside modal AND modal is still open
    if (modalEl && modalEl.parentNode && e.target && !modalEl.contains(e.target as Node)) {
      const target = e.target as HTMLElement;
      if (target.id !== 'end-run-overlay' && !target.closest('#end-run-overlay')) {
        hideModal();
      }
    }
    };
  
  // Attach with small delay to avoid capturing the click that opened the modal
  setTimeout(() => {
    if (outsideClickHandler) {
      document.addEventListener('click', outsideClickHandler);
    }
    if (outsideTouchEndHandler) {
      document.addEventListener('touchend', outsideTouchEndHandler);
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
  
  // WAIT for animation to complete before resuming game
  setTimeout(() => {
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
    
    // CRITICAL: Resume game AFTER modal is completely removed
    console.log('🎯 Resuming game after End This Run modal closed');
    safeResumeGame();
    
    // 🔥 USER REQUEST: Resume game to allow tile interactions
    try {
      resumeGame();
      console.log('🔓 Game resumed (end-run modal closed)');
    } catch (error) {
      console.warn('⚠️ Failed to resume game:', error);
    }
    
    // Unlock slider
    safeUnlockSlider();
    
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
    setTimeout(() => {
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
