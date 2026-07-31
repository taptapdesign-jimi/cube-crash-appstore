export type HomepageEnterTransitionResult = 'completed' | 'cancelled';

export interface HomepageEnterTransitionLease {
  readonly id: number;
  readonly reason: string;
  readonly targetSlideIndex: number;
  readonly settled: Promise<HomepageEnterTransitionResult>;
  isCurrent(): boolean;
  onCancel(callback: (reason: string) => void): void;
  complete(): void;
}

interface ActiveHomepageEnterTransition {
  id: number;
  reason: string;
  targetSlideIndex: number;
  cancelCallbacks: Set<(reason: string) => void>;
  resolve: (result: HomepageEnterTransitionResult) => void;
}

/** Single lifecycle owner for a Homepage return enter. */
export class HomepageEnterTransitionOwner {
  private nextId = 0;
  private active: ActiveHomepageEnterTransition | null = null;

  public begin(reason: string, targetSlideIndex: number): HomepageEnterTransitionLease {
    this.cancel('superseded-by-new-homepage-enter');

    const id = ++this.nextId;
    let resolveSettled!: (result: HomepageEnterTransitionResult) => void;
    const settled = new Promise<HomepageEnterTransitionResult>((resolve) => {
      resolveSettled = resolve;
    });
    const active: ActiveHomepageEnterTransition = {
      id,
      reason,
      targetSlideIndex,
      cancelCallbacks: new Set(),
      resolve: resolveSettled,
    };
    this.active = active;

    return {
      id,
      reason,
      targetSlideIndex,
      settled,
      isCurrent: () => this.active?.id === id,
      onCancel: (callback) => {
        if (this.active?.id !== id) {
          callback('lease-no-longer-current');
          return;
        }
        active.cancelCallbacks.add(callback);
      },
      complete: () => {
        if (this.active?.id !== id) return;
        this.active = null;
        active.cancelCallbacks.clear();
        active.resolve('completed');
      },
    };
  }

  public cancel(reason: string): boolean {
    const active = this.active;
    if (!active) return false;
    this.active = null;
    active.cancelCallbacks.forEach((callback) => {
      try { callback(reason); } catch {}
    });
    active.cancelCallbacks.clear();
    active.resolve('cancelled');
    return true;
  }

  public isActive(): boolean {
    return this.active !== null;
  }
}

export const homepageEnterTransitionOwner = new HomepageEnterTransitionOwner();
