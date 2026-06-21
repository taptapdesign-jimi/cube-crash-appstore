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
