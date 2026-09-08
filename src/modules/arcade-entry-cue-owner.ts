import { cancelArcadeEntrySurfaceGate } from './arcade-entry-surface-gate.js';

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

/** Native WebKit can animate the DOM cue while PIXI warms; desktop web init can block GSAP mid-frame. */
export function shouldOverlapArcadeEntryCueWithColdBoot(
  protocol = typeof window !== 'undefined' ? window.location?.protocol : '',
): boolean {
  return protocol === 'app:';
}

/** Start the visual cue as soon as Homepage has exited, overlapping board preparation. */
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
  owner.promise = import('./arcade-stage-clear-modal.js')
    .then(({ showArcadeContinuationRoundCue }) => {
      // The chunk can finish loading after reset/Exit/new Play transferred
      // ownership. A retired starter must never mount over the current cue.
      if (owner.generation !== cueGeneration) return;
      return showArcadeContinuationRoundCue(
        normalizedRound,
        () => {
          if (owner.generation === cueGeneration) {
            resolvePresentationWaiters(normalizedRound);
          }
        },
      );
    })
    .finally(() => {
      owner.settled = true;
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
  try {
    await promise;
  } finally {
    if (activeCue?.promise === promise) activeCue = null;
  }
}

export function isArcadeEntryCuePending(): boolean {
  return !!activeCue && !activeCue.settled;
}

export function resetArcadeEntryCueOwner(): void {
  cueGeneration += 1;
  activeCue = null;
  presentationWaiters.forEach((waiters) => waiters.forEach((resolve) => resolve()));
  presentationWaiters.clear();
}

/** Abort an entry that can no longer reach board pop-in (for example boot failure). */
export function cancelArcadeEntryCueOwner(): void {
  const cancellationGeneration = ++cueGeneration;
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
