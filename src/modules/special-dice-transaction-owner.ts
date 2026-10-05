export type SpecialDiceTransactionKind = 'star' | 'juice' | 'magnet' | 'tnt';

export type SpecialMergeDestinationDisposition =
  | 'consume-final'
  | 'consume-before-primary-spawn'
  | 'consume-after-continuation';

export type SpecialMergeTransactionReceipt = Readonly<{
  token: number;
  kind: SpecialDiceTransactionKind;
  runGeneration: number;
  acceptedBoardRevision: number;
  committedBoardRevision: number;
  sourceDieId: string;
  destinationDieId: string;
  sourceCell: Readonly<{ c: number; r: number }>;
  destinationCell: Readonly<{ c: number; r: number }>;
  consumedDieIds: readonly string[];
  reservedCells: readonly Readonly<{ c: number; r: number }>[];
  destinationDisposition: SpecialMergeDestinationDisposition;
  expectedPrimarySpawnCount: 0 | 1;
  finalMerge: boolean;
}>;

export type SpecialDiceTransactionSnapshot = {
  token: number;
  kind: SpecialDiceTransactionKind;
  phase: 'mutating' | 'visual-tail';
  boardRevisionAtCommit: number | null;
  startedAt: number;
  expiresAt: number;
  expired: boolean;
  mergeReceipt: SpecialMergeTransactionReceipt | null;
  primarySpawn: {
    state: 'unavailable' | 'available' | 'reserved' | 'committed';
    permit: number | null;
    committedCount: number;
    committedCells: readonly Readonly<{ c: number; r: number }>[];
  };
};

export type SpecialMergePrimarySpawnPermit = Readonly<{
  transactionToken: number;
  permit: number;
  cell: Readonly<{ c: number; r: number }>;
}>;

function freezeCell(cell: { c: number; r: number }): Readonly<{ c: number; r: number }> {
  return Object.freeze({ c: cell.c | 0, r: cell.r | 0 });
}

/**
 * Immutable gameplay receipt captured before a Special merge mutates the board.
 * Async visual callbacks may inspect it, but cannot rewrite what was consumed,
 * which cell is reserved, or whether the destination must survive.
 */
export function createSpecialMergeTransactionReceipt(input: {
  token: number;
  kind: SpecialDiceTransactionKind;
  runGeneration: number;
  acceptedBoardRevision: number;
  sourceDieId: string;
  destinationDieId: string;
  sourceCell: { c: number; r: number };
  destinationCell: { c: number; r: number };
  destinationDisposition: SpecialMergeDestinationDisposition;
  expectedPrimarySpawnCount: 0 | 1;
  finalMerge: boolean;
}): SpecialMergeTransactionReceipt {
  const sourceCell = freezeCell(input.sourceCell);
  const destinationCell = freezeCell(input.destinationCell);
  const consumedDieIds = Object.freeze([input.sourceDieId, input.destinationDieId]);
  const reservedCells = Object.freeze([destinationCell]);
  return Object.freeze({
    token: input.token,
    kind: input.kind,
    runGeneration: input.runGeneration,
    acceptedBoardRevision: input.acceptedBoardRevision,
    committedBoardRevision: input.acceptedBoardRevision + 1,
    sourceDieId: input.sourceDieId,
    destinationDieId: input.destinationDieId,
    sourceCell,
    destinationCell,
    consumedDieIds,
    reservedCells,
    destinationDisposition: input.destinationDisposition,
    expectedPrimarySpawnCount: input.expectedPrimarySpawnCount,
    finalMerge: input.finalMerge,
  });
}

export function isSpecialMergeTransactionReceiptCurrent(
  receipt: SpecialMergeTransactionReceipt,
  input: { token: number | null | undefined; runGeneration: number; boardRevision: number },
): boolean {
  return receipt.token === input.token &&
    receipt.runGeneration === input.runGeneration &&
    receipt.committedBoardRevision === input.boardRevision;
}

export function auditSpecialMergeTransactionPostconditions(
  receipt: SpecialMergeTransactionReceipt,
  liveDice: ReadonlyArray<{
    id?: string | null;
    value?: number;
    special?: string | null;
    cleanupOwned?: boolean;
  }>,
  accounting?: {
    committedCount: number;
    committedCells: readonly Readonly<{ c: number; r: number }>[];
    requireSettled?: boolean;
  },
): { ok: boolean; issues: readonly string[] } {
  const issues: string[] = [];
  const liveById = new Map(liveDice.map((die) => [die.id, die]));
  if (liveById.has(receipt.sourceDieId)) issues.push('consumed-source-still-live');

  const destination = liveById.get(receipt.destinationDieId);
  if (destination) {
    issues.push('consumed-destination-still-live');
    if ((destination.value | 0) === 6 && !destination.special && destination.cleanupOwned !== true) {
      issues.push('unowned-plain-six-destination');
    }
  }

  if (accounting) {
    if (receipt.destinationDisposition === 'consume-before-primary-spawn' && destination) {
      issues.push('destination-not-consumed-before-primary-spawn');
    }
    if (accounting.committedCount > receipt.expectedPrimarySpawnCount) {
      issues.push('extra-primary-spawn');
    }
    if (accounting.requireSettled === true && accounting.committedCount !== receipt.expectedPrimarySpawnCount) {
      issues.push('primary-spawn-count-mismatch');
    }
    const reserved = new Set(receipt.reservedCells.map((cell) => `${cell.c},${cell.r}`));
    if (accounting.committedCells.some((cell) => !reserved.has(`${cell.c},${cell.r}`))) {
      issues.push('primary-spawn-outside-reservation');
    }
  }

  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) });
}

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
  private nextPrimarySpawnPermit = 1;
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
      expired: false,
      mergeReceipt: null,
      primarySpawn: {
        state: 'unavailable',
        permit: null,
        committedCount: 0,
        committedCells: [],
      },
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
    if (!this.active) return null;
    return {
      ...this.active,
      primarySpawn: {
        ...this.active.primarySpawn,
        committedCells: this.active.primarySpawn.committedCells.map((cell) => ({ ...cell })),
      },
    };
  }

  markBoardCommitted(token: number | null | undefined, boardRevision: number): boolean {
    if (!this.owns(token) || !this.active) return false;
    this.active.phase = 'visual-tail';
    this.active.boardRevisionAtCommit = boardRevision;
    return true;
  }

  attachMergeReceipt(
    token: number | null | undefined,
    receipt: SpecialMergeTransactionReceipt,
  ): boolean {
    if (!this.owns(token) || !this.active || receipt.token !== token) return false;
    this.active.mergeReceipt = receipt;
    this.active.primarySpawn = {
      state: receipt.expectedPrimarySpawnCount === 1 ? 'available' : 'unavailable',
      permit: null,
      committedCount: 0,
      committedCells: [],
    };
    return true;
  }

  reservePrimarySpawn(
    token: number | null | undefined,
    cell: { c: number; r: number },
  ): SpecialMergePrimarySpawnPermit | null {
    if (!this.owns(token) || !this.active?.mergeReceipt) return null;
    if (this.active.primarySpawn.state !== 'available') return null;
    const normalizedCell = freezeCell(cell);
    const reserved = this.active.mergeReceipt.reservedCells.some(
      (candidate) => candidate.c === normalizedCell.c && candidate.r === normalizedCell.r,
    );
    if (!reserved) return null;
    const permit = this.nextPrimarySpawnPermit++;
    this.active.primarySpawn.state = 'reserved';
    this.active.primarySpawn.permit = permit;
    return Object.freeze({ transactionToken: token!, permit, cell: normalizedCell });
  }

  commitPrimarySpawn(permit: SpecialMergePrimarySpawnPermit): boolean {
    if (!this.owns(permit.transactionToken) || !this.active?.mergeReceipt) return false;
    if (this.active.primarySpawn.state !== 'reserved') return false;
    if (this.active.primarySpawn.permit !== permit.permit) return false;
    this.active.primarySpawn.state = 'committed';
    this.active.primarySpawn.permit = null;
    this.active.primarySpawn.committedCount += 1;
    this.active.primarySpawn.committedCells = [freezeCell(permit.cell)];
    return true;
  }

  cancelPrimarySpawn(permit: SpecialMergePrimarySpawnPermit): boolean {
    if (!this.owns(permit.transactionToken) || !this.active) return false;
    if (this.active.primarySpawn.state !== 'reserved') return false;
    if (this.active.primarySpawn.permit !== permit.permit) return false;
    this.active.primarySpawn.state = 'available';
    this.active.primarySpawn.permit = null;
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

  /**
   * The transaction lock may be released only from a real board snapshot that
   * satisfies the immutable receipt. Keeping this decision inside the owner
   * prevents callers from logging a failed audit and unlocking anyway.
   */
  releaseAfterPostconditionAudit(
    token: number | null | undefined,
    liveDice: Parameters<typeof auditSpecialMergeTransactionPostconditions>[1],
    accounting: NonNullable<Parameters<typeof auditSpecialMergeTransactionPostconditions>[2]>,
  ): { released: boolean; audit: ReturnType<typeof auditSpecialMergeTransactionPostconditions> } {
    if (!this.owns(token) || !this.active?.mergeReceipt) {
      return {
        released: false,
        audit: Object.freeze({ ok: false, issues: Object.freeze(['inactive-special-transaction']) }),
      };
    }
    const audit = auditSpecialMergeTransactionPostconditions(
      this.active.mergeReceipt,
      liveDice,
      accounting,
    );
    if (!audit.ok) return { released: false, audit };
    return { released: this.release(token), audit };
  }

  reset(): void {
    this.active = null;
  }

  private pruneExpired(): void {
    if (this.active && this.active.expiresAt <= this.now()) {
      // Once a merge receipt exists, expiry must remain explicitly recoverable.
      // Silently dropping it would bypass postconditions and unlock fake residue.
      if (this.active.mergeReceipt) {
        this.active.expired = true;
      } else {
        this.active = null;
      }
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
    this.capturedWithGetter = true;
    this.capturedRevision = null;
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

export function canRunOrdinaryMergeDuringVisualTail(
  owner: Pick<SpecialDiceTransactionOwner, 'isVisualTail'>,
  input: {
    sourceValue: number;
    destinationValue: number;
    sourceStableOrdinary: boolean;
    destinationStableOrdinary: boolean;
  },
): boolean {
  if (!owner.isVisualTail()) return false;
  return isStableOrdinaryMerge(input);
}

export function isStableOrdinaryMerge(input: {
  sourceValue: number;
  destinationValue: number;
  sourceStableOrdinary: boolean;
  destinationStableOrdinary: boolean;
}): boolean {
  if (!input.sourceStableOrdinary || !input.destinationStableOrdinary) return false;
  const sourceValue = input.sourceValue | 0;
  const destinationValue = input.destinationValue | 0;
  return sourceValue > 0 && sourceValue < 6 && destinationValue > 0 && destinationValue < 6 &&
    sourceValue + destinationValue <= 6;
}

export function isStableOrdinarySubSixStack(input: {
  sourceValue: number;
  destinationValue: number;
  sourceStableOrdinary: boolean;
  destinationStableOrdinary: boolean;
}): boolean {
  if (!input.sourceStableOrdinary || !input.destinationStableOrdinary) return false;
  const sourceValue = input.sourceValue | 0;
  const destinationValue = input.destinationValue | 0;
  // A second merge-six cannot begin while the first merge-six spawn owner is
  // active. This narrower exception is only for a local stack below six.
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
