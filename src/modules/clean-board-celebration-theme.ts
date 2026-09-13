import {
  getJourneyWorldDefinition,
  getJourneyWorldIdForBoard,
} from './journey-world-definitions';
import { RUN_MODE_JOURNEY, type RunMode } from './run-mode';

export type CleanBoardCelebrationTheme = 'forest' | 'beach' | 'area55';

export function resolveCleanBoardCelebrationTheme(options: {
  boardNumber: number;
  runMode: RunMode | null;
}): CleanBoardCelebrationTheme {
  // Arcade has no Journey World. Its existing neutral/result presentation
  // deliberately keeps the accepted classic (Area 55) confetti fallback.
  if (options.runMode !== RUN_MODE_JOURNEY) return 'area55';

  const boardId = Math.trunc(Number.isFinite(options.boardNumber) ? options.boardNumber : 0);
  const worldId = getJourneyWorldIdForBoard(boardId);
  const animationTheme = getJourneyWorldDefinition(worldId ?? 0)?.animationTheme;
  return animationTheme === 'forest' || animationTheme === 'beach' || animationTheme === 'area55'
    ? animationTheme
    : 'area55';
}
