/**
 * Score Bottom Sheet
 * Shows high score stats and cubes cracked when user clicks on score area in HUD
 * Uses same drag and outside click functionality as end-run-modal
 */

import { statsService } from '../services/stats-service';

let modal: HTMLElement | null = null;
let isVisible = false;

// Outside click handlers (same pattern as end-run-modal)
let outsideClickHandler: ((e: Event) => void) | null = null;
let outsideTouchEndHandler: ((e: TouchEvent) => void) | null = null;

function createModal(): HTMLElement {
  if (modal) {
    modal.remove();
    modal = null;
  }

  const modalEl = document.createElement('div');
  modalEl.className = 'simple-bottom-sheet score-bottom-sheet';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'score-sheet-title');
  
  // CRITICAL: Start with display: none to prevent flash
  modalEl.style.display = 'none';

  modalEl.innerHTML = `
    <div class="modal-handle"></div>
    <div class="simple-content">
      <h2 id="score-sheet-title" class="bottom-sheet-title">Score Stats</h2>
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
  `;

  // Add drag functionality (same as end-run-modal)
  addDragFunctionality(modalEl);
  
  // Add outside click functionality (same as end-run-modal)
  addOutsideClickFunctionality(modalEl);

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
  modalEl.ontouchstart = (e: TouchEvent) => {
    console.log('🎯 DRAG START ON SCORE SHEET:', e.touches[0].clientY);
    e.preventDefault();
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    modalEl.style.transition = 'none';
    
    if (modalEl.classList.contains('visible')) {
      forceCenterModal();
    }
  };

  modalEl.ontouchmove = (e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    
    if (deltaY > 0) {
      const newTransform = `translateY(${deltaY}px)`;
      modalEl.style.transform = newTransform;
    }
  };

  modalEl.ontouchend = (e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    isDragging = false;
    
    modalEl.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    
    if (deltaY > 80) {
      console.log('🎯 CLOSING SCORE SHEET');
      modalEl.style.transition = 'transform 0.4s ease-in-out';
      modalEl.style.transform = 'translateY(100vh)';
      setTimeout(() => hideScoreBottomSheet(), 400);
    } else {
      console.log('🎯 SNAPPING BACK');
      modalEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      modalEl.style.transform = 'translateY(0)';
    }
    
    setTimeout(() => forceCenterModal(), 50);
  };
  
  // Mouse events on entire modal
  modalEl.onmousedown = (e: MouseEvent) => {
    console.log('🎯 MOUSE DOWN ON SCORE SHEET:', e.clientY);
    e.preventDefault();
    startY = e.clientY;
    currentY = startY;
    isDragging = true;
    modalEl.style.transition = 'none';
    
    if (modalEl.classList.contains('visible')) {
      forceCenterModal();
    }
  };
  
  document.onmousemove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    currentY = e.clientY;
    const deltaY = currentY - startY;
    
    if (deltaY > 0) {
      const newTransform = `translateY(${deltaY}px)`;
      modalEl.style.transform = newTransform;
    }
  };
  
  document.onmouseup = () => {
    if (!isDragging) return;
    isDragging = false;
    
    modalEl.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    
    if (deltaY > 80) {
      console.log('🎯 CLOSING SCORE SHEET (mouse)');
      modalEl.style.transition = 'transform 0.4s ease-in-out';
      modalEl.style.transform = 'translateY(100vh)';
      setTimeout(() => hideScoreBottomSheet(), 400);
    } else {
      console.log('🎯 SNAPPING BACK (mouse)');
      modalEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      modalEl.style.transform = 'translateY(0)';
    }
    
    setTimeout(() => forceCenterModal(), 50);
  };
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
    if (modalEl && modalEl.parentNode && e.target && !modalEl.contains(e.target as Node)) {
      hideScoreBottomSheet();
    }
  };
  
  outsideTouchEndHandler = (e: TouchEvent) => {
    if (modalEl && modalEl.parentNode && e.target && !modalEl.contains(e.target as Node)) {
      hideScoreBottomSheet();
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

export function showScoreBottomSheet(): void {
  if (isVisible || (modal && modal.parentNode && !(modal as any)._closing)) {
    console.warn('⚠️ Score bottom sheet already open');
    return;
  }

  console.log('📊 Opening score bottom sheet');

  // Light haptic for opening bottom sheet
  if (typeof (window as any).triggerHapticImpact === 'function') {
    (window as any).triggerHapticImpact('light');
  }

  const el = createModal();
  console.log('🎯 SCORE BOTTOM SHEET CREATED');

  // Mark modal as visible and set closing flag to false
  (el as any)._closing = false;

  // Get fresh stats from service
  const stats = statsService.getStats();
  
  // Update values
  const highScoreEl = document.getElementById('score-sheet-high-score');
  const cubesCrackedEl = document.getElementById('score-sheet-cubes-cracked');
  
  if (highScoreEl) highScoreEl.textContent = stats.highScore.toString();
  if (cubesCrackedEl) cubesCrackedEl.textContent = stats.cubesCracked.toString();

  // Show modal with animation (same as end-run-modal)
  el.style.display = 'block';
  el.style.transform = 'translateY(100%)';
  
  requestAnimationFrame(() => {
    el.classList.add('visible');
    el.style.transition = 'transform 0.3s ease-out';
    el.style.transform = 'translateY(0)';
  });

  isVisible = true;
}

export function hideScoreBottomSheet(): void {
  const modalEl = modal;
  if (!modalEl || (modalEl as any)._closing) return;

  (modalEl as any)._closing = true;
  isVisible = false;

  console.log('📊 Closing score bottom sheet');

  // Medium haptic for closing
  if (typeof (window as any).triggerHapticImpact === 'function') {
    (window as any).triggerHapticImpact('medium');
  }

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

  // Remove modal after animation
  setTimeout(() => {
    if (modalEl && modalEl.parentNode) {
      modalEl.parentNode.removeChild(modalEl);
    }
    (modalEl as any)._closing = false;
    modal = null;
  }, 400);
}

// Export to window for HUD access
if (typeof window !== 'undefined') {
  (window as any).showScoreBottomSheet = showScoreBottomSheet;
  (window as any).hideScoreBottomSheet = hideScoreBottomSheet;
}
