import { gsap } from 'gsap';
import { smokeBubblesAtCard } from './journey-card-idle-bounce.js';

export const JOURNEY_MOTION = {
  viewportTargetSelector: [
    '.journey-board-card-wrapper',
    '.journey-forest-main-art',
    '.journey-forest-cloud-art',
    '.journey-forest-island-art',
    '.journey-forest-stump-art',
    '.journey-forest-star-art',
  ].join(', '),
  viewportMaxTargets: 44,
  viewportExitMaxTargets: 96,
  viewportMarginPx: 180,
  viewportExitMarginPx: 48,
  cardPunchScale: 1.12,
  cardPunchDuration: 0.14,
  cardPunchEase: 'back.out(2.4)',
  cardShrinkScale: 0,
  cardShrinkDuration: 0.46,
  cardShrinkEase: 'back.in(1.7)',
  targetExitMinScale: 0.04,
  screenExitTailDuration: 0.01,
  screenExitTailDelay: 0,
  headerExitLeadSeconds: 0.42,
  headerExitCompletePad: 0.12,
} as const;

export const JOURNEY_MOTION_TRACE_ENABLED = true;

export type JourneyViewportTransitionOptions = {
  excludeActiveArea: boolean;
  includeHiddenPrepared: boolean;
  maxTargets?: number;
  viewportMarginPx?: number;
};

export type JourneyViewportEnterStart = {
  scale: number;
  y: number;
  duration: number;
  ease: string;
};

export type JourneyViewportExitSpec = {
  punchScale: number;
  punchDuration: number;
  punchEase: string;
  exitScale: number;
  exitY: number;
  exitDuration: number;
  exitEase: string;
};

function getTraceElementSnapshot(element: HTMLElement): Record<string, unknown> {
  const rect = element.getBoundingClientRect();
  return {
    className: element.className,
    boardId: element.querySelector?.('.journey-board-card')?.getAttribute('data-board-id') ??
      element.getAttribute('data-board-id') ??
      null,
    areaId: element.dataset?.journeyAreaId ?? null,
    prepared: element.dataset?.ccJourneyEnterPrepared === 'true',
    visibility: element.style.visibility || null,
    opacity: element.style.opacity || null,
    transform: element.style.transform || null,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
}

export function traceJourneyMotion(label: string, data: Record<string, unknown> = {}): void {
  if (!JOURNEY_MOTION_TRACE_ENABLED && (window as any).__ccJourneyMotionTrace !== true) return;
  try {
    console.info('🧪 JourneyMotionTrace', {
      label,
      t: Math.round(performance.now()),
      activeBoardId: getActiveJourneyBoardAreaId(),
      returningFromDetailModal: (window as any).__ccReturningFromDetailModal === true,
      returningFromInterimBoard:
        (window as any).__ccReturningFromInterimBoard === true ||
        localStorage.getItem('__ccReturningFromInterimBoard') === 'true',
      activeAreaEnterPending: (window as any).__ccJourneyActiveAreaEnterPending === true,
      viewportEnterAnimating: (window as any).__ccJourneyViewportEnterAnimating === true,
      viewportTransitionLocked: (window as any).__ccJourneyViewportTransitionLocked === true,
      ...data,
    });
  } catch {}
}

export function getActiveJourneyBoardAreaId(): number | null {
  try {
    const raw =
      (window as any).__ccLastActiveJourneyBoardAreaId ??
      localStorage.getItem('__ccLastActiveJourneyBoardAreaId');
    const boardId = Number(raw || 0);
    return Number.isFinite(boardId) && boardId > 0 ? boardId : null;
  } catch {
    return null;
  }
}

export function isActiveJourneyBoardAreaEnterPending(): boolean {
  try {
    return (window as any).__ccJourneyActiveAreaEnterPending === true;
  } catch {
    return false;
  }
}

export function isActiveJourneyAreaElement(element: HTMLElement, boardId: number | null): boolean {
  if (!boardId) return false;
  if (element.classList.contains(`journey-forest-island-${boardId}`)) return true;
  if (element.classList.contains(`journey-forest-stump-${boardId}`)) return true;
  if (element.classList.contains(`journey-forest-star-board-${boardId}`)) return true;
  if (element.classList.contains(`journey-forest-cloud-board-${boardId}`)) return true;
  const card = element.matches('.journey-board-card-wrapper')
    ? element.querySelector('.journey-board-card')
    : element.closest('.journey-board-card-wrapper')?.querySelector('.journey-board-card');
  return (card as HTMLElement | null)?.dataset?.boardId === String(boardId);
}

export function isJourneyElementViewportVisible(element: HTMLElement, viewportMargin = 32): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0.01) {
    return false;
  }
  return rect.bottom >= -viewportMargin &&
    rect.top <= window.innerHeight + viewportMargin &&
    rect.right >= -viewportMargin &&
    rect.left <= window.innerWidth + viewportMargin;
}

export function selectJourneyViewportTransitionTargets(
  journeyScreen: HTMLElement,
  opts: JourneyViewportTransitionOptions
): HTMLElement[] {
  const activeBoardId = getActiveJourneyBoardAreaId();
  const viewportMarginPx = opts.viewportMarginPx ?? JOURNEY_MOTION.viewportMarginPx;
  const maxTargets = opts.maxTargets ?? JOURNEY_MOTION.viewportMaxTargets;
  const candidates = Array.from(
    journeyScreen.querySelectorAll(JOURNEY_MOTION.viewportTargetSelector)
  ) as HTMLElement[];

  const uniqueTargets = Array.from(new Set(candidates))
    .filter((element) => {
      if (!document.body.contains(element)) return false;
      if ((element as any).__ccJourneyToGameExitTween === true) return false;
      if (opts.excludeActiveArea && isActiveJourneyAreaElement(element, activeBoardId)) return false;
      if (opts.includeHiddenPrepared && element.dataset.ccJourneyEnterPrepared === 'true') {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom >= -viewportMarginPx &&
          rect.top <= window.innerHeight + viewportMarginPx &&
          rect.right >= -viewportMarginPx &&
          rect.left <= window.innerWidth + viewportMarginPx;
      }
      return isJourneyElementViewportVisible(element, viewportMarginPx);
    })
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const aStrictlyVisible = aRect.bottom >= 0 && aRect.top <= window.innerHeight && aRect.right >= 0 && aRect.left <= window.innerWidth;
      const bStrictlyVisible = bRect.bottom >= 0 && bRect.top <= window.innerHeight && bRect.right >= 0 && bRect.left <= window.innerWidth;
      if (aStrictlyVisible !== bStrictlyVisible) return aStrictlyVisible ? -1 : 1;
      const viewportCenter = window.innerHeight * 0.5;
      return Math.abs((aRect.top + aRect.height * 0.5) - viewportCenter) -
        Math.abs((bRect.top + bRect.height * 0.5) - viewportCenter);
    });

  const selectedTargets = uniqueTargets.slice(0, maxTargets);
  traceJourneyMotion('viewport-targets-selected', {
    excludeActiveArea: opts.excludeActiveArea,
    includeHiddenPrepared: opts.includeHiddenPrepared,
    maxTargets,
    viewportMarginPx,
    candidateCount: candidates.length,
    eligibleCount: uniqueTargets.length,
    selectedCount: selectedTargets.length,
    truncatedCount: Math.max(0, uniqueTargets.length - selectedTargets.length),
    targets: selectedTargets.slice(0, 18).map(getTraceElementSnapshot),
  });
  return selectedTargets;
}

export function getJourneyViewportEnterStart(target: HTMLElement): JourneyViewportEnterStart {
  const exitSpec = getJourneyViewportExitSpec(target);
  const isCard = target.classList.contains('journey-board-card-wrapper');
  const isLargeWorldArt = target.classList.contains('journey-forest-main-art');
  return {
    scale: exitSpec.exitScale,
    y: exitSpec.exitY,
    duration: exitSpec.exitDuration + exitSpec.punchDuration,
    ease: isCard ? JOURNEY_MOTION.cardPunchEase : isLargeWorldArt ? 'back.out(1.15)' : 'back.out(1.25)',
  };
}

export function getJourneyViewportExitSpec(target: HTMLElement): JourneyViewportExitSpec {
  const isLargeWorldArt = target.classList.contains('journey-forest-main-art');
  const isCard = target.classList.contains('journey-board-card-wrapper');
  return {
    punchScale: isLargeWorldArt ? 1.015 : isCard ? JOURNEY_MOTION.cardPunchScale : 1.08,
    punchDuration: isLargeWorldArt ? 0.08 : JOURNEY_MOTION.cardPunchDuration,
    punchEase: isLargeWorldArt ? 'power2.out' : JOURNEY_MOTION.cardPunchEase,
    exitScale: isLargeWorldArt ? 0.78 : isCard ? JOURNEY_MOTION.cardShrinkScale : JOURNEY_MOTION.targetExitMinScale,
    exitY: isLargeWorldArt ? 18 : 0,
    exitDuration: isLargeWorldArt ? 0.42 : isCard ? JOURNEY_MOTION.cardShrinkDuration : 0.44,
    exitEase: isLargeWorldArt ? 'back.in(1.15)' : isCard ? JOURNEY_MOTION.cardShrinkEase : 'back.in(1.25)',
  };
}

export function emitJourneyCardExitSmoke(card: HTMLElement | null | undefined): void {
  if (!card || !card.parentElement) return;
  traceJourneyMotion('card-exit-smoke-request', {
    boardId: card.getAttribute('data-board-id'),
    isInterim: card.classList.contains('interim'),
    className: card.className,
    snapshot: getTraceElementSnapshot(card),
  });
  try {
    smokeBubblesAtCard(card, {
      sizeScale: 0.62,
      distanceScale: 0.62,
      countScale: 0.42,
      haloScale: 0.62,
      strength: 2.0,
      trailAlpha: 0.92,
      baseAlpha: 0.92,
      allowOverlap: true,
      allowNonInterim: true,
      activeLockMs: 180,
      fadeOutTime: 0.72,
      cleanupTime: 1.25,
    });
  } catch {}
}

export function primeJourneyMotionTarget(target: HTMLElement): void {
  target.style.transformOrigin = '50% 50%';
  target.style.willChange = 'transform, opacity';
  target.style.pointerEvents = 'none';
  target.style.transition = 'none';
  target.style.opacity = '1';
  target.style.visibility = 'visible';
  try {
    gsap.set(target, {
      scale: 1,
      opacity: 1,
      y: 0,
      visibility: 'visible',
      force3D: true,
      overwrite: true,
    });
  } catch {}
}
