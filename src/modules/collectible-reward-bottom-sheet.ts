// Collectible Reward Bottom Sheet
// Displays a bottom sheet when a new collectible card is unlocked.

import { 
  getDefaultCollectibleDetail, 
  validateCollectibleDetail, 
  setActiveOverlay, 
  setActiveResolve, 
  setClosing, 
  executeCleanup,
  isOverlayActive,
  getActiveOverlay,
  getActiveResolve,
  isClosing
} from './collectible-reward-utils.js';

import { 
  createOverlay, 
  createBottomSheet, 
  addStyles, 
  attachDragHandlers, 
  attachButtonHandlers, 
  attachKeyboardHandlers, 
  attachOutsideClickHandlers 
} from './collectible-reward-ui.js';

import { 
  showOverlayAnimation, 
  hideOverlayAnimation, 
  showSheetAnimation, 
  hideSheetAnimation, 
  revealCollectibleCardAnimation 
} from './collectible-reward-animations.js';

// Types
interface CollectibleDetail {
  cardName?: string;
  imagePath?: string;
  rarity?: string;
}

interface HideOptions {
  preserveCurrentTransform?: boolean;
  onAfterClose?: () => void;
  duration?: number;
  easing?: string;
}

/**
 * Show collectible reward bottom sheet
 */
export function showCollectibleRewardBottomSheet(detail: CollectibleDetail = {}): Promise<string> {
  return new Promise((resolve) => {
    // Check if already showing
    if (isOverlayActive()) {
      resolve('already-showing');
      return;
    }

    // Validate detail
    const validatedDetail = validateCollectibleDetail(detail);
    
    // Add styles
    addStyles();
    
    // Create overlay
    const overlay = createOverlay();
    document.body.appendChild(overlay);
    setActiveOverlay(overlay);
    
    // Create sheet
    const sheet = createBottomSheet(validatedDetail);
    overlay.appendChild(sheet);
    
    // Attach handlers
    attachDragHandlers(sheet);
    attachButtonHandlers(sheet);
    attachKeyboardHandlers(sheet);
    attachOutsideClickHandlers(overlay);
    
    // Set up close handler
    const handleClose = (reason: string) => {
      hideCollectibleRewardBottomSheet(reason);
      resolve(reason);
    };
    
    sheet.addEventListener('collectible-reward-close', (e: any) => {
      handleClose(e.detail.reason);
    });
    
    // Animate in
    showOverlayAnimation(overlay).then(() => {
      showSheetAnimation(sheet).then(() => {
        revealCollectibleCardAnimation(sheet, validatedDetail);
      });
    });
    
    // Set resolve function
    setActiveResolve(resolve);
  });
}

/**
 * Hide collectible reward bottom sheet
 */
export function hideCollectibleRewardBottomSheet(reason: string = 'dismiss', options: HideOptions = {}): void {
  const overlay = getActiveOverlay();
  if (!overlay) return;

  setClosing(true);

  const sheet = overlay.querySelector('.collectible-reward-sheet') as HTMLElement;
  if (!sheet) return;

  // Animate out
  hideSheetAnimation(sheet).then(() => {
    hideOverlayAnimation(overlay).then(() => {
      // Cleanup
      executeCleanup();
      
      // Call onAfterClose if provided
      if (options.onAfterClose) {
        options.onAfterClose();
      }
    });
  });
}