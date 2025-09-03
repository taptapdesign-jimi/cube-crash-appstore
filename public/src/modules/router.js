// src/modules/router.js
// Tiny scene/event helper (optional).
export const Bus = (() => {
  const listeners = new Map();
  return {
    on(evt, fn){ const arr = listeners.get(evt) || []; arr.push(fn); listeners.set(evt, arr); },
    off(evt, fn){ const arr = listeners.get(evt) || []; listeners.set(evt, arr.filter(x=>x!==fn)); },
    emit(evt, payload){ (listeners.get(evt) || []).forEach(fn => { try { fn(payload); } catch {} }); }
  };
})();

export const Scenes = {
  BOOT: 'BOOT',
  HOME: 'HOME',
  GAME: 'GAME',
  ACHIEVEMENTS: 'ACHIEVEMENTS',
  SETTINGS: 'SETTINGS',
};
