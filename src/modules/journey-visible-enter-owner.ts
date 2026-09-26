export interface JourneyVisibleEnterLease {
  generation: number;
  epoch: number;
  joined: boolean;
  promise: Promise<void>;
  isCurrent(): boolean;
  settle(): void;
}

type ActiveJourneyVisibleEnter = {
  generation: number;
  epoch: number;
  promise: Promise<void>;
  resolve: () => void;
};

/** Owns the hidden-prime -> visibly committed Journey handoff. */
export class JourneyVisibleEnterOwner {
  private generation = 0;
  private active: ActiveJourneyVisibleEnter | null = null;

  acquire(epoch: number): JourneyVisibleEnterLease {
    const current = this.active;
    if (current?.epoch === epoch) {
      return this.createLease(current, true);
    }

    this.retire();
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    const active = {
      generation: ++this.generation,
      epoch,
      promise,
      resolve,
    };
    this.active = active;
    return this.createLease(active, false);
  }

  retire(): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    active.resolve();
  }

  private createLease(active: ActiveJourneyVisibleEnter, joined: boolean): JourneyVisibleEnterLease {
    const isCurrent = (): boolean => this.active === active;
    return {
      generation: active.generation,
      epoch: active.epoch,
      joined,
      promise: active.promise,
      isCurrent,
      settle: () => {
        if (joined) return;
        if (!isCurrent()) return;
        this.active = null;
        active.resolve();
      },
    };
  }
}
