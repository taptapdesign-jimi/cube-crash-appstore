import { RUN_MODE_JOURNEY, setRunMode } from './run-mode.js';
import { emitIOSNativeDiagnostic } from '../utils/ios-native-diagnostic.js';

export interface JourneyOriginOptions {
  fromInterim?: boolean;
  returningFromInterim?: boolean;
  fromDetailModal?: boolean;
  detailBoardId?: number | null;
}

const JOURNEY_CARD_OVERLAY_RETURN_BOARD_KEY = '__ccJourneyCardOverlayReturnBoardId';

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

  delete (window as any)[JOURNEY_CARD_OVERLAY_RETURN_BOARD_KEY];
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.journey-board-card-return-placeholder').forEach((element) => {
      element.classList.remove('journey-board-card-return-placeholder');
    });
  }

  markJourneyGameOrigin({
    fromInterim: false,
    fromDetailModal: true,
    detailBoardId: normalizedBoardId,
  });

  return normalizedBoardId;
}

export function markJourneyCardOverlayReturn(boardId: unknown): number | null {
  if (typeof window === 'undefined') return null;
  const normalizedBoardId = normalizeBoardId(boardId);
  if (!normalizedBoardId) return null;
  clearJourneyDetailReturn();
  (window as any)[JOURNEY_CARD_OVERLAY_RETURN_BOARD_KEY] = normalizedBoardId;
  if (typeof document !== 'undefined') {
    document
      .querySelector(`.journey-board-card[data-board-id="${normalizedBoardId}"]`)
      ?.classList.add('journey-board-card-return-placeholder');
  }
  return normalizedBoardId;
}

export function getJourneyCardOverlayReturnBoardId(): number | null {
  if (typeof window === 'undefined') return null;
  return normalizeBoardId((window as any)[JOURNEY_CARD_OVERLAY_RETURN_BOARD_KEY]);
}

/**
 * Acknowledge the overlay return only after the exact card has landed back in
 * its live Unit. A stale caller cannot clear a newer board's return request.
 */
export function completeJourneyCardOverlayReturn(boardId: unknown): boolean {
  if (typeof window === 'undefined') return false;
  const normalizedBoardId = normalizeBoardId(boardId);
  if (!normalizedBoardId || getJourneyCardOverlayReturnBoardId() !== normalizedBoardId) {
    return false;
  }
  delete (window as any)[JOURNEY_CARD_OVERLAY_RETURN_BOARD_KEY];
  if (typeof document !== 'undefined') {
    document
      .querySelectorAll(`.journey-board-card[data-board-id="${normalizedBoardId}"]`)
      .forEach((element) => element.classList.remove('journey-board-card-return-placeholder'));
  }
  return true;
}

/** Reveal the normal Unit card and retire an intent that cannot safely land. */
export function cancelJourneyCardOverlayReturn(boardId: unknown): boolean {
  const normalizedBoardId = normalizeBoardId(boardId);
  if (!normalizedBoardId || !completeJourneyCardOverlayReturn(normalizedBoardId)) return false;
  if (typeof document !== 'undefined') {
    document
      .querySelectorAll(`.journey-board-card[data-board-id="${normalizedBoardId}"]`)
      .forEach((element) => element.classList.remove('journey-board-card-return-landing'));
  }
  return true;
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

  const overlayReturnBoardId = normalizeBoardId(
    (window as any)[JOURNEY_CARD_OVERLAY_RETURN_BOARD_KEY],
  );
  if (overlayReturnBoardId === normalizedBoardId) {
    clearJourneyDetailReturn();
    return {
      target: 'journey',
      boardId: normalizedBoardId,
      isUnlockedBoard: true,
      isInterim: false,
    };
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

/**
 * A failed Journey board always returns to its containing Journey world.
 * Failure is not a continuation of the board-detail flow, even when the board
 * was originally launched from its detail modal.
 */
export function prepareJourneyFailReturnTarget(boardId: unknown): JourneyReturnDecision {
  const normalizedBoardId = normalizeBoardId(boardId);
  if (typeof window === 'undefined') {
    return { target: 'homepage', boardId: normalizedBoardId, isUnlockedBoard: false, isInterim: false };
  }

  clearJourneyDetailReturn();
  markJourneyGameOrigin({ fromInterim: false });

  // A fail Exit returns to the same world/board area, not to a fresh Journey
  // entry from Homepage. Reuse the established active-area return lifecycle so
  // the viewport is primed hidden and the complete Forest/Beach/Area 55 Unit
  // performs one coordinated standard enter.
  (window as any).__ccReturningFromDetailModal = true;
  // Must be present before any preserved Journey world is scoped/rendered;
  // showCollectibles later consumes it for the single visible return enter.
  (window as any).__ccSuppressJourneyV700AutoWorldEnter = true;
  if (normalizedBoardId) {
    (window as any).__ccJourneyReturnBoardId = normalizedBoardId;
    (window as any).__ccLastActiveJourneyBoardAreaId = normalizedBoardId;
    try { localStorage.setItem('__ccJourneyReturnBoardId', String(normalizedBoardId)); } catch {}
    try { localStorage.setItem('__ccLastActiveJourneyBoardAreaId', String(normalizedBoardId)); } catch {}
  }
  emitIOSNativeDiagnostic('fail-return-prepared', { boardId: normalizedBoardId });

  return {
    target: 'journey',
    boardId: normalizedBoardId,
    isUnlockedBoard: false,
    isInterim: false,
  };
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
