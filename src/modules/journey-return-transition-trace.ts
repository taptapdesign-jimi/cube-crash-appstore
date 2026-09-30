import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';
import { beginJourneyTerminalPreparationPerformance, type JourneyTerminalPreparationPerformance } from './journey-terminal-preparation-performance.js';

type JourneyReturnSource = 'clean-board' | 'fail';

let generation = 0;
let prewarmGeneration = 0;
let activePrewarm: {
  id: number;
  ownerToken: number;
  source: JourneyReturnSource;
  boardId: number;
} | null = null;
let active: {
  id: number;
  source: JourneyReturnSource;
  boardId: number;
  startedAt: number;
  firstUnitStarted: boolean;
  resultExitCompletedAt: number | null;
  prewarmOwnerToken: number | null;
  preparation: JourneyTerminalPreparationPerformance | null;
  finishCtaSetup: (() => void) | undefined;
} | null = null;

function isActiveTransition(transitionId: number): boolean {
  return active?.id === transitionId;
}

export function beginJourneyReturnTransition(source: JourneyReturnSource, boardId: number): number {
  // A settled-result prewarm may already have built the expensive World DOM.
  // Retire only its async request ownership here; the prepared DOM/plan is
  // deliberately left in place so the accepted transition can adopt it.
  const prewarmOwnerToken = activePrewarm?.ownerToken ?? null;
  prewarmGeneration += 1;
  activePrewarm = null;
  active?.preparation?.finish('replaced');
  const id = ++generation;
  const preparation = beginJourneyTerminalPreparationPerformance(id, source, boardId);
  active = {
    id,
    source,
    boardId: Number.isFinite(boardId) ? boardId : 0,
    startedAt: performance.now(),
    firstUnitStarted: false,
    resultExitCompletedAt: null,
    prewarmOwnerToken,
    preparation,
    finishCtaSetup: preparation?.start('cta-synchronous'),
  };
  markJourneyReturnTransition('cta-accepted');
  return id;
}

/**
 * Build the cold Journey destination while the result is settled and before
 * Exit can be activated. This deliberately skips the paint-warm lease: the
 * accepted transition acquires that lease later with its own generation token.
 */
export async function prewarmJourneyReturnBeforeTerminalExit(
  source: JourneyReturnSource,
  boardId: number,
): Promise<boolean> {
  const id = ++prewarmGeneration;
  const ownerToken = -id;
  activePrewarm = {
    id,
    ownerToken,
    source,
    boardId: Number.isFinite(boardId) ? boardId : 0,
  };
  try {
    const { journeyBoardsManager } = await import('./journey-boards-manager.js');
    if (activePrewarm?.id !== id) return false;
    const prepared = journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn?.(
      `terminal-settled:${source}`,
      ownerToken,
      null,
      { warmPaint: false },
    ) === true;
    if (!prepared && activePrewarm?.id === id) activePrewarm = null;
    return prepared;
  } catch {
    if (activePrewarm?.id === id) activePrewarm = null;
    return false;
  }
}

export function cancelJourneyReturnPrewarm(reason: string): void {
  const ownerToken = activePrewarm?.ownerToken ?? null;
  const cancellationGeneration = ++prewarmGeneration;
  activePrewarm = null;
  if (ownerToken === null) return;
  void import('./journey-boards-manager.js').then(({ journeyBoardsManager }) => {
    // A replacement modal may have started a newer prewarm while this import
    // was pending. Never let old cleanup cancel that newer prepared plan.
    if (prewarmGeneration !== cancellationGeneration || activePrewarm !== null) return;
    journeyBoardsManager.cancelPreparedJourneyV700WorldEnter?.(ownerToken, reason);
  }).catch(() => {});
}

export function measureJourneyReturnPreparationPhase<T>(transitionId: number | null, name: string, work: () => T): T {
  const capture = active?.id === transitionId ? active.preparation : null;
  return capture ? capture.phase(name, work) : work();
}

export function finishJourneyReturnCtaSetup(transitionId: number | null): void {
  if (active?.id === transitionId) active.finishCtaSetup?.();
}

export function markJourneyReturnTransition(
  event: string,
  detail: Record<string, unknown> = {},
): void {
  if (!active) return;
  emitNativeConsoleDiagnostic('[CC_JOURNEY_RETURN]', event, {
    transitionId: active.id,
    source: active.source,
    boardId: active.boardId,
    elapsedMs: Math.round(performance.now() - active.startedAt),
    ...detail,
  });
}

/** Only the terminal visual owner may release the immediate Journey reveal. */
export function markJourneyReturnResultExitComplete(transitionId: number | null): void {
  if (!active || active.id !== transitionId) return;
  active.resultExitCompletedAt = performance.now();
  markJourneyReturnTransition('result-last-visible');
}

export function getJourneyReturnRevealToken(): number | null {
  return active?.resultExitCompletedAt != null ? active.id : null;
}

/** Warm terminal returns are already primed; cold navigation keeps its paint boundary. */
export function scheduleJourneyReturnReveal(
  transitionId: number | null,
  isPresentationCurrent: () => boolean,
  reveal: () => void,
): void {
  const run = (): void => {
    if (!isPresentationCurrent()) return;
    if (transitionId !== null && getJourneyReturnRevealToken() !== transitionId) return;
    reveal();
  };
  if (transitionId !== null) run();
  else requestAnimationFrame(run);
}

export function markJourneyReturnFirstUnitStart(detail: Record<string, unknown> = {}): void {
  if (!active || active.firstUnitStarted) return;
  active.firstUnitStarted = true;
  const resultToFirstUnitMs = active.resultExitCompletedAt === null
    ? null
    : Math.round(performance.now() - active.resultExitCompletedAt);
  const postResultBudgetMs = 33;
  markJourneyReturnTransition('first-world-unit-start', {
    resultToFirstUnitMs,
    budgetMs: postResultBudgetMs,
    withinBudget: resultToFirstUnitMs !== null && resultToFirstUnitMs <= postResultBudgetMs,
    ...detail,
  });
}

export function completeJourneyReturnTransition(
  detail: Record<string, unknown> = {},
  transitionId?: number | null,
): void {
  if (!active) return;
  // Runtime completions must prove ownership. A normal/non-terminal World
  // enter passes null and may not retire an active terminal return; tests and
  // explicit teardown may omit the argument to clear the current record.
  if (transitionId !== undefined && active.id !== transitionId) return;
  active.preparation?.finish('enter-complete');
  markJourneyReturnTransition('enter-complete', detail);
  active = null;
}

export function cancelJourneyReturnTransition(transitionId: number | null, reason: string): void {
  const ownedTransitionId = transitionId ?? active?.id ?? null;
  if (ownedTransitionId === null || !isActiveTransition(ownedTransitionId)) return;
  const prewarmOwnerToken = active?.prewarmOwnerToken ?? null;
  active?.preparation?.finish(`cancelled:${reason}`);
  markJourneyReturnTransition('cancelled', { reason });
  active = null;
  void import('./journey-boards-manager.js').then(({ journeyBoardsManager }) => {
    journeyBoardsManager.cancelPreparedJourneyV700WorldEnter?.(ownedTransitionId, reason);
    if (prewarmOwnerToken !== null) {
      journeyBoardsManager.cancelPreparedJourneyV700WorldEnter?.(prewarmOwnerToken, reason);
    }
  }).catch(() => {});
}

export function prepareJourneyReturnBehindTerminalOverlay(
  source: string,
  transitionId: number,
): void {
  const preparation = active?.id === transitionId ? active.preparation : null;
  preparation?.mark('module-requested');
  void import('./journey-boards-manager.js').then(({ journeyBoardsManager }) => {
    if (!isActiveTransition(transitionId)) return;
    preparation?.mark('module-ready');
    const prepare = () => journeyBoardsManager.prepareJourneyV700WorldEnterFromReturn?.(
      `terminal-overlay:${source}`,
      transitionId,
      preparation,
    );
    const prepared = (preparation ? preparation.phase('prepare-synchronous', prepare) : prepare()) === true;
    if (!isActiveTransition(transitionId)) {
      journeyBoardsManager.cancelPreparedJourneyV700WorldEnter?.(
        transitionId,
        'terminal-return-owner-changed',
      );
      return;
    }
    preparation?.mark('prepare-returned');
    if (!prepared) preparation?.finish('not-prepared');
    markJourneyReturnTransition('destination-prepared-behind-result', { prepared });
  }).catch((error) => {
    preparation?.finish('prepare-failed');
    if (!isActiveTransition(transitionId)) return;
    markJourneyReturnTransition('destination-prepare-failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
