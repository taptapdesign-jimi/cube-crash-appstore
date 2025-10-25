// Clean Board Modal - DOM-based overlay (design-first), Board cleared + bonus + Continue

import { 
  getActiveOverlay, 
  setActiveOverlay, 
  isModalVisible, 
  setModalVisible, 
  getModalParams,
  setModalParams,
  getCurrentScore,
  setScore,
  animateScore,
  updateHUD,
  updateHighScore,
  calculateBonusScore,
  executeModalCallback,
  cleanupOverlay
} from './clean-board-utils.js';

import { 
  createOverlay, 
  createCard, 
  createHeroImage, 
  createInfoStack, 
  createTextCluster, 
  createScoreGroup, 
  createTitle, 
  createScoreLabel, 
  createMainScore, 
  createBonusScore, 
  createNewScore, 
  createButtonContainer, 
  createContinueButton, 
  createCancelButton, 
  addButtonHoverEffects, 
  attachButtonHandlers, 
  attachKeyboardHandlers, 
  attachOutsideClickHandlers,
  cleanupEventHandlers
} from './clean-board-ui.js';

import { logger } from '../core/logger.js';

import { 
  showOverlayAnimation, 
  hideOverlayAnimation, 
  showCardAnimation, 
  hideCardAnimation, 
  animateModalEntrance, 
  animateModalExit,
  animateScoreChange
} from './clean-board-animations.js';

// Type definitions
interface ShowCleanBoardModalParams {
  app?: any;
  stage?: any;
  getScore?: () => number;
  setScore?: (score: number) => void;
  animateScore?: (score: number, duration: number) => void;
  updateHUD?: () => void;
  bonus?: number;
  scoreCap?: number;
  boardNumber?: number;
}

interface CleanBoardModalResult {
  action: string;
}

/**
 * Show clean board modal
 */
export async function showCleanBoardModal({ 
  app, 
  stage, 
  getScore, 
  setScore, 
  animateScore, 
  updateHUD, 
  bonus = 500, 
  scoreCap = 999999, 
  boardNumber = 1 
}: ShowCleanBoardModalParams = {}): Promise<CleanBoardModalResult> {
  return new Promise(async resolve => {
    // Check if already showing
    if (isModalVisible()) {
      logger.info('⚠️ Clean board modal already visible');
      resolve({ action: 'already-showing' });
      return;
    }

    // Set modal parameters
    setModalParams({ app, stage, getScore, setScore, animateScore, updateHUD, bonus, scoreCap, boardNumber });

    // Create overlay
    const overlay = createOverlay();
    document.body.appendChild(overlay);
    setActiveOverlay(overlay);
    setModalVisible(true);

    // Create card
    const card = createCard();
    overlay.appendChild(card);

    // Create hero image
    const hero = createHeroImage();
    card.appendChild(hero);

    // Create info stack
    const infoStack = createInfoStack();
    card.appendChild(infoStack);

    // Create text cluster
    const textCluster = createTextCluster();
    infoStack.appendChild(textCluster);

    // Create title
    const title = createTitle();
    textCluster.appendChild(title);

    // Create score group
    const scoreGroup = createScoreGroup();
    infoStack.appendChild(scoreGroup);

    // Create score label
    const scoreLabel = createScoreLabel();
    scoreGroup.appendChild(scoreLabel);

    // Get current score and calculate new score
    const currentScore = getCurrentScore();
    const newScore = calculateBonusScore(currentScore, bonus, scoreCap);

    // Create main score display
    const mainScore = createMainScore(currentScore);
    scoreGroup.appendChild(mainScore);

    // Create bonus score display
    const bonusScore = createBonusScore(bonus);
    scoreGroup.appendChild(bonusScore);

    // Create new score display
    const newScoreEl = createNewScore(newScore);
    scoreGroup.appendChild(newScoreEl);

    // Create button container
    const buttonContainer = createButtonContainer();
    infoStack.appendChild(buttonContainer);

    // Create buttons
    const continueBtn = createContinueButton();
    const cancelBtn = createCancelButton();
    buttonContainer.appendChild(continueBtn);
    buttonContainer.appendChild(cancelBtn);

    // Add button hover effects
    addButtonHoverEffects(buttonContainer);

    // Attach handlers
    attachButtonHandlers(buttonContainer);
    attachKeyboardHandlers(card);
    attachOutsideClickHandlers(overlay);

    // Set up event handlers
    const handleAction = (e: any) => {
      const { action } = e.detail;
      
      switch (action) {
        case 'continue':
          logger.info('✅ Continuing game');
          // Update score
          setScore(newScore);
          animateScore(newScore, 1000);
          updateHUD();
          updateHighScore(newScore);
          
          // Animate score change
          animateScoreChange(mainScore, newScoreEl).then(() => {
            hideCleanBoardModal();
            resolve({ action: 'continue' });
          });
          break;
        case 'cancel':
          logger.info('❌ Cancelling clean board');
          hideCleanBoardModal();
          resolve({ action: 'cancel' });
          break;
      }
    };

    const handleClose = (e: any) => {
      const { reason } = e.detail;
      logger.info(`❌ Closing clean board modal: ${reason}`);
      hideCleanBoardModal();
      resolve({ action: 'close' });
    };

    card.addEventListener('clean-board-modal-action', handleAction);
    card.addEventListener('clean-board-modal-close', handleClose);

    // Animate in
    animateModalEntrance(overlay, card);
  });
}

/**
 * Hide clean board modal
 */
export function hideCleanBoardModal(): void {
  const overlay = getActiveOverlay();
  if (!overlay) return;

  const card = overlay.querySelector('div[style*="background:transparent"]') as HTMLElement;
  if (!card) return;

  // Animate out
  animateModalExit(overlay, card).then(() => {
    // Cleanup
    cleanupEventHandlers(card, overlay);
    
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    
    setActiveOverlay(null);
    setModalVisible(false);
  });
}