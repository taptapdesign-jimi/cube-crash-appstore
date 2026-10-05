import {
  auditSpecialMergeTransactionPostconditions,
  canRunOrdinaryMergeDuringVisualTail,
  createSpecialMergeTransactionReceipt,
  isStableOrdinaryMerge,
  isStableOrdinarySubSixStack,
  getSpecialDiceEndgameBlock,
  isSpecialMergeTransactionReceiptCurrent,
  PostCommitBoardRevisionGuard,
  SpecialDiceTransactionOwner,
} from '../special-dice-transaction-owner';

test.each(['star', 'juice', 'magnet', 'tnt'] as const)(
  '%s merge receipt immutably owns both consumed dice and the destination cell',
  (kind) => {
    const receipt = createSpecialMergeTransactionReceipt({
      token: 17,
      kind,
      runGeneration: 4,
      acceptedBoardRevision: 10,
      sourceDieId: `${kind}-source`,
      destinationDieId: `${kind}-destination`,
      sourceCell: { c: 1, r: 2 },
      destinationCell: { c: 3, r: 4 },
      destinationDisposition: 'consume-after-continuation',
      expectedPrimarySpawnCount: 1,
      finalMerge: false,
    });

    expect(receipt).toMatchObject({
      token: 17,
      kind,
      acceptedBoardRevision: 10,
      committedBoardRevision: 11,
      consumedDieIds: [`${kind}-source`, `${kind}-destination`],
      reservedCells: [{ c: 3, r: 4 }],
      expectedPrimarySpawnCount: 1,
    });
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt.consumedDieIds)).toBe(true);
    expect(Object.isFrozen(receipt.reservedCells)).toBe(true);
    expect(isSpecialMergeTransactionReceiptCurrent(receipt, {
      token: 17,
      runGeneration: 4,
      boardRevision: 11,
    })).toBe(true);
    expect(isSpecialMergeTransactionReceiptCurrent(receipt, {
      token: 17,
      runGeneration: 4,
      boardRevision: 12,
    })).toBe(false);
  },
);

test('Special merge postconditions reject the fake unowned destination six', () => {
  const receipt = createSpecialMergeTransactionReceipt({
    token: 3,
    kind: 'juice',
    runGeneration: 1,
    acceptedBoardRevision: 7,
    sourceDieId: 'bottle',
    destinationDieId: 'destination',
    sourceCell: { c: 0, r: 0 },
    destinationCell: { c: 1, r: 0 },
    destinationDisposition: 'consume-after-continuation',
    expectedPrimarySpawnCount: 1,
    finalMerge: false,
  });

  expect(auditSpecialMergeTransactionPostconditions(receipt, [
    { id: 'destination', value: 6, special: null, cleanupOwned: false },
  ])).toEqual({
    ok: false,
    issues: ['consumed-destination-still-live', 'unowned-plain-six-destination'],
  });
  expect(auditSpecialMergeTransactionPostconditions(receipt, [
    { id: 'fresh-spawn', value: 2, special: null },
  ], {
    committedCount: 1,
    committedCells: [{ c: 1, r: 0 }],
    requireSettled: true,
  })).toEqual({ ok: true, issues: [] });
});

test('transaction owner fails closed until fake six residue is removed from the live board snapshot', () => {
  const owner = new SpecialDiceTransactionOwner(() => 1000, 5000);
  const token = owner.claim('juice')!;
  const receipt = createSpecialMergeTransactionReceipt({
    token,
    kind: 'juice',
    runGeneration: 1,
    acceptedBoardRevision: 7,
    sourceDieId: 'bottle',
    destinationDieId: 'destination',
    sourceCell: { c: 0, r: 0 },
    destinationCell: { c: 1, r: 0 },
    destinationDisposition: 'consume-after-continuation',
    expectedPrimarySpawnCount: 1,
    finalMerge: false,
  });
  expect(owner.attachMergeReceipt(token, receipt)).toBe(true);
  const permit = owner.reservePrimarySpawn(token, { c: 1, r: 0 })!;
  expect(owner.commitPrimarySpawn(permit)).toBe(true);

  const blocked = owner.releaseAfterPostconditionAudit(token, [
    { id: 'destination', value: 6, special: null, cleanupOwned: false },
    { id: 'replacement', value: 2, special: null },
  ], {
    committedCount: 1,
    committedCells: [{ c: 1, r: 0 }],
    requireSettled: true,
  });
  expect(blocked).toEqual({
    released: false,
    audit: {
      ok: false,
      issues: ['consumed-destination-still-live', 'unowned-plain-six-destination'],
    },
  });
  expect(owner.owns(token)).toBe(true);

  expect(owner.releaseAfterPostconditionAudit(token, [
    { id: 'replacement', value: 2, special: null },
  ], {
    committedCount: 1,
    committedCells: [{ c: 1, r: 0 }],
    requireSettled: true,
  })).toEqual({ released: true, audit: { ok: true, issues: [] } });
  expect(owner.isActive()).toBe(false);
});

test('destination disposition never permits a consumed cleanup-owned destination to release', () => {
  const base = {
    token: 1,
    kind: 'magnet' as const,
    runGeneration: 1,
    acceptedBoardRevision: 1,
    sourceDieId: 'source',
    destinationDieId: 'destination',
    sourceCell: { c: 0, r: 0 },
    destinationCell: { c: 1, r: 0 },
    expectedPrimarySpawnCount: 1 as const,
    finalMerge: false,
  };
  const liveCleanupDestination = [
    { id: 'destination', value: 6, special: null, cleanupOwned: true },
  ];
  const unsettledAccounting = {
    committedCount: 0,
    committedCells: [] as Array<{ c: number; r: number }>,
    requireSettled: false,
  };

  const afterContinuation = createSpecialMergeTransactionReceipt({
    ...base,
    destinationDisposition: 'consume-after-continuation',
  });
  expect(auditSpecialMergeTransactionPostconditions(
    afterContinuation,
    liveCleanupDestination,
    unsettledAccounting,
  )).toEqual({ ok: false, issues: ['consumed-destination-still-live'] });
  expect(auditSpecialMergeTransactionPostconditions(
    afterContinuation,
    liveCleanupDestination,
    { ...unsettledAccounting, committedCount: 1, committedCells: [{ c: 1, r: 0 }], requireSettled: true },
  ).ok).toBe(false);

  const beforeSpawn = createSpecialMergeTransactionReceipt({
    ...base,
    destinationDisposition: 'consume-before-primary-spawn',
  });
  expect(auditSpecialMergeTransactionPostconditions(
    beforeSpawn,
    liveCleanupDestination,
    unsettledAccounting,
  )).toEqual({
    ok: false,
    issues: [
      'consumed-destination-still-live',
      'destination-not-consumed-before-primary-spawn',
    ],
  });
});

test('owner refuses release while a cleanup-owned consumed destination is still live', () => {
  const owner = new SpecialDiceTransactionOwner(() => 1000, 5000);
  const token = owner.claim('magnet')!;
  const receipt = createSpecialMergeTransactionReceipt({
    token,
    kind: 'magnet',
    runGeneration: 1,
    acceptedBoardRevision: 1,
    sourceDieId: 'source',
    destinationDieId: 'destination',
    sourceCell: { c: 0, r: 0 },
    destinationCell: { c: 1, r: 0 },
    destinationDisposition: 'consume-after-continuation',
    expectedPrimarySpawnCount: 0,
    finalMerge: false,
  });
  expect(owner.attachMergeReceipt(token, receipt)).toBe(true);
  const result = owner.releaseAfterPostconditionAudit(token, [
    { id: 'destination', value: 6, cleanupOwned: true },
  ], { committedCount: 0, committedCells: [], requireSettled: false });
  expect(result).toEqual({
    released: false,
    audit: { ok: false, issues: ['consumed-destination-still-live'] },
  });
  expect(owner.owns(token)).toBe(true);
});

test('strict owner release refuses a missing expected primary spawn', () => {
  const owner = new SpecialDiceTransactionOwner(() => 1000, 5000);
  const token = owner.claim('tnt')!;
  const receipt = createSpecialMergeTransactionReceipt({
    token,
    kind: 'tnt',
    runGeneration: 1,
    acceptedBoardRevision: 1,
    sourceDieId: 'source',
    destinationDieId: 'destination',
    sourceCell: { c: 0, r: 0 },
    destinationCell: { c: 1, r: 0 },
    destinationDisposition: 'consume-after-continuation',
    expectedPrimarySpawnCount: 1,
    finalMerge: false,
  });
  expect(owner.attachMergeReceipt(token, receipt)).toBe(true);
  const result = owner.releaseAfterPostconditionAudit(token, [], {
    committedCount: 0,
    committedCells: [],
    requireSettled: true,
  });
  expect(result).toEqual({
    released: false,
    audit: { ok: false, issues: ['primary-spawn-count-mismatch'] },
  });
  expect(owner.owns(token)).toBe(true);
});

test.each(['star', 'juice', 'magnet', 'tnt'] as const)(
  '%s final receipt rejects every primary spawn while non-final permits exactly one reserved-cell commit',
  (kind) => {
    const finalOwner = new SpecialDiceTransactionOwner(() => 1000, 5000);
    const finalToken = finalOwner.claim(kind)!;
    const finalReceipt = createSpecialMergeTransactionReceipt({
      token: finalToken,
      kind,
      runGeneration: 1,
      acceptedBoardRevision: 2,
      sourceDieId: `${kind}-final-source`,
      destinationDieId: `${kind}-final-destination`,
      sourceCell: { c: 0, r: 0 },
      destinationCell: { c: 1, r: 0 },
      destinationDisposition: 'consume-final',
      expectedPrimarySpawnCount: 0,
      finalMerge: true,
    });
    expect(finalOwner.attachMergeReceipt(finalToken, finalReceipt)).toBe(true);
    expect(finalOwner.reservePrimarySpawn(finalToken, { c: 1, r: 0 })).toBeNull();
    expect(finalOwner.snapshot()?.primarySpawn).toMatchObject({
      state: 'unavailable',
      committedCount: 0,
      committedCells: [],
    });

    const owner = new SpecialDiceTransactionOwner(() => 1000, 5000);
    const token = owner.claim(kind)!;
    const receipt = createSpecialMergeTransactionReceipt({
      token,
      kind,
      runGeneration: 1,
      acceptedBoardRevision: 2,
      sourceDieId: `${kind}-source`,
      destinationDieId: `${kind}-destination`,
      sourceCell: { c: 0, r: 0 },
      destinationCell: { c: 1, r: 0 },
      destinationDisposition: 'consume-after-continuation',
      expectedPrimarySpawnCount: 1,
      finalMerge: false,
    });
    expect(owner.attachMergeReceipt(token, receipt)).toBe(true);
    expect(owner.reservePrimarySpawn(token, { c: 2, r: 0 })).toBeNull();

    const cancelled = owner.reservePrimarySpawn(token, { c: 1, r: 0 })!;
    expect(owner.reservePrimarySpawn(token, { c: 1, r: 0 })).toBeNull();
    expect(owner.cancelPrimarySpawn(cancelled)).toBe(true);

    const committed = owner.reservePrimarySpawn(token, { c: 1, r: 0 })!;
    expect(owner.commitPrimarySpawn(committed)).toBe(true);
    expect(owner.commitPrimarySpawn(committed)).toBe(false);
    expect(owner.reservePrimarySpawn(token, { c: 1, r: 0 })).toBeNull();
    expect(owner.snapshot()?.primarySpawn).toMatchObject({
      state: 'committed',
      committedCount: 1,
      committedCells: [{ c: 1, r: 0 }],
    });
  },
);

test('postcondition accounting detects extra, missing, and out-of-reservation primary spawns', () => {
  const receipt = createSpecialMergeTransactionReceipt({
    token: 9,
    kind: 'tnt',
    runGeneration: 1,
    acceptedBoardRevision: 3,
    sourceDieId: 'ball',
    destinationDieId: 'regular',
    sourceCell: { c: 0, r: 0 },
    destinationCell: { c: 1, r: 0 },
    destinationDisposition: 'consume-after-continuation',
    expectedPrimarySpawnCount: 1,
    finalMerge: false,
  });

  expect(auditSpecialMergeTransactionPostconditions(receipt, [], {
    committedCount: 2,
    committedCells: [{ c: 1, r: 0 }, { c: 2, r: 0 }],
    requireSettled: true,
  })).toEqual({
    ok: false,
    issues: ['extra-primary-spawn', 'primary-spawn-count-mismatch', 'primary-spawn-outside-reservation'],
  });
  expect(auditSpecialMergeTransactionPostconditions(receipt, [], {
    committedCount: 0,
    committedCells: [],
    requireSettled: true,
  })).toEqual({ ok: false, issues: ['primary-spawn-count-mismatch'] });
});

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

test('only the active owner token can attach its immutable merge receipt', () => {
  const owner = new SpecialDiceTransactionOwner(() => 1000, 5000);
  const token = owner.claim('tnt');
  const receipt = createSpecialMergeTransactionReceipt({
    token: token!,
    kind: 'tnt',
    runGeneration: 2,
    acceptedBoardRevision: 5,
    sourceDieId: 'flower',
    destinationDieId: 'regular',
    sourceCell: { c: 0, r: 1 },
    destinationCell: { c: 1, r: 1 },
    destinationDisposition: 'consume-final',
    expectedPrimarySpawnCount: 0,
    finalMerge: true,
  });

  expect(owner.attachMergeReceipt((token || 0) + 1, receipt)).toBe(false);
  expect(owner.attachMergeReceipt(token, receipt)).toBe(true);
  expect(owner.snapshot()?.mergeReceipt).toBe(receipt);
});

test('post-commit work cannot mutate a newer board revision', () => {
  let boardRevision = 12;
  const guard = new PostCommitBoardRevisionGuard(() => boardRevision);
  const mutations: string[] = [];

  expect(guard.capture()).toBe(12);
  expect(guard.runIfCurrent(() => mutations.push('current'))).toBe(true);

  // Models an accepted ordinary merge during Magnet's 1200 ms visual tail.
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

test('TTL cannot silently discard an owned merge receipt', () => {
  let now = 0;
  const owner = new SpecialDiceTransactionOwner(() => now, 1000);
  const token = owner.claim('juice')!;
  const receipt = createSpecialMergeTransactionReceipt({
    token,
    kind: 'juice',
    runGeneration: 1,
    acceptedBoardRevision: 2,
    sourceDieId: 'source',
    destinationDieId: 'destination',
    sourceCell: { c: 0, r: 0 },
    destinationCell: { c: 1, r: 0 },
    destinationDisposition: 'consume-after-continuation',
    expectedPrimarySpawnCount: 1,
    finalMerge: false,
  });
  expect(owner.attachMergeReceipt(token, receipt)).toBe(true);

  now = 1001;
  expect(owner.isActive()).toBe(true);
  expect(owner.owns(token)).toBe(true);
  expect(owner.snapshot()).toMatchObject({ token, expired: true, mergeReceipt: receipt });
  expect(owner.claim('star')).toBeNull();
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

test.each(['star', 'juice', 'magnet', 'tnt'] as const)(
  '%s visual tail permits every stable ordinary merge through six',
  (kind) => {
    const owner = new SpecialDiceTransactionOwner(() => 1000, 5000);
    const token = owner.claim(kind);
    const decision = (sourceValue: number, destinationValue: number, stable = true) =>
      canRunOrdinaryMergeDuringVisualTail(owner, {
        sourceValue,
        destinationValue,
        sourceStableOrdinary: stable,
        destinationStableOrdinary: stable,
      });

    expect(decision(1, 2)).toBe(false);
    owner.markBoardCommitted(token, 3);
    expect(decision(1, 2)).toBe(true);
    expect(decision(3, 3)).toBe(true);
    expect(decision(1, 5)).toBe(true);
    expect(decision(4, 4)).toBe(false);
    expect(decision(2, 2, false)).toBe(false);
  },
);

test('classifies every stable ordinary merge through six for special visual tails', () => {
  const decision = (sourceValue: number, destinationValue: number, stable = true) =>
    isStableOrdinaryMerge({
      sourceValue,
      destinationValue,
      sourceStableOrdinary: stable,
      destinationStableOrdinary: stable,
    });

  expect(decision(1, 2)).toBe(true);
  expect(decision(2, 3)).toBe(true);
  expect(decision(3, 3)).toBe(true);
  expect(decision(1, 5)).toBe(true);
  expect(decision(4, 4)).toBe(false);
  expect(decision(2, 2, false)).toBe(false);
});

test('classifies only stable ordinary sub-six stacks for concurrent visual handoffs', () => {
  const decision = (sourceValue: number, destinationValue: number, stable = true) =>
    isStableOrdinarySubSixStack({
      sourceValue,
      destinationValue,
      sourceStableOrdinary: stable,
      destinationStableOrdinary: stable,
    });

  expect(decision(1, 2)).toBe(true);
  expect(decision(2, 3)).toBe(true);
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


test('failed revision capture fails closed without reusing an older snapshot', () => {
  let revision = 12;
  const getter = jest.fn(() => revision);
  const guard = new PostCommitBoardRevisionGuard(getter);
  expect(guard.capture()).toBe(12);
  revision = Number.NaN;
  expect(guard.capture()).toBeNull();
  revision = 12;
  expect(guard.isCurrent()).toBe(false);
  getter.mockImplementationOnce(() => { throw new Error('unavailable'); });
  expect(guard.capture()).toBeNull();
  expect(guard.isCurrent()).toBe(false);
  const legacy = new PostCommitBoardRevisionGuard();
  expect(legacy.capture()).toBeNull();
  expect(legacy.isCurrent()).toBe(true);
});
