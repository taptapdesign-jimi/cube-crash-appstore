// Resume Game Bottom Sheet - same style as End This Run modal

import { 
  getActiveModal, 
  setActiveModal, 
  isModalVisible, 
  setModalVisible, 
  getModalOptions,
  pauseGame,
  resumeGame,
  unlockSlider,
  createCleanupRegistry,
  executeCleanup,
  setModalClosing,
  isModalClosing
} from './resume-sheet-utils.js';

import { 
  addBottomSheetStyles, 
  createResumeModal, 
  addDragFunctionality, 
  attachButtonHandlers, 
  attachKeyboardHandlers, 
  addOutsideClickFunctionality,
  cleanupEventHandlers
} from './resume-sheet-ui.js';

import { 
  showBottomSheetAnimation, 
  hideBottomSheetAnimation, 
  animateBottomSheetEntrance, 
  animateBottomSheetExit 
} from './resume-sheet-animations.js';
import { logger } from '../core/logger.js';

/**
 * Show resume game bottom sheet
 */
export function showResumeGameBottomSheet(): void {
  // Check if already showing
  if (isModalVisible()) {
    logger.info('⚠️ Resume sheet already visible');
    return;
  }

  // Add styles
  addBottomSheetStyles();
  
  // Create modal
  const modal = createResumeModal();
  document.body.appendChild(modal);
  setActiveModal(modal);
  setModalVisible(true);
  
  // Create cleanup registry
  const registerCleanup = createCleanupRegistry(modal);
  
  // Attach handlers
  addDragFunctionality(modal, registerCleanup);
  attachButtonHandlers(modal, registerCleanup);
  attachKeyboardHandlers(modal, registerCleanup);
  addOutsideClickFunctionality(modal, registerCleanup);
  
  // Set up event handlers
  const handleAction = (e: any) => {
    const { action } = e.detail;
    const options = getModalOptions();
    
    switch (action) {
      case 'resume':
        logger.info('▶️ Resuming game');
        options.resume();
        hideResumeModal();
        break;
      case 'pause':
        logger.info('⏸️ Staying paused');
        options.pause();
        hideResumeModal();
        break;
    }
  };
  
  const handleClose = (e: any) => {
    const { reason } = e.detail;
    logger.info(`❌ Closing resume sheet: ${reason}`);
    hideResumeModal();
  };
  
  modal.addEventListener('resume-sheet-action', handleAction);
  modal.addEventListener('resume-sheet-close', handleClose);
  
  // Animate in
  animateBottomSheetEntrance(modal);
  
  // Pause game
  pauseGame();
}

/**
 * Hide resume modal
 */
export function hideResumeModal(): void {
  const modal = getActiveModal();
  if (!modal) return;

  // Check if already closing
  if (isModalClosing(modal)) {
    logger.info('⚠️ Resume sheet already closing');
    return;
  }

  setModalClosing(modal, true);
  setModalVisible(false);

  // Animate out
  animateBottomSheetExit(modal).then(() => {
    // Cleanup
    cleanupEventHandlers(modal);
    executeCleanup(modal);
    
    if (modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
    
    setActiveModal(null);
    
    // Resume game and unlock slider
    resumeGame();
    unlockSlider();
  });
}