// Resume Game Bottom Sheet - same style as End This Run modal

import { safePauseGame, safeResumeGame, safeUnlockSlider, safeLockSlider } from '../utils/animations.js';
import { logger } from '../core/logger.js';

let resumeModal: HTMLElement | null = null;

function createCleanupRegistry(modalEl: HTMLElement): (fn: () => void) => void {
  const list: (() => void)[] = [];
  (modalEl as any)._cleanupFns = list;
  return function register(fn: () => void) {
    if (typeof fn === 'function') list.push(fn);
  };
}

function createResumeModal(): HTMLElement {
  if (resumeModal) {
    // CRITICAL: Remove all event listeners before removing
    const oldModal = resumeModal;
    try {
      const cleanups = Array.isArray((oldModal as any)._cleanupFns) ? [...(oldModal as any)._cleanupFns] : [];
      cleanups.forEach(fn => {
        try { fn(); } catch (e) {}
      });
    } catch (e) {}
    
    resumeModal.remove();
    resumeModal = null;
  }

  resumeModal = document.createElement('div');
  resumeModal.className = 'resume-bottom-sheet';
  
  // CRITICAL: Start with display: none to prevent flash
  resumeModal.style.display = 'none';
  
  const registerCleanup = createCleanupRegistry(resumeModal);
  
  resumeModal.innerHTML = `
    <div class="modal-handle"></div>
    <div class="simple-content">
      <div class="simple-header">
        <div class="simple-title-section">
          <h2>Resume Game?</h2>
          <p>Would you like to continue<br>your last game?</p>
        </div>
        <div class="simple-buttons">
          <div class="simple-button-row">
            <button class="continue-btn">Continue</button>
            <button class="new-game-btn">New Game</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const continueBtn = resumeModal.querySelector('.continue-btn');
  const newGameBtn = resumeModal.querySelector('.new-game-btn');

  if (continueBtn) {
    (continueBtn as HTMLButtonElement).addEventListener('click', () => {
      console.log('🔘 Continue button pressed - loading saved game');
      hideResumeModal();
      setTimeout(() => {
        if (typeof (window as any).continueGameWithSavedState === 'function') {
          (window as any).continueGameWithSavedState();
        } else {
          console.error('❌ continueGameWithSavedState function not found');
        }
      }, 700); // 700ms to match New Game delay
    });
  }
  
  if (newGameBtn) {
    (newGameBtn as HTMLButtonElement).addEventListener('click', () => {
      console.log('🔘 New Game button pressed - starting fresh');
      // Clear saved game state
      try {
        localStorage.removeItem('cc_saved_game');
        localStorage.removeItem('cubeCrash_gameState');
        console.log('✅ Cleared saved game state for new game');
      } catch (error) {
        console.warn('⚠️ Failed to clear saved game state:', error);
      }
      hideResumeModal();
      // CRITICAL: Wait for modal to close, then start game directly
      // IMPORTANT: This delay should be LONGER than Continue to ensure modal is closed
      setTimeout(() => {
        console.log('🎮 Starting game after modal closed (New Game)');
        // Call startNewGame directly - it will handle exit animation
        if ((window as any).uiManager) {
          (window as any).uiManager.startNewGame();
        }
      }, 700); // 700ms instead of 600ms to ensure modal is fully closed
    });
  }
  
  // Add drag FIRST, then append to DOM
  addDragFunctionality(resumeModal, registerCleanup);
  
  document.body.appendChild(resumeModal);
  
  // Add outside click AFTER DOM append
  addOutsideClickFunctionality(resumeModal, registerCleanup);
  
  return resumeModal;
}

function addOutsideClickFunctionality(modalEl: HTMLElement, registerCleanup: (fn: () => void) => void): void {
  setTimeout(() => {
    document.onclick = (e: Event) => {
      if (modalEl && !modalEl.contains(e.target as Node)) {
        hideResumeModal();
      }
    };
    
    document.ontouchend = (e: TouchEvent) => {
      if (modalEl && !modalEl.contains(e.target as Node)) {
        hideResumeModal();
      }
    };
    
    registerCleanup(() => {
      document.onclick = null;
      document.ontouchend = null;
    });
  }, 200);
}

// Import animation function at module level (no async import delay)
import { animateBottomSheetEntrance } from './resume-sheet-animations.js';

export function showResumeGameBottomSheet(): void {
  console.log('🎯 Pausing game for bottom sheet');
  safePauseGame();
  
  // Lock slider to prevent swiping
  safeLockSlider();
  
  const el = createResumeModal();
  console.log('🎯 RESUME MODAL CREATED');
  
  // CRITICAL: Small delay to ensure DOM is ready before animating
  setTimeout(() => {
    requestAnimationFrame(() => {
      // Direct animation call - no async import, instant response
      animateBottomSheetEntrance(el).then(() => {
        console.log('✅ Bottom sheet entrance complete');
      }).catch((error) => {
        console.error('❌ Failed to animate:', error);
        el.classList.add('visible');
      });
    });
  }, 50); // 50ms delay to ensure modal is fully created
}

export function hideResumeModal(): void {
  const modalEl = resumeModal;
  if (!modalEl || (modalEl as any)._closing) return;

  (modalEl as any)._closing = true;
  
  // Animate out with 0.4s duration
  modalEl.style.transition = 'transform 0.4s ease-in-out';
  modalEl.style.transform = 'translateY(100%)';
  
  safeUnlockSlider();
  // CRITICAL: Don't resume game here - let startNewGame handle it

  try {
    const cleanups = Array.isArray((modalEl as any)._cleanupFns) ? [...(modalEl as any)._cleanupFns] : [];
    (modalEl as any)._cleanupFns = [];
    cleanups.forEach(fn => {
      try { fn(); } catch (error) {
        console.warn('⚠️ Cleanup failed:', error);
      }
    });
  } catch (e) {
    // Ignore cleanup errors
  }

  setTimeout(() => {
    modalEl.classList.remove('visible');
    
    // CRITICAL: Force hide bottom sheet to prevent it from blocking animations
    modalEl.style.display = 'none';
    modalEl.style.visibility = 'hidden';
    modalEl.style.zIndex = '-999999999';
    modalEl.style.transform = 'translateY(100vh)';
    modalEl.style.transition = 'none';
    
    try { modalEl.remove(); } catch (error) {
      console.warn('⚠️ Failed to remove modal:', error);
    }
    if (resumeModal === modalEl) {
      resumeModal = null;
    }
  }, 400);
}



// CRITICAL: Rewrite to use CSS classes instead of inline styles
// Pure modular approach - no inline styles, just class toggling

function addDragFunctionality(modalEl: HTMLElement, registerCleanup: (fn: () => void) => void): void {
  console.log('🎯 ADDING DRAG TO RESUME MODAL - MODULAR APPROACH');

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  
  // CRITICAL: Clear any existing handlers first
  modalEl.ontouchstart = null;
  modalEl.ontouchmove = null;
  modalEl.ontouchend = null;
  modalEl.onmousedown = null;

  // Touch events on entire modal
  modalEl.ontouchstart = (e: TouchEvent) => {
    // Don't start drag if clicking on buttons
    if (e.target && ((e.target as HTMLElement).closest('.continue-btn') || (e.target as HTMLElement).closest('.new-game-btn'))) {
      console.log('🎯 CLICK ON BUTTON - NO DRAG');
      return;
    }
    
    console.log('🎯 TOUCH START:', e.touches[0].clientY);
    e.preventDefault();
    e.stopPropagation();
    
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    
    // Clear any existing transform
    (modalEl.style as any).transform = '';
    (modalEl.style as any).transition = 'none';
    modalEl.classList.add('dragging');
    modalEl.classList.remove('closing', 'snapping');
  };

  modalEl.ontouchmove = (e: TouchEvent) => {
    if (!isDragging) return;
    
    // Don't move if on button
    if (e.target && ((e.target as HTMLElement).closest('.continue-btn') || (e.target as HTMLElement).closest('.new-game-btn'))) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const touchY = e.touches[0].clientY;
    currentY = touchY;
    const deltaY = touchY - startY;
    
    console.log('🎯 TOUCH MOVE:', { currentY, startY, deltaY });
    
    // INSTANT update - no requestAnimationFrame delay
    if (deltaY > 0) {
      (modalEl.style as any).transform = `translateY(${deltaY}px)`;
    } else {
      (modalEl.style as any).transform = 'translateY(0)';
    }
  };

  modalEl.ontouchend = (e: TouchEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    isDragging = false;
    
    const deltaY = currentY - startY;
    const threshold = 100;
    const velocity = deltaY;
    
    console.log('🎯 TOUCH END:', { deltaY, threshold, velocity });
    
    // Remove dragging class
    modalEl.classList.remove('dragging');
    
    if (deltaY > threshold || velocity > 150) {
      // Close with CSS animation
      console.log('🎯 CLOSING');
      
      (modalEl.style as any).transition = 'transform 0.4s ease-out';
      (modalEl.style as any).transform = 'translateY(100vh)';
      
      setTimeout(() => hideResumeModal(), 500);
    } else {
      // Snap back
      console.log('🎯 SNAPPING BACK');
      
      (modalEl.style as any).transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      (modalEl.style as any).transform = 'translateY(0)';
    }
  };
  
  // Mouse events (desktop support)
  modalEl.onmousedown = (e: MouseEvent) => {
    if (e.target && ((e.target as HTMLElement).closest('.continue-btn') || (e.target as HTMLElement).closest('.new-game-btn'))) {
      return;
    }
    
    console.log('🎯 MOUSE DOWN:', e.clientY);
    e.preventDefault();
    e.stopPropagation();
    
    startY = e.clientY;
    currentY = startY;
    isDragging = true;
    
    (modalEl.style as any).transform = '';
    (modalEl.style as any).transition = 'none';
    modalEl.classList.add('dragging');
    modalEl.classList.remove('closing', 'snapping');
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const mouseY = e.clientY;
    currentY = mouseY;
    const deltaY = mouseY - startY;

    console.log('🎯 MOUSE MOVE:', { currentY, startY, deltaY });

    // INSTANT update
    if (deltaY > 0) {
      (modalEl.style as any).transform = `translateY(${deltaY}px)`;
    } else {
      (modalEl.style as any).transform = 'translateY(0)';
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    isDragging = false;

    const deltaY = currentY - startY;
    const threshold = 100;
    const velocity = deltaY;
    
    console.log('🎯 MOUSE UP:', { deltaY, threshold, velocity });

    modalEl.classList.remove('dragging');

    if (deltaY > threshold || velocity > 150) {
      console.log('🎯 CLOSING (mouse)');
      
      (modalEl.style as any).transition = 'transform 0.4s ease-out';
      (modalEl.style as any).transform = 'translateY(100vh)';
      
      setTimeout(() => hideResumeModal(), 500);
    } else {
      console.log('🎯 SNAPPING BACK (mouse)');
      
      (modalEl.style as any).transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      (modalEl.style as any).transform = 'translateY(0)';
    }
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  registerCleanup(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });
}