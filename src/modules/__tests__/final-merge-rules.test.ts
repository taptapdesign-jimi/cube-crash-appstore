import {
  getFinalMergeSnapshot,
  getFinalMergeTileSets,
  getPlayableMagnetPullCandidates,
  isTilePendingGameplayRemoval,
  isWildLikeTile,
  tileBlocksFinalMerge,
  tileCountsAsFinalMergeActive,
} from '../final-merge-rules';

const makeTile = (overrides: Partial<any> = {}) => ({
  value: 0,
  special: null,
  locked: false,
  destroyed: false,
  visible: true,
  eventMode: 'static',
  ...overrides,
});

test('last two regular dice that merge to 6 are final merge', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });

  expect(getFinalMergeSnapshot({
    activeTilesBeforeMerge: [src, dst],
    src,
    dst,
    effSum: 6,
  })).toMatchObject({
    activeSnapshotWasOnlyMergePair: true,
    isFinalRegularMerge6: true,
    isFinalWildLastTwo: false,
    isFinalMerge: true,
  });
});

test('last wild plus regular is final unless magnet will pull tiles', () => {
  const src = makeTile({ value: 0, special: 'wild-juice' });
  const dst = makeTile({ value: 5 });

  expect(getFinalMergeSnapshot({
    activeTilesBeforeMerge: [src, dst],
    src,
    dst,
    effSum: 6,
  }).isFinalMerge).toBe(true);
});

test('future wild-prefixed special dice are treated as wild-like', () => {
  const src = makeTile({ value: 0, special: 'wild-cubero' });
  const dst = makeTile({ value: 5 });

  expect(isWildLikeTile(src)).toBe(true);
  expect(getFinalMergeSnapshot({
    activeTilesBeforeMerge: [src, dst],
    src,
    dst,
    effSum: 6,
  })).toMatchObject({
    isFinalWildLastTwo: true,
    isFinalMerge: true,
  });
});

test('visual wild flags are treated as wild-like even without special name', () => {
  expect(isWildLikeTile(makeTile({ isWild: true }))).toBe(true);
  expect(isWildLikeTile(makeTile({ isWildFace: true }))).toBe(true);
});

test('final merge active rules include locked wilds but exclude locked ghosts', () => {
  expect(tileCountsAsFinalMergeActive(makeTile({ special: 'wild-cubero', locked: true }))).toBe(true);
  expect(tileCountsAsFinalMergeActive(makeTile({ value: 0, locked: true }))).toBe(false);
  expect(tileCountsAsFinalMergeActive(makeTile({ value: 4, locked: false }))).toBe(true);
});

test('final merge blocker rules ignore src/dst, pending removal, ghosts, and magnet-affected tiles', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });

  expect(tileBlocksFinalMerge(src, src, dst)).toBe(false);
  expect(tileBlocksFinalMerge(makeTile({ special: 'wild-cubero', locked: true }), src, dst)).toBe(true);
  expect(tileBlocksFinalMerge(makeTile({ value: 5, locked: true }), src, dst)).toBe(false);
  expect(tileBlocksFinalMerge(makeTile({ value: 5, _wildMagnetAffected: true }), src, dst)).toBe(false);
  expect(tileBlocksFinalMerge(makeTile({ value: 5, _pendingRemoval: true }), src, dst)).toBe(false);
});

test('pending gameplay removal helper covers cleanup pipeline flags', () => {
  expect(isTilePendingGameplayRemoval(makeTile({ destroyed: true }))).toBe(true);
  expect(isTilePendingGameplayRemoval(makeTile({ _ccWildSpawnDropping: true }))).toBe(true);
  expect(isTilePendingGameplayRemoval(makeTile({
    special: 'wild-tnt',
    _ccWildSpawnDropping: true,
    eventMode: 'static',
    visible: true,
    alpha: 1,
  }))).toBe(false);
  expect(isTilePendingGameplayRemoval(makeTile({ _pendingRemoval: true }))).toBe(true);
  expect(isTilePendingGameplayRemoval(makeTile({ _beingRemoved: true }))).toBe(true);
  expect(isTilePendingGameplayRemoval(makeTile({ _cleanupQueued: true }))).toBe(true);
  expect(isTilePendingGameplayRemoval(makeTile({ value: 1 }))).toBe(false);
});

test('last preload TNT plus regular remains final even with stale drop flag', () => {
  const src = makeTile({
    value: 0,
    special: 'wild-tnt',
    _ccWildSpawnDropping: true,
    eventMode: 'static',
    visible: true,
    alpha: 1,
  });
  const dst = makeTile({ value: 5 });

  const tileSets = getFinalMergeTileSets({
    tiles: [src, dst],
    src,
    dst,
  });

  expect(tileSets.activeTilesBeforeMerge).toEqual([src, dst]);
  expect(tileSets.finalMergeBlockersBefore).toEqual([]);
  expect(getFinalMergeSnapshot({
    activeTilesBeforeMerge: tileSets.activeTilesBeforeMerge,
    finalMergeBlockersBefore: tileSets.finalMergeBlockersBefore,
    src,
    dst,
    effSum: 6,
  })).toMatchObject({
    isFinalWildLastTwo: true,
    isFinalMerge: true,
  });
});

test('final merge tile-set helper returns active tiles and blockers from one source of truth', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });
  const lockedWild = makeTile({ value: 0, special: 'wild-cubero', locked: true });
  const ghost = makeTile({ value: 0, locked: true });
  const pending = makeTile({ value: 5, _pendingRemoval: true });

  expect(getFinalMergeTileSets({
    tiles: [src, dst, lockedWild, ghost, pending],
    src,
    dst,
  })).toEqual({
    activeTilesBeforeMerge: [src, dst, lockedWild],
    finalMergeBlockersBefore: [lockedWild],
  });
});

test('magnet last pair is not final when it has tiles to pull', () => {
  const src = makeTile({ value: 0, special: 'wild-magnet' });
  const dst = makeTile({ value: 5 });

  expect(getFinalMergeSnapshot({
    activeTilesBeforeMerge: [src, dst],
    src,
    dst,
    effSum: 6,
    isWildMagnetMerge: true,
    hasTilesToPull: true,
  })).toMatchObject({
    isFinalWildLastTwo: false,
    isFinalMerge: false,
  });
});

test('magnet pull candidates ignore stale removed star residue', () => {
  const star = makeTile({
    value: 0,
    special: 'wild',
    _pendingRemoval: true,
    visible: true,
    alpha: 1,
  });
  const src = makeTile({ value: 0, special: 'wild-magnet' });
  const dst = makeTile({ value: 5 });

  expect(getPlayableMagnetPullCandidates({
    tiles: [star, src, dst],
    src,
    dst,
    magnetTile: src,
  })).toEqual([]);
});

test('other active gameplay blocker prevents final regular merge', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });
  const blocker = makeTile({ value: 1 });

  expect(getFinalMergeSnapshot({
    activeTilesBeforeMerge: [src, dst],
    src,
    dst,
    effSum: 6,
    finalMergeBlockersBefore: [blocker],
  }).isFinalMerge).toBe(false);
});
