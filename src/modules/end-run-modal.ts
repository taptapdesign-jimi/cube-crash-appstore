// Simple End Run Modal
import { showCleanBoardModal } from './clean-board-modal.js';
import { safePauseGame, safeResumeGame, safeUnlockSlider } from '../utils/animations.js';

let modal: HTMLElement | null = null;

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
            <button class="complete-board-btn">Complete Board</button>
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
      
      // Step 1: Animate modal exit
      hideModal();
      
      // Step 2: Wait for modal animation to complete (400ms), then restart
      setTimeout(() => {
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
      }, 400); // Wait for modal close animation to complete
    });
  }
  
  if (completeBoardBtn) {
    completeBoardBtn.addEventListener('click', async () => {
      console.log('🎯 Complete Board button clicked');
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
            
            const interval = setInterval(() => {
              step++;
              current += stepSize;
              if (step >= steps) {
                scoreEl.textContent = newScore.toLocaleString();
                clearInterval(interval);
              } else {
                scoreEl.textContent = Math.round(current).toLocaleString();
              }
            }, duration / steps);
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
      
      // Step 1: Animate modal exit (non-blocking)
      hideModal();
      
      // Step 2: Start board exit animation IMMEDIATELY (don't wait for modal to finish)
      console.log('🎯 Starting board exit immediately - modal exits in parallel');
      
      // Guard: Prevent multiple calls
      if ((window as any).exitingToMenu) {
        console.log('⚠️ exitToMenu already in progress, skipping duplicate call');
        return;
      }
      
      // Clear saved game state when exiting
      try {
        localStorage.removeItem('cc_saved_game');
        localStorage.removeItem('cubeCrash_gameState');
        console.log('✅ end-run-modal: Cleared both saved game states on exit');
      } catch (error) {
        console.warn('⚠️ end-run-modal: Failed to clear saved game state on exit:', error);
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
  console.log('🎯 Pausing game for End This Run modal');
  safePauseGame();
  
  // CRITICAL: Freeze entire game - disable ALL interactions
  // 1. Freeze board container
  const boardContainer = document.getElementById('board-container');
  if (boardContainer) {
    boardContainer.style.pointerEvents = 'none';
    boardContainer.style.userSelect = 'none';
    boardContainer.style.touchAction = 'none';
    console.log('🔒 Board frozen - ALL events disabled');
  }
  
  // 2. Freeze HUD elements
  const hudElements = document.querySelectorAll('#hud-container, #score-text, #level-text, #combo-text, .wild-meter, #hud');
  hudElements.forEach(el => {
    if (el instanceof HTMLElement) {
      el.style.pointerEvents = 'none';
      el.style.userSelect = 'none';
      el.style.touchAction = 'none';
    }
  });
  console.log('🔒 HUD frozen - ALL events disabled');
  
  // 3. Freeze entire app container as final safety
  const appContainer = document.getElementById('app');
  if (appContainer) {
    // Don't set pointer-events: none on entire app, just add overlay protection
    const overlay = document.createElement('div');
    overlay.id = 'end-run-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      z-index: 999999;
      pointer-events: all;
      touch-action: none;
      user-select: none;
    `;
    document.body.appendChild(overlay);
    console.log('🔒 Overlay protection added');
  }
  
  const el = createModal();
  console.log('🎯 END RUN MODAL CREATED');
  
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
function addOutsideClickFunctionality(modalEl: HTMLElement): void {
  // Simple outside click
  setTimeout(() => {
    document.onclick = (e: Event) => {
      if (e.target && !modalEl.contains(e.target as Node)) {
        hideModal();
      }
    };
  }, 200);
}

export function hideModal(): void {
  const modalEl = modal;
  if (!modalEl || (modalEl as any)._closing) return;

  (modalEl as any)._closing = true;
  
  // Animate out with 0.4s duration (same as resume modal)
  modalEl.style.transition = 'transform 0.4s ease-in-out';
  modalEl.style.transform = 'translateY(100%)';
  
  // CRITICAL: Remove overlay protection first
  const overlay = document.getElementById('end-run-overlay');
  if (overlay) {
    overlay.remove();
    console.log('🔓 Overlay protection removed');
  }
  
  // Unfreeze game board and HUD - re-enable interactions
  const boardContainer = document.getElementById('board-container');
  if (boardContainer) {
    boardContainer.style.pointerEvents = 'auto';
    boardContainer.style.userSelect = '';
    boardContainer.style.touchAction = '';
    console.log('🔓 Board unfrozen - ALL events enabled');
  }
  
  const hudElements = document.querySelectorAll('#hud-container, #score-text, #level-text, #combo-text, .wild-meter, #hud');
  hudElements.forEach(el => {
    if (el instanceof HTMLElement) {
      el.style.pointerEvents = 'auto';
      el.style.userSelect = '';
      el.style.touchAction = '';
    }
  });
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
    
    // CRITICAL: Resume game AFTER modal is completely removed
    console.log('🎯 Resuming game after End This Run modal closed');
    safeResumeGame();
    
    // Unlock slider
    safeUnlockSlider();
    
    console.log('✅ End Run modal cleanup complete - game resumed');
  }, 400);
}

export function showEndRunModalFromGame(): void {
  showEndRunModal();
}