// resume-sheet-ui.ts
// UI components for resume game bottom sheet

import { generateId, createCleanupRegistry, getModalOptions } from './resume-sheet-utils.js';

// Type definitions
interface HTMLElementWithCleanup extends HTMLElement {
  _cleanupFns?: (() => void)[];
  _closing?: boolean;
}

interface TouchEventWithTouches extends TouchEvent {
  touches: TouchList;
  changedTouches: TouchList;
}

interface MouseEventWithTarget extends MouseEvent {
  target: EventTarget | null;
}

/**
 * Add CSS styles for bottom sheet
 */
export function addBottomSheetStyles(): void {
  if (document.getElementById('bottom-sheet-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'bottom-sheet-styles';
  style.textContent = `
    /* Bottom Sheet Button Styles - matching original CTA buttons */
    .continue-btn {
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
      outline: none !important;
      text-decoration: none !important;
    }
    
    .continue-btn:hover {
      background: #F08A65 !important;
      transform: scale(1.02) !important;
    }
    
    .continue-btn:active {
      transform: scale(0.98) !important;
      box-shadow: 0 6px 0 0 #C24921 !important;
    }
    
    .pause-btn {
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
      outline: none !important;
      text-decoration: none !important;
    }
    
    .pause-btn:hover {
      background: #7C8BA5 !important;
      transform: scale(1.02) !important;
    }
    
    .pause-btn:active {
      transform: scale(0.98) !important;
      box-shadow: 0 6px 0 0 #4A5A7A !important;
    }
    
    .resume-bottom-sheet {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      background: white !important;
      border-radius: 20px 20px 0 0 !important;
      padding: 30px 20px 40px 20px !important;
      box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.3) !important;
      z-index: 10000 !important;
      transform: translateY(100%) !important;
      transition: transform 0.3s ease !important;
      max-height: 80vh !important;
      overflow: hidden !important;
    }
    
    .resume-bottom-sheet.show {
      transform: translateY(0) !important;
    }
    
    .resume-bottom-sheet-content {
      text-align: center !important;
    }
    
    .resume-bottom-sheet-title {
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 28px !important;
      font-weight: bold !important;
      color: #333 !important;
      margin: 0 0 15px 0 !important;
    }
    
    .resume-bottom-sheet-subtitle {
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 18px !important;
      color: #666 !important;
      margin: 0 0 30px 0 !important;
    }
    
    .resume-bottom-sheet-buttons {
      display: flex !important;
      flex-direction: column !important;
      gap: 20px !important;
      align-items: center !important;
    }
    
    .resume-bottom-sheet-handle {
      width: 40px !important;
      height: 4px !important;
      background: #ddd !important;
      border-radius: 2px !important;
      margin: 0 auto 20px auto !important;
    }
    
    @media (max-width: 480px) {
      .resume-bottom-sheet {
        padding: 25px 15px 35px 15px !important;
      }
      
      .resume-bottom-sheet-title {
        font-size: 24px !important;
      }
      
      .resume-bottom-sheet-subtitle {
        font-size: 16px !important;
      }
      
      .continue-btn,
      .pause-btn {
        height: 56px !important;
        font-size: 20px !important;
        padding: 0 40px !important;
      }
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Create resume modal
 */
export function createResumeModal(): HTMLElementWithCleanup {
  const modal = document.createElement('div') as HTMLElementWithCleanup;
  modal.className = 'resume-bottom-sheet';
  modal.id = generateId();
  
  modal.innerHTML = `
    <div class="resume-bottom-sheet-handle"></div>
    <div class="resume-bottom-sheet-content">
      <h2 class="resume-bottom-sheet-title">Resume Game</h2>
      <p class="resume-bottom-sheet-subtitle">Continue where you left off</p>
      <div class="resume-bottom-sheet-buttons">
        <button class="continue-btn" data-action="resume">
          Continue Playing
        </button>
        <button class="pause-btn" data-action="pause">
          Stay Paused
        </button>
      </div>
    </div>
  `;
  
  return modal;
}

/**
 * Add drag functionality to modal
 */
export function addDragFunctionality(modalEl: HTMLElementWithCleanup, registerCleanup: (fn: () => void) => void): void {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let startTime = 0;
  
  const handleStart = (e: Event) => {
    const touch = (e as TouchEvent).touches?.[0] || e as MouseEvent;
    startY = touch.clientY;
    currentY = startY;
    isDragging = true;
    startTime = Date.now();
    
    modalEl.style.transition = 'none';
    e.preventDefault();
  };
  
  const handleMove = (e: Event) => {
    if (!isDragging) return;
    
    const touch = (e as TouchEvent).touches?.[0] || e as MouseEvent;
    currentY = touch.clientY;
    const deltaY = currentY - startY;
    
    if (deltaY > 0) {
      modalEl.style.transform = `translateY(${deltaY}px)`;
    }
    
    e.preventDefault();
  };
  
  const handleEnd = (e: Event) => {
    if (!isDragging) return;
    
    isDragging = false;
    modalEl.style.transition = 'transform 0.3s ease';
    
    const deltaY = currentY - startY;
    const duration = Date.now() - startTime;
    const velocity = deltaY / duration;
    
    if (deltaY > 100 || velocity > 0.5) {
      // Close modal
      modalEl.style.transform = 'translateY(100%)';
      setTimeout(() => {
        const closeEvent = new CustomEvent('resume-sheet-close', {
          detail: { reason: 'drag' }
        });
        modalEl.dispatchEvent(closeEvent);
      }, 300);
    } else {
      // Return to position
      modalEl.style.transform = 'translateY(0)';
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
  
  // Register cleanup
  registerCleanup(() => {
    modalEl.removeEventListener('touchstart', handleStart);
    modalEl.removeEventListener('touchmove', handleMove);
    modalEl.removeEventListener('touchend', handleEnd);
    modalEl.removeEventListener('mousedown', handleStart);
    modalEl.removeEventListener('mousemove', handleMove);
    modalEl.removeEventListener('mouseup', handleEnd);
  });
}

/**
 * Attach button handlers
 */
export function attachButtonHandlers(modalEl: HTMLElementWithCleanup, registerCleanup: (fn: () => void) => void): void {
  const continueBtn = modalEl.querySelector('[data-action="resume"]');
  const pauseBtn = modalEl.querySelector('[data-action="pause"]');
  
  const handleAction = (action: string) => {
    const actionEvent = new CustomEvent('resume-sheet-action', {
      detail: { action }
    });
    modalEl.dispatchEvent(actionEvent);
  };
  
  if (continueBtn) {
    continueBtn.addEventListener('click', () => handleAction('resume'));
  }
  
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => handleAction('pause'));
  }
  
  // Register cleanup
  registerCleanup(() => {
    if (continueBtn) continueBtn.removeEventListener('click', () => handleAction('resume'));
    if (pauseBtn) pauseBtn.removeEventListener('click', () => handleAction('pause'));
  });
}

/**
 * Attach keyboard handlers
 */
export function attachKeyboardHandlers(modalEl: HTMLElementWithCleanup, registerCleanup: (fn: () => void) => void): void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const closeEvent = new CustomEvent('resume-sheet-close', {
        detail: { reason: 'escape' }
      });
      modalEl.dispatchEvent(closeEvent);
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Register cleanup
  registerCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
}

/**
 * Add outside click functionality
 */
export function addOutsideClickFunctionality(modalEl: HTMLElementWithCleanup, registerCleanup: (fn: () => void) => void): void {
  const handleClick = (e: Event) => {
    if (e.target === modalEl) {
      const closeEvent = new CustomEvent('resume-sheet-close', {
        detail: { reason: 'outside-click' }
      });
      modalEl.dispatchEvent(closeEvent);
    }
  };
  
  modalEl.addEventListener('click', handleClick);
  
  // Register cleanup
  registerCleanup(() => {
    modalEl.removeEventListener('click', handleClick);
  });
}

/**
 * Cleanup event handlers
 */
export function cleanupEventHandlers(modalEl: HTMLElementWithCleanup): void {
  // Remove all event listeners
  const events = ['touchstart', 'touchmove', 'touchend', 'mousedown', 'mousemove', 'mouseup', 'click'];
  events.forEach(event => {
    modalEl.removeEventListener(event, () => {});
  });
  
  // Remove keyboard handler
  document.removeEventListener('keydown', () => {});
}

// All functions are already exported individually above
