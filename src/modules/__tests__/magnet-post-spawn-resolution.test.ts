import {
  createMagnetRespawnPlan,
  isPlayablePostMagnetTile,
  resolvePostMagnetEndgameAction,
  resolvePreMagnetRespawnDecision,
} from '../magnet-post-spawn-resolution';

const tile = (overrides: Partial<any> = {}) => ({
  value: 1,
  locked: false,
  destroyed: false,
  visible: true,
  alpha: 1,
  special: null,
  ...overrides,
});

test('post-magnet resolution continues when spawned tiles have merge or stack potential', () => {
  const result = resolvePostMagnetEndgameAction({
    tiles: [tile({ value: 6 }), tile({ value: 2 }), tile({ value: 4 })],
    anyMergePossible: () => true,
    isLastMergeFlagSet: true,
    spawnCount: 2,
  });

  expect(result.action).toBe('continue');
  expect(result.reason).toBe('merge-or-stack-potential');
  expect(result.shouldClearLastMergeFlag).toBe(true);
});

test('post-magnet resolution asks central level-end check for clean merge-6 only board', () => {
  const result = resolvePostMagnetEndgameAction({
    tiles: [tile({ value: 6 })],
    anyMergePossible: () => false,
    isLastMergeFlagSet: true,
    spawnCount: 0,
  });

  expect(result.action).toBe('check-level-end');
  expect(result.reason).toBe('clean-merge6-only');
  expect(result.isActuallyLastMerge).toBe(true);
});

test('post-magnet resolution never completes while successfully spawned replacements are still locked', () => {
  const result = resolvePostMagnetEndgameAction({
    tiles: [
      tile({ value: 6 }),
      tile({ value: 2, locked: true }),
      tile({ value: 4, locked: true }),
    ],
    anyMergePossible: () => false,
    isLastMergeFlagSet: true,
    spawnCount: 2,
    successfulSpawnCount: 2,
  });

  expect(result.action).toBe('continue');
  expect(result.reason).toBe('spawned-tiles-settling');
  expect(result.hasSpawnedNewTiles).toBe(true);
  expect(result.shouldClearLastMergeFlag).toBe(true);
  expect(result.isActuallyLastMerge).toBe(false);
});

test('post-magnet resolution asks central level-end check for stuck unlocked tiles', () => {
  const result = resolvePostMagnetEndgameAction({
    tiles: [tile({ value: 4 }), tile({ value: 5 })],
    anyMergePossible: () => false,
    spawnCount: 2,
  });

  expect(result.action).toBe('check-level-end');
  expect(result.reason).toBe('stuck-unlocked-tiles');
});

test('post-magnet resolution detects the reported 4 + 3 arcade residue as no-moves', () => {
  const result = resolvePostMagnetEndgameAction({
    tiles: [tile({ value: 4 }), tile({ value: 3 })],
    anyMergePossible: () => false,
    spawnCount: 2,
  });

  expect(result.action).toBe('check-level-end');
  expect(result.reason).toBe('stuck-unlocked-tiles');
  expect(result.activeTiles.map(activeTile => activeTile.value)).toEqual([4, 3]);
});

test('post-magnet playable filter ignores locked regular tiles but keeps locked wild dice', () => {
  expect(isPlayablePostMagnetTile(tile({ value: 4, locked: true }))).toBe(false);
  expect(isPlayablePostMagnetTile(tile({ value: 0, locked: true, special: 'wild-juice' }))).toBe(true);
});

test('magnet respawn plan preserves v915 replacements, obligatory cube, and survivor density', () => {
  expect(createMagnetRespawnPlan(3, true)).toEqual({
    replacementSpawnCount: 3,
    obligatorySpawnCount: 1,
    spawnCount: 4,
  });

  expect(createMagnetRespawnPlan(0, false)).toEqual({
    replacementSpawnCount: 0,
    obligatorySpawnCount: 0,
    spawnCount: 0,
  });
});

test('pre-magnet respawn delegates final last-merge to central endgame', () => {
  const dst = tile({ value: 6 });

  expect(resolvePreMagnetRespawnDecision({
    isLastMergeFlagSetRaw: true,
    activeTilesAfterRemoval: [dst],
    dst,
    pulledCellCount: 0,
  })).toEqual({
    isLastMergeFlagSet: true,
    onlyDstRemains: true,
    hasTilesToRespawn: false,
    shouldClearLastMergeFlag: false,
    shouldDelegateToCentralEndgame: true,
  });
});

test('pre-magnet respawn clears stale final flag when pulled tiles must respawn', () => {
  const dst = tile({ value: 6 });
  const pulled = tile({ value: 3 });

  expect(resolvePreMagnetRespawnDecision({
    isLastMergeFlagSetRaw: true,
    activeTilesAfterRemoval: [dst, pulled],
    dst,
    pulledCellCount: 1,
  })).toEqual({
    isLastMergeFlagSet: false,
    onlyDstRemains: false,
    hasTilesToRespawn: true,
    shouldClearLastMergeFlag: true,
    shouldDelegateToCentralEndgame: false,
  });
});

test('pre-magnet respawn treats only merge-6 remaining as central endgame even without flag', () => {
  const dst = tile({ value: 6 });

  expect(resolvePreMagnetRespawnDecision({
    isLastMergeFlagSetRaw: false,
    activeTilesAfterRemoval: [dst],
    dst,
    pulledCellCount: 0,
  })).toMatchObject({
    isLastMergeFlagSet: false,
    onlyDstRemains: true,
    hasTilesToRespawn: false,
    shouldDelegateToCentralEndgame: true,
  });
});

test('pre-magnet respawn completes when pulled tile list exists but only merge-6 remains', () => {
  const dst = tile({ value: 6 });

  expect(resolvePreMagnetRespawnDecision({
    isLastMergeFlagSetRaw: false,
    activeTilesAfterRemoval: [],
    dst,
    pulledCellCount: 1,
  })).toEqual({
    isLastMergeFlagSet: false,
    onlyDstRemains: true,
    hasTilesToRespawn: false,
    shouldClearLastMergeFlag: false,
    shouldDelegateToCentralEndgame: true,
  });
});

test('pre-magnet respawn completes when active list contains only dst even with pulled cells', () => {
  const dst = tile({ value: 6 });

  expect(resolvePreMagnetRespawnDecision({
    isLastMergeFlagSetRaw: false,
    activeTilesAfterRemoval: [dst],
    dst,
    pulledCellCount: 2,
  })).toEqual({
    isLastMergeFlagSet: false,
    onlyDstRemains: true,
    hasTilesToRespawn: false,
    shouldClearLastMergeFlag: false,
    shouldDelegateToCentralEndgame: true,
  });
});

test('pre-magnet respawn still respawns when another playable tile remains after pull', () => {
  const dst = tile({ value: 6 });
  const other = tile({ value: 3 });

  expect(resolvePreMagnetRespawnDecision({
    isLastMergeFlagSetRaw: false,
    activeTilesAfterRemoval: [dst, other],
    dst,
    pulledCellCount: 1,
  })).toMatchObject({
    onlyDstRemains: false,
    hasTilesToRespawn: true,
    shouldDelegateToCentralEndgame: false,
  });
});
