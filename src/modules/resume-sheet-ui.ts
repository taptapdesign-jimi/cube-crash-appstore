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
    /* Primary Button - Orange CTA (Tap Scale Animation) - Exact copy of slider CTA */
    /* Using slide-button class to match slider CTA exactly */
    .resume-bottom-sheet .slide-button.tap-scale.menu-btn-primary,
    button.slide-button.tap-scale.menu-btn-primary,
    .resume-bottom-sheet button.slide-button,
    button[data-action="resume"] {
      transform-style: flat !important;
      perspective: none !important;
      background: #E97A55 !important;
      color: white !important;
      border: none !important;
      border-radius: 40px !important;
      height: 64px !important;
      min-height: 64px !important;
      padding: 0 !important;
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 24px !important;
      font-weight: bold !important;
      box-shadow: 0 8px 0 0 #C24921 !important;
      transition: none !important;
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
      box-sizing: border-box !important;
      width: 100% !important;
      max-width: 310px !important;
      line-height: normal !important;
      touch-action: manipulation !important;
    }
    
    .resume-bottom-sheet .slide-button.tap-scale.menu-btn-primary:hover,
    button.slide-button.tap-scale.menu-btn-primary:hover,
    .resume-bottom-sheet button.slide-button:hover,
    button[data-action="resume"]:hover {
      transform: scale(1) !important;
      box-shadow: 0 8px 0 0 #C24921 !important;
      background: #E97A55 !important;
      color: white !important;
    }
    
    .resume-bottom-sheet .slide-button.tap-scale.menu-btn-primary:active,
    button.slide-button.tap-scale.menu-btn-primary:active,
    .resume-bottom-sheet button.slide-button:active,
    button[data-action="resume"]:active {
      transform: scale(0.80) !important;
      transition: transform 0.35s ease !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    
    /* Secondary Button - White with Brown Border */
    /* Using high specificity to override ALL other CSS */
    button.pause-btn,
    .resume-bottom-sheet button.pause-btn,
    button[data-action="pause"] {
      transform-style: flat !important;
      perspective: none !important;
      background: white !important;
      color: #AD8675 !important;
      border: 1px solid #E9DCD6 !important;
      border-radius: 40px !important;
      height: 64px !important;
      min-height: 64px !important;
      padding: 0 !important;
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 24px !important;
      font-weight: bold !important;
      box-shadow: 0 8px 0 0 rgba(233, 220, 214, 1) !important;
      transition: none !important;
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
      box-sizing: border-box !important;
      width: 100% !important;
      max-width: 310px !important;
      line-height: normal !important;
      touch-action: manipulation !important;
    }
    
    button.pause-btn:hover,
    .resume-bottom-sheet button.pause-btn:hover,
    button[data-action="pause"]:hover {
      transform: scale(1) !important;
      background: white !important;
      color: #AD8675 !important;
      box-shadow: 0 8px 0 0 rgba(233, 220, 214, 1) !important;
    }
    
    button.pause-btn:active,
    .resume-bottom-sheet button.pause-btn:active,
    button[data-action="pause"]:active {
      transform: scale(0.80) !important;
      transition: transform 0.35s ease !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    
    .resume-bottom-sheet {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      background: white !important;
      border-radius: 20px 20px 0 0 !important;
      padding: 30px 20px 40px 20px !important;
      box-shadow: 0 -10px 30px rgba(233, 210, 200, 1) !important;
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
      font-size: 40px !important;
      font-weight: 800 !important;
      color: #AD8675 !important;
      margin: 0 0 15px 0 !important;
    }
    
    .resume-bottom-sheet-subtitle {
      font-family: "LTCrow", system-ui, -apple-system, sans-serif !important;
      font-size: 18px !important;
      color: #AD8675 !important;
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
        font-size: 36px !important;
      }
      
      .resume-bottom-sheet-subtitle {
        font-size: 16px !important;
      }
      
      .resume-bottom-sheet .slide-button.tap-scale.menu-btn-primary,
      button.slide-button.tap-scale.menu-btn-primary,
      .resume-bottom-sheet button.slide-button,
      button[data-action="resume"] {
        height: 64px !important;
        min-height: 64px !important;
        font-size: 24px !important;
        width: 100% !important;
        max-width: 310px !important;
      }
      
      button.pause-btn,
      .resume-bottom-sheet button.pause-btn,
      button[data-action="pause"] {
        height: 64px !important;
        min-height: 64px !important;
        font-size: 24px !important;
        width: 100% !important;
        max-width: 310px !important;
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
        <button class="slide-button tap-scale menu-btn-primary" data-action="resume">
          Continue
        </button>
        <button class="pause-btn secondary-button tap-scale" data-action="pause">
          New Game
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
  
  console.log('🔘 Buttons found:', { continueBtn: !!continueBtn, pauseBtn: !!pauseBtn });
  
  const handleAction = (action: string) => {
    console.log('🔘 Button clicked! Action:', action);
    const actionEvent = new CustomEvent('resume-sheet-action', {
      detail: { action }
    });
    modalEl.dispatchEvent(actionEvent);
  };
  
  const resumeHandler = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔘 Resume button clicked!');
    handleAction('resume');
  };
  
  const pauseHandler = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔘 Pause button clicked!');
    handleAction('pause');
  };
  
  const resumeTouchHandler = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔘 Resume button touched!');
    handleAction('resume');
  };
  
  const pauseTouchHandler = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔘 Pause button touched!');
    handleAction('pause');
  };
  
  if (continueBtn) {
    console.log('🔘 Adding resume listeners...');
    continueBtn.addEventListener('click', resumeHandler);
    continueBtn.addEventListener('touchend', resumeTouchHandler, { passive: false });
  } else {
    console.error('❌ Continue button not found!');
  }
  
  if (pauseBtn) {
    console.log('🔘 Adding pause listeners...');
    pauseBtn.addEventListener('click', pauseHandler);
    pauseBtn.addEventListener('touchend', pauseTouchHandler, { passive: false });
  } else {
    console.error('❌ Pause button not found!');
  }
  
  // Register cleanup
  registerCleanup(() => {
    if (continueBtn) {
      continueBtn.removeEventListener('click', resumeHandler);
      continueBtn.removeEventListener('touchend', resumeTouchHandler);
    }
    if (pauseBtn) {
      pauseBtn.removeEventListener('click', pauseHandler);
      pauseBtn.removeEventListener('touchend', pauseTouchHandler);
    }
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
