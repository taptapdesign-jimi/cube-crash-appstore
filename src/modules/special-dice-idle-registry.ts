export interface SpecialDiceIdleOwner {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

type Registration<T extends object> = {
  key: T;
  owner: SpecialDiceIdleOwner;
  state: 'pending' | 'running' | 'paused';
};

export interface SpecialDiceIdleRegistryOptions {
  acquireSettledCadence?: () => () => void;
}

/**
 * Owns the lifecycle of every live Special-die idle controller.
 *
 * Admission is deliberately not a performance budget: every registered tile
 * starts exactly once and remains live until that exact tile retires. Shared
 * interaction boundaries may suspend the whole population, and nested
 * boundaries resume it only after the final token is released. One registry
 * lease keeps the Pixi ticker at settled-motion cadence for the entire live
 * population instead of allocating one cadence lease per tile.
 */
export class SpecialDiceIdleRegistry<T extends object> {
  private readonly registrations = new Map<T, Registration<T>>();
  private readonly suspensions = new Set<symbol>();
  private releaseSettledCadence: (() => void) | null = null;

  constructor(private readonly options: SpecialDiceIdleRegistryOptions = {}) {}

  register(key: T, owner: SpecialDiceIdleOwner): void {
    const existing = this.registrations.get(key);
    if (existing) {
      // A repeated drop/snap-back callback must not restart a live animation or
      // replace the owner that was actually started. A pending registration
      // may safely take the latest callbacks before its first start.
      if (existing.state === 'pending') existing.owner = owner;
      return;
    }

    this.registrations.set(key, { key, owner, state: 'pending' });
    this.reconcile();
  }

  retire(key: T): void {
    const registration = this.registrations.get(key);
    if (!registration) return;
    this.registrations.delete(key);
    if (registration.state !== 'pending') registration.owner.stop();
    this.reconcileCadence();
  }

  has(key: T): boolean {
    return this.registrations.has(key);
  }

  suspend(reason = 'runtime'): () => void {
    const token = Symbol(reason);
    this.suspensions.add(token);
    if (this.suspensions.size === 1) this.reconcile();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.suspensions.delete(token);
      if (this.suspensions.size === 0) this.reconcile();
    };
  }

  snapshot(): {
    registered: number;
    running: number;
    paused: number;
    pending: number;
    suspended: boolean;
    settledCadenceOwned: boolean;
  } {
    const registrations = [...this.registrations.values()];
    return {
      registered: registrations.length,
      running: registrations.filter(({ state }) => state === 'running').length,
      paused: registrations.filter(({ state }) => state === 'paused').length,
      pending: registrations.filter(({ state }) => state === 'pending').length,
      suspended: this.suspensions.size > 0,
      settledCadenceOwned: this.releaseSettledCadence !== null,
    };
  }

  reset(): void {
    for (const registration of this.registrations.values()) {
      if (registration.state !== 'pending') registration.owner.stop();
    }
    this.registrations.clear();
    this.suspensions.clear();
    this.releaseCadence();
  }

  private reconcile(): void {
    const suspended = this.suspensions.size > 0;
    if (!suspended) this.acquireCadence();

    for (const registration of this.registrations.values()) {
      if (suspended) {
        if (registration.state !== 'running') continue;
        registration.owner.pause();
        registration.state = 'paused';
        continue;
      }

      if (registration.state === 'pending') {
        registration.owner.start();
        registration.state = 'running';
      } else if (registration.state === 'paused') {
        registration.owner.resume();
        registration.state = 'running';
      }
    }

    this.reconcileCadence();
  }

  private reconcileCadence(): void {
    if (this.suspensions.size === 0 && this.registrations.size > 0) {
      this.acquireCadence();
    } else {
      this.releaseCadence();
    }
  }

  private acquireCadence(): void {
    if (this.releaseSettledCadence || this.registrations.size === 0) return;
    this.releaseSettledCadence = this.options.acquireSettledCadence?.() ?? null;
  }

  private releaseCadence(): void {
    const release = this.releaseSettledCadence;
    this.releaseSettledCadence = null;
    release?.();
  }
}
