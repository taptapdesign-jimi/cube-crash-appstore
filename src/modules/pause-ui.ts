// pause-ui.ts
// UI components for pause modal

import { generateId, getCurrentScore, getModalButtonOptions } from './pause-utils.js';

/**
 * Ensure overlay exists
 */
export function ensureOverlay(): HTMLElement {
  const existingOverlay = document.getElementById('pause-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const el = document.createElement('div');
  el.id = 'pause-overlay';
  el.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 99999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: transparent !important;
    backdrop-filter: blur(12px) !important;
  `;
  
  return el;
}

/**
 * Create pause modal content
 */
export function createPauseModalContent(): HTMLElement {
  const score = getCurrentScore();
  const options = getModalButtonOptions();
  
  const modal = document.createElement('div');
  modal.id = generateId();
  modal.style.cssText = `
    background: white !important;
    border-radius: 20px !important;
    padding: 40px !important;
    max-width: 400px !important;
    width: 90% !important;
    text-align: center !important;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3) !important;
    transform: scale(0.8) !important;
    opacity: 0 !important;
    transition: all 0.3s ease !important;
  `;
  
  modal.innerHTML = `
    <h2 style="
      font-family: 'LTCrow', system-ui, -apple-system, sans-serif !important;
      font-size: 32px !important;
      font-weight: bold !important;
      color: #333 !important;
      margin: 0 0 20px 0 !important;
    ">Game Paused</h2>
    
    <p style="
      font-family: 'LTCrow', system-ui, -apple-system, sans-serif !important;
      font-size: 18px !important;
      color: #666 !important;
      margin: 0 0 30px 0 !important;
    ">What would you like to do?</p>
    
    <div style="
      font-family: 'LTCrow', system-ui, -apple-system, sans-serif !important;
      font-size: 24px !important;
      font-weight: bold !important;
      color: #E97A55 !important;
      margin: 0 0 30px 0 !important;
    ">Score: ${score.toLocaleString()}</div>
    
    <div style="
      display: flex !important;
      flex-direction: column !important;
      gap: 20px !important;
      align-items: center !important;
    ">
      <button class="resume-btn continue-btn primary-button" data-action="resume" style="
        background: #E97A55 !important;
        color: white !important;
        border: none !important;
        border-radius: 40px !important;
        height: 64px !important;
        min-height: 64px !important;
        padding: 0 56px !important;
        font-family: 'LTCrow', system-ui, -apple-system, sans-serif !important;
        font-size: 24px !important;
        font-weight: bold !important;
        box-shadow: 0 8px 0 0 #C24921 !important;
        cursor: pointer !important;
        transition: transform 0.35s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        text-decoration: none !important;
        outline: none !important;
        user-select: none !important;
        -webkit-tap-highlight-color: transparent !important;
        width: 100% !important;
        max-width: 310px !important;
        transform: scale(1) !important;
        transform-style: flat !important;
        perspective: none !important;
        overflow: hidden !important;
      ">Continue</button>
      
      <button class="restart-btn" data-action="restart" style="
        background: #6C7B95 !important;
        color: white !important;
        border: none !important;
        border-radius: 40px !important;
        height: 64px !important;
        padding: 0 56px !important;
        font-family: 'LTCrow', system-ui, -apple-system, sans-serif !important;
        font-size: 20px !important;
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
      ">New Game</button>
      
      <button class="exit-btn" data-action="exit" style="
        background: #DC3545 !important;
        color: white !important;
        border: none !important;
        border-radius: 40px !important;
        height: 64px !important;
        padding: 0 56px !important;
        font-family: 'LTCrow', system-ui, -apple-system, sans-serif !important;
        font-size: 24px !important;
        font-weight: bold !important;
        box-shadow: 0 8px 0 0 #A71E2A !important;
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
      ">Exit to Menu</button>
    </div>
  `;
  
  return modal;
}

/**
 * Add button hover effects
 */
export function addButtonHoverEffects(modal: HTMLElement): void {
  const resumeBtn = modal.querySelector('.resume-btn') as HTMLElement;
  const restartBtn = modal.querySelector('.restart-btn') as HTMLElement;
  const exitBtn = modal.querySelector('.exit-btn') as HTMLElement;
  
  if (resumeBtn) {
    resumeBtn.addEventListener('mouseenter', () => {
      resumeBtn.style.background = '#F08A65';
      resumeBtn.style.transform = 'translateY(-2px)';
      resumeBtn.style.boxShadow = '0 10px 0 0 #C24921';
    });
    
    resumeBtn.addEventListener('mouseleave', () => {
      resumeBtn.style.background = '#E97A55';
      resumeBtn.style.transform = 'translateY(0)';
      resumeBtn.style.boxShadow = '0 8px 0 0 #C24921';
    });
    
    resumeBtn.addEventListener('mousedown', () => {
      resumeBtn.style.transform = 'translateY(2px)';
      resumeBtn.style.boxShadow = '0 6px 0 0 #C24921';
    });
    
    resumeBtn.addEventListener('mouseup', () => {
      resumeBtn.style.transform = 'translateY(-2px)';
      resumeBtn.style.boxShadow = '0 10px 0 0 #C24921';
    });
  }
  
  if (restartBtn) {
    restartBtn.addEventListener('mouseenter', () => {
      restartBtn.style.background = '#7C8BA5';
      restartBtn.style.transform = 'translateY(-2px)';
      restartBtn.style.boxShadow = '0 10px 0 0 #4A5A7A';
    });
    
    restartBtn.addEventListener('mouseleave', () => {
      restartBtn.style.background = '#6C7B95';
      restartBtn.style.transform = 'translateY(0)';
      restartBtn.style.boxShadow = '0 8px 0 0 #4A5A7A';
    });
    
    restartBtn.addEventListener('mousedown', () => {
      restartBtn.style.transform = 'translateY(2px)';
      restartBtn.style.boxShadow = '0 6px 0 0 #4A5A7A';
    });
    
    restartBtn.addEventListener('mouseup', () => {
      restartBtn.style.transform = 'translateY(-2px)';
      restartBtn.style.boxShadow = '0 10px 0 0 #4A5A7A';
    });
  }
  
  if (exitBtn) {
    exitBtn.addEventListener('mouseenter', () => {
      exitBtn.style.background = '#E74C3C';
      exitBtn.style.transform = 'translateY(-2px)';
      exitBtn.style.boxShadow = '0 10px 0 0 #A71E2A';
    });
    
    exitBtn.addEventListener('mouseleave', () => {
      exitBtn.style.background = '#DC3545';
      exitBtn.style.transform = 'translateY(0)';
      exitBtn.style.boxShadow = '0 8px 0 0 #A71E2A';
    });
    
    exitBtn.addEventListener('mousedown', () => {
      exitBtn.style.transform = 'translateY(2px)';
      exitBtn.style.boxShadow = '0 6px 0 0 #A71E2A';
    });
    
    exitBtn.addEventListener('mouseup', () => {
      exitBtn.style.transform = 'translateY(-2px)';
      exitBtn.style.boxShadow = '0 10px 0 0 #A71E2A';
    });
  }
}

/**
 * Attach button handlers
 */
export function attachButtonHandlers(modal: HTMLElement): void {
  const resumeBtn = modal.querySelector('[data-action="resume"]');
  const restartBtn = modal.querySelector('[data-action="restart"]');
  const exitBtn = modal.querySelector('[data-action="exit"]');
  
  const handleAction = (action: string) => {
    const actionEvent = new CustomEvent('pause-modal-action', {
      detail: { action }
    });
    modal.dispatchEvent(actionEvent);
  };
  
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => handleAction('resume'));
  }
  
  if (restartBtn) {
    restartBtn.addEventListener('click', () => handleAction('restart'));
  }
  
  if (exitBtn) {
    exitBtn.addEventListener('click', () => handleAction('exit'));
  }
}

/**
 * Attach keyboard handlers
 */
export function attachKeyboardHandlers(modal: HTMLElement): void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const closeEvent = new CustomEvent('pause-modal-close', {
        detail: { reason: 'escape' }
      });
      modal.dispatchEvent(closeEvent);
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Store handler for cleanup
  (modal as any)._keyboardHandler = handleKeyDown;
}

/**
 * Attach outside click handlers
 */
export function attachOutsideClickHandlers(overlay: HTMLElement): void {
  const handleClick = (e: Event) => {
    if (e.target === overlay) {
      const closeEvent = new CustomEvent('pause-modal-close', {
        detail: { reason: 'outside-click' }
      });
      overlay.dispatchEvent(closeEvent);
    }
  };
  
  overlay.addEventListener('click', handleClick);
  
  // Store handler for cleanup
  (overlay as any)._outsideClickHandler = handleClick;
}

/**
 * Cleanup event handlers
 */
export function cleanupEventHandlers(modal: HTMLElement, overlay: HTMLElement): void {
  // Remove keyboard handler
  if ((modal as any)._keyboardHandler) {
    document.removeEventListener('keydown', (modal as any)._keyboardHandler);
    delete (modal as any)._keyboardHandler;
  }
  
  // Remove outside click handler
  if ((overlay as any)._outsideClickHandler) {
    overlay.removeEventListener('click', (overlay as any)._outsideClickHandler);
    delete (overlay as any)._outsideClickHandler;
  }
}

// All functions are already exported individually above
