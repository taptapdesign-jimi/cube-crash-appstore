type FrameScheduler = (callback: FrameRequestCallback) => number;

type PreparedFrameReleaseOptions = {
  renderPreparedFrame: () => void;
  scheduleFrame?: FrameScheduler;
};

/** Owns the opaque paper cover until Pixi has presented a valid board frame. */
class BoardTransitionPresentationHandoff {
  private generation = 0;
  private pendingRelease: (() => void) | null = null;
  private releasePromise: Promise<boolean> | null = null;

  retain(release: () => void): number {
    this.generation += 1;
    this.pendingRelease = release;
    this.releasePromise = null;
    return this.generation;
  }

  hasPendingCover(): boolean {
    return this.pendingRelease !== null;
  }

  releaseAfterPreparedFrames({
    renderPreparedFrame,
    scheduleFrame = requestAnimationFrame,
  }: PreparedFrameReleaseOptions): Promise<boolean> {
    if (!this.pendingRelease) return Promise.resolve(false);
    if (this.releasePromise) return this.releasePromise;

    const ownedGeneration = this.generation;
    const waitForFrame = () => new Promise<void>((resolve) => {
      scheduleFrame(() => resolve());
    });

    this.releasePromise = (async () => {
      try { renderPreparedFrame(); } catch {}
      await waitForFrame();
      if (ownedGeneration !== this.generation || !this.pendingRelease) return false;
      try { renderPreparedFrame(); } catch {}
      await waitForFrame();
      if (ownedGeneration !== this.generation || !this.pendingRelease) return false;

      const release = this.pendingRelease;
      this.pendingRelease = null;
      release();
      return true;
    })().finally(() => {
      if (ownedGeneration === this.generation) this.releasePromise = null;
    });
    return this.releasePromise;
  }

  cancel(): void {
    this.generation += 1;
    this.pendingRelease = null;
    this.releasePromise = null;
  }
}

export const boardTransitionPresentationHandoff = new BoardTransitionPresentationHandoff();
