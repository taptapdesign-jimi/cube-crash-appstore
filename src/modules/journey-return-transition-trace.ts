import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';
import { beginJourneyTerminalPreparationPerformance, type JourneyTerminalPreparationPerformance } from './journey-terminal-preparation-performance.js';
import { suspendSpeculativeGameplayAudioLoads } from './gameplay-audio-buffer-player.js';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';

type JourneyReturnSource = 'clean-board' | 'fail';

let generation = 0;
let prewarmGeneration = 0;
const coldRevealLifecycle = createScreenLifecycle('journey-cold-reveal');
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
  releaseSpeculativeAudio: () => void;
  destinationReady: Promise<boolean> | null;
  destinationPrepared: boolean | null;
  destinationVisibleReady: boolean;
  destinationVisibleReadyPromise: Promise<boolean>;
  resolveDestinationVisibleReady: (ready: boolean) => void;
  revealCallbacks: Set<() => void>;
  staticCover: HTMLElement | null;
  lifecycle: ReturnType<typeof createScreenLifecycle>;
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
  if (active) cancelJourneyReturnTransition(active.id, 'replaced');
  const id = ++generation;
  const preparation = beginJourneyTerminalPreparationPerformance(id, source, boardId);
  let resolveDestinationVisibleReady!: (ready: boolean) => void;
  const destinationVisibleReadyPromise = new Promise<boolean>((resolve) => {
    resolveDestinationVisibleReady = resolve;
  });
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
    releaseSpeculativeAudio: suspendSpeculativeGameplayAudioLoads(),
    destinationReady: null,
    destinationPrepared: null,
    destinationVisibleReady: false,
    destinationVisibleReadyPromise,
    resolveDestinationVisibleReady,
    revealCallbacks: new Set(),
    staticCover: null,
    lifecycle: createScreenLifecycle(`journey-return-${id}`),
  };
  markJourneyReturnTransition('cta-accepted');
  return id;
}

/** The route may join an accepted return before the cover has released it. */
export function getJourneyReturnTransitionToken(): number | null {
  return active?.id ?? null;
}

export function isJourneyReturnStaticCoverActive(transitionId: number | null): boolean {
  return transitionId !== null
    && active?.id === transitionId
    && active.staticCover?.isConnected === true;
}

/**
 * Publish the single prepared Journey surface beneath the transferred terminal
 * cover. This is a readiness signal only; the authored Unit enter still waits
 * for the cover owner to finish its fade and release the reveal token.
 */
export function markJourneyReturnDestinationVisibleReady(transitionId: number): void {
  if (!active || active.id !== transitionId || active.destinationVisibleReady) return;
  active.destinationVisibleReady = true;
  active.resolveDestinationVisibleReady(true);
  markJourneyReturnTransition('destination-visible-ready-behind-cover');
}

/**
 * Transfer the already-static Clean Board paper to the transition coordinator.
 * The result modal can retire immediately while this exact element masks route
 * cleanup and the one Journey commit. No duplicate curtain is allocated.
 */
export function transferJourneyReturnStaticCover(
  transitionId: number,
  cover: HTMLElement,
  fadeMs: number,
): boolean {
  if (!active || active.id !== transitionId || !cover.isConnected) return false;
  const transition = active;
  if (transition.staticCover && transition.staticCover !== cover) {
    transition.staticCover.remove();
  }
  transition.staticCover = cover;
  cover.dataset.ccJourneyReturnStaticCover = String(transitionId);
  cover.style.pointerEvents = 'none';
  cover.style.opacity = '1';
  cover.style.transition = 'none';

  let releaseStarted = false;
  const release = (ready: boolean): void => {
    if (releaseStarted) return;
    releaseStarted = true;
    if (!active || active !== transition || transition.staticCover !== cover) {
      cover.remove();
      return;
    }
    markJourneyReturnTransition('static-cover-release-start', { ready, fadeMs });
    transition.lifecycle.trackRaf(() => {
      if (!active || active !== transition || transition.staticCover !== cover) {
        cover.remove();
        return;
      }
      cover.style.transition = `opacity ${Math.max(0, fadeMs)}ms ease`;
      cover.style.opacity = '0';
      transition.lifecycle.trackTimeout(() => {
        if (!active || active !== transition) {
          cover.remove();
          return;
        }
        transition.staticCover = null;
        cover.remove();
        markJourneyReturnResultExitComplete(transitionId);
      }, Math.max(0, fadeMs));
    });
  };

  // The timeout is recovery only. Normally showCollectibles commits the exact
  // prepared surface in the next route task and resolves this immediately.
  transition.lifecycle.trackTimeout(() => release(false), 1600);
  void transition.destinationVisibleReadyPromise.then((ready) => {
    release(ready);
  });
  markJourneyReturnTransition('static-cover-transferred');
  return true;
}

/**
 * Prepare a reusable World after the result CTA has entered. The manager
 * builds and primes detached board Units over separate presentation turns,
 * then commits the completed hidden subtree once. It deliberately avoids the
 * transparent paint-warm lease: connected hidden World work competes with the
 * still-visible celebration on WebKit. Exit remains actionable throughout.
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
    const prepared = await journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally?.(
      `terminal-settled:${source}`,
      ownerToken,
    ) === true;
    if (!prepared && activePrewarm?.id === id) activePrewarm = null;
    if (!prepared) return false;
    const ready = await journeyBoardsManager.waitForPreparedJourneyV700WorldEnter?.(ownerToken);
    if (activePrewarm?.id !== id) return false;
    if (!ready) activePrewarm = null;
    return ready === true;
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
  if (active.resultExitCompletedAt !== null) return;
  active.resultExitCompletedAt = performance.now();
  markJourneyReturnTransition('result-last-visible');
  const callbacks = Array.from(active.revealCallbacks);
  active.revealCallbacks.clear();
  callbacks.forEach((callback) => callback());
}

/** Join the accepted return before any renderer or visible-enter fallback runs. */
export async function waitForJourneyReturnDestination(transitionId: number): Promise<boolean> {
  if (!isActiveTransition(transitionId)) return false;
  const ready = await active?.destinationReady;
  return isActiveTransition(transitionId) && ready === true;
}

/**
 * The moving result has finished, but its opaque paper still owns the screen.
 * Use that static cover to pay the exact destination's connected paint cost;
 * if preparation is late or stale, return immediately and keep the canonical
 * recovery path rather than extending a blank cover indefinitely.
 */
export async function warmJourneyReturnBehindSettledTerminal(
  source: JourneyReturnSource,
  transitionId: number,
): Promise<boolean> {
  if (!isActiveTransition(transitionId)) return false;
  // Do not lengthen a terminal cover waiting for construction. Clean Board's
  // settled-result owner normally finished this well before CTA; Fail may not
  // have, and then its canonical post-exit recovery remains authoritative.
  if (active?.destinationPrepared !== true) return false;
  try {
    const { journeyBoardsManager } = await import('./journey-boards-manager.js');
    if (!isActiveTransition(transitionId)) return false;
    active?.preparation?.mark('settled-cover-paint-requested');
    const painted = await journeyBoardsManager.warmPreparedJourneyV700WorldEnterBehindSettledTerminal?.(
      transitionId,
      `terminal-settled-cover:${source}`,
      active?.preparation ?? null,
    ) === true;
    if (isActiveTransition(transitionId)) {
      markJourneyReturnTransition('destination-painted-behind-settled-result', { painted });
    }
    return isActiveTransition(transitionId) && painted;
  } catch (error) {
    if (isActiveTransition(transitionId)) {
      markJourneyReturnTransition('destination-settled-paint-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return false;
  }
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
  if (transitionId === null) {
    coldRevealLifecycle.trackRaf(run);
    return;
  }
  if (!active || active.id !== transitionId) return;
  if (active.resultExitCompletedAt !== null) {
    run();
    return;
  }
  active.revealCallbacks.add(run);
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
  active.releaseSpeculativeAudio();
  active.lifecycle.cleanup();
  active.staticCover?.remove();
  active.resolveDestinationVisibleReady(false);
  active.revealCallbacks.clear();
  active = null;
}

export function cancelJourneyReturnTransition(transitionId: number | null, reason: string): void {
  const ownedTransitionId = transitionId ?? active?.id ?? null;
  if (ownedTransitionId === null || !isActiveTransition(ownedTransitionId)) return;
  const prewarmOwnerToken = active?.prewarmOwnerToken ?? null;
  active?.preparation?.finish(`cancelled:${reason}`);
  markJourneyReturnTransition('cancelled', { reason });
  active?.releaseSpeculativeAudio();
  active?.lifecycle.cleanup();
  active?.staticCover?.remove();
  active?.resolveDestinationVisibleReady(false);
  active?.revealCallbacks.clear();
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
  if (!active || active.id !== transitionId || active.destinationReady) return;
  const destinationReady = import('./journey-boards-manager.js').then(async ({ journeyBoardsManager }) => {
    if (!isActiveTransition(transitionId)) return false;
    preparation?.mark('module-ready');
    const prewarmOwnerToken = active?.prewarmOwnerToken ?? null;
    if (prewarmOwnerToken !== null) {
      const ready = await journeyBoardsManager.waitForPreparedJourneyV700WorldEnter(prewarmOwnerToken);
      if (!isActiveTransition(transitionId)) return false;
      if (ready && journeyBoardsManager.adoptPreparedJourneyV700WorldEnter(
        prewarmOwnerToken, transitionId, preparation,
      )) {
        markJourneyReturnTransition('destination-adopted-behind-result', { prepared: true });
        return true;
      }
    }
    // Required preparation uses the same bounded builder even after pressure
    // cancelled speculative work. Never fall back to an all-World reset.
    const prepared = await journeyBoardsManager.prepareJourneyV700WorldEnterFromReturnIncrementally(
      `terminal-overlay:${source}`, transitionId,
    );
    if (!isActiveTransition(transitionId)) return false;
    preparation?.mark('prepare-returned');
    if (!prepared) preparation?.finish('not-prepared');
    markJourneyReturnTransition('destination-prepared-incrementally', { prepared });
    return prepared;
  }).catch((error) => {
    preparation?.finish('prepare-failed');
    if (!isActiveTransition(transitionId)) return false;
    markJourneyReturnTransition('destination-prepare-failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  });
  active.destinationReady = destinationReady;
  void destinationReady.then((ready) => {
    if (active?.id === transitionId) active.destinationPrepared = ready;
  });
}
