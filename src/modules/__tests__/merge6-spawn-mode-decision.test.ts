import { resolveMerge6SpawnMode } from '../merge6-spawn-mode-decision';

describe('merge6-spawn-mode-decision', () => {
  it('spawns at destination in true endgame mode', () => {
    expect(resolveMerge6SpawnMode({
      isLastMerge: false,
      isFinalMergeByResolver: false,
      spawnMult: 1,
      isEndgameMode: true,
      isArcadeSimpleWildMergeSpawn: false,
    }).shouldSpawnAtDst).toBe(true);
  });

  it('does not spawn at destination in normal locked-tile mode', () => {
    expect(resolveMerge6SpawnMode({
      isLastMerge: false,
      isFinalMergeByResolver: false,
      spawnMult: 2,
      isEndgameMode: false,
      isArcadeSimpleWildMergeSpawn: false,
    }).shouldSpawnAtDst).toBe(false);
  });

  it('never spawns at destination for final merge completion', () => {
    expect(resolveMerge6SpawnMode({
      isLastMerge: true,
      isFinalMergeByResolver: false,
      spawnMult: 1,
      isEndgameMode: true,
      isArcadeSimpleWildMergeSpawn: true,
    }).shouldSpawnAtDst).toBe(false);

    expect(resolveMerge6SpawnMode({
      isLastMerge: false,
      isFinalMergeByResolver: true,
      spawnMult: 1,
      isEndgameMode: true,
      isArcadeSimpleWildMergeSpawn: true,
    }).shouldSpawnAtDst).toBe(false);
  });

  it('allows arcade simple wild merge spawn at destination', () => {
    expect(resolveMerge6SpawnMode({
      isLastMerge: false,
      isFinalMergeByResolver: false,
      spawnMult: 1,
      isEndgameMode: false,
      isArcadeSimpleWildMergeSpawn: true,
    }).shouldSpawnAtDst).toBe(true);
  });
});
