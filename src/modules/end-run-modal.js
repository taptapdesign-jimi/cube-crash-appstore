// Simple End Run Modal
import { showCleanBoardModal } from './clean-board-modal.js';

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
  
  // Add button press handling for proper UX
  const addButtonPressHandling = (btn, action) => {
    let buttonPressStartedOnButton = false;
    
    const handleButtonDown = () => {
      buttonPressStartedOnButton = true;
      btn.style.transform = 'scale(0.85)';
      btn.style.transition = 'transform 0.15s ease';
    };
    
    const handleButtonUp = (e) => {
      // Only trigger action if press started on button AND ends on button
      if (buttonPressStartedOnButton && btn.contains(e.target)) {
        action();
      }
      
      buttonPressStartedOnButton = false;
      btn.style.transform = 'scale(1)';
      btn.style.transition = 'transform 0.15s ease';
    };
    
    const handleButtonLeave = () => {
      btn.style.transform = 'scale(1)';
      btn.style.transition = 'transform 0.15s ease';
    };
    
    btn.addEventListener('mousedown', handleButtonDown);
    btn.addEventListener('touchstart', handleButtonDown, { passive: true });
    
    btn.addEventListener('mouseup', handleButtonUp);
    btn.addEventListener('mouseleave', handleButtonLeave);
    btn.addEventListener('touchend', handleButtonUp, { passive: true });
    
    // Global release handlers
    document.addEventListener('mouseup', handleButtonUp);
    document.addEventListener('touchend', handleButtonUp);
  };
  
  addButtonPressHandling(restartBtn, () => {
    hideModal();
    if (window.CC && window.CC.restart) {
      window.CC.restart();
    }
  });
  
  addButtonPressHandling(exitBtn, () => {
    hideModal();
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
    
    // Unlock slider immediately so CTA becomes responsive right after the sheet starts closing
    try {
      if (typeof window.unlockSlider === 'function') {
        window.unlockSlider();
      }
    } catch (error) {
      console.warn('⚠️ Failed to unlock slider while hiding end run modal:', error);
    }
    
    setTimeout(() => {
      if (modal) {
        modal.remove();
        modal = null;
      }
    }, 300);
  }
}
