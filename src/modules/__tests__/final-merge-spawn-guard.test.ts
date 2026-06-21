import { resolveFinalMergeSpawnGuard, resolvePreSpawnFinalMergeCompletion } from '../final-merge-spawn-guard';

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

  it('deduplicates active tile refs before deciding final wild pair', () => {
    const src = { special: 'wild-juice' };
    const dst = { value: 5, stackDepth: 2 };

    expect(resolveFinalMergeSpawnGuard({
      activeTilesBeforeMerge: [src, dst, dst],
      finalMergeBlockersBefore: [],
      src,
      dst,
      effSum: 6,
      srcIsWild: true,
      dstIsWild: false,
      magnetWillPull: false,
    })).toEqual({ shouldBlockSpawn: true, reason: 'wild-final-pair' });
  });

  it('deduplicates active tile refs before deciding final regular pair', () => {
    const src = { value: 4 };
    const dst = { value: 2, stackDepth: 1 };

    expect(resolveFinalMergeSpawnGuard({
      activeTilesBeforeMerge: [src, dst, dst],
      finalMergeBlockersBefore: [],
      src,
      dst,
      effSum: 6,
      srcIsWild: false,
      dstIsWild: false,
      magnetWillPull: false,
    })).toEqual({ shouldBlockSpawn: true, reason: 'regular-final-pair' });
  });

  it('blocks spawn for stacked regular visible pair that sums to 6', () => {
    const src = { value: 4, stackDepth: 1 };
    const dst = { value: 2, stackDepth: 2 };

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

  it('routes final wild pre-spawn completion through one decision helper', () => {
    expect(resolvePreSpawnFinalMergeCompletion({
      spawnGuardDecision: { shouldBlockSpawn: true, reason: 'wild-final-pair' },
      srcWasWild: true,
      dstWasWild: false,
      effSum: 6,
      otherPlayableCount: 0,
    })).toEqual({ shouldComplete: true, reason: 'final-wild-pair' });
  });

  it('routes final regular pre-spawn completion through one decision helper', () => {
    expect(resolvePreSpawnFinalMergeCompletion({
      spawnGuardDecision: { shouldBlockSpawn: true, reason: 'regular-final-pair' },
      srcWasWild: false,
      dstWasWild: false,
      effSum: 6,
      otherPlayableCount: 0,
    })).toEqual({ shouldComplete: true, reason: 'final-regular-pair' });
  });

  it('does not complete pre-spawn final merge while another playable tile remains', () => {
    expect(resolvePreSpawnFinalMergeCompletion({
      spawnGuardDecision: { shouldBlockSpawn: true, reason: 'wild-final-pair' },
      srcWasWild: true,
      dstWasWild: false,
      effSum: 6,
      otherPlayableCount: 1,
    })).toEqual({ shouldComplete: false, reason: 'other-playable-present' });
  });

  it('does not complete non-final pre-spawn merge', () => {
    expect(resolvePreSpawnFinalMergeCompletion({
      spawnGuardDecision: { shouldBlockSpawn: false, reason: 'not-final-pair' },
      srcWasWild: false,
      dstWasWild: false,
      effSum: 5,
      otherPlayableCount: 0,
    })).toEqual({ shouldComplete: false, reason: 'not-final-pair' });
  });
});
