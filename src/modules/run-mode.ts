export const RUN_MODE_JOURNEY = 'journey' as const;
export const RUN_MODE_ARCADE_HOME = 'arcade_home' as const;

export type RunMode = typeof RUN_MODE_JOURNEY | typeof RUN_MODE_ARCADE_HOME;

function isValidRunMode(mode: any): mode is RunMode {
  return mode === RUN_MODE_JOURNEY || mode === RUN_MODE_ARCADE_HOME;
}

export function setRunMode(mode: RunMode): void {
  if (typeof window === 'undefined') return;
  (window as any).__ccRunMode = mode;
}

export function getRunMode(): RunMode | null {
  if (typeof window === 'undefined') return null;
  const mode = (window as any).__ccRunMode;
  return isValidRunMode(mode) ? mode : null;
}

export function clearRunMode(): void {
  if (typeof window === 'undefined') return;
  delete (window as any).__ccRunMode;
}

export function isArcadeHomeRunMode(): boolean {
  return getRunMode() === RUN_MODE_ARCADE_HOME;
}

function setStorageFlag(key: string, enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(key, 'true');
    } else {
      localStorage.removeItem(key);
    }
  } catch {}
}

export function markArcadeHomeRunOrigin(): void {
  if (typeof window === 'undefined') return;
  const w = window as any;

  setRunMode(RUN_MODE_ARCADE_HOME);

  w.__ccCameFromHomepage = true;
  w.__ccCameFromJourney = false;
  w.__ccFromInterimBoard = false;
  w.__ccIsInterimBoard = false;

  delete w.__ccReturningFromInterimBoard;
  delete w.__ccCameFromDetailModal;
  delete w.__ccDetailModalBoardId;

  setStorageFlag('__ccCameFromHomepage', true);
  setStorageFlag('__ccCameFromJourney', false);
  setStorageFlag('__ccFromInterimBoard', false);
  setStorageFlag('__ccReturningFromInterimBoard', false);
}
