export type BoardMutationOutcome = 'pending' | 'spawn' | 'complete';

export type BoardMutationEpoch = Readonly<{
  value: number;
  transactionId: string;
  boardRevision: number;
}>;

export type BoardSpawnPermit = Readonly<{
  epoch: number;
  sequence: number;
  transactionId: string;
  boardRevision: number;
}>;

export type BoardMutationEpochOptions = Readonly<{
  transactionId?: string;
  boardRevision?: number;
  /** Exact number of spawn mutation boundaries admitted by this transaction. */
  spawnBudget?: number;
}>;

export type BoardMutationCommitRejection =
  | 'stale-epoch'
  | 'unknown-permit'
  | 'permit-consumed'
  | 'terminal-committed'
  | 'spawn-committed';

export type BoardMutationCommitResult =
  | Readonly<{ accepted: true; outcome: Exclude<BoardMutationOutcome, 'pending'> }>
  | Readonly<{
      accepted: false;
      outcome: BoardMutationOutcome;
      reason: BoardMutationCommitRejection;
    }>;

/**
 * Owns the mutually-exclusive spawn/complete decision for one board mutation.
 *
 * Delayed spawn work receives an identity-bound permit. A terminal commit
 * revokes every outstanding permit synchronously, so a callback that resumes
 * after finality cannot mutate the board. Multiple pre-issued permits may be
 * consumed for one fan-out spawn, but completion can no longer be committed
 * after the first spawn permit is consumed.
 */
export class BoardMutationEpochOwner {
  private epoch = 0;
  private permitSequence = 0;
  private outcome: BoardMutationOutcome = 'pending';
  private transactionId = 'board-mutation:0';
  private boardRevision = 0;
  private spawnBudget = Number.POSITIVE_INFINITY;
  private issuedSpawnPermits = 0;
  private readonly activePermits = new Set<BoardSpawnPermit>();
  private readonly consumedPermits = new WeakSet<object>();

  public beginMutation(options: BoardMutationEpochOptions = {}): BoardMutationEpoch {
    this.epoch += 1;
    this.outcome = 'pending';
    this.activePermits.clear();
    this.transactionId = options.transactionId ?? `board-mutation:${this.epoch}`;
    this.boardRevision = Number.isFinite(options.boardRevision)
      ? Math.max(0, Math.trunc(options.boardRevision as number))
      : this.epoch;
    this.spawnBudget = Number.isFinite(options.spawnBudget)
      ? Math.max(0, Math.trunc(options.spawnBudget as number))
      : Number.POSITIVE_INFINITY;
    this.issuedSpawnPermits = 0;
    return Object.freeze({
      value: this.epoch,
      transactionId: this.transactionId,
      boardRevision: this.boardRevision,
    });
  }

  public invalidate(): void {
    this.epoch += 1;
    this.outcome = 'pending';
    this.activePermits.clear();
    this.transactionId = `board-mutation:${this.epoch}:invalidated`;
    this.boardRevision += 1;
    this.spawnBudget = 0;
    this.issuedSpawnPermits = 0;
  }

  public issueSpawnPermit(epoch: BoardMutationEpoch): BoardSpawnPermit | null {
    if (!this.isCurrentEpoch(epoch) || this.outcome === 'complete') return null;
    if (this.issuedSpawnPermits >= this.spawnBudget) return null;

    const permit = Object.freeze({
      epoch: epoch.value,
      sequence: ++this.permitSequence,
      transactionId: epoch.transactionId,
      boardRevision: epoch.boardRevision,
    });
    this.issuedSpawnPermits += 1;
    this.activePermits.add(permit);
    return permit;
  }

  /**
   * Atomically chooses the spawn side of the spawn XOR terminal invariant
   * before any asynchronous representation work resumes. Pre-issued permits
   * remain valid, while terminal completion becomes impossible immediately.
   */
  public sealSpawnPlan(epoch: BoardMutationEpoch): BoardMutationCommitResult {
    if (!this.isCurrentEpoch(epoch)) {
      return { accepted: false, outcome: this.outcome, reason: 'stale-epoch' };
    }
    if (this.outcome === 'complete') {
      return { accepted: false, outcome: this.outcome, reason: 'terminal-committed' };
    }
    this.outcome = 'spawn';
    return { accepted: true, outcome: 'spawn' };
  }

  public commitSpawn(permit: BoardSpawnPermit): BoardMutationCommitResult {
    if (permit.epoch !== this.epoch) {
      return { accepted: false, outcome: this.outcome, reason: 'stale-epoch' };
    }
    if (this.outcome === 'complete') {
      return { accepted: false, outcome: this.outcome, reason: 'terminal-committed' };
    }
    if (this.consumedPermits.has(permit)) {
      return { accepted: false, outcome: this.outcome, reason: 'permit-consumed' };
    }
    if (!this.activePermits.delete(permit)) {
      return { accepted: false, outcome: this.outcome, reason: 'unknown-permit' };
    }

    this.consumedPermits.add(permit);
    this.outcome = 'spawn';
    return { accepted: true, outcome: 'spawn' };
  }

  public commitComplete(epoch: BoardMutationEpoch): BoardMutationCommitResult {
    if (!this.isCurrentEpoch(epoch)) {
      return { accepted: false, outcome: this.outcome, reason: 'stale-epoch' };
    }
    if (this.outcome === 'spawn') {
      return { accepted: false, outcome: this.outcome, reason: 'spawn-committed' };
    }
    if (this.outcome === 'complete') {
      return { accepted: false, outcome: this.outcome, reason: 'terminal-committed' };
    }

    this.outcome = 'complete';
    this.activePermits.clear();
    return { accepted: true, outcome: 'complete' };
  }

  public getOutcome(epoch: BoardMutationEpoch): BoardMutationOutcome | null {
    return this.isCurrentEpoch(epoch) ? this.outcome : null;
  }

  private isCurrentEpoch(epoch: BoardMutationEpoch): boolean {
    return epoch.value === this.epoch
      && epoch.transactionId === this.transactionId
      && epoch.boardRevision === this.boardRevision;
  }
}
