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

test('isTileTransientlySpawning returns true for locked value tile', () => {
  const tile = makeTile({ locked: true, value: 4 });
  expect(isTileTransientlySpawning(tile, { autoClearStaleFlag: true, ignoreWildJuice: true })).toBe(true);
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

test('getTransientSpawnState returns both locked and spawning sets', () => {
  const tiles = [
    makeTile({ locked: true, value: 3 }),
    makeTile({ locked: false, value: 2, _isBeingSpawned: true, eventMode: 'none' }),
    makeTile({ locked: false, value: 4 }),
  ];
  const state = getTransientSpawnState(tiles, { autoClearStaleFlag: true, ignoreWildJuice: true });
  expect(state.lockedActiveTiles.length).toBe(1);
  expect(state.tilesStillSpawning.length).toBe(2);
  expect(state.hasNotReadyTiles).toBe(true);
});
