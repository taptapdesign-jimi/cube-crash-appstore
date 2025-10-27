// clean-board-ui.ts
// UI components for clean board modal

import { 
  pickRandomHeadline, 
  getCurrentScore, 
  calculateBonusScore, 
  formatNumber, 
  generateId,
  getModalButtonOptions
} from './clean-board-utils.js';

// Type definitions
interface TouchEventWithTouches extends TouchEvent {
  touches: TouchList;
  changedTouches: TouchList;
}

interface MouseEventWithTarget extends MouseEvent {
  target: EventTarget | null;
}

/**
 * Create overlay element
 */
export function createOverlay(): HTMLElement {
  const overlayId = 'cc-clean-board-overlay';
  const old = document.getElementById(overlayId);
  if (old) old.remove();

  const el = document.createElement('div');
  el.id = overlayId;
  el.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:#F3EEE8',
    'z-index:10000000000000',
    'opacity:0',
    'transition:opacity .2s ease'
  ].join(';');
  
  return el;
}

/**
 * Create card element
 */
export function createCard(): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = [
    'background:transparent',
    'border-radius:40px',
    'padding:40px 32px',
    'text-align:center',
    'font-family:"LTCrow", system-ui, -apple-system, sans-serif',
    'transform:scale(0.9)',
    'transition:transform .34s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .2s ease',
    'opacity:0',
    'max-width:min(340px,88vw)',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:40px'
  ].join(';');
  
  return card;
}

/**
 * Create hero image
 */
export function createHeroImage(): HTMLElement {
  const hero = document.createElement('img');
  hero.alt = 'Board cleared';
  hero.src = './assets/clean-board.png';
  hero.style.cssText = 'width:min(240px,70vw);height:auto;display:block;margin:0 auto 0 auto;transform:scale(1);';

  // Add error handling for image
  hero.onerror = () => {
    // Fallback to a simple div
    hero.style.cssText = 'width:min(260px,46vw);height:min(260px,46vw);background:#4CAF50;border-radius:20px;display:block;margin:0 auto 24px auto;transform:scale(0.92);';
  };

  return hero;
}

/**
 * Create info stack
 */
export function createInfoStack(): HTMLElement {
  const infoStack = document.createElement('div');
  infoStack.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:32px',
    'width:100%'
  ].join(';');
  
  return infoStack;
}

/**
 * Create text cluster
 */
export function createTextCluster(): HTMLElement {
  const textCluster = document.createElement('div');
  textCluster.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:8px',
    'width:100%'
  ].join(';');
  
  return textCluster;
}

/**
 * Create score group
 */
export function createScoreGroup(): HTMLElement {
  const scoreGroup = document.createElement('div');
  scoreGroup.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:8px',
    'width:100%'
  ].join(';');
  
  return scoreGroup;
}

/**
 * Create title element
 */
export function createTitle(): HTMLElement {
  const title = document.createElement('div');
  title.textContent = pickRandomHeadline();
  title.style.cssText = 'color:#B07F69;font-weight:800;font-size:40px;line-height:1;margin:0;';
  
  return title;
}

/**
 * Create score label
 */
export function createScoreLabel(): HTMLElement {
  const scoreLabel = document.createElement('div');
  scoreLabel.textContent = 'Your score';
  scoreLabel.style.cssText = 'color:#b69077;font-weight:600;font-size:20px;line-height:1.2;margin:0;letter-spacing:0.02em;';
  
  return scoreLabel;
}

/**
 * Create main score display
 */
export function createMainScore(currentScore: number): HTMLElement {
  const mainScore = document.createElement('div');
  mainScore.textContent = formatNumber(currentScore);
  mainScore.style.cssText = 'color:#B07F69;font-weight:800;font-size:48px;line-height:1;margin:0;letter-spacing:-0.02em;';
  
  return mainScore;
}

/**
 * Create bonus score display
 */
export function createBonusScore(bonus: number): HTMLElement {
  const bonusScore = document.createElement('div');
  bonusScore.textContent = `+${formatNumber(bonus)}`;
  bonusScore.style.cssText = 'color:#4CAF50;font-weight:700;font-size:24px;line-height:1;margin:0;letter-spacing:-0.01em;';
  
  return bonusScore;
}

/**
 * Create new score display
 */
export function createNewScore(newScore: number): HTMLElement {
  const newScoreEl = document.createElement('div');
  newScoreEl.textContent = formatNumber(newScore);
  newScoreEl.style.cssText = 'color:#B07F69;font-weight:800;font-size:48px;line-height:1;margin:0;letter-spacing:-0.02em;';
  
  return newScoreEl;
}

/**
 * Create button container
 */
export function createButtonContainer(): HTMLElement {
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'gap:16px',
    'width:100%',
    'align-items:center'
  ].join(';');
  
  return buttonContainer;
}

/**
 * Create continue button
 */
export function createContinueButton(): HTMLElement {
  const continueBtn = document.createElement('button');
  continueBtn.textContent = 'Continue';
  continueBtn.setAttribute('data-action', 'continue');
  continueBtn.style.cssText = [
    'background:#E97A55',
    'color:white',
    'border:none',
    'border-radius:40px',
    'height:64px',
    'padding:0 56px',
    'font-family:"LTCrow", system-ui, -apple-system, sans-serif',
    'font-size:24px',
    'font-weight:bold',
    'box-shadow:0 8px 0 0 #C24921',
    'cursor:pointer',
    'transition:all 0.2s ease',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'text-align:center',
    'text-decoration:none',
    'outline:none',
    'user-select:none',
    '-webkit-tap-highlight-color:transparent'
  ].join(';');
  
  return continueBtn;
}

/**
 * Create cancel button
 */
export function createCancelButton(): HTMLElement {
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.setAttribute('data-action', 'cancel');
  cancelBtn.style.cssText = [
    'background:#6C7B95',
    'color:white',
    'border:none',
    'border-radius:40px',
    'height:64px',
    'padding:0 56px',
    'font-family:"LTCrow", system-ui, -apple-system, sans-serif',
    'font-size:24px',
    'font-weight:bold',
    'box-shadow:0 8px 0 0 #4A5A7A',
    'cursor:pointer',
    'transition:all 0.2s ease',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'text-align:center',
    'text-decoration:none',
    'outline:none',
    'user-select:none',
    '-webkit-tap-highlight-color:transparent'
  ].join(';');
  
  return cancelBtn;
}

/**
 * Add button hover effects
 */
export function addButtonHoverEffects(buttonContainer: HTMLElement): void {
  const continueBtn = buttonContainer.querySelector('[data-action="continue"]') as HTMLElement;
  const cancelBtn = buttonContainer.querySelector('[data-action="cancel"]') as HTMLElement;
  
  if (continueBtn) {
    continueBtn.addEventListener('mouseenter', () => {
      continueBtn.style.background = '#F08A65';
      continueBtn.style.transform = 'translateY(-2px)';
      continueBtn.style.boxShadow = '0 10px 0 0 #C24921';
    });
    
    continueBtn.addEventListener('mouseleave', () => {
      continueBtn.style.background = '#E97A55';
      continueBtn.style.transform = 'translateY(0)';
      continueBtn.style.boxShadow = '0 8px 0 0 #C24921';
    });
    
    continueBtn.addEventListener('mousedown', () => {
      continueBtn.style.transform = 'translateY(2px)';
      continueBtn.style.boxShadow = '0 6px 0 0 #C24921';
    });
    
    continueBtn.addEventListener('mouseup', () => {
      continueBtn.style.transform = 'translateY(-2px)';
      continueBtn.style.boxShadow = '0 10px 0 0 #C24921';
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#7C8BA5';
      cancelBtn.style.transform = 'translateY(-2px)';
      cancelBtn.style.boxShadow = '0 10px 0 0 #4A5A7A';
    });
    
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = '#6C7B95';
      cancelBtn.style.transform = 'translateY(0)';
      cancelBtn.style.boxShadow = '0 8px 0 0 #4A5A7A';
    });
    
    cancelBtn.addEventListener('mousedown', () => {
      cancelBtn.style.transform = 'translateY(2px)';
      cancelBtn.style.boxShadow = '0 6px 0 0 #4A5A7A';
    });
    
    cancelBtn.addEventListener('mouseup', () => {
      cancelBtn.style.transform = 'translateY(-2px)';
      cancelBtn.style.boxShadow = '0 10px 0 0 #4A5A7A';
    });
  }
}

/**
 * Attach button handlers
 */
export function attachButtonHandlers(buttonContainer: HTMLElement): void {
  const continueBtn = buttonContainer.querySelector('[data-action="continue"]');
  const cancelBtn = buttonContainer.querySelector('[data-action="cancel"]');
  
  const handleAction = (action: string) => {
    const actionEvent = new CustomEvent('clean-board-modal-action', {
      detail: { action }
    });
    buttonContainer.dispatchEvent(actionEvent);
  };
  
  if (continueBtn) {
    continueBtn.addEventListener('click', () => handleAction('continue'));
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => handleAction('cancel'));
  }
}

/**
 * Attach keyboard handlers
 */
export function attachKeyboardHandlers(modal: HTMLElement): void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const closeEvent = new CustomEvent('clean-board-modal-close', {
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
      const closeEvent = new CustomEvent('clean-board-modal-close', {
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

/**
 * Create animated main score that starts at 0
 */
export function createAnimatedScoreElement(): HTMLElement {
  const mainScore = document.createElement('div');
  mainScore.textContent = '0';
  mainScore.style.cssText = 'color:#B07F69;font-weight:800;font-size:48px;line-height:1;margin:0;letter-spacing:-0.02em;';
  return mainScore;
}

/**
 * Create bonus score display that appears below main score
 */
export function createBonusScoreDisplay(bonus: number, boardNumber: number): HTMLElement {
  const bonusScore = document.createElement('div');
  bonusScore.textContent = `+${bonus} Bonus score`;
  bonusScore.style.cssText = 'color:#E8734A;font-weight:700;font-size:24px;line-height:1;margin:0;letter-spacing:-0.01em;opacity:0;transition:opacity 0.3s ease;';
  bonusScore.id = 'bonus-score-display';
  return bonusScore;
}

/**
 * Create board info display (shows after bonus is added)
 */
export function createBoardInfoDisplay(boardNumber: number): HTMLElement {
  const boardInfo = document.createElement('div');
  boardInfo.textContent = `Board #${boardNumber} cleared`;
  boardInfo.style.cssText = 'color:#E8734A;font-weight:700;font-size:24px;line-height:1;margin:0;letter-spacing:-0.01em;opacity:0;transition:opacity 0.3s ease;';
  boardInfo.id = 'board-info-display';
  return boardInfo;
}

// All functions are already exported individually above
