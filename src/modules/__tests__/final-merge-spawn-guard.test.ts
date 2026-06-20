import { resolveFinalMergeSpawnGuard } from '../final-merge-spawn-guard';

describe('final-merge-spawn-guard', () => {
  it('blocks spawn for a final regular merge-6 pair', () => {
    const src = { value: 4 };
    const dst = { value: 2 };

    expect(resolveFinalMergeSpawnGuard({
      activeTilesBeforeMerge: [src, dst],
      finalMergeBlockersBefore: [],
      src,
      dst,
      effSum: 6,
      srcIsWild: false,
      dstIsWild: false,
      magnetWillPull: false,
    })).toEqual({ shouldBlockSpawn: true, reason: 'regular-final-pair' });
  });

  it('blocks spawn for a final wild plus regular pair', () => {
    const src = { special: 'wild-juice' };
    const dst = { value: 5 };

    expect(resolveFinalMergeSpawnGuard({
      activeTilesBeforeMerge: [src, dst],
      finalMergeBlockersBefore: [],
      src,
      dst,
      effSum: 6,
      srcIsWild: true,
      dstIsWild: false,
      magnetWillPull: false,
    })).toEqual({ shouldBlockSpawn: true, reason: 'wild-final-pair' });
  });

  it('does not block when a magnet will pull more tiles', () => {
    const src = { special: 'wild-magnet' };
    const dst = { value: 5 };

    expect(resolveFinalMergeSpawnGuard({
      activeTilesBeforeMerge: [src, dst],
      finalMergeBlockersBefore: [],
      src,
      dst,
      effSum: 6,
      srcIsWild: true,
      dstIsWild: false,
      magnetWillPull: true,
    })).toEqual({ shouldBlockSpawn: false, reason: 'magnet-will-pull' });
  });

  it('does not block when another gameplay blocker existed before merge', () => {
    const src = { value: 4 };
    const dst = { value: 2 };
    const blocker = { value: 3 };

    expect(resolveFinalMergeSpawnGuard({
      activeTilesBeforeMerge: [src, dst, blocker],
      finalMergeBlockersBefore: [blocker],
      src,
      dst,
      effSum: 6,
      srcIsWild: false,
      dstIsWild: false,
      magnetWillPull: false,
    })).toEqual({ shouldBlockSpawn: false, reason: 'blockers-present' });
  });
});
