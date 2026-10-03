import { handleLastMergeEarly, resolveLastMergeEarlyState } from '../app-core-merge-lastmerge';
import { resolveWildEndgameSpawnMult } from '../wild-endgame-spawn-mult-decision';

function createDeps(overrides: Partial<Parameters<typeof handleLastMergeEarly>[0]> = {}) {
  const calls = {
    wildMeter: [] as number[],
    stateWildMeter: [] as number[],
    pendingCleanBoard: [] as number[],
    hudReset: [] as boolean[],
    logs: [] as any[][],
    warns: [] as any[][],
  };

  const deps: Parameters<typeof handleLastMergeEarly>[0] = {
    tiles: [],
    src: null,
    dst: null,
    effSum: 6,
    boardNumber: 2,
    wildMeter: 0.8,
    setWildMeter: (v) => calls.wildMeter.push(v),
    setStateWildMeter: (v) => calls.stateWildMeter.push(v),
    HUD: { resetWildMeter: (force?: boolean) => calls.hudReset.push(!!force) },
    setPendingCleanBoard: (boardNumber) => calls.pendingCleanBoard.push(boardNumber),
    devLog: (...args: any[]) => calls.logs.push(args),
    devWarn: (...args: any[]) => calls.warns.push(args),
    isWildMagnetMerge: false,
    mode: 'journey',
    ...overrides,
  };

  return { deps, calls };
}

describe('app-core-merge-lastmerge', () => {
  it('keeps 3 + 2 non-final when another 5 remains so meter continuation can spawn', () => {
    const src = { value: 3, stackDepth: 1, visible: true };
    const dst = { value: 2, stackDepth: 1, visible: true };
    const remainingFive = { value: 5, stackDepth: 1, visible: true };

    expect(resolveLastMergeEarlyState({
      tiles: [src, dst, remainingFive],
      src,
      dst,
      effSum: 5,
      isWildMagnetMerge: false,
      mode: 'arcade',
    })).toMatchObject({
      isActuallyLastMerge: false,
      visibleTilesCountBeforeWildProgress: 3,
    });
  });

  it('resolves early final merge state without side effects', () => {
    const src = { value: 0, special: 'wild-beach-ball', stackDepth: 1 };
    const dst = { value: 5, stackDepth: 1 };

    expect(resolveLastMergeEarlyState({
      tiles: [src, dst],
      src,
      dst,
      effSum: 6,
      isWildMagnetMerge: false,
      mode: 'arcade',
    })).toMatchObject({
      isActuallyLastMerge: true,
      isWildLastTwoForCheck: true,
      isRegularLastTwoMerge6: false,
      willPullTiles: false,
      visibleTilesCountBeforeWildProgress: 2,
      activeTilesCountBeforeWildProgress: 2,
    });
  });

  it('keeps the final wild-star pair in the captured merge snapshot after live mutation', () => {
    const src = { value: 0, special: 'wild-star', stackDepth: 1, visible: true };
    const dst = { value: 5, stackDepth: 1, visible: true };

    const result = resolveLastMergeEarlyState({
      tiles: [src, dst],
      src,
      dst,
      effSum: 6,
      isWildMagnetMerge: false,
      mode: 'arcade',
    });

    // The star finale may consume its live special/visibility before merge-6 spawn
    // resolution. The entry snapshot must remain the authoritative final pair.
    src.special = undefined as any;
    src.visible = false;

    expect(result.isActuallyLastMerge).toBe(true);
    expect(result.finalMergeSnapshot).toMatchObject({
      isFinalMerge: true,
      isFinalWildLastTwo: true,
    });
    expect(result.activeTilesBeforeWildProgress).toEqual([src, dst]);
    expect(result.visibleTilesCountBeforeWildProgress).toBe(2);
  });

  it.each([
    ['star', 'wild'],
    ['juice', 'wild-juice'],
    ['TNT', 'wild-tnt'],
    ['magnet without pull targets', 'wild-magnet'],
  ])('marks final %s plus regular as complete in Arcade in both merge directions', (_label, special) => {
    const specialTile = { value: 0, special, stackDepth: 1, visible: true };
    const regularTile = { value: 5, stackDepth: 1, visible: true };

    for (const [src, dst] of [[specialTile, regularTile], [regularTile, specialTile]]) {
      const result = resolveLastMergeEarlyState({
        tiles: [specialTile, regularTile],
        src,
        dst,
        effSum: 6,
        isWildMagnetMerge: special === 'wild-magnet',
        mode: 'arcade',
      });

      expect(result.isActuallyLastMerge).toBe(true);
      expect(result.finalMergeSnapshot.isFinalWildLastTwo).toBe(true);
    }
  });

  it('recognizes a future registry special by archetype metadata', () => {
    const src = {
      value: 0,
      special: null,
      _ccSpecialDiceArchetype: 'wild-tnt',
      stackDepth: 1,
      visible: true,
    };
    const dst = { value: 5, stackDepth: 1, visible: true };

    const result = resolveLastMergeEarlyState({
      tiles: [src, dst],
      src,
      dst,
      effSum: 6,
      isWildMagnetMerge: false,
      mode: 'arcade',
    });

    expect(result.isActuallyLastMerge).toBe(true);
    expect(result.finalMergeSnapshot.isFinalWildLastTwo).toBe(true);
  });

  it('reproduces and closes Laser final Merge-6 spawning two dice from an active-looking orphan', () => {
    const laser = {
      value: 0,
      special: 'wild-tnt',
      _ccSpecialDiceVariant: 'laser-gun',
      _ccSpecialDiceArchetype: 'wild-tnt',
      stackDepth: 1,
      visible: true,
      alpha: 1,
      gridX: 0,
      gridY: 0,
    };
    const regular = {
      value: 5,
      stackDepth: 1,
      visible: true,
      alpha: 1,
      gridX: 1,
      gridY: 0,
    };
    const staleOrphan = {
      value: 4,
      stackDepth: 1,
      visible: true,
      alpha: 1,
      locked: false,
      destroyed: false,
      gridX: 2,
      gridY: 0,
    };
    const tiles = [laser, regular, staleOrphan];
    // drag-core clears the picked-up source cell before it hands the accepted
    // merge to app-core. This detached-source shape is the production boundary
    // that previously made the final Laser + 5 look like a non-final merge.
    const grid = [[null, regular, null]];

    // This is the exact old failure decision: the presentation-history list
    // invents a third blocker, then Laser's ordinary two-die multiplier is
    // allowed to continue instead of handing the final pair to New Reward.
    const rawListDecision = resolveLastMergeEarlyState({
      tiles,
      src: laser,
      dst: regular,
      effSum: 6,
      isWildMagnetMerge: false,
      mode: 'journey',
    });
    const legacySpawnCount = resolveWildEndgameSpawnMult({
      spawnMult: laser.stackDepth + regular.stackDepth,
      isWildMerge: true,
      lockedEmptyPlaceholderCount: 2,
      isLastMerge: rawListDecision.isActuallyLastMerge,
    }).spawnMult;
    expect(rawListDecision.isActuallyLastMerge).toBe(false);
    expect(legacySpawnCount).toBe(2);

    const authoritativeDecision = resolveLastMergeEarlyState({
      tiles,
      grid,
      src: laser,
      dst: regular,
      effSum: 6,
      isWildMagnetMerge: false,
      mode: 'journey',
    });
    expect(authoritativeDecision.activeTilesBeforeWildProgress).toHaveLength(2);
    expect(authoritativeDecision.activeTilesBeforeWildProgress).toEqual(
      expect.arrayContaining([laser, regular]),
    );
    expect(authoritativeDecision.isActuallyLastMerge).toBe(true);
    expect(authoritativeDecision.decision).toEqual({
      type: 'complete',
      target: 'journey-board',
      reason: 'final_wild_merge6',
    });
  });

  it('waits instead of completing or spawning from an invalid authoritative grid snapshot', () => {
    const laser = { value: 0, special: 'wild-tnt', gridX: 0, gridY: 0, visible: true };
    const regular = { value: 5, gridX: 1, gridY: 0, visible: true };
    const duplicate = { value: 4, gridX: 2, gridY: 0, visible: true };

    const result = resolveLastMergeEarlyState({
      tiles: [laser, regular, duplicate],
      grid: [[null, regular, duplicate], [null, null, duplicate]],
      src: laser,
      dst: regular,
      effSum: 6,
      isWildMagnetMerge: false,
      mode: 'journey',
    });

    expect(result.authoritativeGridStatus).toBe('invalid');
    expect(result.authoritativeGridIssues).toContain('duplicate-grid-owner');
    expect(result.isActuallyLastMerge).toBe(false);
    expect(result.decision).toEqual({
      type: 'wait',
      reason: 'invalid_authoritative_grid_snapshot',
    });
  });

  it('marks final regular merge-6 and prevents wild meter fill', () => {
    const src = { value: 4, stackDepth: 1 };
    const dst = { value: 2, stackDepth: 1 };
    const { deps, calls } = createDeps({
      tiles: [src, dst],
      src,
      dst,
      effSum: 6,
    });

    const result = handleLastMergeEarly(deps);

    expect(result.isActuallyLastMerge).toBe(true);
    expect(dst).toMatchObject({ _isLastMerge: true });
    expect(calls.wildMeter).toEqual([0]);
    expect(calls.stateWildMeter).toEqual([0]);
    expect(calls.hudReset).toEqual([true]);
    expect(calls.pendingCleanBoard).toEqual([2]);
  });

  it('marks stacked regular visible pair as final merge', () => {
    const src = { value: 4, stackDepth: 1 };
    const dst = { value: 2, stackDepth: 2 };
    const { deps, calls } = createDeps({
      tiles: [src, dst],
      src,
      dst,
      effSum: 6,
    });

    const result = handleLastMergeEarly(deps);

    expect(result.isActuallyLastMerge).toBe(true);
    expect(dst).toMatchObject({ _isLastMerge: true });
    expect(calls.wildMeter).toEqual([0]);
    expect(calls.stateWildMeter).toEqual([0]);
    expect(calls.hudReset).toEqual([true]);
    expect(calls.pendingCleanBoard).toEqual([2]);
  });

  it('marks final wild plus regular merge-6 across future special dice', () => {
    const src = { value: 0, special: 'wild-cubero', stackDepth: 1 };
    const dst = { value: 5, stackDepth: 2 };
    const { deps, calls } = createDeps({
      tiles: [src, dst],
      src,
      dst,
      effSum: 6,
    });

    const result = handleLastMergeEarly(deps);

    expect(result.isActuallyLastMerge).toBe(true);
    expect(dst).toMatchObject({ _isLastMerge: true });
    expect(calls.wildMeter).toEqual([0]);
    expect(calls.pendingCleanBoard).toEqual([2]);
  });

  it('does not mark magnet as final when it still has tiles to pull', () => {
    const src = { value: 0, special: 'wild-magnet', stackDepth: 1 };
    const dst = { value: 5, stackDepth: 1, _hasTilesToPull: true };
    const other = { value: 3, stackDepth: 1 };
    const { deps, calls } = createDeps({
      tiles: [src, dst, other],
      src,
      dst,
      effSum: 6,
      isWildMagnetMerge: true,
    });

    const result = handleLastMergeEarly(deps);

    expect(result.isActuallyLastMerge).toBe(false);
    expect(result.willPullTiles).toBe(true);
    expect(dst).not.toMatchObject({ _isLastMerge: true });
    expect(calls.wildMeter).toEqual([]);
    expect(calls.stateWildMeter).toEqual([]);
    expect(calls.hudReset).toEqual([]);
    expect(calls.pendingCleanBoard).toEqual([]);
  });
});
