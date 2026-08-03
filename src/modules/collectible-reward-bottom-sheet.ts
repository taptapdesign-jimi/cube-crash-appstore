// Collectible Reward Bottom Sheet
// Displays a bottom sheet when a new collectible card is unlocked.

import { 
  getDefaultCollectibleDetail, 
  validateCollectibleDetail, 
  setActiveOverlay, 
  setActiveResolve, 
  setClosing, 
  executeCleanup,
  registerCleanup,
  isOverlayActive,
  getActiveOverlay,
  getActiveResolve,
  getIsClosing
} from './collectible-reward-utils.js';

import { 
  createOverlay, 
  createBottomSheet, 
  addStyles, 
  attachDragHandlers, 
  attachCloseButtonHandler,
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
import { ctaMotion, exitCtaPair, registerCta, type CtaController } from './cta-system.ts';

let rewardCtaControllers: CtaController[] = [];

function disposeRewardCtas(): void {
  rewardCtaControllers.splice(0).forEach(controller => controller.dispose());
}

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
  clickedCta?: HTMLButtonElement;
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
    attachCloseButtonHandler(sheet);
    attachKeyboardHandlers(sheet);
    attachOutsideClickHandlers(overlay);
    
    // Set up close handler
    const handleClose = (reason: string, clickedCta?: HTMLButtonElement) => {
      void hideCollectibleRewardBottomSheet(reason, {
        clickedCta,
        onAfterClose: reason === 'view-collection'
          ? () => (window as any).showCollectiblesScreen?.({ scrollToCard: 'new', animateCard: true })
          : undefined,
      });
      resolve(reason);
    };

    const continueButton = sheet.querySelector<HTMLButtonElement>('[data-action="close"]');
    const viewCollectionButton = sheet.querySelector<HTMLButtonElement>('[data-action="view-collection"]');
    if (continueButton && viewCollectionButton) {
      rewardCtaControllers = [
        registerCta(viewCollectionButton, {
          variant: 'primary',
          initialState: 'hidden',
          activationTiming: 'immediate',
          onActivate: () => handleClose('view-collection', viewCollectionButton),
        }),
        registerCta(continueButton, {
          variant: 'secondary',
          initialState: 'hidden',
          activationTiming: 'immediate',
          onActivate: () => handleClose('continue', continueButton),
        }),
      ];
      registerCleanup(disposeRewardCtas);
    }
    
    // 🔥 FIX: Store handler for proper cleanup
    const closeHandler = (e: any) => {
      handleClose(e.detail.reason);
    };
    sheet.addEventListener('collectible-reward-close', closeHandler);
    
    // 🔥 FIX: Register cleanup to remove event listener
    registerCleanup(() => {
      sheet.removeEventListener('collectible-reward-close', closeHandler);
    });
    
    // Animate in
    showOverlayAnimation(overlay).then(() => {
      showSheetAnimation(sheet).then(() => {
        rewardCtaControllers.forEach((controller, index) => {
          void controller.enter({ delay: (index * ctaMotion.companionExitStaggerMs) / 1000 });
        });
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
export async function hideCollectibleRewardBottomSheet(reason: string = 'dismiss', options: HideOptions = {}): Promise<void> {
  const overlay = getActiveOverlay();
  if (!overlay) return;

  setClosing(true);

  const sheet = overlay.querySelector('.collectible-reward-sheet') as HTMLElement;
  if (!sheet) return;

  const buttons = rewardCtaControllers.map(controller => controller.element);
  const clicked = options.clickedCta ?? buttons[0];
  if (clicked) {
    await exitCtaPair(clicked, buttons.find(button => button !== clicked));
  }

  await hideSheetAnimation(sheet);
  await hideOverlayAnimation(overlay);
  executeCleanup();
  options.onAfterClose?.();
}
