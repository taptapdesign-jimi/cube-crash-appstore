// src/modules/modes.js
// Game mode helpers (logic-only; UI-free).
export const MODES = {
  ENDLESS: 'ENDLESS',
  TIMED_30S: 'TIMED_30S',
  MOVES_30: 'MOVES_30',
};

export function createModeState(mode = MODES.ENDLESS) {
  const state = { mode, timeLeft: 30_000, movesLeft: 30 };
  if (mode === MODES.ENDLESS) { delete state.timeLeft; delete state.movesLeft; }
  return state;
}

export function onMergeTick(state, { isSixMerge = false } = {}) {
  if (state.mode === MODES.MOVES_30) {
    state.movesLeft = Math.max(0, (state.movesLeft || 0) - 1);
  }
  // timed mode is decreased via onTimeTick()
}

export function onTimeTick(state, dtMs) {
  if (state.mode === MODES.TIMED_30S) {
    state.timeLeft = Math.max(0, (state.timeLeft || 0) - dtMs);
  }
}

export function isGameOver(state, { hasAnyMergePossible } = {}) {
  if (state.mode === MODES.ENDLESS) return !hasAnyMergePossible;
  if (state.mode === MODES.TIMED_30S) return (state.timeLeft || 0) <= 0;
  if (state.mode === MODES.MOVES_30)  return (state.movesLeft || 0) <= 0;
  return false;
}
