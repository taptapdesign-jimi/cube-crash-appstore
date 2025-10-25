// Simple End Run Modal
import { 
  getActiveModal, 
  setActiveModal, 
  isModalVisible, 
  setModalVisible, 
  getModalOptions,
  pauseGame,
  resumeGame,
  unlockSlider
} from './end-run-utils.js';

import { 
  addEndRunModalStyles, 
  createModal, 
  addDragFunctionality, 
  attachButtonHandlers, 
  attachKeyboardHandlers, 
  addOutsideClickFunctionality,
  cleanupEventHandlers
} from './end-run-ui.js';

import { logger } from '../core/logger.js';

import { 
  showModalAnimation, 
  hideModalAnimation, 
  animateModalEntrance, 
  animateModalExit 
} from './end-run-animations.js';

/**
 * Show end run modal
 */
export function showEndRunModal(): void {
  // Check if already showing
  if (isModalVisible()) {
    logger.info('⚠️ End run modal already visible');
    return;
  }

  // Add styles
  addEndRunModalStyles();
  
  // Create modal
  const modal = createModal();
  document.body.appendChild(modal);
  setActiveModal(modal);
  setModalVisible(true);
  
  // Attach handlers
  addDragFunctionality(modal);
  attachButtonHandlers(modal);
  attachKeyboardHandlers(modal);
  addOutsideClickFunctionality(modal);
  
  // Set up event handlers
  const handleAction = (e: any) => {
    const { action } = e.detail;
    const options = getModalOptions();
    
    switch (action) {
      case 'restart':
        logger.info('🔄 Restarting game');
        options.restart();
        hideModal();
        break;
      case 'exit':
        logger.info('🚪 Exiting to menu');
        options.exit();
        hideModal();
        break;
      case 'clean':
        logger.info('🧹 Opening clean board modal');
        options.clean();
        break;
    }
  };
  
  const handleClose = (e: any) => {
    const { reason } = e.detail;
    logger.info(`❌ Closing modal: ${reason}`);
    hideModal();
  };
  
  modal.addEventListener('end-run-modal-action', handleAction);
  modal.addEventListener('end-run-modal-close', handleClose);
  
  // Animate in
  animateModalEntrance(modal);
  
  // Pause game
  pauseGame();
}

/**
 * Hide modal
 */
export function hideModal(): void {
  const modal = getActiveModal();
  if (!modal) return;

  setModalVisible(false);

  // Animate out
  animateModalExit(modal).then(() => {
    // Cleanup
    cleanupEventHandlers(modal);
    
    if (modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
    
    setActiveModal(null);
    
    // Resume game
    resumeGame();
    unlockSlider();
  });
}

/**
 * Show end run modal from game
 */
export function showEndRunModalFromGame(): void {
  logger.info('🎯 Showing end run modal from game');
  showEndRunModal();
}