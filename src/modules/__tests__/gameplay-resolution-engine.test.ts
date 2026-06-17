import { createGameplaySnapshot } from '../gameplay-snapshot';
import {
  getLegacyComparableDecisionType,
  getResolverComparableDecisionType,
  normalizeLevelEndDecision,
  resolveFinalMergeDecision,
  resolveGameplayState,
  resolveLevelEndDecision,
  resolveMergeFinality,
  summarizeGameplayDecision,
} from '../gameplay-resolution-engine';
import { getFinalMergeSnapshot } from '../final-merge-rules';
import { clearEndGameCache } from '../endgame-checker';

beforeEach(() => {
  clearEndGameCache();
});

const makeTile = (overrides: Partial<any> = {}) => ({
  value: 0,
  special: null,
  locked: false,
  destroyed: false,
  visible: true,
  eventMode: 'static',
  ...overrides,
});

const makeBoard = (canMerge = false) => ({
  anyMergePossible: () => canMerge,
});

test('arcade final regular merge resolves to stage complete even with moves depleted', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });
  const snapshot = createGameplaySnapshot({
    tiles: [src, dst],
    moves: 0,
    makeBoard: makeBoard(false),
    mode: 'arcade',
    phase: 'before-merge',
    src,
    dst,
    effSum: 6,
  });

  expect(resolveGameplayState(snapshot)).toEqual({
    type: 'complete',
    target: 'arcade-stage',
    reason: 'final_regular_merge6',
  });
});

test('final regular merge6 resolves to complete instead of spawn even in after-merge phase', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });
  const snapshot = createGameplaySnapshot({
    tiles: [src, dst],
    moves: 0,
    makeBoard: makeBoard(false),
    mode: 'arcade',
    phase: 'after-merge',
    src,
    dst,
    effSum: 6,
  });

  expect(resolveGameplayState(snapshot)).toEqual({
    type: 'complete',
    target: 'arcade-stage',
    reason: 'final_regular_merge6',
  });
});

test('non-final merge6 still resolves to spawn after merge', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });
  const blocker = makeTile({ value: 5 });
  const snapshot = createGameplaySnapshot({
    tiles: [src, dst, blocker],
    moves: 3,
    makeBoard: makeBoard(false),
    mode: 'arcade',
    phase: 'after-merge',
    src,
    dst,
    effSum: 6,
  });

  expect(resolveGameplayState(snapshot)).toEqual({
    type: 'spawn',
    reason: 'merge6_spawn_required',
  });
});

test('final merge helper is the source of truth for regular 4+2 completion target', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });
  const finalMerge = getFinalMergeSnapshot({
    activeTilesBeforeMerge: [src, dst],
    src,
    dst,
    effSum: 6,
  });

  expect(resolveFinalMergeDecision({
    mode: 'arcade',
    finalMerge,
  })).toEqual({
    type: 'complete',
    target: 'arcade-stage',
    reason: 'final_regular_merge6',
  });
});

test('merge finality helper returns final snapshot and complete decision together', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });

  expect(resolveMergeFinality({
    mode: 'arcade',
    finalMergeInput: {
      activeTilesBeforeMerge: [src, dst],
      src,
      dst,
      effSum: 6,
    },
  })).toEqual({
    finalMerge: {
      activeSnapshotWasOnlyMergePair: true,
      isFinalRegularMerge6: true,
      isFinalWildLastTwo: false,
      isFinalMerge: true,
    },
    decision: {
      type: 'complete',
      target: 'arcade-stage',
      reason: 'final_regular_merge6',
    },
    isFinalMerge: true,
  });
});

test('final merge helper refuses completion when pulled tiles will merge', () => {
  const src = makeTile({ value: 0, special: 'wild-magnet' });
  const dst = makeTile({ value: 5 });
  const finalMerge = getFinalMergeSnapshot({
    activeTilesBeforeMerge: [src, dst],
    src,
    dst,
    effSum: 6,
  });

  expect(resolveFinalMergeDecision({
    mode: 'arcade',
    finalMerge,
    willPulledTilesMerge: true,
  })).toEqual({
    type: 'continue',
    reason: 'pulled_tiles_will_merge',
  });
});

test('journey final wild merge resolves to journey board complete', () => {
  const src = makeTile({ value: 0, special: 'wild-juice' });
  const dst = makeTile({ value: 5 });
  const snapshot = createGameplaySnapshot({
    tiles: [src, dst],
    moves: 4,
    makeBoard: makeBoard(false),
    mode: 'journey',
    phase: 'before-merge',
    src,
    dst,
    effSum: 6,
  });

  expect(resolveGameplayState(snapshot)).toEqual({
    type: 'complete',
    target: 'journey-board',
    reason: 'final_wild_merge6',
  });
});

test('locked future wild tile blocks final merge completion as gameplay continuation', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });
  const lockedSpecial = makeTile({ value: 0, special: 'wild-cubero', locked: true });
  const snapshot = createGameplaySnapshot({
    tiles: [src, dst, lockedSpecial],
    moves: 4,
    makeBoard: makeBoard(false),
    mode: 'arcade',
    phase: 'before-merge',
    src,
    dst,
    effSum: 6,
  });

  expect(resolveGameplayState(snapshot)).toEqual({
    type: 'continue',
    reason: 'wild_continuation_available',
  });
  expect(snapshot.finalMerge.isFinalMerge).toBe(false);
});

test('locked ghost placeholder does not block final merge completion', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });
  const ghost = makeTile({ value: 0, locked: true });
  const snapshot = createGameplaySnapshot({
    tiles: [src, dst, ghost],
    moves: 4,
    makeBoard: makeBoard(false),
    mode: 'arcade',
    phase: 'before-merge',
    src,
    dst,
    effSum: 6,
  });

  expect(resolveGameplayState(snapshot)).toEqual({
    type: 'complete',
    target: 'arcade-stage',
    reason: 'final_regular_merge6',
  });
});

test('magnet with tiles to pull waits/continues instead of completing final merge', () => {
  const src = makeTile({ value: 0, special: 'wild-magnet' });
  const dst = makeTile({ value: 5 });
  const extra = makeTile({ value: 2 });
  const snapshot = createGameplaySnapshot({
    tiles: [src, dst, extra],
    moves: 4,
    makeBoard: makeBoard(true),
    mode: 'arcade',
    phase: 'before-merge',
    src,
    dst,
    effSum: 6,
    flags: { hasTilesToPull: true },
  });

  expect(resolveGameplayState(snapshot)).toEqual({
    type: 'continue',
    reason: 'wild_continuation_available',
  });
});

test('runtime animation/spawn guard resolves to wait before fail or complete', () => {
  const tiles = [
    makeTile({ value: 5 }),
    makeTile({ value: 4 }),
  ];
  const snapshot = createGameplaySnapshot({
    tiles,
    moves: 0,
    makeBoard: makeBoard(false),
    mode: 'arcade',
    phase: 'level-check',
    flags: { merge6SpawnInProgress: true },
  });

  expect(resolveGameplayState(snapshot)).toEqual({
    type: 'wait',
    reason: 'runtime_transition_active',
  });
});

test('no-moves board resolves to fail when no runtime guard is active', () => {
  const tiles = [
    makeTile({ value: 5 }),
    makeTile({ value: 4 }),
    makeTile({ value: 5 }),
  ];
  const snapshot = createGameplaySnapshot({
    tiles,
    moves: 0,
    makeBoard: makeBoard(false),
    mode: 'arcade',
    phase: 'level-check',
  });

  expect(resolveGameplayState(snapshot)).toEqual({
    type: 'fail',
    reason: 'no_merges_possible',
  });
});

test('level-end normalization lets resolver wait beat legacy stuck', () => {
  expect(normalizeLevelEndDecision({
    legacyResult: { type: 'stuck', reason: 'legacy_stuck' },
    resolverDecision: { type: 'wait', reason: 'runtime_transition_active' },
  })).toEqual({
    type: 'wait',
    reason: 'runtime_transition_active',
    source: 'resolver',
  });
});

test('level-end normalization blocks legacy stuck when resolver says continue', () => {
  expect(normalizeLevelEndDecision({
    legacyResult: { type: 'stuck', reason: 'legacy_stuck' },
    resolverDecision: { type: 'continue', reason: 'wild_continuation_available' },
  })).toEqual({
    type: 'continue',
    reason: 'wild_continuation_available',
    source: 'resolver',
  });
});

test('level-end normalization maps resolver complete to clean flow', () => {
  expect(normalizeLevelEndDecision({
    legacyResult: { type: 'continue', reason: 'tiles_remaining' },
    resolverDecision: { type: 'complete', target: 'arcade-stage', reason: 'final_regular_merge6' },
  })).toEqual({
    type: 'clean',
    reason: 'final_regular_merge6',
    source: 'resolver',
  });
});

test('level-end normalization maps resolver fail to stuck flow', () => {
  expect(normalizeLevelEndDecision({
    legacyResult: { type: 'continue', reason: 'tiles_remaining' },
    resolverDecision: { type: 'fail', reason: 'no_merges_possible' },
  })).toEqual({
    type: 'stuck',
    reason: 'no_merges_possible',
    source: 'resolver',
  });
});

test('level-end normalization falls back to legacy when resolver is unavailable', () => {
  expect(normalizeLevelEndDecision({
    legacyResult: { type: 'clean', reason: 'legacy_clean' },
    resolverDecision: null,
  })).toEqual({
    type: 'clean',
    reason: 'legacy_clean',
    source: 'legacy',
  });
});

test('resolveLevelEndDecision returns snapshot, raw resolver decision, and normalized decision together', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });

  const resolved = resolveLevelEndDecision({
    legacyResult: { type: 'continue', reason: 'legacy_continue' },
    snapshotInput: {
      tiles: [src, dst],
      moves: 0,
      makeBoard: makeBoard(false),
      mode: 'arcade',
      phase: 'level-check',
      src,
      dst,
      effSum: 6,
    },
  });

  expect(resolved.resolverDecision).toEqual({
    type: 'complete',
    target: 'arcade-stage',
    reason: 'final_regular_merge6',
  });
  expect(resolved.levelEndDecision).toEqual({
    type: 'clean',
    reason: 'final_regular_merge6',
    source: 'resolver',
  });
  expect(resolved.snapshot.activeTiles).toHaveLength(2);
});

test('comparable decision helpers keep shadow logging terminology centralized', () => {
  expect(getLegacyComparableDecisionType({ type: 'clean', reason: 'legacy_clean' })).toBe('complete');
  expect(getLegacyComparableDecisionType({ type: 'stuck', reason: 'legacy_stuck' })).toBe('fail');
  expect(getLegacyComparableDecisionType({ type: 'continue', reason: 'legacy_continue' })).toBe('continue');
  expect(getResolverComparableDecisionType({ type: 'spawn', reason: 'spawn_required' })).toBe('continue');
  expect(getResolverComparableDecisionType({ type: 'complete', target: 'arcade-stage', reason: 'done' })).toBe('complete');
});

test('gameplay decision summary exposes compact debug state', () => {
  const src = makeTile({ value: 4 });
  const dst = makeTile({ value: 2 });
  const snapshot = createGameplaySnapshot({
    tiles: [src, dst],
    moves: 0,
    makeBoard: makeBoard(false),
    mode: 'arcade',
    phase: 'before-merge',
    src,
    dst,
    effSum: 6,
    stageNumber: 3,
  });
  const decision = resolveGameplayState(snapshot);

  expect(summarizeGameplayDecision(snapshot, decision)).toMatchObject({
    mode: 'arcade',
    phase: 'before-merge',
    stageNumber: 3,
    decision: 'complete',
    reason: 'final_regular_merge6',
    target: 'arcade-stage',
    activeTiles: 2,
    moves: 0,
    effSum: 6,
    endGameType: 'stuck',
  });
});
