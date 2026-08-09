// Collectible Reward Bottom Sheet
// Displays a bottom sheet when a new collectible card is unlocked.

import {
  validateCollectibleDetail, 
  setActiveOverlay, 
  setActiveResolve, 
  setClosing, 
  executeCleanup,
  registerCleanup,
  isOverlayActive,
  getActiveOverlay,
  getIsClosing,
  cleanupOverlay,
} from './collectible-reward-utils.js';

import { 
  createOverlay, 
  createBottomSheet, 
  addStyles, 
  attachKeyboardHandlers, 
  attachOutsideClickHandlers 
} from './collectible-reward-ui.js';

import { 
  showOverlayAnimation, 
  hideOverlayAnimation, 
  showSheetAnimation, 
  hideSheetAnimation, 
  revealCollectibleCardAnimation,
  scheduleCollectibleRewardAnimation,
  cleanupCollectibleRewardAnimationTimeouts,
} from './collectible-reward-animations.js';
import { exitCtaPair, registerCta, type CtaController } from './cta-system.ts';
import {
  GAMEPLAY_MODAL_BENCHMARK,
  getGameplayModalCtaEnterDelayMs,
  runGameplayModalParallelExit,
} from './gameplay-modal-benchmark.ts';
import { mountGameplaySheetClose } from './gameplay-sheet-close.ts';
import { mountGameplayModalSpatialMotion } from './gameplay-modal-spatial-motion.js';
import { installGameplayOverlayModalDragMotion } from './modal-vertical-drag-dismiss.js';

let rewardCtaControllers: CtaController[] = [];
let disposeRewardSpatialMotion: (() => void) | null = null;

function cleanupRewardSpatialMotion(): void {
  disposeRewardSpatialMotion?.();
  disposeRewardSpatialMotion = null;
}

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
    disposeRewardSpatialMotion = mountGameplayModalSpatialMotion(
      overlay,
      sheet.querySelector<HTMLElement>('.cc-gameplay-modal-paper-shell'),
    );
    registerCleanup(cleanupRewardSpatialMotion);
    
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

    // The centered modal benchmark dismisses through close, Escape, or
    // backdrop tap. It does not inherit the legacy translateY drag owner.
    const closeHost = sheet.querySelector<HTMLElement>('.cc-gameplay-modal-idle-shell') ?? sheet;
    const closeController = mountGameplaySheetClose(
      closeHost,
      () => handleClose('close-button'),
      'Close collectible reward',
    );
    registerCleanup(() => closeController.dispose());
    registerCleanup(installGameplayOverlayModalDragMotion(sheet, {
      onDismiss: () => handleClose('drag'),
      motionElement: sheet,
    }));
    attachKeyboardHandlers(sheet);
    attachOutsideClickHandlers(overlay);

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
    overlay.addEventListener('collectible-reward-close', closeHandler);
    
    // 🔥 FIX: Register cleanup to remove event listener
    registerCleanup(() => {
      sheet.removeEventListener('collectible-reward-close', closeHandler);
      overlay.removeEventListener('collectible-reward-close', closeHandler);
    });
    registerCleanup(cleanupCollectibleRewardAnimationTimeouts);
    
    // Animate in
    void showOverlayAnimation(overlay);
    void showSheetAnimation(sheet).then(() => {
      revealCollectibleCardAnimation(sheet, validatedDetail);
    });

    const ctaStartMs = getGameplayModalCtaEnterDelayMs();
    rewardCtaControllers.forEach((controller, index) => {
      scheduleCollectibleRewardAnimation(
        () => void controller.enter(),
        ctaStartMs + index * GAMEPLAY_MODAL_BENCHMARK.companionCtaStaggerMs,
      );
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
  if (!overlay || getIsClosing()) return;

  setClosing(true);
  cleanupRewardSpatialMotion();
  cleanupCollectibleRewardAnimationTimeouts();

  const sheet = overlay.querySelector('.collectible-reward-sheet') as HTMLElement;
  if (!sheet) return;

  const buttons = rewardCtaControllers.map(controller => controller.element);
  const clicked = options.clickedCta ?? buttons[0];
  await runGameplayModalParallelExit(
    () => clicked
      ? exitCtaPair(clicked, buttons.find(button => button !== clicked))
      : Promise.resolve(),
    async () => {
      const overlayExit = hideOverlayAnimation(overlay);
      await Promise.all([hideSheetAnimation(sheet), overlayExit]);
    },
  );
  executeCleanup();
  cleanupOverlay();
  options.onAfterClose?.();
}
