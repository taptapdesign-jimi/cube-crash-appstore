// src/modules/achievements.js
import store from './storage.js';
import { ACHIEVEMENTS } from './achievements-config.js';

const KEY = 'achievements_v1';

let unlocked = new Set(store.get(KEY, []));

function save() { store.set(KEY, Array.from(unlocked)); }

export function resetAll() { unlocked = new Set(); save(); }

export function isUnlocked(id) { return unlocked.has(id); }

export function getUnlocked() { return Array.from(unlocked); }

export function onSmallMerge(streakCount) {
  if (streakCount >= 5) unlock('chain_keeper');
}

export function onSixMerge(stackDepth) {
  unlock('first_six');
  if (stackDepth >= 4) unlock('stack_master');
}

export function onRunStats({ score, moves }) {
  if (score >= 10000) unlock('score_10k');
  if (moves >= 50)    unlock('iron_focus');
}


function unlock(id) {
  if (isUnlocked(id)) return false;
  const exists = ACHIEVEMENTS.some(a => a.id === id);
  if (!exists) return false;
  unlocked.add(id);
  save();
  return true;
}

export default {
  isUnlocked, getUnlocked, resetAll,
  onSmallMerge, onSixMerge, onRunStats,
};
