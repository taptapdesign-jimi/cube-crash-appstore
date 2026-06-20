import {
  createMagnetRespawnPlan,
  isPlayablePostMagnetTile,
  resolvePostMagnetEndgameAction,
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

test('post-magnet resolution asks central level-end check for stuck unlocked tiles', () => {
  const result = resolvePostMagnetEndgameAction({
    tiles: [tile({ value: 4 }), tile({ value: 5 })],
    anyMergePossible: () => false,
    spawnCount: 2,
  });

  expect(result.action).toBe('check-level-end');
  expect(result.reason).toBe('stuck-unlocked-tiles');
});

test('post-magnet playable filter ignores locked regular tiles but keeps locked wild dice', () => {
  expect(isPlayablePostMagnetTile(tile({ value: 4, locked: true }))).toBe(false);
  expect(isPlayablePostMagnetTile(tile({ value: 0, locked: true, special: 'wild-juice' }))).toBe(true);
});

test('magnet respawn plan replaces pulled cells and adds one obligatory tile', () => {
  expect(createMagnetRespawnPlan(3, true)).toEqual({
    replacementSpawnCount: 3,
    obligatorySpawnCount: 1,
    spawnCount: 4,
  });

  expect(createMagnetRespawnPlan(0, false)).toEqual({
    replacementSpawnCount: 0,
    obligatorySpawnCount: 1,
    spawnCount: 1,
  });
});
