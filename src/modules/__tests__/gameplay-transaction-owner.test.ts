import { BoardMutationEpochOwner } from '../board-mutation-epoch-owner';
import {
  GameplayTransactionOwner,
  type GameplayBoardSnapshot,
} from '../gameplay-transaction-owner';

function board(...dice: Array<{
  id: string;
  c: number;
  r: number;
  value: number;
  special?: string | null;
  locked?: boolean;
}>): GameplayBoardSnapshot {
  return {
    dice: dice.map((die) => ({
      ...die,
      stackDepth: 1,
      special: die.special ?? null,
      locked: die.locked ?? false,
    })),
  };
}

describe('GameplayTransactionOwner', () => {
  test('calculates once and derives merge, New Reward, save and animation from one immutable revision', () => {
    const mutationOwner = new BoardMutationEpochOwner();
    const owner = new GameplayTransactionOwner(7, mutationOwner);
    const calculate = jest.fn(() => ({
      nextBoard: board({ id: 'dst', c: 1, r: 0, value: 6 }),
      decision: {
        type: 'complete' as const,
        target: 'journey-board' as const,
        reason: 'final_regular_merge6',
      },
      merge: {
        sourceDieId: 'src',
        destinationDieId: 'dst',
        resultDieId: 'dst',
        resultValue: 6,
      },
      spawns: [],
      scoreDelta: 6,
      wildMeterDelta: 0,
    }));

    const preparedResult = owner.prepare({
      expectedRevision: 7,
      preBoard: board(
        { id: 'src', c: 0, r: 0, value: 4 },
        { id: 'dst', c: 1, r: 0, value: 2 },
      ),
      calculate,
    });
    expect(preparedResult.accepted).toBe(true);
    if (!preparedResult.accepted) return;

    const committedResult = owner.commit(preparedResult.transaction);
    expect(committedResult.accepted).toBe(true);
    if (!committedResult.accepted) return;
    const transaction = committedResult.transaction;

    expect(calculate).toHaveBeenCalledTimes(1);
    expect(transaction).toMatchObject({
      status: 'committed',
      baseRevision: 7,
      boardRevision: 8,
      decision: { type: 'complete', target: 'journey-board' },
      terminalPresentation: { type: 'new-reward', target: 'journey-board' },
      spawnPlan: [],
    });
    expect(transaction.persistencePlan).toMatchObject({
      transactionId: transaction.transactionId,
      boardRevision: 8,
      board: transaction.nextBoard,
    });
    expect(transaction.animationPlan).toEqual([
      expect.objectContaining({
        type: 'merge',
        transactionId: transaction.transactionId,
        boardRevision: 8,
      }),
      expect.objectContaining({
        type: 'terminal-handoff',
        transactionId: transaction.transactionId,
        boardRevision: 8,
        presentation: transaction.terminalPresentation,
      }),
    ]);
    expect(Object.isFrozen(transaction.preBoard)).toBe(true);
    expect(Object.isFrozen(transaction.preBoard.dice)).toBe(true);
    expect(Object.isFrozen(transaction.preBoard.dice[0])).toBe(true);
    expect(Object.isFrozen(transaction.nextBoard)).toBe(true);
    expect(mutationOwner.getOutcome(transaction.epoch)).toBe('complete');
  });

  test('deterministically reproduces and blocks New Reward with two late value-5 spawns', () => {
    const mutationOwner = new BoardMutationEpochOwner();

    // Exact bad interleaving: two continuation callbacks have already captured
    // value 5 before the final merge transaction reaches New Reward.
    const staleEpoch = mutationOwner.beginMutation({
      transactionId: 'pre-final-continuation',
      boardRevision: 12,
      spawnBudget: 2,
    });
    const queued = [
      { value: 5, permit: mutationOwner.issueSpawnPermit(staleEpoch)! },
      { value: 5, permit: mutationOwner.issueSpawnPermit(staleEpoch)! },
    ];

    const owner = new GameplayTransactionOwner(12, mutationOwner);
    const prepared = owner.prepare({
      expectedRevision: 12,
      preBoard: board(
        { id: 'src', c: 0, r: 0, value: 4 },
        { id: 'dst', c: 1, r: 0, value: 2 },
      ),
      calculate: () => ({
        nextBoard: board({ id: 'dst', c: 1, r: 0, value: 6 }),
        decision: {
          type: 'complete',
          target: 'journey-board',
          reason: 'final_regular_merge6',
        },
        merge: {
          sourceDieId: 'src',
          destinationDieId: 'dst',
          resultDieId: 'dst',
          resultValue: 6,
        },
        spawns: [],
        scoreDelta: 6,
        wildMeterDelta: 0,
      }),
    });
    expect(prepared.accepted).toBe(true);
    if (!prepared.accepted) return;
    const committed = owner.commit(prepared.transaction);
    expect(committed.accepted).toBe(true);
    if (!committed.accepted) return;

    const visibleValues = committed.transaction.nextBoard.dice.map((die) => die.value);
    const lateResults = queued.map(({ value, permit }) => {
      const result = mutationOwner.commitSpawn(permit);
      if (result.accepted) visibleValues.push(value);
      return result;
    });

    expect(committed.transaction.terminalPresentation?.type).toBe('new-reward');
    expect(committed.transaction.capabilities.spawns).toEqual([]);
    expect(lateResults).toEqual([
      { accepted: false, outcome: 'complete', reason: 'stale-epoch' },
      { accepted: false, outcome: 'complete', reason: 'stale-epoch' },
    ]);
    expect(visibleValues).toEqual([6]);
  });

  test('seals the exact spawn plan before async mutation and cannot later become terminal', () => {
    const mutationOwner = new BoardMutationEpochOwner();
    const owner = new GameplayTransactionOwner(2, mutationOwner);
    const prepared = owner.prepare({
      expectedRevision: 2,
      preBoard: board({ id: 'merge6', c: 0, r: 0, value: 6 }),
      calculate: () => ({
        nextBoard: board(
          { id: 'merge6', c: 0, r: 0, value: 6 },
          { id: 'spawn-a', c: 1, r: 0, value: 5 },
          { id: 'spawn-b', c: 2, r: 0, value: 5 },
        ),
        decision: { type: 'spawn', reason: 'merge6_spawn_required' },
        merge: null,
        spawns: [
          { id: 'spawn-a', c: 1, r: 0, value: 5, special: null },
          { id: 'spawn-b', c: 2, r: 0, value: 5, special: null },
        ],
        scoreDelta: 0,
        wildMeterDelta: 0,
      }),
    });
    expect(prepared.accepted).toBe(true);
    if (!prepared.accepted) return;
    const committed = owner.commit(prepared.transaction);
    expect(committed.accepted).toBe(true);
    if (!committed.accepted) return;

    expect(mutationOwner.getOutcome(committed.transaction.epoch)).toBe('spawn');
    expect(mutationOwner.commitComplete(committed.transaction.epoch)).toEqual({
      accepted: false,
      outcome: 'spawn',
      reason: 'spawn-committed',
    });
    expect(committed.transaction.capabilities.spawns).toHaveLength(2);
    expect(owner.commitSpawn(committed.transaction.capabilities.spawns[0])).toEqual({
      accepted: true,
      outcome: 'spawn',
    });
    expect(owner.commitSpawn(committed.transaction.capabilities.spawns[1])).toEqual({
      accepted: true,
      outcome: 'spawn',
    });
    expect(mutationOwner.issueSpawnPermit(committed.transaction.epoch)).toBeNull();
  });

  test('rejects a terminal transaction that also plans continuation spawns', () => {
    const owner = new GameplayTransactionOwner();
    const result = owner.prepare({
      expectedRevision: 0,
      preBoard: board(
        { id: 'src', c: 0, r: 0, value: 4 },
        { id: 'dst', c: 1, r: 0, value: 2 },
      ),
      calculate: () => ({
        nextBoard: board(
          { id: 'dst', c: 1, r: 0, value: 6 },
          { id: 'illegal-spawn', c: 2, r: 0, value: 5 },
        ),
        decision: {
          type: 'complete',
          target: 'journey-board',
          reason: 'final_regular_merge6',
        },
        merge: {
          sourceDieId: 'src',
          destinationDieId: 'dst',
          resultDieId: 'dst',
          resultValue: 6,
        },
        spawns: [{ id: 'illegal-spawn', c: 2, r: 0, value: 5, special: null }],
        scoreDelta: 6,
        wildMeterDelta: 0,
      }),
    });

    expect(result).toEqual({
      accepted: false,
      reason: 'invalid-plan',
      detail: 'terminal transaction cannot contain a continuation spawn plan',
    });
    expect(owner.getRevision()).toBe(0);
  });

  test('rejects the observed final-merge snapshot if two value-5 dice are already in its committed board', () => {
    const owner = new GameplayTransactionOwner();
    const result = owner.prepare({
      expectedRevision: 0,
      preBoard: board(
        { id: 'src', c: 0, r: 0, value: 4 },
        { id: 'dst', c: 1, r: 0, value: 2 },
      ),
      calculate: () => ({
        nextBoard: board(
          { id: 'dst', c: 1, r: 0, value: 6 },
          { id: 'late-five-a', c: 2, r: 0, value: 5 },
          { id: 'late-five-b', c: 3, r: 0, value: 5 },
        ),
        decision: {
          type: 'complete',
          target: 'journey-board',
          reason: 'final_regular_merge6',
        },
        merge: {
          sourceDieId: 'src',
          destinationDieId: 'dst',
          resultDieId: 'dst',
          resultValue: 6,
        },
        spawns: [],
        scoreDelta: 6,
        wildMeterDelta: 0,
      }),
    });

    expect(result).toEqual({
      accepted: false,
      reason: 'invalid-plan',
      detail: 'final merge nextBoard contains residual gameplay dice: late-five-a,late-five-b',
    });
    expect(owner.getRevision()).toBe(0);
  });

  test('a successor prepared revision retires every old async capability', () => {
    const owner = new GameplayTransactionOwner();
    const first = owner.prepare({
      expectedRevision: 0,
      preBoard: board({ id: 'one', c: 0, r: 0, value: 1 }),
      calculate: () => ({
        nextBoard: board({ id: 'one', c: 0, r: 0, value: 1 }),
        decision: { type: 'continue', reason: 'board_playable' },
        merge: null,
        spawns: [],
        scoreDelta: 0,
        wildMeterDelta: 0,
      }),
    });
    expect(first.accepted).toBe(true);
    if (!first.accepted) return;
    const firstCommit = owner.commit(first.transaction);
    expect(firstCommit.accepted).toBe(true);
    if (!firstCommit.accepted) return;
    expect(owner.isCapabilityCurrent(firstCommit.transaction.capabilities.persistence)).toBe(true);

    const successor = owner.prepare({
      expectedRevision: 1,
      preBoard: firstCommit.transaction.nextBoard,
      calculate: (preBoard) => ({
        nextBoard: preBoard,
        decision: { type: 'continue', reason: 'board_playable' },
        merge: null,
        spawns: [],
        scoreDelta: 0,
        wildMeterDelta: 0,
      }),
    });
    expect(successor.accepted).toBe(true);
    expect(owner.isCapabilityCurrent(firstCommit.transaction.capabilities.persistence)).toBe(false);
  });
});
