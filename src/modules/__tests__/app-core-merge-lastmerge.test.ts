import { handleLastMergeEarly, resolveLastMergeEarlyState } from '../app-core-merge-lastmerge';

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
