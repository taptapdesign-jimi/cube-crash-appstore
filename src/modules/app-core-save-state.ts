import { snapshotRunComboBonus } from './run-combo-bonus.ts';

type SaveStateDeps = {
  gridSnapshot: any[][];
  score: number;
  level: number;
  boardNumber: number;
  moves: number;
  wildMeter: number;
  wildSpawnCount: number;
  bestScore: number;
  starsCount: number;
  MOVES_MAX: number;
  devLog: (...args: any[]) => void;
};

export function buildSaveState({
  gridSnapshot,
  score,
  level,
  boardNumber,
  moves,
  wildMeter,
  wildSpawnCount,
  bestScore,
  starsCount,
  MOVES_MAX,
  devLog,
}: SaveStateDeps){
  const currentState = {
    grid: gridSnapshot,
    score: Number.isFinite(score) ? score : 0,
    level: Number.isFinite(level) ? level : 1,
    boardNumber: Number.isFinite(boardNumber) ? boardNumber : (Number.isFinite(level) ? level : 1),
    moves: Number.isFinite(moves) ? moves : MOVES_MAX,
    wildMeter: Number.isFinite(wildMeter) ? wildMeter : 0,
    wildSpawnCount: Number.isFinite(wildSpawnCount) ? Math.max(0, Math.trunc(wildSpawnCount)) : 0,
    bestScore: Number.isFinite(bestScore) ? bestScore : 0,
    starsCount: Number.isFinite(starsCount) ? starsCount : 0,
    runComboBonus: snapshotRunComboBonus(boardNumber),
    timestamp: Date.now(),
  };

  devLog('💾 Saving game state:', {
    gridRows: currentState.grid.length,
    gridCols: currentState.grid[0]?.length || 0,
    score: currentState.score,
    level: currentState.level,
    boardNumber: currentState.boardNumber,
    moves: currentState.moves,
    wildMeter: currentState.wildMeter,
    wildSpawnCount: currentState.wildSpawnCount,
  });

  return currentState;
}

/** Remembers only successful writes; timestamps do not make unchanged gameplay dirty. */
export function createGameSaveWriter() {
  let previous: { key: string; content: string; serialized: string } | null = null;
  const contentOf = (state: Record<string, unknown>) => {
    const { timestamp: _timestamp, ...content } = state;
    return JSON.stringify(content);
  };
  return {
    reset() { previous = null; },
    remember(key: string, serialized: string | null) {
      previous = null;
      if (!serialized) return;
      try {
        const state = JSON.parse(serialized);
        if (state && typeof state === 'object' && !Array.isArray(state)) {
          previous = { key, content: contentOf(state), serialized };
        }
      } catch { /* A malformed stored record must never suppress a repair write. */ }
    },
    write(key: string, state: Record<string, unknown>, storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
      const content = contentOf(state);
      // Verify the durable copy still exists: completion/reset can remove a save externally.
      if (previous?.key === key && previous.content === content &&
          storage.getItem(key) === previous.serialized) return false;
      const serialized = JSON.stringify(state);
      storage.setItem(key, serialized);
      previous = { key, content, serialized };
      return true;
    },
  };
}
