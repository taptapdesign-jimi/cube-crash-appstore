import { resolveWildEndgameSpawnMult } from '../wild-endgame-spawn-mult-decision';

describe('wild-endgame-spawn-mult-decision', () => {
  it('reduces non-final wild merge spawn to one when no locked placeholders remain', () => {
    expect(resolveWildEndgameSpawnMult({
      spawnMult: 3,
      isWildMerge: true,
      lockedEmptyPlaceholderCount: 0,
      isLastMerge: false,
    })).toEqual({ spawnMult: 1, reducedToSingleSpawn: true });
  });

  it('keeps spawn count for regular merges, non-endgame boards, final merges, and already-single spawns', () => {
    expect(resolveWildEndgameSpawnMult({
      spawnMult: 3,
      isWildMerge: false,
      lockedEmptyPlaceholderCount: 0,
      isLastMerge: false,
    })).toEqual({ spawnMult: 3, reducedToSingleSpawn: false });

    expect(resolveWildEndgameSpawnMult({
      spawnMult: 3,
      isWildMerge: true,
      lockedEmptyPlaceholderCount: 2,
      isLastMerge: false,
    })).toEqual({ spawnMult: 3, reducedToSingleSpawn: false });

    expect(resolveWildEndgameSpawnMult({
      spawnMult: 3,
      isWildMerge: true,
      lockedEmptyPlaceholderCount: 0,
      isLastMerge: true,
    })).toEqual({ spawnMult: 3, reducedToSingleSpawn: false });

    expect(resolveWildEndgameSpawnMult({
      spawnMult: 1,
      isWildMerge: true,
      lockedEmptyPlaceholderCount: 0,
      isLastMerge: false,
    })).toEqual({ spawnMult: 1, reducedToSingleSpawn: false });
  });
});
