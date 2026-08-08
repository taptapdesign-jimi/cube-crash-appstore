import { cancelArcadeEntrySurfaceGate } from './arcade-entry-surface-gate.js';

type ActiveArcadeEntryCue = {
  round: number;
  promise: Promise<void>;
  settled: boolean;
};

let activeCue: ActiveArcadeEntryCue | null = null;

const normalizeRound = (round: number): number => Math.max(1, Math.trunc(Number(round) || 1));

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
    round: normalizedRound,
    settled: false,
    promise: Promise.resolve(),
  };
  owner.promise = import('./arcade-stage-clear-modal.js')
    .then(({ showArcadeContinuationRoundCue }) => showArcadeContinuationRoundCue(normalizedRound))
    .finally(() => {
      owner.settled = true;
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
  activeCue = null;
  cancelArcadeEntrySurfaceGate();
}

/** Abort an entry that can no longer reach board pop-in (for example boot failure). */
export function cancelArcadeEntryCueOwner(): void {
  activeCue = null;
  cancelArcadeEntrySurfaceGate();
  void import('./arcade-stage-clear-modal.js')
    .then(({ cancelArcadeStageClearModal }) => cancelArcadeStageClearModal())
    .catch(() => {});
}
