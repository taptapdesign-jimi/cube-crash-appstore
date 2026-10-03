import { commitLaserGunTileImpact } from '../laser-gun-tile-impact';
import { BoardMutationEpochOwner } from '../board-mutation-epoch-owner';

function createTile(value = 2) {
  return {
    value,
    stackDepth: 2,
    destroyed: false,
    scale: { x: 1, y: 1, set(x: number, y = x) { this.x = x; this.y = y; } },
    rotG: { rotation: 0 },
    _ccTntBonusOwned: true,
  } as any;
}

function fixture(tile = createTile()) {
  const grid = [[tile]];
  const tiles = [tile];
  const callbacks: { complete?: () => void; interrupt?: () => void; safety?: () => void } = {};
  const kill = jest.fn();
  const setValueImmediate = jest.fn((target, value) => { target.value = value; });
  const releaseOwnership = jest.fn((target) => { delete target._ccTntBonusOwned; });
  const onSettled = jest.fn();
  const onValueCommitted = jest.fn();
  const commitMutation = jest.fn(() => true);
  const startBounce = jest.fn((_target, complete, interrupt) => {
    callbacks.complete = complete;
    callbacks.interrupt = interrupt;
    return { kill };
  });
  const scheduleSafety = jest.fn((callback) => { callbacks.safety = callback; });
  const run = (replacementValue = 5) => commitLaserGunTileImpact({
    tile, grid, tiles, column: 0, row: 0, replacementValue,
    setValueImmediate, startBounce, releaseOwnership, onValueCommitted, onSettled, commitMutation, scheduleSafety,
  });
  return {
    tile, grid, tiles, callbacks, kill, setValueImmediate, releaseOwnership,
    onValueCommitted, onSettled, startBounce, commitMutation, scheduleSafety, run,
  };
}

describe('LaserGun same-tile impact transaction', () => {
  test('changes the face and runs the canonical bounce without changing grid/list identity', () => {
    const f = fixture();
    expect(f.run()).toBe(true);
    expect(f.tile.value).toBe(5);
    expect(f.tile.stackDepth).toBe(1);
    expect(f.grid[0][0]).toBe(f.tile);
    expect(f.tiles).toEqual([f.tile]);
    expect(f.tile._ccTntBonusOwned).toBe(true);
    expect(f.tile._ccLaserGunImpactTl?.kill).toEqual(expect.any(Function));
    expect(f.onValueCommitted).toHaveBeenCalledTimes(1);
    expect(f.onSettled).not.toHaveBeenCalled();

    f.callbacks.complete?.();
    expect(f.releaseOwnership).toHaveBeenCalledTimes(1);
    expect(f.tile._ccLaserGunImpactTl).toBeNull();
    expect(f.onSettled).toHaveBeenCalledWith(true);
    expect(f.tile.scale).toMatchObject({ x: 1, y: 1 });
    f.callbacks.safety?.();
    expect(f.releaseOwnership).toHaveBeenCalledTimes(1);
  });

  test('rejects a stale or dragged grid identity without mutating the current occupant', () => {
    const stale = createTile(2);
    const occupant = createTile(4);
    const f = fixture(stale);
    f.grid[0][0] = occupant;
    expect(f.run(6)).toBe(false);
    expect(stale.value).toBe(2);
    expect(occupant.value).toBe(4);
    expect(f.setValueImmediate).not.toHaveBeenCalled();
    expect(f.onValueCommitted).not.toHaveBeenCalled();
    expect(f.startBounce).not.toHaveBeenCalled();
    expect(f.releaseOwnership).toHaveBeenCalledTimes(1);
    expect(f.onSettled).toHaveBeenCalledWith(false);
  });

  test('interrupt and safety paths restore the pose and settle exactly once', () => {
    const f = fixture();
    f.tile.rotG.rotation = 0.12;
    f.run();
    f.tile.scale.set(1.08);
    f.tile.rotG.rotation = -0.2;
    f.callbacks.safety?.();
    expect(f.kill).toHaveBeenCalledTimes(1);
    expect(f.tile.scale).toMatchObject({ x: 1, y: 1 });
    expect(f.tile.rotG.rotation).toBeCloseTo(0.12);
    f.callbacks.interrupt?.();
    f.callbacks.complete?.();
    expect(f.releaseOwnership).toHaveBeenCalledTimes(1);
    expect(f.onSettled).toHaveBeenCalledTimes(1);
  });

  test('tile lifecycle kill settles the owned bounce and a retired generation cannot mutate its successor', () => {
    const f = fixture();
    let current = true;
    commitLaserGunTileImpact({
      tile: f.tile,
      grid: f.grid,
      tiles: f.tiles,
      column: 0,
      row: 0,
      replacementValue: 6,
      setValueImmediate: f.setValueImmediate,
      startBounce: f.startBounce,
      releaseOwnership: f.releaseOwnership,
      onSettled: f.onSettled,
      isCurrent: () => current,
      commitMutation: () => true,
      scheduleSafety: f.scheduleSafety,
    });
    current = false;
    f.tile._ccLaserGunImpactTl.kill();

    expect(f.kill).toHaveBeenCalledTimes(1);
    expect(f.releaseOwnership).toHaveBeenCalledTimes(1);
    expect(f.onSettled).not.toHaveBeenCalled();
    expect(f.tile._ccLaserGunImpactTl).toBeNull();
    f.callbacks.safety?.();
    expect(f.releaseOwnership).toHaveBeenCalledTimes(1);
  });

  test('a post-commit presentation failure stays an accepted same-tile mutation', () => {
    const f = fixture();
    f.startBounce.mockImplementationOnce(() => { throw new Error('bounce unavailable'); });

    expect(f.run(6)).toBe(true);
    expect(f.tile.value).toBe(6);
    expect(f.onValueCommitted).toHaveBeenCalledTimes(1);
    expect(f.releaseOwnership).toHaveBeenCalledTimes(1);
    expect(f.onSettled).toHaveBeenCalledWith(true);
    expect(f.tile.scale).toMatchObject({ x: 1, y: 1 });
  });

  test('a setter throw after permit consumption commits one logical value and cannot retry or become terminal', () => {
    const f = fixture(createTile(2));
    const mutationOwner = new BoardMutationEpochOwner();
    const epoch = mutationOwner.beginMutation({
      transactionId: 'laser-setter-throw',
      boardRevision: 22,
      spawnBudget: 1,
    });
    const permit = mutationOwner.issueSpawnPermit(epoch)!;
    const throwingSetter = jest.fn(() => { throw new Error('renderer setter failed'); });
    const commitMutation = jest.fn(() => mutationOwner.commitSpawn(permit).accepted);
    const run = () => commitLaserGunTileImpact({
      tile: f.tile,
      grid: f.grid,
      tiles: f.tiles,
      column: 0,
      row: 0,
      replacementValue: 5,
      setValueImmediate: throwingSetter,
      startBounce: f.startBounce,
      releaseOwnership: f.releaseOwnership,
      onValueCommitted: f.onValueCommitted,
      onSettled: f.onSettled,
      commitMutation,
      scheduleSafety: f.scheduleSafety,
    });

    expect(run()).toBe(true);
    expect(f.tile).toMatchObject({ value: 5, stackDepth: 1 });
    expect(f.onValueCommitted).toHaveBeenCalledTimes(1);
    expect(f.onSettled).toHaveBeenCalledWith(true);
    expect(f.startBounce).not.toHaveBeenCalled();
    expect(mutationOwner.getOutcome(epoch)).toBe('spawn');
    expect(mutationOwner.commitComplete(epoch)).toEqual({
      accepted: false,
      outcome: 'spawn',
      reason: 'spawn-committed',
    });

    expect(run()).toBe(false);
    expect(throwingSetter).toHaveBeenCalledTimes(1);
    expect(commitMutation).toHaveBeenCalledTimes(2);
    expect(f.tile.value).toBe(5);
  });

  test('four impacts preserve a complete one-to-one board while values change', () => {
    const tiles = [1, 2, 3, 4].map(createTile);
    const grid = [tiles.slice()];
    const identities = tiles.slice();
    tiles.forEach((tile, column) => {
      let complete: (() => void) | undefined;
      expect(commitLaserGunTileImpact({
        tile, grid, tiles, column, row: 0, replacementValue: tile.value + 1,
        setValueImmediate: (target, value) => { target.value = value; },
        startBounce: (_target, onComplete) => { complete = onComplete; },
        releaseOwnership: (target) => { delete target._ccTntBonusOwned; },
        onSettled: jest.fn(), commitMutation: () => true, scheduleSafety: jest.fn(),
      })).toBe(true);
      complete?.();
    });
    expect(tiles).toEqual(identities);
    expect(grid[0]).toEqual(identities);
    expect(new Set(grid[0]).size).toBe(4);
    expect(tiles.map(tile => tile.value)).toEqual([2, 3, 4, 5]);
    expect(tiles.every(tile => !tile.destroyed)).toBe(true);
  });

  test('terminal commit revokes two queued Laser impacts before either can change a die', () => {
    const first = createTile(2);
    const second = createTile(4);
    const tiles = [first, second];
    const grid = [tiles.slice()];
    const mutationOwner = new BoardMutationEpochOwner();
    const epoch = mutationOwner.beginMutation({
      transactionId: 'laser-final-merge',
      boardRevision: 21,
      spawnBudget: 2,
    });
    const permits = [
      mutationOwner.issueSpawnPermit(epoch)!,
      mutationOwner.issueSpawnPermit(epoch)!,
    ];
    expect(mutationOwner.commitComplete(epoch)).toEqual({ accepted: true, outcome: 'complete' });

    const valueCommits = jest.fn();
    const results = tiles.map((tile, column) => commitLaserGunTileImpact({
      tile,
      grid,
      tiles,
      column,
      row: 0,
      replacementValue: 5,
      setValueImmediate: (target, value) => {
        valueCommits();
        target.value = value;
      },
      startBounce: jest.fn(),
      releaseOwnership: (target) => { delete target._ccTntBonusOwned; },
      onSettled: jest.fn(),
      commitMutation: () => mutationOwner.commitSpawn(permits[column]).accepted,
      scheduleSafety: jest.fn(),
    }));

    expect(results).toEqual([false, false]);
    expect(valueCommits).not.toHaveBeenCalled();
    expect(tiles.map((tile) => tile.value)).toEqual([2, 4]);
    expect(mutationOwner.getOutcome(epoch)).toBe('complete');
  });
});
