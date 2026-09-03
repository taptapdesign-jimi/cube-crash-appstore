export const JOURNEY_STAGES_PER_WORLD = 10;

export interface JourneyWorldStageState {
  id: number;
  unlocked: boolean;
  interim?: boolean;
}

export type JourneyWorldCardPresentation = 'unlocked' | 'interim' | 'locked';

export function getJourneyWorldCardPresentation(
  board: Pick<JourneyWorldStageState, 'unlocked' | 'interim'>,
): JourneyWorldCardPresentation {
  // A completed Unit must never remain visually interim if an older mounted
  // Journey tree still carries both states during the gameplay return handoff.
  if (board.unlocked) return 'unlocked';
  if (board.interim) return 'interim';
  return 'locked';
}

export function getJourneyWorldStageNumber(boardId: number): number {
  const safeBoardId = Math.max(1, Math.trunc(Number.isFinite(boardId) ? boardId : 1));
  return ((safeBoardId - 1) % JOURNEY_STAGES_PER_WORLD) + 1;
}

export function formatJourneyWorldStageNumber(boardId: number): string {
  return String(getJourneyWorldStageNumber(boardId)).padStart(2, '0');
}

/**
 * Keep Journey save IDs global (1-30), while giving every World its own
 * independent next-stage marker. A completed World has no interim card.
 */
export function reconcileJourneyWorldInterims<T extends JourneyWorldStageState>(boards: T[]): number[] {
  boards.forEach((board) => {
    board.interim = false;
  });

  const worldCount = Math.ceil(boards.length / JOURNEY_STAGES_PER_WORLD);
  const interimBoardIds: number[] = [];
  for (let worldIndex = 0; worldIndex < worldCount; worldIndex += 1) {
    const start = worldIndex * JOURNEY_STAGES_PER_WORLD + 1;
    const end = start + JOURNEY_STAGES_PER_WORLD - 1;
    const worldBoards = boards
      .filter((board) => board.id >= start && board.id <= end)
      .sort((a, b) => a.id - b.id);
    if (worldBoards.length === 0 || worldBoards.every((board) => board.unlocked)) continue;

    const highestUnlockedId = worldBoards.reduce(
      (highest, board) => board.unlocked ? Math.max(highest, board.id) : highest,
      start - 1,
    );
    const nextBoard = worldBoards.find((board) => !board.unlocked && board.id > highestUnlockedId)
      ?? worldBoards.find((board) => !board.unlocked);
    if (!nextBoard) continue;
    nextBoard.interim = true;
    interimBoardIds.push(nextBoard.id);
  }

  return interimBoardIds;
}
