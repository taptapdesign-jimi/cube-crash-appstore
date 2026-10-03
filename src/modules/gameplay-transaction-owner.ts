import type { GameplayResolutionDecision } from './gameplay-resolution-engine.ts';
import {
  BoardMutationEpochOwner,
  type BoardMutationCommitResult,
  type BoardMutationEpoch,
  type BoardSpawnPermit,
} from './board-mutation-epoch-owner.ts';

export type GameplayTransactionDecision = Exclude<GameplayResolutionDecision, { type: 'wait' }>;

export type GameplayBoardDieSnapshot = Readonly<{
  id: string;
  c: number;
  r: number;
  value: number;
  stackDepth: number;
  special: string | null;
  locked: boolean;
}>;

export type GameplayBoardSnapshot = Readonly<{
  dice: readonly GameplayBoardDieSnapshot[];
}>;

export type GameplayMergePlan = Readonly<{
  sourceDieId: string;
  destinationDieId: string;
  resultDieId: string;
  resultValue: number;
}>;

export type GameplaySpawnPlanEntry = Readonly<{
  id: string;
  c: number;
  r: number;
  value: number;
  special: string | null;
}>;

export type GameplayTransactionCalculation = Readonly<{
  nextBoard: GameplayBoardSnapshot;
  decision: GameplayTransactionDecision;
  merge: GameplayMergePlan | null;
  spawns: readonly GameplaySpawnPlanEntry[];
  scoreDelta: number;
  wildMeterDelta: number;
}>;

export type GameplayTerminalPresentation =
  | Readonly<{ type: 'new-reward'; reason: string; target: 'journey-board' }>
  | Readonly<{ type: 'clean-board'; reason: string; target: 'arcade-stage' | 'clean-board' }>
  | Readonly<{ type: 'no-moves'; reason: string }>;

export type GameplayAnimationPlanStep =
  | Readonly<{
      type: 'merge';
      transactionId: string;
      boardRevision: number;
      sourceDieId: string;
      destinationDieId: string;
      resultDieId: string;
      resultValue: number;
    }>
  | Readonly<{
      type: 'spawn';
      transactionId: string;
      boardRevision: number;
      spawnId: string;
    }>
  | Readonly<{
      type: 'terminal-handoff';
      transactionId: string;
      boardRevision: number;
      presentation: GameplayTerminalPresentation;
    }>;

export type GameplayTransactionCapabilityKind =
  | 'animation'
  | 'endgame'
  | 'persistence'
  | 'presentation';

export type GameplayTransactionCapability = Readonly<{
  transactionId: string;
  boardRevision: number;
  kind: GameplayTransactionCapabilityKind;
}>;

export type GameplayTransactionSpawnCapability = Readonly<{
  transactionId: string;
  boardRevision: number;
  spawn: GameplaySpawnPlanEntry;
  owner: Pick<BoardMutationEpochOwner, 'commitSpawn'>;
  permit: BoardSpawnPermit;
}>;

export type GameplayPersistencePlan = Readonly<{
  transactionId: string;
  boardRevision: number;
  board: GameplayBoardSnapshot;
  decision: GameplayTransactionDecision;
}>;

export type PreparedGameplayTransaction = Readonly<{
  status: 'prepared';
  transactionId: string;
  baseRevision: number;
  boardRevision: number;
  epoch: BoardMutationEpoch;
  preBoard: GameplayBoardSnapshot;
  nextBoard: GameplayBoardSnapshot;
  decision: GameplayTransactionDecision;
  merge: GameplayMergePlan | null;
  spawnPlan: readonly GameplaySpawnPlanEntry[];
  scoreDelta: number;
  wildMeterDelta: number;
  terminalPresentation: GameplayTerminalPresentation | null;
  animationPlan: readonly GameplayAnimationPlanStep[];
  persistencePlan: GameplayPersistencePlan;
  capabilities: Readonly<{
    animation: GameplayTransactionCapability;
    endgame: GameplayTransactionCapability;
    persistence: GameplayTransactionCapability;
    presentation: GameplayTransactionCapability;
    spawns: readonly GameplayTransactionSpawnCapability[];
  }>;
}>;

export type CommittedGameplayTransaction = Omit<PreparedGameplayTransaction, 'status'> & Readonly<{
  status: 'committed';
}>;

export type GameplayTransactionPrepareResult =
  | Readonly<{ accepted: true; transaction: PreparedGameplayTransaction }>
  | Readonly<{
      accepted: false;
      reason: 'stale-revision' | 'transaction-in-progress' | 'invalid-plan';
      detail?: string;
    }>;

export type GameplayTransactionCommitResult =
  | Readonly<{ accepted: true; transaction: CommittedGameplayTransaction }>
  | Readonly<{
      accepted: false;
      reason: 'stale-revision' | 'stale-transaction' | 'mutation-rejected';
      mutation?: BoardMutationCommitResult;
    }>;

type PrepareGameplayTransactionInput = Readonly<{
  expectedRevision: number;
  preBoard: GameplayBoardSnapshot;
  calculate: (
    immutablePreBoard: GameplayBoardSnapshot,
    identity: Readonly<{ transactionId: string; boardRevision: number }>,
  ) => GameplayTransactionCalculation;
}>;

function freezeDie(die: GameplayBoardDieSnapshot): GameplayBoardDieSnapshot {
  return Object.freeze({
    id: String(die.id),
    c: die.c | 0,
    r: die.r | 0,
    value: die.value | 0,
    stackDepth: Math.max(1, die.stackDepth | 0),
    special: typeof die.special === 'string' ? die.special : null,
    locked: die.locked === true,
  });
}

function freezeBoard(board: GameplayBoardSnapshot): GameplayBoardSnapshot {
  return Object.freeze({
    dice: Object.freeze((Array.isArray(board?.dice) ? board.dice : []).map(freezeDie)),
  });
}

function freezeMerge(merge: GameplayMergePlan | null): GameplayMergePlan | null {
  if (!merge) return null;
  return Object.freeze({
    sourceDieId: String(merge.sourceDieId),
    destinationDieId: String(merge.destinationDieId),
    resultDieId: String(merge.resultDieId),
    resultValue: merge.resultValue | 0,
  });
}

function freezeSpawn(spawn: GameplaySpawnPlanEntry): GameplaySpawnPlanEntry {
  return Object.freeze({
    id: String(spawn.id),
    c: spawn.c | 0,
    r: spawn.r | 0,
    value: spawn.value | 0,
    special: typeof spawn.special === 'string' ? spawn.special : null,
  });
}

function freezeDecision(decision: GameplayTransactionDecision): GameplayTransactionDecision {
  return Object.freeze({ ...decision }) as GameplayTransactionDecision;
}

function getTerminalPresentation(
  decision: GameplayTransactionDecision,
): GameplayTerminalPresentation | null {
  if (decision.type === 'fail') {
    return Object.freeze({ type: 'no-moves', reason: decision.reason });
  }
  if (decision.type !== 'complete') return null;
  if (decision.target === 'journey-board') {
    return Object.freeze({
      type: 'new-reward',
      reason: decision.reason,
      target: decision.target,
    });
  }
  return Object.freeze({
    type: 'clean-board',
    reason: decision.reason,
    target: decision.target,
  });
}

function validateBoard(board: GameplayBoardSnapshot, label: string): string | null {
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const die of board.dice) {
    if (!die.id) return `${label} contains a die without an id`;
    if (ids.has(die.id)) return `${label} contains duplicate die id ${die.id}`;
    ids.add(die.id);
    const cell = `${die.c},${die.r}`;
    if (cells.has(cell)) return `${label} contains duplicate occupied cell ${cell}`;
    cells.add(cell);
  }
  return null;
}

function validateCalculation(
  preBoard: GameplayBoardSnapshot,
  calculation: GameplayTransactionCalculation,
): string | null {
  const boardError = validateBoard(calculation.nextBoard, 'nextBoard');
  if (boardError) return boardError;
  const terminal = calculation.decision.type === 'complete' || calculation.decision.type === 'fail';
  if (terminal && calculation.spawns.length > 0) {
    return 'terminal transaction cannot contain a continuation spawn plan';
  }
  if (calculation.decision.type === 'spawn' && calculation.spawns.length === 0) {
    return 'spawn decision requires at least one planned spawn';
  }
  const nextById = new Map(calculation.nextBoard.dice.map((die) => [die.id, die]));
  for (const spawn of calculation.spawns) {
    const nextDie = nextById.get(spawn.id);
    if (!nextDie) return `planned spawn ${spawn.id} is absent from nextBoard`;
    if (
      nextDie.c !== spawn.c
      || nextDie.r !== spawn.r
      || nextDie.value !== spawn.value
      || nextDie.special !== spawn.special
    ) {
      return `planned spawn ${spawn.id} does not match its nextBoard die`;
    }
  }
  if (calculation.merge) {
    const preIds = new Set(preBoard.dice.map((die) => die.id));
    if (!preIds.has(calculation.merge.sourceDieId)) {
      return `merge source ${calculation.merge.sourceDieId} is absent from preBoard`;
    }
    if (!preIds.has(calculation.merge.destinationDieId)) {
      return `merge destination ${calculation.merge.destinationDieId} is absent from preBoard`;
    }
    if (!nextById.has(calculation.merge.resultDieId)) {
      return `merge result ${calculation.merge.resultDieId} is absent from nextBoard`;
    }
  }
  if (
    calculation.decision.type === 'complete'
    && calculation.decision.reason.startsWith('final_')
  ) {
    if (!calculation.merge) return 'final merge transaction requires one merge plan';
    const residualIds = calculation.nextBoard.dice
      .filter((die) => die.id !== calculation.merge?.resultDieId)
      .map((die) => die.id);
    if (residualIds.length > 0) {
      return `final merge nextBoard contains residual gameplay dice: ${residualIds.join(',')}`;
    }
  }
  return null;
}

function makeCapability(
  transactionId: string,
  boardRevision: number,
  kind: GameplayTransactionCapabilityKind,
): GameplayTransactionCapability {
  return Object.freeze({ transactionId, boardRevision, kind });
}

/**
 * Owns one immutable logical-board commit and all side-effect capabilities
 * derived from it. The calculator runs exactly once against a frozen snapshot.
 * Presentation, persistence, animation and spawn work all carry the same
 * transaction identity and board revision.
 */
export class GameplayTransactionOwner {
  private revision: number;
  private transactionSequence = 0;
  private prepared: PreparedGameplayTransaction | null = null;
  private committed: CommittedGameplayTransaction | null = null;
  private readonly issuedCapabilities = new WeakSet<object>();

  constructor(
    initialRevision = 0,
    private readonly mutationOwner = new BoardMutationEpochOwner(),
  ) {
    this.revision = Math.max(0, Math.trunc(initialRevision));
  }

  public prepare(input: PrepareGameplayTransactionInput): GameplayTransactionPrepareResult {
    if (this.prepared) return { accepted: false, reason: 'transaction-in-progress' };
    if (input.expectedRevision !== this.revision) {
      return { accepted: false, reason: 'stale-revision' };
    }

    const transactionId = `gameplay:${++this.transactionSequence}`;
    const boardRevision = this.revision + 1;
    const preBoard = freezeBoard(input.preBoard);
    const preBoardError = validateBoard(preBoard, 'preBoard');
    if (preBoardError) {
      return { accepted: false, reason: 'invalid-plan', detail: preBoardError };
    }

    let calculation: GameplayTransactionCalculation;
    try {
      calculation = input.calculate(preBoard, Object.freeze({ transactionId, boardRevision }));
    } catch (error) {
      return {
        accepted: false,
        reason: 'invalid-plan',
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    const nextBoard = freezeBoard(calculation.nextBoard);
    const decision = freezeDecision(calculation.decision);
    const merge = freezeMerge(calculation.merge);
    const spawnPlan = Object.freeze(calculation.spawns.map(freezeSpawn));
    const normalizedCalculation = {
      ...calculation,
      nextBoard,
      decision,
      merge,
      spawns: spawnPlan,
    };
    const calculationError = validateCalculation(preBoard, normalizedCalculation);
    if (calculationError) {
      return { accepted: false, reason: 'invalid-plan', detail: calculationError };
    }

    const epoch = this.mutationOwner.beginMutation({
      transactionId,
      boardRevision,
      spawnBudget: spawnPlan.length,
    });
    // Opening a successor mutation epoch synchronously retires every callback
    // capability from the preceding committed revision, even if this prepared
    // transaction is later abandoned.
    this.committed = null;
    const spawnCapabilities: GameplayTransactionSpawnCapability[] = [];
    for (const spawn of spawnPlan) {
      const permit = this.mutationOwner.issueSpawnPermit(epoch);
      if (!permit) {
        this.mutationOwner.invalidate();
        return {
          accepted: false,
          reason: 'invalid-plan',
          detail: 'unable to issue the exact immutable spawn capability set',
        };
      }
      spawnCapabilities.push(Object.freeze({
        transactionId,
        boardRevision,
        spawn,
        owner: this.mutationOwner,
        permit,
      }));
    }

    const terminalPresentation = getTerminalPresentation(decision);
    const animationPlan: GameplayAnimationPlanStep[] = [];
    if (merge) {
      animationPlan.push(Object.freeze({
        type: 'merge',
        transactionId,
        boardRevision,
        ...merge,
      }));
    }
    for (const spawn of spawnPlan) {
      animationPlan.push(Object.freeze({
        type: 'spawn',
        transactionId,
        boardRevision,
        spawnId: spawn.id,
      }));
    }
    if (terminalPresentation) {
      animationPlan.push(Object.freeze({
        type: 'terminal-handoff',
        transactionId,
        boardRevision,
        presentation: terminalPresentation,
      }));
    }

    const persistencePlan: GameplayPersistencePlan = Object.freeze({
      transactionId,
      boardRevision,
      board: nextBoard,
      decision,
    });
    const capabilities = Object.freeze({
      animation: makeCapability(transactionId, boardRevision, 'animation'),
      endgame: makeCapability(transactionId, boardRevision, 'endgame'),
      persistence: makeCapability(transactionId, boardRevision, 'persistence'),
      presentation: makeCapability(transactionId, boardRevision, 'presentation'),
      spawns: Object.freeze(spawnCapabilities),
    });
    this.issuedCapabilities.add(capabilities.animation);
    this.issuedCapabilities.add(capabilities.endgame);
    this.issuedCapabilities.add(capabilities.persistence);
    this.issuedCapabilities.add(capabilities.presentation);
    spawnCapabilities.forEach((capability) => this.issuedCapabilities.add(capability));

    this.prepared = Object.freeze({
      status: 'prepared',
      transactionId,
      baseRevision: this.revision,
      boardRevision,
      epoch,
      preBoard,
      nextBoard,
      decision,
      merge,
      spawnPlan,
      scoreDelta: Number.isFinite(calculation.scoreDelta) ? calculation.scoreDelta : 0,
      wildMeterDelta: Number.isFinite(calculation.wildMeterDelta) ? calculation.wildMeterDelta : 0,
      terminalPresentation,
      animationPlan: Object.freeze(animationPlan),
      persistencePlan,
      capabilities,
    });
    return { accepted: true, transaction: this.prepared };
  }

  public commit(transaction: PreparedGameplayTransaction): GameplayTransactionCommitResult {
    if (this.prepared !== transaction) {
      return { accepted: false, reason: 'stale-transaction' };
    }
    if (transaction.baseRevision !== this.revision) {
      this.abort(transaction);
      return { accepted: false, reason: 'stale-revision' };
    }

    const isTerminal = transaction.terminalPresentation !== null;
    const mutation = isTerminal
      ? this.mutationOwner.commitComplete(transaction.epoch)
      : transaction.spawnPlan.length > 0
        ? this.mutationOwner.sealSpawnPlan(transaction.epoch)
        : null;
    if (mutation && mutation.accepted === false) {
      this.abort(transaction);
      return { accepted: false, reason: 'mutation-rejected', mutation };
    }

    this.revision = transaction.boardRevision;
    this.prepared = null;
    this.committed = Object.freeze({ ...transaction, status: 'committed' });
    return { accepted: true, transaction: this.committed };
  }

  public abort(transaction: PreparedGameplayTransaction): boolean {
    if (this.prepared !== transaction) return false;
    this.prepared = null;
    this.mutationOwner.invalidate();
    return true;
  }

  public isCapabilityCurrent(
    capability: Pick<GameplayTransactionCapability, 'transactionId' | 'boardRevision'>,
  ): boolean {
    return typeof capability === 'object'
      && capability !== null
      && this.issuedCapabilities.has(capability)
      && this.committed?.transactionId === capability.transactionId
      && this.committed.boardRevision === capability.boardRevision
      && this.revision === capability.boardRevision;
  }

  public commitSpawn(capability: GameplayTransactionSpawnCapability): BoardMutationCommitResult {
    if (!this.isCapabilityCurrent(capability)) {
      const identityMatches = this.committed?.transactionId === capability?.transactionId
        && this.committed.boardRevision === capability?.boardRevision;
      return {
        accepted: false,
        outcome: this.committed
          ? this.mutationOwner.getOutcome(this.committed.epoch) ?? 'pending'
          : 'pending',
        reason: identityMatches ? 'unknown-permit' : 'stale-epoch',
      };
    }
    return capability.owner.commitSpawn(capability.permit);
  }

  public getRevision(): number {
    return this.revision;
  }

  public getCommitted(): CommittedGameplayTransaction | null {
    return this.committed;
  }
}
