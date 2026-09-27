const unlockBoardOnCompletion = jest.fn();
const getBoardById = jest.fn(() => ({ name: 'Test Card', imagePath: './card.png' }));
const showJourneyNewCardScreen = jest.fn(async () => ({ action: 'cancelled' as const }));
const setHighestUnlockedBoardId = jest.fn();
const setLastOpenedBoardId = jest.fn();
const clearCurrentRunState = jest.fn();

jest.mock('../journey-boards-manager.js', () => ({
  journeyBoardsManager: { unlockBoardOnCompletion, getBoardById },
}));
jest.mock('../journey-new-card-screen.js', () => ({ showJourneyNewCardScreen }));
jest.mock('../journey-progression-state.js', () => ({
  journeyProgressionState: {
    getHighestUnlockedBoardId: jest.fn(() => 12),
    setHighestUnlockedBoardId,
    setLastOpenedBoardId,
    clearCurrentRunState,
  },
}));
import { runJourneyCompletionFlow } from '../journey-completion-flow';
import { boardStatsService } from '../../services/board-stats-service';
import * as cardAssets from '../journey-card-assets';

describe('Journey completion cancellation ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (window as any).__ccFromInterimBoard = true;
    showJourneyNewCardScreen.mockResolvedValue({ action: 'cancelled' });
    jest.spyOn(boardStatsService, 'getBoardStats').mockReturnValue({ highScore: 0 } as any);
    jest.spyOn(cardAssets, 'resolveJourneyCardAsset').mockReturnValue({
      path1x: './card.png', path2x: './card@2x.png', rarity: 'common',
    } as any);
  });

  afterEach(() => {
    delete (window as any).__ccFromInterimBoard;
  });

  test('a cancelled delayed Reward cannot clear or retarget a successor run', async () => {
    const cleanupCover = jest.fn();
    const warn = jest.fn();
    const result = await runJourneyCompletionFlow({
      boardNumber: 12,
      level: 12,
      createNewCardHandoffCover: () => cleanupCover,
      logger: { warn },
    });

    expect(warn).not.toHaveBeenCalled();
    expect(showJourneyNewCardScreen).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      isFromInterimBoard: true,
      cleanupNewCardHandoffCover: null,
      cancelled: true,
    });
    expect(cleanupCover).toHaveBeenCalledTimes(1);
    expect(setHighestUnlockedBoardId).not.toHaveBeenCalled();
    expect(setLastOpenedBoardId).not.toHaveBeenCalled();
    expect(clearCurrentRunState).not.toHaveBeenCalled();
  });
});
