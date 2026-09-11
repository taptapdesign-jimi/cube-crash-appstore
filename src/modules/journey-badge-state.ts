export const JOURNEY_BOARDS_STATE_STORAGE_KEY = 'journey_boards_state';
export const JOURNEY_VIEWED_BOARDS_STORAGE_KEY = 'journey_viewed_boards';
export const JOURNEY_LAYOUT_STATE_VERSION_STORAGE_KEY = 'journey_forest_layout_state_version';
export const JOURNEY_LAYOUT_STATE_VERSION = 'forest-board-1-interim-v1';

type JourneyBadgeStorage = Pick<Storage, 'getItem'>;

type PersistedJourneyBoard = {
  id: number;
  unlocked: boolean;
};

function readPersistedBoards(storage: JourneyBadgeStorage): PersistedJourneyBoard[] | null {
  const raw = storage.getItem(JOURNEY_BOARDS_STATE_STORAGE_KEY);
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return null;

  const boards: PersistedJourneyBoard[] = [];
  const seenIds = new Set<number>();

  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== 'object') return null;

    const id = Number((candidate as { id?: unknown }).id);
    const unlocked = (candidate as { unlocked?: unknown }).unlocked;
    if (!Number.isInteger(id) || id < 1 || typeof unlocked !== 'boolean') return null;
    if (seenIds.has(id)) continue;

    seenIds.add(id);
    boards.push({ id, unlocked });
  }

  return boards;
}

function readViewedBoardIds(storage: JourneyBadgeStorage): Set<number> | null {
  const raw = storage.getItem(JOURNEY_VIEWED_BOARDS_STORAGE_KEY) || '[]';
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return null;

  return new Set(
    parsed
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value >= 1),
  );
}

/**
 * Reads the Journey navigation badge directly from its persisted state.
 * Homepage callers must stay independent from the full Journey renderer so a
 * badge refresh cannot instantiate the 30-Unit manager during app cold start.
 */
export function getPersistedJourneyNewlyUnlockedCount(
  storage: JourneyBadgeStorage = localStorage,
): number {
  try {
    const layoutVersion = storage.getItem(JOURNEY_LAYOUT_STATE_VERSION_STORAGE_KEY);
    if (layoutVersion !== JOURNEY_LAYOUT_STATE_VERSION) return 0;

    const boards = readPersistedBoards(storage);
    const viewedBoardIds = readViewedBoardIds(storage);
    if (!boards || !viewedBoardIds) return 0;

    return boards.reduce((count, board) => (
      board.unlocked && !viewedBoardIds.has(board.id) ? count + 1 : count
    ), 0);
  } catch {
    return 0;
  }
}
