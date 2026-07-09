import { RUN_MODE_JOURNEY, setRunMode } from './run-mode.js';

export interface JourneyOriginOptions {
  fromInterim?: boolean;
  returningFromInterim?: boolean;
  fromDetailModal?: boolean;
  detailBoardId?: number | null;
}

export type JourneyReturnTarget = 'homepage' | 'journey' | 'detail-modal';

export interface JourneyReturnDecision {
  target: JourneyReturnTarget;
  boardId: number | null;
  isUnlockedBoard: boolean;
  isInterim: boolean;
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

function normalizeBoardId(boardId: unknown): number | null {
  const value = Number(boardId);
  if (!Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized >= 1 && normalized <= 30 ? normalized : null;
}

export function markJourneyGameOrigin(opts: JourneyOriginOptions = {}): void {
  if (typeof window === 'undefined') return;

  const w = window as any;
  const fromInterim = opts.fromInterim === true;

  setRunMode(RUN_MODE_JOURNEY);
  w.__ccCameFromJourney = true;
  w.__ccCameFromHomepage = false;
  setStorageFlag('__ccCameFromJourney', true);
  setStorageFlag('__ccCameFromHomepage', false);

  w.__ccFromInterimBoard = fromInterim;
  w.__ccIsInterimBoard = fromInterim;
  setStorageFlag('__ccFromInterimBoard', fromInterim);

  if (opts.returningFromInterim === true) {
    w.__ccReturningFromInterimBoard = true;
    setStorageFlag('__ccReturningFromInterimBoard', true);
  } else if (!fromInterim) {
    delete w.__ccReturningFromInterimBoard;
    setStorageFlag('__ccReturningFromInterimBoard', false);
  }

  if (opts.fromDetailModal === true) {
    w.__ccCameFromDetailModal = true;
    if (Number.isFinite(opts.detailBoardId as number)) {
      w.__ccDetailModalBoardId = opts.detailBoardId;
    }
  }
}

export function markJourneyDetailReturn(boardId: unknown): number | null {
  if (typeof window === 'undefined') return null;
  const normalizedBoardId = normalizeBoardId(boardId);
  if (!normalizedBoardId) return null;

  markJourneyGameOrigin({
    fromInterim: false,
    fromDetailModal: true,
    detailBoardId: normalizedBoardId,
  });

  return normalizedBoardId;
}

export function clearJourneyDetailReturn(): void {
  if (typeof window === 'undefined') return;
  const w = window as any;
  delete w.__ccCameFromDetailModal;
  delete w.__ccDetailModalBoardId;
}

export function isJourneyInterimOriginActive(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return w.__ccFromInterimBoard === true
    || w.__ccIsInterimBoard === true
    || localStorage.getItem('__ccFromInterimBoard') === 'true';
}

export async function resolveJourneyReturnTarget(boardId: unknown): Promise<JourneyReturnDecision> {
  if (typeof window === 'undefined') {
    return { target: 'homepage', boardId: null, isUnlockedBoard: false, isInterim: false };
  }

  const normalizedBoardId = normalizeBoardId(boardId);
  if (!isJourneyOriginActive()) {
    return { target: 'homepage', boardId: normalizedBoardId, isUnlockedBoard: false, isInterim: false };
  }

  const isInterim = isJourneyInterimOriginActive();
  if (!normalizedBoardId || isInterim) {
    clearJourneyDetailReturn();
    markJourneyGameOrigin({ fromInterim: isInterim });
    return { target: 'journey', boardId: normalizedBoardId, isUnlockedBoard: false, isInterim };
  }

  try {
    const { journeyBoardsManager } = await import('./journey-boards-manager.js');
    const board = journeyBoardsManager.getBoardById?.(normalizedBoardId);
    if (board?.unlocked === true) {
      markJourneyDetailReturn(normalizedBoardId);
      return { target: 'detail-modal', boardId: normalizedBoardId, isUnlockedBoard: true, isInterim: false };
    }
  } catch {}

  clearJourneyDetailReturn();
  markJourneyGameOrigin({ fromInterim: false });
  return { target: 'journey', boardId: normalizedBoardId, isUnlockedBoard: false, isInterim: false };
}

export function clearJourneyInterimOrigin(): void {
  if (typeof window === 'undefined') return;
  const w = window as any;
  w.__ccFromInterimBoard = false;
  w.__ccIsInterimBoard = false;
  delete w.__ccReturningFromInterimBoard;
  setStorageFlag('__ccFromInterimBoard', false);
  setStorageFlag('__ccReturningFromInterimBoard', false);
}

export function isJourneyOriginActive(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return w.__ccCameFromJourney === true
    || isJourneyInterimOriginActive()
    || localStorage.getItem('__ccCameFromJourney') === 'true'
    || localStorage.getItem('__ccFromInterimBoard') === 'true';
}
