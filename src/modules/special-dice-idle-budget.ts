export interface SpecialDiceIdleBudgetOwner {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

type Candidate<T extends object> = {
  key: T;
  owner: SpecialDiceIdleBudgetOwner;
  sequence: number;
  active: boolean;
  paused: boolean;
};

/**
 * Bounds continuous Special-die work without adding another ticker or timer.
 * The newest live Special is the visual priority; older candidates retain only
 * registration and a static pose so they can be promoted if the winner leaves.
 */
export class SpecialDiceIdleBudget<T extends object> {
  private readonly candidates = new Map<T, Candidate<T>>();
  private readonly suspensions = new Set<symbol>();
  private sequence = 0;

  constructor(private readonly maxActive: number) {}

  request(key: T, owner: SpecialDiceIdleBudgetOwner): void {
    const existing = this.candidates.get(key);
    if (existing) {
      existing.owner = owner;
      existing.sequence = ++this.sequence;
    } else {
      this.candidates.set(key, {
        key,
        owner,
        sequence: ++this.sequence,
        active: false,
        paused: false,
      });
    }
    this.reconcile();
  }

  retire(key: T): void {
    const candidate = this.candidates.get(key);
    if (!candidate) return;
    this.deactivate(candidate);
    this.candidates.delete(key);
    this.reconcile();
  }

  has(key: T): boolean {
    return this.candidates.has(key);
  }

  suspend(reason = 'runtime'): () => void {
    const token = Symbol(reason);
    this.suspensions.add(token);
    if (this.suspensions.size === 1) {
      for (const candidate of this.candidates.values()) {
        if (!candidate.active || candidate.paused) continue;
        candidate.paused = true;
        candidate.owner.pause();
      }
    }
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
    active: number;
    paused: number;
    suspended: boolean;
    maxActive: number;
  } {
    const candidates = [...this.candidates.values()];
    return {
      registered: candidates.length,
      active: candidates.filter((candidate) => candidate.active).length,
      paused: candidates.filter((candidate) => candidate.paused).length,
      suspended: this.suspensions.size > 0,
      maxActive: this.maxActive,
    };
  }

  reset(): void {
    for (const candidate of this.candidates.values()) this.deactivate(candidate);
    this.candidates.clear();
    this.suspensions.clear();
    this.sequence = 0;
  }

  private reconcile(): void {
    const suspended = this.suspensions.size > 0;
    const winners = new Set(
      [...this.candidates.values()]
        .sort((left, right) => right.sequence - left.sequence)
        .slice(0, Number.isFinite(this.maxActive) ? Math.max(0, this.maxActive) : undefined),
    );

    for (const candidate of this.candidates.values()) {
      if (!winners.has(candidate)) {
        this.deactivate(candidate);
        continue;
      }
      if (!candidate.active) {
        candidate.active = true;
        candidate.paused = suspended;
        candidate.owner.start();
        if (suspended) candidate.owner.pause();
        continue;
      }
      if (suspended && !candidate.paused) {
        candidate.paused = true;
        candidate.owner.pause();
      } else if (!suspended && candidate.paused) {
        candidate.paused = false;
        candidate.owner.resume();
      }
    }
  }

  private deactivate(candidate: Candidate<T>): void {
    if (!candidate.active) return;
    candidate.active = false;
    candidate.paused = false;
    candidate.owner.stop();
  }
}
