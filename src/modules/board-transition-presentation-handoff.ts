type FrameScheduler = (callback: FrameRequestCallback) => number;

type PreparedFrameReleaseOptions = {
  renderPreparedFrame: () => void;
  scheduleFrame?: FrameScheduler;
  lease?: BoardTransitionCoverLease;
};

export type BoardTransitionCoverLease = Readonly<{
  coverGeneration: number;
  gameplayGeneration: number;
}>;

const COVER_HOLD_DEADLINE_MS = 12_000;

function traceHandoff(event: string, generation: number, detail?: unknown): void {
  if (typeof window === 'undefined') return;
  const target = window as typeof window & { __ccBoardHandoffTrace?: unknown[] };
  const entry = { event, generation, at: Date.now(), visibility: document.visibilityState, detail };
  target.__ccBoardHandoffTrace = [...(target.__ccBoardHandoffTrace ?? []).slice(-39), entry];
  console.info('[CC_BOARD_HANDOFF]', entry);
}

/** Owns the opaque paper cover until Pixi has presented a valid board frame. */
class BoardTransitionPresentationHandoff {
  private generation = 0;
  private pendingRelease: (() => void) | null = null;
  private releasePromise: Promise<boolean> | null = null;
  private deadlineId: ReturnType<typeof setTimeout> | null = null;
  private gameplayOwner = 0;

  private clearDeadline(): void {
    if (this.deadlineId !== null) clearTimeout(this.deadlineId);
    this.deadlineId = null;
  }

  private releaseOwnedCover(generation: number, reason: string): boolean {
    if (generation !== this.generation || !this.pendingRelease) return false;
    const release = this.pendingRelease;
    this.pendingRelease = null;
    this.gameplayOwner = 0;
    this.clearDeadline();
    traceHandoff(reason, generation);
    try {
      release();
    } catch (error) {
      // Ownership is already terminal above. A DOM cleanup failure must not
      // reject a fire-and-forget prepared-frame release or revive the lease.
      traceHandoff('release-callback-error', generation, String(error));
      console.error('[CC_BOARD_HANDOFF] release callback failed', error);
    }
    return true;
  }

  retain(release: () => void): number {
    // A replacement must never orphan the previous opaque owner.
    if (this.pendingRelease) this.releaseOwnedCover(this.generation, 'replaced-release');
    this.generation += 1;
    this.pendingRelease = release;
    this.releasePromise = null;
    const ownedGeneration = this.generation;
    traceHandoff('retain', ownedGeneration);
    this.deadlineId = setTimeout(() => {
      // Last-resort liveness guarantee. Normal presentation always releases
      // after two prepared frames; this only prevents a permanent deadlock.
      this.releaseOwnedCover(ownedGeneration, 'deadline-release');
    }, COVER_HOLD_DEADLINE_MS);
    return this.generation;
  }

  claimForGameplayEntry(gameplayGeneration: number): BoardTransitionCoverLease | null {
    if (!this.pendingRelease) return null;
    this.gameplayOwner = gameplayGeneration;
    this.releasePromise = null;
    traceHandoff('claimed', this.generation);
    return { coverGeneration: this.generation, gameplayGeneration };
  }

  hasPendingCover(): boolean {
    return this.pendingRelease !== null;
  }

  releaseAfterPreparedFrames({
    renderPreparedFrame,
    scheduleFrame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback) => setTimeout(() => callback(Date.now()), 16) as unknown as number,
    lease,
  }: PreparedFrameReleaseOptions): Promise<boolean> {
    if (!this.pendingRelease) return Promise.resolve(false);
    if (lease && (
      lease.coverGeneration !== this.generation ||
      lease.gameplayGeneration !== this.gameplayOwner
    )) return Promise.resolve(false);
    if (this.releasePromise) return this.releasePromise;

    const ownedGeneration = this.generation;
    const waitForFrame = () => new Promise<void>((resolve) => {
      try {
        scheduleFrame(() => resolve());
      } catch {
        setTimeout(resolve, 16);
      }
    });

    const releasePromise = (async () => {
      traceHandoff('release-request', ownedGeneration);
      try { renderPreparedFrame(); } catch {}
      await waitForFrame();
      if (ownedGeneration !== this.generation || !this.pendingRelease ||
        (lease && lease.gameplayGeneration !== this.gameplayOwner)) return false;
      try { renderPreparedFrame(); } catch {}
      await waitForFrame();
      if (ownedGeneration !== this.generation || !this.pendingRelease ||
        (lease && lease.gameplayGeneration !== this.gameplayOwner)) return false;

      return this.releaseOwnedCover(ownedGeneration, 'released');
    })().finally(() => {
      if (this.releasePromise === releasePromise) this.releasePromise = null;
    });
    this.releasePromise = releasePromise;
    return releasePromise;
  }

  cancel(): void {
    this.clearDeadline();
    traceHandoff('cancel', this.generation);
    this.generation += 1;
    this.pendingRelease = null;
    this.gameplayOwner = 0;
    this.releasePromise = null;
  }
}

export const boardTransitionPresentationHandoff = new BoardTransitionPresentationHandoff();
