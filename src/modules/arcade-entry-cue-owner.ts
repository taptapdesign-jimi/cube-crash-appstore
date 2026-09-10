import { cancelArcadeEntrySurfaceGate } from './arcade-entry-surface-gate.js';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

const ARCADE_ENTRY_TRACE = '[CC_ARCADE_NN_ENTRY]';

type ActiveArcadeEntryCue = {
  generation: number;
  round: number;
  promise: Promise<void>;
  settled: boolean;
};

let activeCue: ActiveArcadeEntryCue | null = null;
let cueGeneration = 0;
const presentationWaiters = new Map<number, Set<() => void>>();

const normalizeRound = (round: number): number => Math.max(1, Math.trunc(Number(round) || 1));

function resolvePresentationWaiters(round: number): void {
  const waiters = presentationWaiters.get(round);
  presentationWaiters.delete(round);
  waiters?.forEach((resolve) => resolve());
}

/** Resolves when the Round overlay owns the visible surface, before its animation starts. */
export function waitForArcadeEntryCuePresentation(round: number): Promise<void> {
  const normalizedRound = normalizeRound(round);
  return new Promise((resolve) => {
    const waiters = presentationWaiters.get(normalizedRound) || new Set<() => void>();
    waiters.add(resolve);
    presentationWaiters.set(normalizedRound, waiters);
  });
}

/** Start the visual cue after board preparation has reached its guarded presentation commit. */
export function beginArcadeEntryCue(round: number): Promise<void> {
  const normalizedRound = normalizeRound(round);
  if (activeCue && !activeCue.settled && activeCue.round === normalizedRound) {
    return activeCue.promise;
  }

  const owner: ActiveArcadeEntryCue = {
    generation: ++cueGeneration,
    round: normalizedRound,
    settled: false,
    promise: Promise.resolve(),
  };
  emitNativeConsoleDiagnostic(ARCADE_ENTRY_TRACE, 'owner-begin', {
    round: normalizedRound,
    generation: owner.generation,
  });
  owner.promise = import('./arcade-stage-clear-modal.js')
    .then(({ showArcadeContinuationRoundCue }) => {
      // The chunk can finish loading after reset/Exit/new Play transferred
      // ownership. A retired starter must never mount over the current cue.
      if (owner.generation !== cueGeneration) {
        emitNativeConsoleDiagnostic(ARCADE_ENTRY_TRACE, 'owner-retired-before-mount', {
          round: normalizedRound,
          generation: owner.generation,
          currentGeneration: cueGeneration,
        });
        return;
      }
      return showArcadeContinuationRoundCue(
        normalizedRound,
        () => {
          if (owner.generation === cueGeneration) {
            emitNativeConsoleDiagnostic(ARCADE_ENTRY_TRACE, 'overlay-presented', {
              round: normalizedRound,
              generation: owner.generation,
            });
            resolvePresentationWaiters(normalizedRound);
          }
        },
      );
    })
    .finally(() => {
      owner.settled = true;
      emitNativeConsoleDiagnostic(ARCADE_ENTRY_TRACE, 'owner-settled', {
        round: normalizedRound,
        generation: owner.generation,
        current: owner.generation === cueGeneration,
      });
      if (owner.generation === cueGeneration) {
        resolvePresentationWaiters(normalizedRound);
      }
    });
  activeCue = owner;
  return owner.promise;
}

/** Board entrance consumes the already-running cue, or starts it as a safe fallback. */
export async function consumeArcadeEntryCue(round: number): Promise<void> {
  const normalizedRound = normalizeRound(round);
  const owner = activeCue && activeCue.round === normalizedRound
    ? activeCue
    : null;
  const promise = owner?.promise || beginArcadeEntryCue(normalizedRound);
  emitNativeConsoleDiagnostic(ARCADE_ENTRY_TRACE, 'consume-await', {
    round: normalizedRound,
    reusedOwner: !!owner,
  });
  try {
    await promise;
    emitNativeConsoleDiagnostic(ARCADE_ENTRY_TRACE, 'consume-complete', {
      round: normalizedRound,
    });
  } catch (error) {
    emitNativeConsoleDiagnostic(ARCADE_ENTRY_TRACE, 'consume-rejected', {
      round: normalizedRound,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    if (activeCue?.promise === promise) activeCue = null;
  }
}

export function isArcadeEntryCuePending(): boolean {
  return !!activeCue && !activeCue.settled;
}

export function resetArcadeEntryCueOwner(): void {
  cueGeneration += 1;
  emitNativeConsoleDiagnostic(ARCADE_ENTRY_TRACE, 'owner-reset', {
    generation: cueGeneration,
  });
  activeCue = null;
  presentationWaiters.forEach((waiters) => waiters.forEach((resolve) => resolve()));
  presentationWaiters.clear();
}

/** Abort an entry that can no longer reach board pop-in (for example boot failure). */
export function cancelArcadeEntryCueOwner(): void {
  const cancellationGeneration = ++cueGeneration;
  emitNativeConsoleDiagnostic(ARCADE_ENTRY_TRACE, 'owner-cancel', {
    generation: cancellationGeneration,
  });
  activeCue = null;
  presentationWaiters.forEach((waiters) => waiters.forEach((resolve) => resolve()));
  presentationWaiters.clear();
  cancelArcadeEntrySurfaceGate();
  void import('./arcade-stage-clear-modal.js')
    .then(({ cancelArcadeStageClearModal }) => {
      // Lazy cleanup from a retired route must not arrive after a newer Play
      // has acquired the Round cue and cut that new animation short.
      if (cancellationGeneration === cueGeneration) {
        cancelArcadeStageClearModal();
      }
    })
    .catch(() => {});
}
