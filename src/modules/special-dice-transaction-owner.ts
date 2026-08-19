export type SpecialDiceTransactionKind = 'star' | 'juice' | 'magnet' | 'tnt';

export type SpecialDiceTransactionSnapshot = {
  token: number;
  kind: SpecialDiceTransactionKind;
  phase: 'mutating' | 'visual-tail';
  boardRevisionAtCommit: number | null;
  startedAt: number;
  expiresAt: number;
};

/**
 * Single, reference-free owner for gameplay mutations started by special dice.
 *
 * Visual FX may outlive this owner, but another board transaction cannot start
 * until the current special's spawn/pull/cleanup path explicitly releases its
 * immutable token. The TTL is recovery-only and prevents an interrupted native
 * lifecycle from permanently locking a restored board.
 */
export class SpecialDiceTransactionOwner {
  private nextToken = 1;
  private active: SpecialDiceTransactionSnapshot | null = null;

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = 15000,
  ) {}

  claim(kind: SpecialDiceTransactionKind): number | null {
    this.pruneExpired();
    if (this.active) return null;

    const startedAt = this.now();
    const token = this.nextToken++;
    this.active = {
      token,
      kind,
      phase: 'mutating',
      boardRevisionAtCommit: null,
      startedAt,
      expiresAt: startedAt + this.ttlMs,
    };
    return token;
  }

  owns(token: number | null | undefined): boolean {
    this.pruneExpired();
    return typeof token === 'number' && this.active?.token === token;
  }

  isActive(): boolean {
    this.pruneExpired();
    return this.active !== null;
  }

  snapshot(): SpecialDiceTransactionSnapshot | null {
    this.pruneExpired();
    return this.active ? { ...this.active } : null;
  }

  markBoardCommitted(token: number | null | undefined, boardRevision: number): boolean {
    if (!this.owns(token) || !this.active) return false;
    this.active.phase = 'visual-tail';
    this.active.boardRevisionAtCommit = boardRevision;
    return true;
  }

  isVisualTail(): boolean {
    this.pruneExpired();
    return this.active?.phase === 'visual-tail';
  }

  isVisualTailCurrent(boardRevision: number): boolean {
    this.pruneExpired();
    return this.active?.phase === 'visual-tail' &&
      this.active.boardRevisionAtCommit === boardRevision;
  }

  release(token: number | null | undefined): boolean {
    if (!this.owns(token)) return false;
    this.active = null;
    return true;
  }

  reset(): void {
    this.active = null;
  }

  private pruneExpired(): void {
    if (this.active && this.active.expiresAt <= this.now()) {
      this.active = null;
    }
  }
}

/**
 * Captures the board revision at a transaction's commit boundary. Async work
 * after that boundary may continue only while no newer gameplay mutation has
 * been accepted. A missing getter preserves the legacy serialized behaviour;
 * a getter that disappears or throws after capture fails closed.
 */
export class PostCommitBoardRevisionGuard {
  private capturedRevision: number | null = null;
  private capturedWithGetter = false;

  constructor(private readonly getRevision?: () => number) {}

  capture(): number | null {
    if (typeof this.getRevision !== 'function') {
      this.capturedRevision = null;
      this.capturedWithGetter = false;
      return null;
    }
    try {
      const revision = this.getRevision();
      if (!Number.isFinite(revision)) return null;
      this.capturedRevision = revision;
      this.capturedWithGetter = true;
      return revision;
    } catch {
      return null;
    }
  }

  isCurrent(): boolean {
    if (!this.capturedWithGetter) return true;
    try {
      const revision = this.getRevision?.();
      return Number.isFinite(revision) && revision === this.capturedRevision;
    } catch {
      return false;
    }
  }

  runIfCurrent(callback: () => void): boolean {
    if (!this.isCurrent()) return false;
    callback();
    return true;
  }
}

export function canRunOrdinaryStackDuringVisualTail(
  owner: Pick<SpecialDiceTransactionOwner, 'isVisualTail'>,
  input: {
    sourceValue: number;
    destinationValue: number;
    sourceStableOrdinary: boolean;
    destinationStableOrdinary: boolean;
  },
): boolean {
  if (!owner.isVisualTail()) return false;
  if (!input.sourceStableOrdinary || !input.destinationStableOrdinary) return false;
  const sourceValue = input.sourceValue | 0;
  const destinationValue = input.destinationValue | 0;
  // Sum-six owns spawn/replacement work and must remain serialized. This
  // exception is intentionally limited to a local ordinary stack below six.
  return sourceValue > 0 && sourceValue < 6 && destinationValue > 0 && destinationValue < 6 &&
    sourceValue + destinationValue < 6;
}

/**
 * Endgame observers are read-only while a special transaction owns the board.
 * The returned snapshot is immutable and can also be used for diagnostics.
 */
export function getSpecialDiceEndgameBlock(
  owner: Pick<SpecialDiceTransactionOwner, 'snapshot'>,
): SpecialDiceTransactionSnapshot | null {
  return owner.snapshot();
}
