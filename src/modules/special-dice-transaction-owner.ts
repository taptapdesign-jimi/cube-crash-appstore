export type SpecialDiceTransactionKind = 'star' | 'juice' | 'magnet' | 'tnt';

export type SpecialDiceTransactionSnapshot = {
  token: number;
  kind: SpecialDiceTransactionKind;
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
