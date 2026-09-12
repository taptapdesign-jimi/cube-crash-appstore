import {
  clearJourneyDetailReturn,
  isJourneyInterimOriginActive,
  markJourneyGameOrigin,
} from './journey-origin-state.js';

export type JourneyReturnPresentation = 'screen' | 'detail-modal';

export interface JourneyReturnRecoveryOptions {
  boardId?: number | null;
  fromInterim?: boolean;
  reason: string;
}

function isVisiblyPainted(element: HTMLElement | null, requirePointerEvents = false): boolean {
  if (!element || !element.isConnected || element.hidden || element.hasAttribute('hidden')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (Number(style.opacity || '1') <= 0.01) return false;
  if (requirePointerEvents && style.pointerEvents === 'none') return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

function isExplicitlyNonPaintable(element: HTMLElement | null): boolean {
  if (!element || !element.isConnected) return true;
  if (element.hidden || element.hasAttribute('hidden')) return true;
  if (element.getAttribute('aria-hidden') === 'true') return true;

  const style = window.getComputedStyle(element);
  return style.display === 'none'
    || style.visibility === 'hidden'
    || Number(style.opacity || '1') <= 0.01;
}

/**
 * Journey and Homepage are mutually exclusive presentation families. Checking
 * the Journey root alone is insufficient because it is intentionally
 * transparent and can expose a stale Homepage/slider underneath it.
 */
export function isHomepageFamilyNonPaintable(root: ParentNode = document): boolean {
  return isExplicitlyNonPaintable(root.querySelector<HTMLElement>('#home'))
    && isExplicitlyNonPaintable(root.querySelector<HTMLElement>('#slider-container'));
}

export function isJourneyDetailModalPresentationReady(
  root: ParentNode = document,
): boolean {
  if (!isHomepageFamilyNonPaintable(root)) return false;
  const modal = root.querySelector<HTMLElement>('#collectibles-detail-modal');
  if (!isVisiblyPainted(modal, true)) return false;

  const visibleContent = [
    modal?.querySelector<HTMLElement>('#detail-close-btn'),
    modal?.querySelector<HTMLElement>('#board-detail-play-button'),
    modal?.querySelector<HTMLElement>('.detail-image-container'),
    modal?.querySelector<HTMLElement>('.detail-content'),
  ];
  return visibleContent.some((element) => isVisiblyPainted(element));
}

export function isJourneyScreenPresentationReady(
  root: ParentNode = document,
): boolean {
  if (!isHomepageFamilyNonPaintable(root)) return false;
  const screen = root.querySelector<HTMLElement>('#journey-screen');
  if (!isVisiblyPainted(screen)) return false;

  const container = screen?.querySelector<HTMLElement>('#journey-boards-container');
  if (!container?.isConnected) return false;

  const view = container.dataset.journeyV700View;
  const selector = view === 'hub'
    ? '.journey-v700-world-card'
    : view === 'world'
      ? '[data-journey-area-id], .journey-board-card-wrapper'
      : '.journey-v700-world-card, [data-journey-area-id], .journey-board-card-wrapper';
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return candidates.some((element) => isVisiblyPainted(element));
}

export function isJourneyReturnPresentationReady(
  presentation: JourneyReturnPresentation,
  root: ParentNode = document,
): boolean {
  return presentation === 'detail-modal'
    ? isJourneyDetailModalPresentationReady(root)
    : isJourneyScreenPresentationReady(root);
}

export async function waitForJourneyReturnPresentation(
  presentation: JourneyReturnPresentation,
  options: { timeoutMs?: number; pollMs?: number; root?: ParentNode } = {},
): Promise<boolean> {
  const timeoutMs = Math.max(0, options.timeoutMs ?? 1600);
  const pollMs = Math.max(16, options.pollMs ?? 50);
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    if (isJourneyReturnPresentationReady(presentation, options.root ?? document)) return true;
    await new Promise<void>((resolve) => window.setTimeout(resolve, pollMs));
  }
  return isJourneyReturnPresentationReady(presentation, options.root ?? document);
}

/**
 * Converts any failed direct-detail/overlay return into the canonical World
 * return contract. The next showCollectibles() call owns rendering and enter.
 */
export function prepareJourneyWorldRecovery(options: JourneyReturnRecoveryOptions): number | null {
  const boardId = normalizeJourneyBoardId(options.boardId);
  const fromInterim = options.fromInterim ?? isJourneyInterimOriginActive();
  const runtime = window as any;

  clearJourneyDetailReturn();
  markJourneyGameOrigin({ fromInterim });
  delete runtime.__ccSuppressJourneyShowForDirectDetailReturn;
  delete runtime.__ccDirectDetailModalReturnActive;

  if (boardId === null) {
    delete runtime.__ccReturningFromDetailModal;
    delete runtime.__ccSuppressJourneyV700AutoWorldEnter;
    delete runtime.__ccJourneyReturnBoardId;
    delete runtime.__ccLastActiveJourneyBoardAreaId;
    try {
      localStorage.removeItem('__ccJourneyReturnBoardId');
      localStorage.removeItem('__ccLastActiveJourneyBoardAreaId');
    } catch {}
    return null;
  }

  runtime.__ccReturningFromDetailModal = true;
  runtime.__ccSuppressJourneyV700AutoWorldEnter = true;
  runtime.__ccJourneyReturnBoardId = boardId;
  runtime.__ccLastActiveJourneyBoardAreaId = boardId;
  try {
    localStorage.setItem('__ccJourneyReturnBoardId', String(boardId));
    localStorage.setItem('__ccLastActiveJourneyBoardAreaId', String(boardId));
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent('cc-journey-return-recovery', {
      detail: { boardId, reason: options.reason },
    }));
  } catch {}
  return boardId;
}
import { normalizeJourneyBoardId } from './journey-world-definitions.js';
