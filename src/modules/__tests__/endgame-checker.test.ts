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

test('two wild stars only: wild+wild blocked, fail screen when no merges', () => {
  const tiles = [
    makeTile({ value: 1, special: 'wild' }),
    makeTile({ value: 1, special: 'wild' }),
  ];
  const context = makeContext(tiles, 10, false);
  const result = checkEndGame(context, true);
  expect(result.type).toBe('stuck');
  expect(result.reason).toBe('no_merges_possible');
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

test('tileIsActive allows locked wild tiles', () => {
  const wildLocked = makeTile({ value: 0, locked: true, special: 'wild' });
  expect(tileIsActive(wildLocked)).toBe(true);
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
