import {
  canRunOrdinaryStackDuringVisualTail,
  getSpecialDiceEndgameBlock,
  PostCommitBoardRevisionGuard,
  SpecialDiceTransactionOwner,
} from '../special-dice-transaction-owner';

test('serializes every special archetype behind one immutable owner token', () => {
  let now = 1000;
  const owner = new SpecialDiceTransactionOwner(() => now, 5000);

  const flower = owner.claim('tnt');
  expect(flower).toBe(1);
  expect(owner.isActive()).toBe(true);
  expect(owner.claim('magnet')).toBeNull();
  expect(owner.claim('juice')).toBeNull();
  expect(owner.claim('star')).toBeNull();

  expect(owner.release(999)).toBe(false);
  expect(owner.isActive()).toBe(true);
  expect(owner.release(flower)).toBe(true);
  expect(owner.isActive()).toBe(false);

  const honey = owner.claim('magnet');
  expect(honey).toBe(2);
  expect(owner.snapshot()).toMatchObject({ token: 2, kind: 'magnet', startedAt: 1000 });
});

test('post-commit work cannot mutate a newer board revision', () => {
  let boardRevision = 12;
  const guard = new PostCommitBoardRevisionGuard(() => boardRevision);
  const mutations: string[] = [];

  expect(guard.capture()).toBe(12);
  expect(guard.runIfCurrent(() => mutations.push('current'))).toBe(true);

  // Models an accepted ordinary stack during Magnet's 1200 ms visual tail.
  boardRevision += 1;
  expect(guard.runIfCurrent(() => mutations.push('stale-fallback'))).toBe(false);
  expect(guard.runIfCurrent(() => mutations.push('stale-unlock'))).toBe(false);
  expect(guard.runIfCurrent(() => mutations.push('stale-endgame'))).toBe(false);
  expect(mutations).toEqual(['current']);
});

test('watchdog expiry recovers ownership without retaining gameplay objects', () => {
  let now = 0;
  const owner = new SpecialDiceTransactionOwner(() => now, 1000);
  const token = owner.claim('juice');
  expect(owner.owns(token)).toBe(true);

  now = 1001;
  expect(owner.isActive()).toBe(false);
  expect(owner.release(token)).toBe(false);
  expect(owner.claim('star')).toBe(2);

  owner.reset();
  expect(owner.isActive()).toBe(false);
});

test('only the active token can enter the post-commit visual-tail phase', () => {
  const owner = new SpecialDiceTransactionOwner(() => 1000, 5000);
  const token = owner.claim('magnet');

  expect(owner.isVisualTail()).toBe(false);
  expect(owner.markBoardCommitted((token || 0) + 1, 7)).toBe(false);
  expect(owner.isVisualTail()).toBe(false);
  expect(owner.markBoardCommitted(token, 7)).toBe(true);
  expect(owner.isVisualTail()).toBe(true);
  expect(owner.isVisualTailCurrent(7)).toBe(true);
  expect(owner.isVisualTailCurrent(8)).toBe(false);
  expect(owner.snapshot()).toMatchObject({ token, phase: 'visual-tail', boardRevisionAtCommit: 7 });
});

test('visual tail permits stable ordinary sub-six stacks but no new board transaction', () => {
  const owner = new SpecialDiceTransactionOwner(() => 1000, 5000);
  const token = owner.claim('magnet');
  const decision = (sourceValue: number, destinationValue: number, stable = true) =>
    canRunOrdinaryStackDuringVisualTail(owner, {
      sourceValue,
      destinationValue,
      sourceStableOrdinary: stable,
      destinationStableOrdinary: stable,
    });

  expect(decision(1, 2)).toBe(false);
  owner.markBoardCommitted(token, 3);
  expect(decision(1, 2)).toBe(true);
  expect(decision(3, 3)).toBe(false);
  expect(decision(1, 5)).toBe(false);
  expect(decision(2, 2, false)).toBe(false);
});

test('endgame observation stays blocked until the special transaction releases', () => {
  let now = 73680;
  const owner = new SpecialDiceTransactionOwner(() => now, 15000);
  const token = owner.claim('juice');

  expect(getSpecialDiceEndgameBlock(owner)).toEqual(expect.objectContaining({
    token,
    kind: 'juice',
    startedAt: 73680,
  }));

  // This covers the physical incident's 67 ms absorb window: the temporary
  // plain value-6 is still transaction-owned and cannot be treated as residue.
  now += 67;
  expect(getSpecialDiceEndgameBlock(owner)?.token).toBe(token);

  expect(owner.release(token)).toBe(true);
  expect(getSpecialDiceEndgameBlock(owner)).toBeNull();
});
