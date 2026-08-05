import { formatGameplayProgressLabel } from './gameplay-terminology.ts';

type JourneyCompletionLogger = {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
};

export type JourneyCompletionFlowOptions = {
  boardNumber: number;
  level: number;
  logger?: JourneyCompletionLogger;
  createNewCardHandoffCover?: () => (() => void);
};

export type JourneyCompletionFlowResult = {
  isFromInterimBoard: boolean;
  cleanupNewCardHandoffCover: (() => void) | null;
};

export function isJourneyInterimCompletionEntryPoint(): boolean {
  if (typeof window === 'undefined') return false;
  const cameFromDetailModal = (window as any).__ccCameFromDetailModal === true;
  if (cameFromDetailModal) return false;

  return (
    (window as any).__ccFromInterimBoard === true ||
    (window as any).__ccIsInterimBoard === true ||
    localStorage.getItem('__ccFromInterimBoard') === 'true'
  );
}

export async function runJourneyCompletionFlow({
  boardNumber,
  level,
  logger,
  createNewCardHandoffCover,
}: JourneyCompletionFlowOptions): Promise<JourneyCompletionFlowResult> {
  let cleanupNewCardHandoffCover: (() => void) | null = null;
  const isFromInterimBoard = isJourneyInterimCompletionEntryPoint();

  try {
    const { journeyBoardsManager } = await import('./journey-boards-manager.js');
    journeyBoardsManager.unlockBoardOnCompletion(boardNumber);
    logger?.info?.(`🗺️ Journey board ${boardNumber} unlocked on completion`);

    if (isFromInterimBoard) {
      try {
        const boardCard = journeyBoardsManager.getBoardById?.(boardNumber);
        const paddedBoardNumber = String(Math.max(1, Math.min(10, boardNumber | 0))).padStart(2, '0');
        cleanupNewCardHandoffCover = createNewCardHandoffCover?.() ?? null;
        const { showJourneyNewCardScreen } = await import('./journey-new-card-screen.js');
        await showJourneyNewCardScreen({
          boardNumber,
          cardImagePath: boardCard?.imagePath || `./assets/colelctibles/common/${paddedBoardNumber}.png`,
          cardName: boardCard?.name || formatGameplayProgressLabel('journey', boardNumber),
        });
        logger?.info?.(`🎁 Journey new card screen completed for board ${boardNumber}`);

        if ((boardNumber | 0) === 2) {
          try {
            const {
              showJourneySpecialDiceScreen,
              isJourneySpecialDiceUnlocked,
            } = await import('./journey-special-dice-screen.js');
            if (!isJourneySpecialDiceUnlocked('flower')) {
              await showJourneySpecialDiceScreen({ diceType: 'flower' });
              logger?.info?.('🎲 Journey special dice unlock screen completed for flower');
            }
          } catch (specialDiceError) {
            logger?.warn?.('⚠️ Journey special dice screen failed, continuing to clean board:', specialDiceError);
          }
        }
      } catch (newCardError) {
        logger?.warn?.('⚠️ Journey new card screen failed, continuing to clean board:', newCardError);
      }
    }

    const { journeyProgressionState } = await import('./journey-progression-state.js');
    const nextLevel = (level | 0) + 1;
    const highestUnlocked = Math.max(
      journeyProgressionState.getHighestUnlockedBoardId() || 1,
      nextLevel
    );
    journeyProgressionState.setHighestUnlockedBoardId(highestUnlocked);
    journeyProgressionState.setLastOpenedBoardId(highestUnlocked);
    journeyProgressionState.clearCurrentRunState();
    logger?.info?.(`🗺️ Journey: Board ${boardNumber} completed - highestUnlocked: ${highestUnlocked}, lastOpened: ${highestUnlocked}`);
  } catch (error) {
    logger?.warn?.('⚠️ Failed to unlock journey board on completion:', error);
  }

  return {
    isFromInterimBoard,
    cleanupNewCardHandoffCover,
  };
}
