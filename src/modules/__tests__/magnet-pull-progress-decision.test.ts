import { resolveMagnetPullProgressDecision } from '../magnet-pull-progress-decision';

describe('magnet-pull-progress-decision', () => {
  it('adds wild progress for a normal magnet pull', () => {
    const magnet = { special: 'wild-magnet' };
    const pulled = { value: 4 };
    const other = { value: 2 };

    expect(resolveMagnetPullProgressDecision({
      activeTilesBeforePull: [magnet, pulled, other],
      mergeTile: magnet,
      pulledTileCount: 1,
    })).toEqual({
      shouldAddWildProgress: true,
      isLastMergeBeforePull: false,
    });
  });

  it('does not add wild progress for a last magnet pull pair', () => {
    const magnet = { special: 'wild-magnet' };
    const pulled = { value: 4 };

    expect(resolveMagnetPullProgressDecision({
      activeTilesBeforePull: [magnet, pulled],
      mergeTile: magnet,
      pulledTileCount: 1,
    })).toEqual({
      shouldAddWildProgress: false,
      isLastMergeBeforePull: true,
    });
  });

  it('does not add wild progress for invalid pull counts', () => {
    const magnet = { special: 'wild-magnet' };

    expect(resolveMagnetPullProgressDecision({
      activeTilesBeforePull: [magnet],
      mergeTile: magnet,
      pulledTileCount: 0,
    })).toEqual({
      shouldAddWildProgress: false,
      isLastMergeBeforePull: false,
    });
  });
});
