import { createSpecialMergeTransactionReceipt, SpecialDiceTransactionOwner } from '../special-dice-transaction-owner';
import { commitMagnetSurvivor } from '../magnet-survivor-commit';
import { resetTileToNormalState } from '../tile-state-utils';

function point(x = 1, y = 1) {
  return { x, y, set: jest.fn(function set(nextX: number, nextY = nextX) {
    this.x = nextX;
    this.y = nextY;
  }) };
}

function spaceshipTile() {
  const idleDispose = jest.fn();
  const tile: any = {
    destroyed: false,
    gridX: 2,
    gridY: 1,
    value: 6,
    special: 'wild-magnet',
    _ccGameplayDieId: 'consumed-magnet',
    isWild: true,
    isWildFace: true,
    _ccSpecialDiceVariant: 'spaceship',
    specialDiceVariant: 'spaceship',
    _ccSpecialDiceArchetype: 'wild-magnet',
    _ccSpecialDiceResolving: true,
    _wildMagnetPulledTilesMerge: true,
    _magnetMerge6Hidden: true,
    visible: false,
    alpha: 0,
    eventMode: 'none',
    interactive: false,
    interactiveChildren: true,
    scale: point(),
    rotG: {
      eventMode: 'static',
      interactive: true,
      interactiveChildren: true,
      cursor: 'pointer',
      hitArea: { width: 148, height: 148 },
      alpha: 1,
      rotation: 0.2,
      scale: point(),
      pivot: { x: 0, y: -64 },
      position: point(),
    },
    base: {
      texture: { id: 'spaceship-idle-3' },
      _ccTextureAssetPath: './assets/shop/spaceship/spaceship.png',
      visible: true,
      alpha: 1,
      width: 147.456,
      height: 147.456,
      rotation: 0.1,
      scale: point(),
      anchor: point(),
      position: point(),
    },
    shadow: { rotation: 0.2, scale: point() },
    overlay: { visible: true, alpha: 0.2 },
    pips: { visible: false, alpha: 0.2 },
    num: { visible: false, alpha: 0.2 },
    _ccSpaceshipSpriteIdle: { dispose: idleDispose },
    _ccSpaceshipEngineIdleContainer: {
      parent: { removeChild: jest.fn() },
      destroy: jest.fn(),
    },
  };
  return { tile, idleDispose };
}

test('commits a Spaceship destination as one canonical bound regular survivor before reveal', () => {
  const { tile, idleDispose } = spaceshipTile();
  const grid = Array.from({ length: 4 }, () => Array(4).fill(null));
  grid[tile.gridY][tile.gridX] = tile;
  const order: string[] = [];
  let completeBounce: (() => void) | null = null;
  let interruptBounce: (() => void) | null = null;
  const bindToTile = jest.fn((target: any) => {
    order.push('bind');
    expect(target.visible).toBe(false);
    expect(target._ccGameplayDieId).toBeUndefined();
    expect(target.base._ccTextureAssetPath).toBe('./assets/numbers.png');
    target.hitArea = { x: -64, y: -64, width: 128, height: 128 };
    target.eventMode = 'static';
    target.interactive = true;
    target.interactiveChildren = false;
  });

  const receipt = commitMagnetSurvivor({
    tile,
    value: 4,
    grid,
    board: {},
    tileSize: 128,
    gap: 12,
    commitMutation: () => { order.push('mutation'); return true; },
    stopSpecialIdle: (target) => {
      order.push('stop-idle');
      target._ccSpaceshipSpriteIdle.dispose();
      delete target._ccSpaceshipSpriteIdle;
      delete target._ccSpaceshipEngineIdleContainer;
    },
    resetToNormal: (target) => {
      order.push('clear-identity');
      expect(target._ccSpaceshipSpriteIdle).toBeUndefined();
      resetTileToNormalState(target);
    },
    collapseStack: () => { order.push('collapse'); },
    setValueImmediate: (target, value) => {
      order.push('paint');
      target.value = value;
      target.base.texture = { id: 'numbers' };
      target.base._ccTextureAssetPath = './assets/numbers.png';
    },
    syncZIndex: () => { order.push('z-index'); },
    bindToTile,
    startVisualTail: (_target, complete, interrupt) => {
      order.push('bounce');
      completeBounce = complete;
      interruptBounce = interrupt;
    },
    removeOnFailure: jest.fn(),
  });

  expect(receipt.committed).toBe(true);
  expect(order).toEqual([
    'mutation', 'stop-idle', 'clear-identity', 'collapse',
    'paint', 'z-index', 'bind', 'bounce',
  ]);
  expect(idleDispose).toHaveBeenCalledTimes(1);
  expect(bindToTile).toHaveBeenCalledTimes(1);
  expect(tile).toMatchObject({
    value: 4,
    special: null,
    isWild: false,
    isWildFace: false,
    visible: true,
    alpha: 1,
    eventMode: 'static',
    interactive: true,
    interactiveChildren: false,
    hitArea: { width: 128, height: 128 },
  });
  expect(tile._ccSpecialDiceVariant).toBeUndefined();
  expect(tile._ccSpecialDiceResolving).toBeUndefined();
  expect(tile._wildMagnetPulledTilesMerge).toBeUndefined();
  expect(tile._ccSpaceshipSpriteIdle).toBeUndefined();
  expect(tile._ccSpaceshipEngineIdleContainer).toBeUndefined();
  expect(tile.rotG).toMatchObject({
    eventMode: 'none',
    interactive: false,
    interactiveChildren: false,
    cursor: 'default',
    hitArea: null,
  });
  expect(receipt.committed && receipt.isVisualTailSettled()).toBe(false);

  tile.scale.x = 0.6;
  tile.rotG.rotation = 0.3;
  interruptBounce?.();
  expect(receipt.committed && receipt.isVisualTailSettled()).toBe(true);
  expect(tile.scale).toMatchObject({ x: 1, y: 1 });
  expect(tile.rotG.rotation).toBe(0);
  expect(tile.eventMode).toBe('static');
  expect(tile.rotG.eventMode).toBe('none');
  expect(bindToTile).toHaveBeenCalledTimes(1);
  completeBounce?.();
  expect(bindToTile).toHaveBeenCalledTimes(1);
});

test('removes the exact destination and returns a failed receipt when canonical commit fails', () => {
  const { tile } = spaceshipTile();
  const grid = Array.from({ length: 4 }, () => Array(4).fill(null));
  grid[tile.gridY][tile.gridX] = tile;
  const removeOnFailure = jest.fn((target: any) => {
    grid[target.gridY][target.gridX] = null;
    target.destroyed = true;
  });

  const receipt = commitMagnetSurvivor({
    tile,
    value: 2,
    grid,
    board: {},
    tileSize: 128,
    gap: 12,
    commitMutation: () => true,
    stopSpecialIdle: (target) => { delete target._ccSpaceshipSpriteIdle; },
    resetToNormal: resetTileToNormalState,
    collapseStack: jest.fn(),
    setValueImmediate: () => { throw new Error('paint failed'); },
    syncZIndex: jest.fn(),
    bindToTile: jest.fn(),
    removeOnFailure,
  });

  expect(receipt).toMatchObject({ committed: false, reason: 'commit-failed', tile });
  expect(removeOnFailure).toHaveBeenCalledTimes(1);
  expect(grid[1][2]).toBeNull();
  expect(tile.destroyed).toBe(true);
});


test('real Magnet survivor conversion releases the immutable consumed-die receipt', () => {
  const { tile } = spaceshipTile();
  const owner = new SpecialDiceTransactionOwner();
  const token = owner.claim('magnet')!;
  owner.attachMergeReceipt(token, createSpecialMergeTransactionReceipt({
    token, kind: 'magnet', runGeneration: 1, acceptedBoardRevision: 0,
    sourceDieId: 'consumed-source', destinationDieId: tile._ccGameplayDieId,
    sourceCell: { c: 1, r: 1 }, destinationCell: { c: 2, r: 1 },
    destinationDisposition: 'consume-after-continuation', expectedPrimarySpawnCount: 0,
    finalMerge: false,
  }));
  const grid = [[], [null, null, tile]];
  expect(owner.releaseAfterPostconditionAudit(token, [{ id: tile._ccGameplayDieId, value: 6 }],
    { committedCount: 0, committedCells: [], requireSettled: true }).released).toBe(false);
  const result = commitMagnetSurvivor({
    tile, value: 3, grid, board: {}, tileSize: 128, gap: 12,
    stopSpecialIdle: () => {}, resetToNormal: resetTileToNormalState,
    collapseStack: () => {}, setValueImmediate: (target, value) => { target.value = value; },
    syncZIndex: () => {}, bindToTile: () => {}, removeOnFailure: jest.fn(),
  });
  expect(result.committed).toBe(true);
  const release = owner.releaseAfterPostconditionAudit(token,
    [{ id: tile._ccGameplayDieId, value: tile.value }],
    { committedCount: 0, committedCells: [], requireSettled: true });
  expect(release).toMatchObject({ released: true, audit: { ok: true, issues: [] } });
  expect(owner.isActive()).toBe(false);
});
