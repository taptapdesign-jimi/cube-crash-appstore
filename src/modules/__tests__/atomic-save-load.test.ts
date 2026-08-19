import {
  BoardSnapshotIntegrityError,
  buildGridSnapshot,
} from '../app-core-save-tiles.ts';
import {
  GAME_SAVE_SCHEMA_VERSION,
  GameSaveValidationError,
  stampCurrentGameSaveSchema,
  validateAndNormalizeGameSave,
} from '../app-core-save-schema.ts';
import { restoreTilesFromSave } from '../app-core-load-tiles.ts';

function regularTile(overrides: Record<string, any> = {}) {
  return {
    value: 2,
    special: null,
    locked: false,
    open: true,
    isWild: false,
    isWildFace: false,
    gridX: 0,
    gridY: 0,
    visible: true,
    alpha: 1,
    eventMode: 'static',
    ...overrides,
  };
}

function emptyGrid(rows = 1, cols = 1): any[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

describe('atomic gameplay save snapshots', () => {
  test('serializes only the exact authoritative grid identity owner', () => {
    const owner = regularTile();
    const { gridSnapshot, savedTilesCount } = buildGridSnapshot({
      ROWS: 1,
      COLS: 1,
      tiles: [owner],
      grid: [[owner]],
      devLog: jest.fn(),
      devWarn: jest.fn(),
    });

    expect(savedTilesCount).toBe(1);
    expect(gridSnapshot).toEqual([[
      expect.objectContaining({ value: 2, gridX: 0, gridY: 0 }),
    ]]);
  });

  test.each([
    ['orphan duplicate', (owner: any) => ({ tiles: [owner, regularTile()], grid: [[owner]] })],
    ['pending removal', (owner: any) => ({ tiles: [owner], grid: [[Object.assign(owner, { _pendingRemoval: true })]] })],
    ['active spawn tween', (owner: any) => ({ tiles: [owner], grid: [[Object.assign(owner, { _spawnTween: { isActive: () => true } })]] })],
    ['passive playable tile', (owner: any) => ({ tiles: [owner], grid: [[Object.assign(owner, { eventMode: 'passive' })]] })],
  ])('rejects %s instead of overwriting or persisting it', (_label, arrange) => {
    const owner = regularTile();
    const state = arrange(owner);
    expect(() => buildGridSnapshot({
      ROWS: 1,
      COLS: 1,
      tiles: state.tiles,
      grid: state.grid,
      devLog: jest.fn(),
      devWarn: jest.fn(),
    })).toThrow(BoardSnapshotIntegrityError);
  });
});

describe('saved-game schema validation', () => {
  test('stamps newly written saves with the current schema version', () => {
    expect(stampCurrentGameSaveSchema({ grid: [[]] })).toEqual({
      grid: [[]],
      schemaVersion: GAME_SAVE_SCHEMA_VERSION,
    });
  });

  test('migrates a valid unversioned save into the current schema', () => {
    const result = validateAndNormalizeGameSave({
      grid: [[regularTile()]],
      timestamp: Date.now(),
    }, { rows: 1, cols: 1 });

    expect(result.ok).toBe(true);
    if ('issues' in result) throw new Error('expected valid save');
    expect(result.migratedLegacy).toBe(true);
    expect(result.gameState.schemaVersion).toBe(GAME_SAVE_SCHEMA_VERSION);
  });

  test.each([
    ['unsupported version', { schemaVersion: 999, grid: [[regularTile()]] }],
    ['coordinate mismatch', { grid: [[regularTile({ gridX: 2 })]] }],
    ['plain transient six', { grid: [[regularTile({ value: 6 })]] }],
    ['variant mismatch', { grid: [[regularTile({ value: 6, special: 'wild-juice', isWild: true, isWildFace: true, specialDiceVariant: 'bottle' })]] }],
    ['negative board number', { boardNumber: -1, grid: [[regularTile()]] }],
    ['negative moves', { moves: -1, grid: [[regularTile()]] }],
    ['overflowing wild meter', { wildMeter: 100, grid: [[regularTile()]] }],
    ['negative score', { score: -10, grid: [[regularTile()]] }],
    ['board and level mismatch', { boardNumber: 2, level: 1, grid: [[regularTile()]] }],
  ])('rejects %s', (_label, save) => {
    const result = validateAndNormalizeGameSave(save, { rows: 1, cols: 1 });
    expect(result.ok).toBe(false);
  });

  test('rejects duplicate coordinates in a legacy tile-array save', () => {
    const result = validateAndNormalizeGameSave({
      grid: [],
      tiles: [regularTile(), regularTile()],
    }, { rows: 1, cols: 1 });
    expect(result.ok).toBe(false);
    if (!('issues' in result)) throw new Error('expected invalid save');
    expect(result.issues.some((entry) => entry.code === 'duplicate-cell')).toBe(true);
  });
});

describe('atomic restore boundary', () => {
  test('validates before removing any live tile', () => {
    const liveTile: any = regularTile({
      destroy: jest.fn(),
      removeAllListeners: jest.fn(),
      scale: { x: 1, y: 1 },
    });
    const liveTiles = [liveTile];
    const liveGrid = [[liveTile]];
    const invalidSave = {
      grid: [[regularTile({ gridX: 8 })]],
    };

    expect(() => restoreTilesFromSave({
      gameState: invalidSave,
      tiles: liveTiles,
      grid: liveGrid,
      ROWS: 1,
      COLS: 1,
      board: { removeChild: jest.fn() },
      makeBoard: {
        createTile: jest.fn(),
        setValue: jest.fn(),
      },
      createEmptyGrid: () => emptyGrid(),
      applyWildSkinLocal: jest.fn(),
      startWildShimmer: jest.fn(),
      stopWildShimmer: jest.fn(),
      startMagnetIdleParticles: jest.fn(),
      stopMagnetIdleParticles: jest.fn(),
      trackAppTimeout: jest.fn(),
      STATE: {},
      devLog: jest.fn(),
      devWarn: jest.fn(),
      devError: jest.fn(),
      setWildJuiceSpawned: jest.fn(),
    })).toThrow(GameSaveValidationError);

    expect(liveTiles).toEqual([liveTile]);
    expect(liveGrid[0][0]).toBe(liveTile);
    expect(liveTile.destroy).not.toHaveBeenCalled();
  });
});
