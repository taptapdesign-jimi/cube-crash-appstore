// Simple End Run Modal
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
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners
  modal.querySelector('.restart-btn').onclick = () => {
    hideModal();
    if (window.CC && window.CC.restart) {
      window.CC.restart();
    }
  };
  
  modal.querySelector('.exit-btn').onclick = () => {
    hideModal();
    if (window.exitToMenu) {
      window.exitToMenu();
    }
  };
  
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
    if (e.target.closest('.restart-btn') || e.target.closest('.exit-btn')) {
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
    if (e.target.closest('.restart-btn') || e.target.closest('.exit-btn')) {
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
