import { 
  getActiveOverlay, 
  setActiveOverlay, 
  isModalVisible, 
  setModalVisible, 
  getModalOptions,
  setModalOptions,
  pauseGame,
  resumeGame,
  restartGame,
  executeModalCallback,
  cleanupOverlay
} from './pause-utils.js';

import { 
  ensureOverlay, 
  createPauseModalContent, 
  addButtonHoverEffects, 
  attachButtonHandlers, 
  attachKeyboardHandlers, 
  attachOutsideClickHandlers,
  cleanupEventHandlers
} from './pause-ui.js';

import { logger } from '../core/logger.js';

import { 
  showModalAnimation, 
  hideModalAnimation, 
  animateModalEntrance, 
  animateModalExit 
} from './pause-animations.js';

// Type definitions
interface PauseModalOptions {
  onUnpause?: () => void | Promise<void>;
  onRestart?: () => void | Promise<void>;
  onExit?: () => void | Promise<void>;
}

/**
 * Hide pause modal
 */
export function hidePauseModal(): void {
  const overlay = getActiveOverlay();
  if (!overlay) return;

  const modal = overlay.querySelector('div[id*="pause-modal"]') as HTMLElement;
  if (!modal) return;

  // Animate out
  animateModalExit(modal).then(() => {
    // Cleanup
    cleanupEventHandlers(modal, overlay);
    
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    
    setActiveOverlay(null);
    setModalVisible(false);
    
    // Resume game
    resumeGame();
  });
}

/**
 * Show pause modal
 */
export function showPauseModal({ onUnpause, onRestart, onExit }: PauseModalOptions = {}): void {
  // Check if already showing
  if (isModalVisible()) {
    logger.info('⚠️ Pause modal already visible');
    return;
  }

  // Set modal options
  setModalOptions({ onUnpause, onRestart, onExit });

  // Create overlay
  const overlay = ensureOverlay();
  document.body.appendChild(overlay);
  setActiveOverlay(overlay);
  setModalVisible(true);

  // Create modal content
  const modal = createPauseModalContent();
  overlay.appendChild(modal);

  // Add button hover effects
  addButtonHoverEffects(modal);

  // Attach handlers
  attachButtonHandlers(modal);
  attachKeyboardHandlers(modal);
  attachOutsideClickHandlers(overlay);

  // Set up event handlers
  const handleAction = (e: any) => {
    const { action } = e.detail;
    
    switch (action) {
      case 'resume':
        logger.info('▶️ Resuming game');
        executeModalCallback(onUnpause);
        hidePauseModal();
        break;
      case 'restart':
        logger.info('🔄 Restarting game');
        executeModalCallback(onRestart);
        hidePauseModal();
        restartGame();
        break;
      case 'exit':
        logger.info('🚪 Exiting to menu');
        executeModalCallback(onExit);
        hidePauseModal();
        break;
    }
  };

  const handleClose = (e: any) => {
    const { reason } = e.detail;
    logger.info(`❌ Closing pause modal: ${reason}`);
    hidePauseModal();
  };

  modal.addEventListener('pause-modal-action', handleAction);
  modal.addEventListener('pause-modal-close', handleClose);

  // Animate in
  animateModalEntrance(modal);

  // Pause game
  pauseGame();
}