import {
  collapseTileToSingleStackVisual,
  detachTileFromGrid,
  isGameplayTileCandidate,
  isLockedEmptyPlaceholder,
  normalizePlayableTileAfterMutation,
  normalizeSpawnedTileVisual,
  removeTileFully,
} from '../tile-lifecycle-service';

test('collapseTileToSingleStackVisual removes stale stack art without moving the tile', () => {
  const removeChild = jest.fn();
  const destroy = jest.fn();
  const stackG = { parent: { removeChild }, destroy };
  const tile: any = {
    gridX: 4,
    gridY: 4,
    x: 656,
    y: 656,
    stackDepth: 2,
    stackG,
  };

  collapseTileToSingleStackVisual(tile);

  expect(tile.stackDepth).toBe(1);
  expect(tile.stackG).toBeNull();
  expect(removeChild).toHaveBeenCalledWith(stackG);
  expect(destroy).toHaveBeenCalledWith({ children: true });
  expect({ gridX: tile.gridX, gridY: tile.gridY, x: tile.x, y: tile.y }).toEqual({
    gridX: 4,
    gridY: 4,
    x: 656,
    y: 656,
  });
});
import { isVisibleGameplayResolvingSpecialPresence } from '../tile-state-utils';

test('removeTileFully clears direct grid reference, tile list, runtime flags, and destroys tile', () => {
  const tile: any = {
    gridX: 1,
    gridY: 0,
    value: 5,
    eventMode: 'static',
    visible: true,
    alpha: 1,
    _wildMagnetAffected: true,
    _wildMagnetPulledTilesMerge: true,
    _pendingRemoval: true,
    removeAllListeners: jest.fn(),
    destroy: jest.fn(function destroy() {
      tile.destroyed = true;
    }),
  };
  const board = { removeChild: jest.fn() };
  const grid: any[][] = [[null, tile]];
  const tiles = [tile];
  const clearEndGameCache = jest.fn();
  const stopWildIdle = jest.fn();

  const removed = removeTileFully(tile, {
    board,
    grid,
    tiles,
    clearEndGameCache,
    stopWildIdle,
  });

  expect(removed).toBe(true);
  expect(grid[0][1]).toBe(null);
  expect(tiles).toEqual([]);
  expect(board.removeChild).toHaveBeenCalledWith(tile);
  expect(clearEndGameCache).toHaveBeenCalledTimes(1);
  expect(stopWildIdle).toHaveBeenCalledWith(tile);
  expect(tile.eventMode).toBe('none');
  expect(tile.visible).toBe(false);
  expect(tile.alpha).toBe(0);
  expect(tile._wildMagnetAffected).toBeUndefined();
  expect(tile._wildMagnetPulledTilesMerge).toBeUndefined();
  expect(tile._pendingRemoval).toBeUndefined();
  expect(tile.destroy).toHaveBeenCalledWith({ children: true, texture: false, textureSource: false });
});

test('detachTileFromGrid clears stale grid reference even when tile coordinates are wrong', () => {
  const tile: any = { gridX: 4, gridY: 4 };
  const grid: any[][] = [
    [null, null],
    [tile, null],
  ];

  expect(detachTileFromGrid(tile, grid)).toBe(true);
  expect(grid[1][0]).toBe(null);
});

test('isGameplayTileCandidate rejects invisible, pending, locked, passive, and empty residue tiles', () => {
  expect(isGameplayTileCandidate({ value: 2, eventMode: 'static', visible: true, alpha: 1 })).toBe(true);
  expect(isGameplayTileCandidate({ special: 'wild-tnt', eventMode: 'static', visible: true, alpha: 1 })).toBe(true);
  expect(isGameplayTileCandidate({ value: 2, eventMode: 'static', visible: false, alpha: 1 })).toBe(false);
  expect(isGameplayTileCandidate({ value: 2, eventMode: 'static', visible: true, alpha: 0 })).toBe(false);
  expect(isGameplayTileCandidate({ value: 2, eventMode: 'static', visible: true, alpha: 1, locked: true })).toBe(false);
  expect(isGameplayTileCandidate({ value: 2, eventMode: 'none', visible: true, alpha: 1 })).toBe(false);
  expect(isGameplayTileCandidate({ value: 2, eventMode: 'static', visible: true, alpha: 1, _pendingRemoval: true })).toBe(false);
  expect(isGameplayTileCandidate({ value: 6, special: 'wild-magnet', eventMode: 'static', visible: true, alpha: 1, _ccSpecialDiceResolving: true })).toBe(false);
  expect(isGameplayTileCandidate({ value: 0, eventMode: 'static', visible: true, alpha: 1 })).toBe(false);
});

test.each([
  ['TNT', { special: 'wild-tnt' }, true],
  ['magnet', { special: 'wild-magnet' }, true],
  ['future TNT archetype', { special: 'wild-tnt', _ccSpecialDiceArchetype: 'wild-tnt' }, true],
  ['future magnet archetype', { special: 'wild-magnet', _ccSpecialDiceArchetype: 'wild-magnet' }, true],
  ['star', { special: 'wild' }, false],
  ['juice', { special: 'wild-juice' }, false],
])('visible gameplay-resolving special presence classifies %s', (_label, specialOverrides, expected) => {
  expect(isVisibleGameplayResolvingSpecialPresence({
    ...specialOverrides,
    visible: true,
    alpha: 1,
    eventMode: 'none',
  })).toBe(expected);
});

test('visible gameplay-resolving special presence rejects cleanup residue', () => {
  expect(isVisibleGameplayResolvingSpecialPresence({ special: 'wild-tnt', visible: false, alpha: 1 })).toBe(false);
  expect(isVisibleGameplayResolvingSpecialPresence({ special: 'wild-tnt', visible: true, alpha: 0.2 })).toBe(false);
  expect(isVisibleGameplayResolvingSpecialPresence({ special: 'wild-tnt', visible: true, alpha: 1, _pendingRemoval: true })).toBe(false);
  expect(isVisibleGameplayResolvingSpecialPresence({ special: 'wild-magnet', visible: true, alpha: 1, _wildMagnetAffected: true })).toBe(false);
});

test('isLockedEmptyPlaceholder identifies locked ghost residue without matching playable locked specials', () => {
  expect(isLockedEmptyPlaceholder({ locked: true, value: 0 })).toBe(true);
  expect(isLockedEmptyPlaceholder({ locked: true, value: -1 })).toBe(true);
  expect(isLockedEmptyPlaceholder({ locked: true, value: 2 })).toBe(false);
  expect(isLockedEmptyPlaceholder({ locked: true, value: 0, special: 'wild-juice' })).toBe(false);
  expect(isLockedEmptyPlaceholder({ locked: false, value: 0 })).toBe(false);
  expect(isLockedEmptyPlaceholder({ locked: true, value: 0, destroyed: true })).toBe(false);
});

test('normalizeSpawnedTileVisual restores stable visible tile state after spawn tweens', () => {
  const tile: any = {
    scale: { x: 0.3, y: 1.7, set: jest.fn(function set(x: number, y: number) {
      tile.scale.x = x;
      tile.scale.y = y;
    }) },
    alpha: 0.2,
    _isBeingSpawned: true,
    _ccHideFinalMergeResultVisual: true,
    rotG: { alpha: 0.4 },
    base: { alpha: 0.5, visible: false },
    overlay: { alpha: 0.9, visible: true },
    num: { alpha: 0.6 },
    pips: { alpha: 0.1, visible: false },
  };

  normalizeSpawnedTileVisual(tile);

  expect(tile.scale.set).toHaveBeenCalledWith(1, 1);
  expect(tile.scale.x).toBe(1);
  expect(tile.scale.y).toBe(1);
  expect(tile._isBeingSpawned).toBe(false);
  expect(tile._ccHideFinalMergeResultVisual).toBeUndefined();
  expect(tile.alpha).toBe(1);
  expect(tile.rotG.alpha).toBe(1);
  expect(tile.base.alpha).toBe(1);
  expect(tile.base.visible).toBe(true);
  expect(tile.overlay.alpha).toBe(1);
  expect(tile.overlay.visible).toBe(false);
  expect(tile.num.alpha).toBe(1);
  expect(tile.pips.alpha).toBe(1);
  expect(tile.pips.visible).toBe(true);
});

test('normalizePlayableTileAfterMutation clears transient locks and restores hit targets', () => {
  const tile: any = {
    destroyed: false,
    locked: true,
    visible: false,
    alpha: 0.2,
    eventMode: 'none',
    interactive: false,
    interactiveChildren: false,
    cursor: 'default',
    _isBeingSpawned: true,
    _pendingRemoval: true,
    _ccWildSpawnDropping: true,
    _ccWildSpawnHandoffLock: true,
    _wildMagnetAffected: true,
    scale: { x: 0.4, y: 0.8, set: jest.fn(function set(x: number, y: number) {
      tile.scale.x = x;
      tile.scale.y = y;
    }) },
    rotG: {
      destroyed: false,
      visible: false,
      alpha: 0.1,
      eventMode: 'none',
      interactive: false,
      interactiveChildren: false,
      cursor: 'default',
    },
    pips: { alpha: 0.1, visible: false },
  };

  normalizePlayableTileAfterMutation(tile);

  expect(tile.locked).toBe(false);
  expect(tile.visible).toBe(true);
  expect(tile.alpha).toBe(1);
  expect(tile.eventMode).toBe('static');
  expect(tile.interactive).toBe(true);
  expect(tile.interactiveChildren).toBe(true);
  expect(tile.cursor).toBe('pointer');
  expect(tile._pendingRemoval).toBeUndefined();
  expect(tile._ccWildSpawnDropping).toBeUndefined();
  expect(tile._ccWildSpawnHandoffLock).toBeUndefined();
  expect(tile._wildMagnetAffected).toBeUndefined();
  expect(tile.scale.set).toHaveBeenCalledWith(1, 1);
  expect(tile.rotG.visible).toBe(true);
  expect(tile.rotG.alpha).toBe(1);
  expect(tile.rotG.eventMode).toBe('static');
  expect(tile.rotG.interactive).toBe(true);
  expect(tile.rotG.interactiveChildren).toBe(true);
  expect(tile.rotG.cursor).toBe('pointer');
  expect(tile.pips.visible).toBe(true);
  expect(tile.pips.alpha).toBe(1);
});
