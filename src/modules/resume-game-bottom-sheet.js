// public/src/modules/resume-game-bottom-sheet.js
// Resume Game Bottom Sheet - same style as End This Run modal

let resumeModal = null;

function createCleanupRegistry(modalEl) {
  const list = [];
  modalEl._cleanupFns = list;
  return function register(fn) {
    if (typeof fn === 'function') list.push(fn);
  };
}

function createResumeModal() {
  if (resumeModal) {
    resumeModal.remove();
    resumeModal = null;
  }

  resumeModal = document.createElement('div');
  resumeModal.className = 'resume-bottom-sheet';
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
  
  // Add event listeners
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
    
    // Cleanup
    registerCleanup(() => {
      btn.removeEventListener('touchstart', handleTouchStart);
      btn.removeEventListener('touchmove', handleTouchMove);
      btn.removeEventListener('touchend', handleTouchEnd);
      btn.removeEventListener('mousedown', handleMouseDown);
      btn.removeEventListener('mouseup', handleMouseUp);
      btn.removeEventListener('mouseleave', handleMouseLeave);
    });
  };

  addButtonPressHandling(resumeModal.querySelector('.continue-btn'), () => {
    hideResumeModal();
    if (typeof window.continueGame === 'function') {
      window.continueGame();
    }
  });
  
  addButtonPressHandling(resumeModal.querySelector('.new-game-btn'), () => {
    hideResumeModal();
    if (typeof window.startNewGame === 'function') {
      window.startNewGame();
    }
  });
  
  // Add drag functionality
  addDragFunctionality(resumeModal, registerCleanup);
  
  // Add outside click functionality
  addOutsideClickFunctionality(resumeModal, registerCleanup);
  
  document.body.appendChild(resumeModal);
  return resumeModal;
}

export function showResumeGameBottomSheet() {
  const el = createResumeModal();
  
  // Pause the game when bottom sheet appears
  console.log('🎯 Pausing game for bottom sheet');
  if (typeof window.pauseGame === 'function') {
    window.pauseGame();
  }
  
  // Modal starts hidden (CSS default)
  console.log('🎯 RESUME MODAL CREATED - Initial transform:', el.style.transform);
  
  // Show with fluid animation like slider
  requestAnimationFrame(() => {
    el.classList.add('visible');
    console.log('🎯 RESUME MODAL VISIBLE - Transform after visible class:', el.style.transform);
  });
}

// Simple drag functionality - DRAG ON ENTIRE BOTTOM SHEET
function addDragFunctionality(modalEl, registerCleanup) {
  console.log('🎯 ADDING DRAG TO RESUME MODAL');

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  // CSS handles centering automatically, no need for forceCenterModal

  // Touch events on entire modal
  modalEl.ontouchstart = (e) => {
    // Don't start drag if clicking on buttons
    if (e.target.closest('.continue-btn') || e.target.closest('.new-game-btn')) {
      console.log('🎯 CLICK ON BUTTON - NO DRAG');
      return;
    }
    
    console.log('🎯 DRAG START ON RESUME MODAL:', e.touches[0].clientY);
    e.preventDefault();
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    modalEl.style.transition = 'none';
  };

  modalEl.ontouchmove = (e) => {
    // Handle button touch move for cancel on drag off
    if (e.target.closest('.continue-btn') || e.target.closest('.new-game-btn')) {
      // Let button handle its own touch move
      return;
    }
    
    if (!isDragging) return;
    e.preventDefault();
    
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    
    console.log('🎯 DRAG MOVE ON RESUME MODAL:', { currentY, startY, deltaY });
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
    
    // Use CSS transition instead of inline style to avoid conflicts
    modalEl.style.transition = '';
    
    const deltaY = currentY - startY;
    console.log('🎯 DRAG END ON RESUME MODAL:', { deltaY, threshold: 80 });
    
    if (deltaY > 80) {
      console.log('🎯 CLOSING RESUME MODAL');
      modalEl.style.transform = 'translateY(100vh)';
      setTimeout(() => hideResumeModal(), 400); // Match CSS animation duration
    } else {
      console.log('🎯 SNAPPING BACK');
      modalEl.style.transform = 'translateY(0)';
    }
    
    // Remove forceCenterModal call - it causes double animation
  };
  
  // Mouse events on entire modal
  modalEl.onmousedown = (e) => {
    // Don't start drag if clicking on buttons
    if (e.target.closest('.continue-btn') || e.target.closest('.new-game-btn')) {
      console.log('🎯 MOUSE CLICK ON BUTTON - NO DRAG');
      return;
    }
    
    console.log('🎯 MOUSE DOWN ON RESUME MODAL:', e.clientY);
    e.preventDefault();
    startY = e.clientY;
    currentY = startY;
    isDragging = true;
    modalEl.style.transition = 'none';
  };
  
  const handleMouseMove = (e) => {
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

  const handleMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;

    // Use CSS transition instead of inline style to avoid conflicts
    modalEl.style.transition = '';

    const deltaY = currentY - startY;
    console.log('🎯 MOUSE UP:', { deltaY, threshold: 80 });

    if (deltaY > 80) {
      console.log('🎯 CLOSING RESUME MODAL (mouse)');
      modalEl.style.transform = 'translateY(100vh)';
      setTimeout(() => hideResumeModal(), 400); // Match CSS animation duration
    } else {
      console.log('🎯 SNAPPING BACK (mouse)');
      modalEl.style.transform = 'translateY(0)';
    }

    // Remove forceCenterModal call - it causes double animation
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  if (registerCleanup) {
    registerCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  }
}

// Simple outside click functionality
function addOutsideClickFunctionality(modalEl, registerCleanup) {
  // Simple outside click with delay to prevent immediate closing
  setTimeout(() => {
    document.onclick = (e) => {
      if (modalEl && !modalEl.contains(e.target)) {
        console.log('🎯 Outside click detected - closing resume modal');
        hideResumeModal();
      }
    };
    
    // Add touch support for mobile
    document.ontouchend = (e) => {
      if (modalEl && !modalEl.contains(e.target)) {
        console.log('🎯 Outside touch detected - closing resume modal');
        hideResumeModal();
      }
    };
    
    if (registerCleanup) {
      registerCleanup(() => {
        document.onclick = null; // Clear the onclick handler
        document.ontouchend = null; // Clear the ontouchend handler
      });
    }
  }, 200); // Reduced delay to match end-run-modal
}

export function hideResumeModal() {
  const modalEl = resumeModal;
  if (!modalEl || modalEl._closing) return;

  modalEl._closing = true;
  modalEl.classList.remove('visible');

  // Unlock slider immediately so CTA becomes responsive right after the sheet starts closing
  try {
    if (typeof window.unlockSlider === 'function') {
      window.unlockSlider();
    }
  } catch (error) {
    console.warn('⚠️ Failed to unlock slider while hiding resume modal:', error);
  }
  
  // Resume the game when bottom sheet is closed (without action)
  console.log('🎯 Resuming game after bottom sheet closed without action');
  if (typeof window.resumeGame === 'function') {
    window.resumeGame();
  }
  
  // DON'T animate #home element when bottom sheet is closed without action
  // Animation will be triggered only when user actually decides to continue/start game
  console.log('🎮 Bottom sheet closed without action - no #home animation');

  // Clean up event listeners
  try {
    const cleanups = Array.isArray(modalEl._cleanupFns) ? [...modalEl._cleanupFns] : [];
    modalEl._cleanupFns = [];
    cleanups.forEach(fn => {
      try { fn(); } catch (error) {
        console.warn('⚠️ Resume modal cleanup failed:', error);
      }
    });
  } catch (e) {
    // Ignore cleanup errors
  }

  setTimeout(() => {
    try { modalEl.remove(); } catch (error) {
      console.warn('⚠️ Failed to remove resume modal:', error);
    }
    if (resumeModal === modalEl) {
      resumeModal = null;
    }
  }, 400); // Match animation duration
}
