// Simple End Run Modal
import { showCleanBoardModal } from './clean-board-modal.js';
import { safePauseGame, safeResumeGame, safeUnlockSlider } from '../utils/animations.ts';

// Add CSS styles for end run modal buttons
function addEndRunModalStyles() {
  if (document.getElementById('end-run-modal-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'end-run-modal-styles';
  style.textContent = `
    /* End Run Modal Button Styles - matching original CTA buttons */
    .restart-btn {
      background: #E97A55 !important;
      color: white !important;
      border: none !important;
      border-radius: 40px !important;
      height: 64px !important;
      padding: 0 56px !important;
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 24px !important;
      font-weight: bold !important;
      box-shadow: 0 8px 0 0 #C24921 !important;
      transition: transform 0.15s ease !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transform: scale(1) !important;
      position: relative !important;
      overflow: hidden !important;
      -webkit-tap-highlight-color: transparent !important;
      -webkit-touch-callout: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
      cursor: pointer !important;
      width: 100% !important;
      max-width: 280px !important;
    }
    
    .restart-btn:hover {
      transform: scale(1.05) !important;
    }
    
    .restart-btn:active {
      transform: scale(0.95) !important;
      box-shadow: 0 4px 0 0 #C24921 !important;
    }
    
    .exit-btn {
      background: white !important;
      color: #AD8775 !important;
      border: 1px solid #E8DBD6 !important;
      border-radius: 40px !important;
      height: 64px !important;
      padding: 16px 64px !important;
      font-family: "Inter", system-ui, -apple-system, sans-serif !important;
      font-size: 20px !important;
      font-weight: bold !important;
      box-shadow: 0 6px 0 0 #E8DBD6 !important;
      transition: transform 0.15s ease !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transform: scale(1) !important;
      position: relative !important;
      overflow: hidden !important;
      -webkit-tap-highlight-color: transparent !important;
      -webkit-touch-callout: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
      cursor: pointer !important;
      width: 310px !important;
      max-width: 310px !important;
    }
    
    .exit-btn:hover {
      transform: scale(1.05) !important;
    }
    
    .exit-btn:active {
      transform: scale(0.95) !important;
      box-shadow: 0 3px 0 0 #E8DBD6 !important;
    }
    
    .debug-btn {
      background: #FF6B35 !important;
      color: white !important;
      border: none !important;
      border-radius: 40px !important;
      height: 48px !important;
      padding: 0 32px !important;
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 18px !important;
      font-weight: bold !important;
      box-shadow: 0 6px 0 0 #E55A2B !important;
      transition: transform 0.15s ease !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transform: scale(1) !important;
      position: relative !important;
      overflow: hidden !important;
      -webkit-tap-highlight-color: transparent !important;
      -webkit-touch-callout: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
      cursor: pointer !important;
      width: 100% !important;
      max-width: 200px !important;
    }
    
    .debug-btn:hover {
      transform: scale(1.05) !important;
    }
    
    .debug-btn:active {
      transform: scale(0.95) !important;
      box-shadow: 0 3px 0 0 #E55A2B !important;
    }
    
    /* Button row layout */
    .modal-buttons {
      display: flex !important;
      flex-direction: column !important;
      gap: 16px !important;
      width: 100% !important;
      align-items: center !important;
    }
  `;
  
  document.head.appendChild(style);
}

let modal = null;

function createModal() {
  if (modal) {
    modal.remove();
    modal = null;
  }

  modal = document.createElement('div');
  modal.className = 'simple-bottom-sheet';
  
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
            <button class="exit-btn">Exit</button>
          </div>
          <div class="debug-button-row">
            <button class="debug-btn">🧪 Test Clean Board</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners
  const restartBtn = modal.querySelector('.restart-btn');
  const exitBtn = modal.querySelector('.exit-btn');
  const debugBtn = modal.querySelector('.debug-btn');
  
  // Add button press handling for proper UX with "cancel on drag off" logic
  const addButtonPressHandling = (btn, action) => {
    let touchStarted = false;
    let touchStartedOnButton = false;
    
    const handleTouchStart = (e) => {
      touchStarted = true;
      touchStartedOnButton = btn.contains(e.target);
      if (touchStartedOnButton) {
        btn.style.transform = 'scale(0.80)';
        btn.style.transition = 'transform 0.35s ease';
      }
    };
    
    const handleTouchMove = (e) => {
      if (touchStarted && touchStartedOnButton) {
        // Check if touch moved outside button
        const touch = e.touches[0];
        const rect = btn.getBoundingClientRect();
        const isOutside = touch.clientX < rect.left || touch.clientX > rect.right || 
                         touch.clientY < rect.top || touch.clientY > rect.bottom;
        
        if (isOutside) {
          // Cancel the touch - reset button
          btn.style.transform = 'scale(1)';
          btn.style.transition = 'transform 0.35s ease';
          touchStartedOnButton = false;
        }
      }
    };
    
    const handleTouchEnd = (e) => {
      if (touchStarted && touchStartedOnButton) {
        // Only trigger if touch ended on button
        const touch = e.changedTouches[0];
        const rect = btn.getBoundingClientRect();
        const isOnButton = touch.clientX >= rect.left && touch.clientX <= rect.right && 
                          touch.clientY >= rect.top && touch.clientY <= rect.bottom;
        
        if (isOnButton) {
          action();
        }
      }
      
      // Reset button
      btn.style.transform = 'scale(1)';
      btn.style.transition = 'transform 0.35s ease';
      touchStarted = false;
      touchStartedOnButton = false;
    };
    
    const handleMouseDown = (e) => {
      if (btn.contains(e.target)) {
        btn.style.transform = 'scale(0.80)';
        btn.style.transition = 'transform 0.35s ease';
      }
    };
    
    const handleMouseUp = (e) => {
      if (btn.contains(e.target)) {
        btn.style.transform = 'scale(1)';
        btn.style.transition = 'transform 0.35s ease';
      }
    };
    
    const handleMouseLeave = () => {
      btn.style.transform = 'scale(1)';
      btn.style.transition = 'transform 0.35s ease';
    };
    
    // Add event listeners
    btn.addEventListener('touchstart', handleTouchStart, { passive: true });
    btn.addEventListener('touchmove', handleTouchMove, { passive: true });
    btn.addEventListener('touchend', handleTouchEnd, { passive: true });
    btn.addEventListener('mousedown', handleMouseDown);
    btn.addEventListener('mouseup', handleMouseUp);
    btn.addEventListener('mouseleave', handleMouseLeave);
  };
  
  addButtonPressHandling(restartBtn, () => {
    hideModal();
    // Clear saved game state when restarting
    try {
      localStorage.removeItem('cc_saved_game');
      localStorage.removeItem('cubeCrash_gameState');
      console.log('✅ end-run-modal: Cleared both saved game states on restart');
    } catch (error) {
      console.warn('⚠️ end-run-modal: Failed to clear saved game state on restart:', error);
    }
    if (window.CC && window.CC.restart) {
      window.CC.restart();
    }
  });
  
  addButtonPressHandling(exitBtn, () => {
    hideModal();
    // Clear saved game state when exiting
    try {
      localStorage.removeItem('cc_saved_game');
      localStorage.removeItem('cubeCrash_gameState');
      console.log('✅ end-run-modal: Cleared both saved game states on exit');
    } catch (error) {
      console.warn('⚠️ end-run-modal: Failed to clear saved game state on exit:', error);
    }
    if (window.exitToMenu) {
      window.exitToMenu();
    }
  });
  
  addButtonPressHandling(debugBtn, async () => {
    hideModal();
    // Trigger clean board flow for testing
    console.log('🧪 DEBUG: Triggering clean board modal...');
    try {
      // Create mock context for clean board modal
      const mockContext = {
        app: window.CC?.app || {},
        stage: window.CC?.stage || {},
        getScore: () => window.CC?.getScore?.() || 1000,
        setScore: (score) => window.CC?.setScore?.(score),
        animateScore: (score) => window.CC?.animateScore?.(score),
        updateHUD: () => window.CC?.updateHUD?.(),
        bonus: 500,
        scoreCap: 999999,
        boardNumber: 1
      };
      
      await showCleanBoardModal(mockContext);
      console.log('🧪 DEBUG: Clean board modal triggered successfully');
    } catch (error) {
      console.warn('🧪 DEBUG: Failed to trigger clean board modal:', error);
    }
  });
  
  // Add drag functionality
  addDragFunctionality(modal);
  
  // Add outside click functionality
  addOutsideClickFunctionality(modal);
  
  document.body.appendChild(modal);
  return modal;
}

export function showEndRunModal() {
  console.log('🎯 showEndRunModal CALLED!');
  
  // Add CSS styles first
  addEndRunModalStyles();
  
  // CRITICAL: Pause the game completely when modal appears
  console.log('🎯 Pausing game for End This Run modal');
  safePauseGame();
  
  const el = createModal();
  console.log('🎯 MODAL ELEMENT CREATED:', el);
  console.log('🎯 MODAL IN DOM:', document.body.contains(el));
  
  // Modal starts hidden (CSS default)
  console.log('🎯 MODAL CREATED - Initial transform:', el.style.transform);
  console.log('🎯 MODAL CLASSES:', el.className);
  
  // Show with animation
  setTimeout(() => {
    el.classList.add('visible');
    console.log('🎯 MODAL VISIBLE - Transform after visible class:', el.style.transform);
    console.log('🎯 MODAL CLASSES AFTER VISIBLE:', el.className);
  }, 10);
}

// Simple drag functionality - DRAG ON ENTIRE BOTTOM SHEET
function addDragFunctionality(modalEl) {
  console.log('🎯 ADDING DRAG TO ENTIRE MODAL');

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  // Function to ensure modal is ALWAYS horizontally centered
  function forceCenterModal() {
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
  modalEl.ontouchstart = (e) => {
    // Don't start drag if clicking on buttons
    if (e.target.closest('.restart-btn') || e.target.closest('.exit-btn') || e.target.closest('.debug-btn')) {
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

  modalEl.ontouchmove = (e) => {
    // Handle button touch move for cancel on drag off
    if (e.target.closest('.restart-btn') || e.target.closest('.exit-btn') || e.target.closest('.debug-btn')) {
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

  modalEl.ontouchend = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    isDragging = false;
    
    modalEl.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    console.log('🎯 DRAG END ON MODAL:', { deltaY, threshold: 80 });
    
    if (deltaY > 80) {
      console.log('🎯 CLOSING MODAL');
      modalEl.style.transform = 'translateY(100vh)';
      setTimeout(() => hideModal(), 300);
    } else {
      console.log('🎯 SNAPPING BACK');
      modalEl.style.transform = 'translateY(0)';
    }
    
    // Force center after drag ends
    setTimeout(() => forceCenterModal(), 50);
  };
  
  // Mouse events on entire modal
  modalEl.onmousedown = (e) => {
    // Don't start drag if clicking on buttons
    if (e.target.closest('.restart-btn') || e.target.closest('.exit-btn') || e.target.closest('.debug-btn')) {
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
  
  document.onmousemove = (e) => {
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
      modalEl.style.transform = 'translateY(100vh)';
      setTimeout(() => hideModal(), 300);
    } else {
      console.log('🎯 SNAPPING BACK (mouse)');
      modalEl.style.transform = 'translateY(0)';
    }
    
    // Force center after mouse drag ends
    setTimeout(() => forceCenterModal(), 50);
  };
}

// Simple outside click functionality
function addOutsideClickFunctionality(modalEl) {
  // Simple outside click
  setTimeout(() => {
    document.onclick = (e) => {
      if (!modalEl.contains(e.target)) {
        hideModal();
      }
    };
  }, 200);
}

export function hideModal() {
  if (modal) {
    modal.classList.remove('visible');
    
    // Resume the game when modal is closed
    console.log('🎯 Resuming game after End This Run modal closed');
    safeResumeGame();
    
    // Unlock slider immediately so CTA becomes responsive right after the sheet starts closing
    safeUnlockSlider();
    
    setTimeout(() => {
      if (modal) {
        modal.remove();
        modal = null;
      }
    }, 300);
  }
}
