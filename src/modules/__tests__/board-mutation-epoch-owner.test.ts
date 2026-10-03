import { BoardMutationEpochOwner } from '../board-mutation-epoch-owner';

describe('BoardMutationEpochOwner', () => {
  test('terminal commit synchronously revokes every pending spawn capability', () => {
    const owner = new BoardMutationEpochOwner();
    const epoch = owner.beginMutation();
    const first = owner.issueSpawnPermit(epoch)!;
    const second = owner.issueSpawnPermit(epoch)!;

    expect(owner.commitComplete(epoch)).toEqual({ accepted: true, outcome: 'complete' });
    expect(owner.commitSpawn(first)).toEqual({
      accepted: false,
      outcome: 'complete',
      reason: 'terminal-committed',
    });
    expect(owner.commitSpawn(second)).toEqual({
      accepted: false,
      outcome: 'complete',
      reason: 'terminal-committed',
    });
    expect(owner.issueSpawnPermit(epoch)).toBeNull();
  });

  test('one mutation epoch can commit complete XOR spawn, never both', () => {
    const owner = new BoardMutationEpochOwner();
    const epoch = owner.beginMutation();
    const first = owner.issueSpawnPermit(epoch)!;
    const second = owner.issueSpawnPermit(epoch)!;

    expect(owner.commitSpawn(first)).toEqual({ accepted: true, outcome: 'spawn' });
    expect(owner.commitComplete(epoch)).toEqual({
      accepted: false,
      outcome: 'spawn',
      reason: 'spawn-committed',
    });
    expect(owner.commitSpawn(second)).toEqual({ accepted: true, outcome: 'spawn' });
    expect(owner.commitSpawn(first)).toEqual({
      accepted: false,
      outcome: 'spawn',
      reason: 'permit-consumed',
    });
  });

  test('a successor epoch invalidates delayed work from its predecessor', () => {
    const owner = new BoardMutationEpochOwner();
    const retiredEpoch = owner.beginMutation();
    const retiredPermit = owner.issueSpawnPermit(retiredEpoch)!;
    const currentEpoch = owner.beginMutation();

    expect(owner.commitSpawn(retiredPermit)).toEqual({
      accepted: false,
      outcome: 'pending',
      reason: 'stale-epoch',
    });
    expect(owner.commitComplete(retiredEpoch)).toEqual({
      accepted: false,
      outcome: 'pending',
      reason: 'stale-epoch',
    });
    expect(owner.getOutcome(currentEpoch)).toBe('pending');
  });

  test('does not accept a forged permit that was never issued by the owner', () => {
    const owner = new BoardMutationEpochOwner();
    const epoch = owner.beginMutation();

    expect(owner.commitSpawn({
      epoch: epoch.value,
      sequence: 999,
      transactionId: epoch.transactionId,
      boardRevision: epoch.boardRevision,
    })).toEqual({
      accepted: false,
      outcome: 'pending',
      reason: 'unknown-permit',
    });
  });

  test('an immutable spawn budget cannot grow after the transaction is planned', () => {
    const owner = new BoardMutationEpochOwner();
    const epoch = owner.beginMutation({
      transactionId: 'merge:17',
      boardRevision: 42,
      spawnBudget: 2,
    });

    const first = owner.issueSpawnPermit(epoch)!;
    const second = owner.issueSpawnPermit(epoch)!;
    expect(owner.issueSpawnPermit(epoch)).toBeNull();
    expect(owner.sealSpawnPlan(epoch)).toEqual({ accepted: true, outcome: 'spawn' });
    expect(owner.commitComplete(epoch)).toEqual({
      accepted: false,
      outcome: 'spawn',
      reason: 'spawn-committed',
    });
    expect(owner.commitSpawn(first)).toEqual({ accepted: true, outcome: 'spawn' });
    expect(owner.commitSpawn(second)).toEqual({ accepted: true, outcome: 'spawn' });
    expect(owner.issueSpawnPermit(epoch)).toBeNull();
  });

  test('final merge revokes two queued value-5 spawns before New Reward ownership', () => {
    const owner = new BoardMutationEpochOwner();
    const epoch = owner.beginMutation({
      transactionId: 'journey-final-merge',
      boardRevision: 9,
      spawnBudget: 2,
    });
    const queuedValue5Spawns = [
      { value: 5, permit: owner.issueSpawnPermit(epoch)! },
      { value: 5, permit: owner.issueSpawnPermit(epoch)! },
    ];

    expect(owner.commitComplete(epoch)).toEqual({ accepted: true, outcome: 'complete' });
    const renderedBoardValues: number[] = [6];
    queuedValue5Spawns.forEach(({ value, permit }) => {
      if (owner.commitSpawn(permit).accepted) renderedBoardValues.push(value);
    });

    expect(renderedBoardValues).toEqual([6]);
    expect(owner.getOutcome(epoch)).toBe('complete');
  });
});
