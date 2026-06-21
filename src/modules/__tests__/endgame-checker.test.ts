import { checkEndGame, clearEndgameCheckerCache, getActiveTiles, tileIsActive, type EndGameContext } from '../endgame-checker';

const makeTile = (overrides: Partial<any> = {}) => ({
  value: 0,
  special: null,
  locked: false,
  destroyed: false,
  visible: true,
  eventMode: 'static',
  ...overrides,
});

const makeContext = (tiles: any[], moves: number, anyMergePossible = false): EndGameContext => ({
  tiles,
  moves,
  makeBoard: {
    anyMergePossible: () => anyMergePossible,
  },
});

beforeEach(() => {
  clearEndgameCheckerCache();
});

test('clean board returns clean', () => {
  const context = makeContext([], 10, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('clean');
  expect(result.reason).toBe('clean_board');
});

test('magnet + merge6 allows continue', () => {
  const tiles = [
    makeTile({ value: 6 }),
    makeTile({ value: 1, special: 'wild-magnet' }),
  ];
  const context = makeContext(tiles, 10, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('continue');
  expect(result.reason).toBe('merges_possible');
});

test('moves depleted and stuck returns stuck', () => {
  const tiles = [
    makeTile({ value: 2 }),
    makeTile({ value: 4 }),
  ];
  const context = makeContext(tiles, 0, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('no_merges_possible');
});

test('moves depleted but merge possible returns continue', () => {
  const tiles = [
    makeTile({ value: 2 }),
    makeTile({ value: 2 }),
  ];
  const context = makeContext(tiles, 0, true);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('continue');
  expect(result.reason).toBe('merges_possible');
});

test('wild + merge6 allows continue', () => {
  const tiles = [
    makeTile({ value: 6 }),
    makeTile({ value: 1, special: 'wild' }),
  ];
  const context = makeContext(tiles, 10, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('continue');
  expect(result.reason).toBe('merges_possible');
});

test('last merge scenario returns clean', () => {
  const dstTile = makeTile({ value: 6 });
  const srcTile = makeTile({ value: 3 });
  const context: EndGameContext = {
    tiles: [dstTile],
    moves: 10,
    makeBoard: { anyMergePossible: () => false },
    dstTile,
    srcTile,
    justRemovedSrc: true,
  };
  const result = checkEndGame(context, true);
  expect(result.type).toBe('clean');
  expect(result.reason).toBe('last_merge');
});

test('final regular 4+2 merge stays clean even when moves are depleted', () => {
  const dstTile = makeTile({ value: 6 });
  const srcTile = makeTile({ value: 4 });
  const context: EndGameContext = {
    tiles: [dstTile],
    moves: 0,
    makeBoard: { anyMergePossible: () => false },
    dstTile,
    srcTile,
    justRemovedSrc: true,
  };
  const result = checkEndGame(context, true);
  expect(result).toEqual({ type: 'clean', reason: 'last_merge' });
});

test('single spawned value after a missed final merge is stuck, not clean', () => {
  const tiles = [makeTile({ value: 5, stackDepth: 1 })];
  const context = makeContext(tiles, 0, false);
  const result = checkEndGame(context, true);
  expect(result).toEqual({ type: 'stuck', reason: 'single_non_6_tile' });
});

test('tileIsActive allows locked wild tiles', () => {
  const wildLocked = makeTile({ value: 0, locked: true, special: 'wild' });
  expect(tileIsActive(wildLocked)).toBe(true);
});

test('tileIsActive allows future wild-prefixed special dice', () => {
  const wildLocked = makeTile({ value: 0, locked: true, special: 'wild-hurricane' });
  expect(tileIsActive(wildLocked)).toBe(true);
});

test('visible locked non-interactive wilds block false clean-board after merge 6', () => {
  const dstTile = makeTile({ value: 6, gridX: 3, gridY: 7 });
  const tntA = makeTile({
    value: 6,
    special: 'wild-tnt',
    locked: true,
    eventMode: 'none',
    alpha: 1,
    gridX: 2,
    gridY: 7,
  });
  const tntB = makeTile({
    value: 6,
    special: 'wild-tnt',
    locked: true,
    eventMode: 'none',
    alpha: 1,
    gridX: 4,
    gridY: 7,
  });
  const context: EndGameContext = {
    tiles: [dstTile, tntA, tntB],
    moves: 8,
    makeBoard: { anyMergePossible: () => false },
    srcTile: makeTile({ value: 2, gridX: 2, gridY: 7 }),
    dstTile,
    justRemovedSrc: true,
  };

  expect(tileIsActive(tntA)).toBe(true);
  expect(checkEndGame(context, true)).toEqual({ type: 'continue', reason: 'merges_possible' });
});

test('getActiveTiles ignores destroyed and invisible tiles', () => {
  const tiles = [
    makeTile({ value: 2 }),
    makeTile({ value: 3, destroyed: true }),
    makeTile({ value: 4, visible: false }),
  ];
  const active = getActiveTiles(tiles);
  expect(active.length).toBe(1);
  expect(active[0].value).toBe(2);
});

test('non-mergeable non-stackable board returns stuck', () => {
  const tiles = [
    makeTile({ value: 1, stackDepth: 1 }),
    makeTile({ value: 4, stackDepth: 1 }),
    makeTile({ value: 5, stackDepth: 1 }),
  ];
  const context = makeContext(tiles, 5, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('no_merges_possible');
});

test('single non-6 tile returns single_non_6_tile stuck reason', () => {
  const tiles = [makeTile({ value: 2, stackDepth: 1 })];
  const context = makeContext(tiles, 4, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('single_non_6_tile');
});

test('single non-6 tile with transient low alpha is still stuck (never clean/stage-end)', () => {
  // Regression: after stacking 3+1 -> 4, settle animation can briefly reduce alpha.
  // This must NEVER be interpreted as clean board.
  const tiles = [makeTile({ value: 4, stackDepth: 1, alpha: 0.01, visible: true })];
  const context = makeContext(tiles, 4, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('single_non_6_tile');
});

test('single stack 3x2 is stuck (self-merge dead end into 6x1)', () => {
  const tiles = [makeTile({ value: 3, stackDepth: 2 })];
  const context = makeContext(tiles, 3, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('single_non_6_tile');
});

test('single stack 2x3 can continue (self-merge chain available)', () => {
  const tiles = [makeTile({ value: 2, stackDepth: 3 })];
  const context = makeContext(tiles, 3, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('continue');
  expect(result.reason).toBe('merges_possible');
});

test('stale _isBeingSpawned on interactive regular tiles does not block stuck detection', () => {
  const tiles = [
    makeTile({ value: 5, _isBeingSpawned: true, eventMode: 'static', locked: false }),
    makeTile({ value: 4, _isBeingSpawned: false, eventMode: 'static', locked: false }),
    makeTile({ value: 5, _isBeingSpawned: false, eventMode: 'static', locked: false }),
    makeTile({ value: 3, _isBeingSpawned: true, eventMode: 'static', locked: false }),
  ];
  const context = makeContext(tiles, 8, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('no_merges_possible');
});

test('stale _isBeingSpawned with non-none interactive eventMode still resolves to stuck', () => {
  const tiles = [
    makeTile({ value: 5, _isBeingSpawned: true, eventMode: 'auto', locked: false }),
    makeTile({ value: 4, _isBeingSpawned: false, eventMode: 'auto', locked: false }),
    makeTile({ value: 5, _isBeingSpawned: false, eventMode: 'auto', locked: false }),
    makeTile({ value: 3, _isBeingSpawned: true, eventMode: 'auto', locked: false }),
  ];
  const context = makeContext(tiles, 8, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('no_merges_possible');
});

test('arcade-style no-moves board with stacks returns stuck, not continue', () => {
  const tiles = [
    makeTile({ value: 5, stackDepth: 2, gridX: 0, gridY: 0 }),
    makeTile({ value: 4, stackDepth: 1, gridX: 1, gridY: 1 }),
    makeTile({ value: 4, stackDepth: 2, gridX: 2, gridY: 2 }),
    makeTile({ value: 4, stackDepth: 1, gridX: 3, gridY: 3 }),
    makeTile({ value: 5, stackDepth: 2, gridX: 4, gridY: 4 }),
    makeTile({ value: 5, stackDepth: 1, gridX: 0, gridY: 5 }),
    makeTile({ value: 5, stackDepth: 3, gridX: 1, gridY: 6 }),
    makeTile({ value: 2, stackDepth: 2, gridX: 2, gridY: 7 }),
  ];
  const context = makeContext(tiles, 12, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('no_merges_possible');
});

test('repeated stuck checks stay stuck for unchanged board state', () => {
  const tiles = [
    makeTile({ value: 5, stackDepth: 2, gridX: 0, gridY: 0 }),
    makeTile({ value: 4, stackDepth: 1, gridX: 1, gridY: 1 }),
    makeTile({ value: 4, stackDepth: 2, gridX: 2, gridY: 2 }),
    makeTile({ value: 5, stackDepth: 1, gridX: 3, gridY: 3 }),
  ];
  const context = makeContext(tiles, 9, false);
  const first = checkEndGame(context, true);
  const second = checkEndGame(context, false);
  const third = checkEndGame(context, true);

  expect(first).toEqual({ type: 'stuck', reason: 'no_merges_possible' });
  expect(second).toEqual({ type: 'stuck', reason: 'no_merges_possible' });
  expect(third).toEqual({ type: 'stuck', reason: 'no_merges_possible' });
});

test('stuck board becomes continue immediately when a valid move appears', () => {
  const tiles = [
    makeTile({ value: 5, stackDepth: 1, gridX: 0, gridY: 0 }),
    makeTile({ value: 4, stackDepth: 1, gridX: 1, gridY: 1 }),
  ];
  const context = makeContext(tiles, 9, false);
  expect(checkEndGame(context, true)).toEqual({ type: 'stuck', reason: 'no_merges_possible' });

  tiles.push(makeTile({ value: 4, stackDepth: 1, gridX: 2, gridY: 2 }));
  const recoveredContext = makeContext(tiles, 9, true);
  expect(checkEndGame(recoveredContext, true)).toEqual({ type: 'continue', reason: 'merges_possible' });
});

test('magnet respawn no-moves state with locked placeholders returns stuck', () => {
  const tiles = [
    makeTile({ value: 3, locked: false, gridX: 1, gridY: 1 }),
    makeTile({ value: 4, locked: false, gridX: 3, gridY: 2 }),
    makeTile({ value: 1, locked: true, gridX: 0, gridY: 0 }),
    makeTile({ value: 5, locked: true, gridX: 2, gridY: 0 }),
    makeTile({ value: 2, locked: true, gridX: 4, gridY: 1 }),
    makeTile({ value: 4, locked: true, gridX: 0, gridY: 3 }),
    makeTile({ value: 3, locked: true, gridX: 2, gridY: 4 }),
    makeTile({ value: 5, locked: true, gridX: 4, gridY: 5 }),
  ];
  const context: EndGameContext = {
    tiles,
    moves: 8,
    makeBoard: {
      anyMergePossible: (allTiles: any[]) => {
        const open = allTiles.filter((t) => t && !t.destroyed && !t.locked && t.visible !== false && (t.value | 0) > 0);
        return open.some((a, i) => open.some((b, j) => i < j && (a.value | 0) + (b.value | 0) <= 6));
      },
    },
  };

  expect(checkEndGame(context, true)).toEqual({ type: 'stuck', reason: 'no_merges_possible' });
});

test('magnet-pulled wild residue does not block no-moves after respawned 4 and 3', () => {
  const tiles = [
    makeTile({ value: 4, locked: false, gridX: 1, gridY: 1 }),
    makeTile({ value: 3, locked: false, gridX: 3, gridY: 2 }),
    makeTile({
      value: 0,
      special: 'wild',
      locked: true,
      eventMode: 'none',
      gridX: 2,
      gridY: 2,
      _wildMagnetAffected: true,
    }),
  ];
  const context: EndGameContext = {
    tiles,
    moves: 8,
    makeBoard: {
      anyMergePossible: (allTiles: any[]) => {
        const open = allTiles.filter((t) => {
          if (!t || t.destroyed || t.visible === false) return false;
          if (t._wildMagnetAffected === true || t.eventMode === 'none') return false;
          if (t.special && String(t.special).startsWith('wild')) return true;
          return !t.locked && (t.value | 0) > 0;
        });
        return open.some((a, i) => open.some((b, j) => {
          if (i >= j) return false;
          const av = a.value | 0;
          const bv = b.value | 0;
          return av > 0 && bv > 0 && av + bv <= 6;
        }));
      },
    },
  };

  expect(checkEndGame(context, true)).toEqual({ type: 'stuck', reason: 'no_merges_possible' });
});

test('reported no-moves board (4,5,4,3,4,4,4,4 with stacks) returns stuck', () => {
  const tiles = [
    makeTile({ value: 4, stackDepth: 2, gridX: 0, gridY: 0 }),
    makeTile({ value: 5, stackDepth: 1, gridX: 1, gridY: 0 }),
    makeTile({ value: 4, stackDepth: 3, gridX: 2, gridY: 0 }),
    makeTile({ value: 3, stackDepth: 1, gridX: 3, gridY: 0 }),
    makeTile({ value: 4, stackDepth: 2, gridX: 4, gridY: 0 }),
    makeTile({ value: 4, stackDepth: 1, gridX: 0, gridY: 1 }),
    makeTile({ value: 4, stackDepth: 2, gridX: 1, gridY: 1 }),
    makeTile({ value: 4, stackDepth: 1, gridX: 2, gridY: 1 }),
  ];
  const context = makeContext(tiles, 14, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('no_merges_possible');
});
