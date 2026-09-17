import { clearFirstPlayTutorialResumeBlockers } from './first-play-tutorial-dev-reset.js';

/** Lightweight launch policy: importing Homepage must not initialize tutorial/gameplay. */
export const FORCE_NEXT_KEY = 'cc_first_play_tutorial_force_next';
export const DONE_KEY = 'cc_first_play_tutorial_done';

export function isFirstPlayTutorialForced(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  return localStorage.getItem(FORCE_NEXT_KEY) === 'true' || localStorage.getItem(DONE_KEY) !== 'true';
}
export function armFirstPlayTutorial(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  localStorage.setItem(FORCE_NEXT_KEY, 'true');
  localStorage.removeItem(DONE_KEY);
  (window as any).__ccFirstPlayTutorialArmed = true;
}

export function resetFirstPlayTutorialRequest(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  localStorage.removeItem(FORCE_NEXT_KEY);
  localStorage.setItem(DONE_KEY, 'true');
  delete (window as any).__ccFirstPlayTutorialArmed;
}

export function setFirstPlayTutorialDevEnabled(enabled: boolean): void {
  if (enabled) {
    clearFirstPlayTutorialResumeBlockers();
    armFirstPlayTutorial();
  } else {
    resetFirstPlayTutorialRequest();
  }
}
