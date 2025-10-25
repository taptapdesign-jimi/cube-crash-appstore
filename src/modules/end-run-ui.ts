// end-run-ui.ts
// UI components for end run modal

import { getCurrentScore, getModalOptions, generateId } from './end-run-utils.js';

// Type definitions
interface TouchEventWithTouches extends TouchEvent {
  touches: TouchList;
  changedTouches: TouchList;
}

interface MouseEventWithTarget extends MouseEvent {
  target: EventTarget | null;
}

/**
 * Add CSS styles for end run modal
 */
export function addEndRunModalStyles(): void {
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
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      text-decoration: none !important;
      outline: none !important;
      user-select: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    
    .restart-btn:hover {
      background: #F08A65 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 10px 0 0 #C24921 !important;
    }
    
    .restart-btn:active {
      transform: translateY(2px) !important;
      box-shadow: 0 6px 0 0 #C24921 !important;
    }
    
    .exit-btn {
      background: #6C7B95 !important;
      color: white !important;
      border: none !important;
      border-radius: 40px !important;
      height: 64px !important;
      padding: 0 56px !important;
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 24px !important;
      font-weight: bold !important;
      box-shadow: 0 8px 0 0 #4A5A7A !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      text-decoration: none !important;
      outline: none !important;
      user-select: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    
    .exit-btn:hover {
      background: #7C8BA5 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 10px 0 0 #4A5A7A !important;
    }
    
    .exit-btn:active {
      transform: translateY(2px) !important;
      box-shadow: 0 6px 0 0 #4A5A7A !important;
    }
    
    .clean-btn {
      background: #4CAF50 !important;
      color: white !important;
      border: none !important;
      border-radius: 40px !important;
      height: 64px !important;
      padding: 0 56px !important;
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 24px !important;
      font-weight: bold !important;
      box-shadow: 0 8px 0 0 #388E3C !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      text-decoration: none !important;
      outline: none !important;
      user-select: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    
    .clean-btn:hover {
      background: #5CBF60 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 10px 0 0 #388E3C !important;
    }
    
    .clean-btn:active {
      transform: translateY(2px) !important;
      box-shadow: 0 6px 0 0 #388E3C !important;
    }
    
    .end-run-modal {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0, 0, 0, 0.5) !important;
      z-index: 10000 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      opacity: 0 !important;
      transition: opacity 0.3s ease !important;
    }
    
    .end-run-modal.show {
      opacity: 1 !important;
    }
    
    .end-run-modal-content {
      background: white !important;
      border-radius: 20px !important;
      padding: 40px !important;
      max-width: 400px !important;
      width: 90% !important;
      text-align: center !important;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3) !important;
      transform: scale(0.8) !important;
      transition: transform 0.3s ease !important;
    }
    
    .end-run-modal.show .end-run-modal-content {
      transform: scale(1) !important;
    }
    
    .end-run-modal-title {
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 32px !important;
      font-weight: bold !important;
      color: #333 !important;
      margin: 0 0 20px 0 !important;
    }
    
    .end-run-modal-subtitle {
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 18px !important;
      color: #666 !important;
      margin: 0 0 30px 0 !important;
    }
    
    .end-run-modal-buttons {
      display: flex !important;
      flex-direction: column !important;
      gap: 20px !important;
      align-items: center !important;
    }
    
    .end-run-modal-score {
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 24px !important;
      font-weight: bold !important;
      color: #E97A55 !important;
      margin: 0 0 30px 0 !important;
    }
    
    @media (max-width: 480px) {
      .end-run-modal-content {
        padding: 30px 20px !important;
        width: 95% !important;
      }
      
      .end-run-modal-title {
        font-size: 28px !important;
      }
      
      .end-run-modal-subtitle {
        font-size: 16px !important;
      }
      
      .restart-btn,
      .exit-btn,
      .clean-btn {
        height: 56px !important;
        font-size: 20px !important;
        padding: 0 40px !important;
      }
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Create modal element
 */
export function createModal(): HTMLElement {
  const score = getCurrentScore();
  const options = getModalOptions();
  
  const modal = document.createElement('div');
  modal.className = 'end-run-modal';
  modal.id = generateId();
  
  modal.innerHTML = `
    <div class="end-run-modal-content">
      <h2 class="end-run-modal-title">Game Over</h2>
      <p class="end-run-modal-subtitle">What would you like to do?</p>
      <div class="end-run-modal-score">Score: ${score.toLocaleString()}</div>
      <div class="end-run-modal-buttons">
        <button class="restart-btn" data-action="restart">
          Restart Game
        </button>
        <button class="clean-btn" data-action="clean">
          Clean Board
        </button>
        <button class="exit-btn" data-action="exit">
          Exit to Menu
        </button>
      </div>
    </div>
  `;
  
  return modal;
}

/**
 * Attach drag functionality to modal
 */
export function addDragFunctionality(modalEl: HTMLElement): void {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let startTime = 0;
  
  const content = modalEl.querySelector('.end-run-modal-content') as HTMLElement;
  if (!content) return;
  
  const handleStart = (e: Event) => {
    const touch = (e as TouchEvent).touches?.[0] || e as MouseEvent;
    startY = touch.clientY;
    currentY = startY;
    isDragging = true;
    startTime = Date.now();
    
    content.style.transition = 'none';
    e.preventDefault();
  };
  
  const handleMove = (e: Event) => {
    if (!isDragging) return;
    
    const touch = (e as TouchEvent).touches?.[0] || e as MouseEvent;
    currentY = touch.clientY;
    const deltaY = currentY - startY;
    
    if (deltaY > 0) {
      content.style.transform = `scale(0.8) translateY(${deltaY}px)`;
    }
    
    e.preventDefault();
  };
  
  const handleEnd = (e: Event) => {
    if (!isDragging) return;
    
    isDragging = false;
    content.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    const duration = Date.now() - startTime;
    const velocity = deltaY / duration;
    
    if (deltaY > 100 || velocity > 0.5) {
      // Close modal
      content.style.transform = 'scale(0.8) translateY(100vh)';
      setTimeout(() => {
        const closeEvent = new CustomEvent('end-run-modal-close', {
          detail: { reason: 'drag' }
        });
        modalEl.dispatchEvent(closeEvent);
      }, 300);
    } else {
      // Return to position
      content.style.transform = 'scale(0.8)';
    }
    
    e.preventDefault();
  };
  
  // Touch events
  modalEl.addEventListener('touchstart', handleStart, { passive: false });
  modalEl.addEventListener('touchmove', handleMove, { passive: false });
  modalEl.addEventListener('touchend', handleEnd, { passive: false });
  
  // Mouse events
  modalEl.addEventListener('mousedown', handleStart);
  modalEl.addEventListener('mousemove', handleMove);
  modalEl.addEventListener('mouseup', handleEnd);
}

/**
 * Attach button handlers
 */
export function attachButtonHandlers(modalEl: HTMLElement): void {
  const restartBtn = modalEl.querySelector('[data-action="restart"]');
  const exitBtn = modalEl.querySelector('[data-action="exit"]');
  const cleanBtn = modalEl.querySelector('[data-action="clean"]');
  
  const handleAction = (action: string) => {
    const actionEvent = new CustomEvent('end-run-modal-action', {
      detail: { action }
    });
    modalEl.dispatchEvent(actionEvent);
  };
  
  if (restartBtn) {
    restartBtn.addEventListener('click', () => handleAction('restart'));
  }
  
  if (exitBtn) {
    exitBtn.addEventListener('click', () => handleAction('exit'));
  }
  
  if (cleanBtn) {
    cleanBtn.addEventListener('click', () => handleAction('clean'));
  }
}

/**
 * Attach keyboard handlers
 */
export function attachKeyboardHandlers(modalEl: HTMLElement): void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const closeEvent = new CustomEvent('end-run-modal-close', {
        detail: { reason: 'escape' }
      });
      modalEl.dispatchEvent(closeEvent);
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Store handler for cleanup
  (modalEl as any)._keyboardHandler = handleKeyDown;
}

/**
 * Attach outside click handlers
 */
export function addOutsideClickFunctionality(modalEl: HTMLElement): void {
  const handleClick = (e: Event) => {
    if (e.target === modalEl) {
      const closeEvent = new CustomEvent('end-run-modal-close', {
        detail: { reason: 'outside-click' }
      });
      modalEl.dispatchEvent(closeEvent);
    }
  };
  
  modalEl.addEventListener('click', handleClick);
  
  // Store handler for cleanup
  (modalEl as any)._outsideClickHandler = handleClick;
}

/**
 * Cleanup event handlers
 */
export function cleanupEventHandlers(modalEl: HTMLElement): void {
  // Remove keyboard handler
  if ((modalEl as any)._keyboardHandler) {
    document.removeEventListener('keydown', (modalEl as any)._keyboardHandler);
    delete (modalEl as any)._keyboardHandler;
  }
  
  // Remove outside click handler
  if ((modalEl as any)._outsideClickHandler) {
    modalEl.removeEventListener('click', (modalEl as any)._outsideClickHandler);
    delete (modalEl as any)._outsideClickHandler;
  }
}

// All functions are already exported individually above
