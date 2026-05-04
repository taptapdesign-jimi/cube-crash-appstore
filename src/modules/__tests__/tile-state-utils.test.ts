import { getTransientSpawnState, isTileTransientlySpawning } from '../tile-state-utils';

const makeTile = (overrides: Partial<any> = {}) => ({
  value: 0,
  special: null,
  locked: false,
  destroyed: false,
  visible: true,
  eventMode: 'static',
  ...overrides,
});

test('isTileTransientlySpawning is false for plain locked value tile (no spawn tween / magnet pull)', () => {
  const tile = makeTile({ locked: true, value: 4 });
  expect(isTileTransientlySpawning(tile, { autoClearStaleFlag: true, ignoreWildJuice: true })).toBe(false);
});

test('isTileTransientlySpawning is true for locked value tile while spawn tween is active', () => {
  const tile: any = makeTile({
    locked: true,
    value: 3,
    _spawnTween: { isActive: () => true },
  });
  expect(isTileTransientlySpawning(tile, { autoClearStaleFlag: false, ignoreWildJuice: true })).toBe(true);
});

test('isTileTransientlySpawning is true for locked tile under wild-magnet pull (_wildMagnetAffected)', () => {
  const tile: any = makeTile({ locked: true, value: 2, _wildMagnetAffected: true });
  expect(isTileTransientlySpawning(tile, { autoClearStaleFlag: true, ignoreWildJuice: true })).toBe(true);
});

test('getTransientSpawnState lists locked tile when locked + active spawn tween', () => {
  const tiles = [
    makeTile({
      locked: true,
      value: 3,
      _spawnTween: { isActive: () => true },
    }),
    makeTile({ locked: false, value: 1 }),
  ];
  const state = getTransientSpawnState(tiles, { autoClearStaleFlag: false, ignoreWildJuice: true });
  expect(state.lockedActiveTiles.length).toBe(1);
  expect(state.tilesStillSpawning.length).toBe(1);
  expect(state.hasNotReadyTiles).toBe(true);
});

test('isTileTransientlySpawning clears stale _spawnTween on locked tile when tween inactive and autoClearStaleFlag', () => {
  const tile: any = makeTile({
    locked: true,
    value: 4,
    _spawnTween: { isActive: () => false },
  });
  expect(isTileTransientlySpawning(tile, { autoClearStaleFlag: true, ignoreWildJuice: true })).toBe(false);
  expect(tile._spawnTween).toBeNull();
});

test('isTileTransientlySpawning clears stale _isBeingSpawned on interactive tile', () => {
  const tile: any = makeTile({ value: 5, locked: false, _isBeingSpawned: true, eventMode: 'static', visible: true });
  expect(isTileTransientlySpawning(tile, { autoClearStaleFlag: true, ignoreWildJuice: true })).toBe(false);
  expect(tile._isBeingSpawned).toBe(false);
});

test('isTileTransientlySpawning keeps true when tile is still non-interactive', () => {
  const tile: any = makeTile({ value: 5, locked: false, _isBeingSpawned: true, eventMode: 'none', visible: true });
  expect(isTileTransientlySpawning(tile, { autoClearStaleFlag: true, ignoreWildJuice: true })).toBe(true);
  expect(tile._isBeingSpawned).toBe(true);
});

test('getTransientSpawnState: locked-only tiles without tween are not “spawning”; _isBeingSpawned still counts when non-interactive', () => {
  const tiles = [
    makeTile({ locked: true, value: 3 }),
    makeTile({ locked: false, value: 2, _isBeingSpawned: true, eventMode: 'none' }),
    makeTile({ locked: false, value: 4 }),
  ];
  const state = getTransientSpawnState(tiles, { autoClearStaleFlag: true, ignoreWildJuice: true });
  expect(state.lockedActiveTiles.length).toBe(0);
  expect(state.tilesStillSpawning.length).toBe(1);
  expect(state.hasNotReadyTiles).toBe(true);
});
