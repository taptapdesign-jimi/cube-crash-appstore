import { resolveWildMergeSpawnBonus } from '../wild-merge-spawn-bonus-decision';

describe('wild-merge-spawn-bonus-decision', () => {
  const baseInput = {
    isWildMerge: true,
    isLastMerge: false,
    isArcadeSimpleWildMergeSpawn: false,
    isFinalWildSnapshotBeforeSpawn: false,
    isJuice: false,
    isStar: false,
    isMagnet: false,
    isTnt: false,
    starOrbitCount: 3,
  };

  it('does not add bonus spawns when wild bonus flow is blocked', () => {
    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isWildMerge: false,
    })).toEqual({ lockedBonusCount: 0, extraActiveCount: 0 });

    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isLastMerge: true,
    })).toEqual({ lockedBonusCount: 0, extraActiveCount: 0 });

    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isArcadeSimpleWildMergeSpawn: true,
    })).toEqual({ lockedBonusCount: 0, extraActiveCount: 0 });

    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isFinalWildSnapshotBeforeSpawn: true,
    })).toEqual({ lockedBonusCount: 0, extraActiveCount: 0 });
  });

  it('uses juice bonus without extra active opens', () => {
    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isJuice: true,
    })).toEqual({ lockedBonusCount: 3, extraActiveCount: 0 });
  });

  it('scales star bonus by available orbit count', () => {
    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isStar: true,
      starOrbitCount: 3,
    })).toEqual({ lockedBonusCount: 9, extraActiveCount: 3 });

    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isStar: true,
      starOrbitCount: 2,
    })).toEqual({ lockedBonusCount: 7, extraActiveCount: 2 });

    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isStar: true,
      starOrbitCount: 1,
    })).toEqual({ lockedBonusCount: 5, extraActiveCount: 1 });
  });

  it('uses locked-only bonus for magnet and tnt archetypes', () => {
    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isMagnet: true,
    })).toEqual({ lockedBonusCount: 9, extraActiveCount: 0 });

    expect(resolveWildMergeSpawnBonus({
      ...baseInput,
      isTnt: true,
    })).toEqual({ lockedBonusCount: 9, extraActiveCount: 0 });
  });

  it('keeps a default bonus for future wild-like special dice', () => {
    expect(resolveWildMergeSpawnBonus(baseInput)).toEqual({
      lockedBonusCount: 9,
      extraActiveCount: 3,
    });
  });
});
