import { createScreenLifecycle } from '../utils/screen-lifecycle.js';

export type JourneyPostEnterLease = {
  generation: number;
  epoch: number;
  isCurrent(): boolean;
  schedule(callback: () => void, delayMs: number): void;
};

type ActiveJourneyPostEnter = {
  generation: number;
  epoch: number;
  lifecycle: ReturnType<typeof createScreenLifecycle>;
};

/** Owns delayed Journey mutations that may outlive the visible enter tween. */
export class JourneyPostEnterOwner {
  private generation = 0;
  private active: ActiveJourneyPostEnter | null = null;

  acquire(epoch: number): JourneyPostEnterLease {
    if (this.active?.epoch !== epoch) {
      this.retire();
      this.active = {
        generation: ++this.generation,
        epoch,
        lifecycle: createScreenLifecycle(`journey-post-enter-${this.generation}`),
      };
    }
    const active = this.active;
    return {
      generation: active.generation,
      epoch: active.epoch,
      isCurrent: () => this.active === active,
      schedule: (callback, delayMs) => {
        if (this.active !== active) return;
        active.lifecycle.trackTimeout(() => {
          if (this.active !== active) return;
          callback();
        }, Math.max(0, delayMs));
      },
    };
  }

  retire(): void {
    const active = this.active;
    this.active = null;
    if (!active) return;
    active.lifecycle.cleanup();
  }
}
