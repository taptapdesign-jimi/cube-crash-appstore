export type ForegroundResumeLease = Readonly<{
  epoch: number;
  resumeTicker: boolean;
}>;

/** Coalesces visibility/pageshow/context events into one resume owner. */
export class ForegroundResumeEpoch {
  private epoch = 0;
  private pending = false;
  private resumeTicker = false;

  public beginSuspension(tickerStarted: boolean): boolean {
    if (this.pending) return false;
    this.epoch += 1;
    this.pending = true;
    this.resumeTicker = tickerStarted;
    return true;
  }

  public consume(): ForegroundResumeLease | null {
    if (!this.pending) return null;
    this.pending = false;
    return { epoch: this.epoch, resumeTicker: this.resumeTicker };
  }

  public isCurrent(lease: ForegroundResumeLease): boolean {
    return lease.epoch === this.epoch;
  }

  public invalidate(): void {
    this.epoch += 1;
    this.pending = false;
    this.resumeTicker = false;
  }
}
