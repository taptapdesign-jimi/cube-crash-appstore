import { shouldShowStackItHintForTiles } from '../endgame-hint-eligibility';

const makeTile = (overrides: Partial<any> = {}) => ({
  value: 1,
  special: null,
  locked: false,
  destroyed: false,
  visible: true,
  eventMode: 'static',
  ...overrides,
});

test('shows STACK IT for any stackable active board, including more than three tiles', () => {
  const tiles = [
    makeTile({ value: 4 }),
    makeTile({ value: 4 }),
    makeTile({ value: 4 }),
    makeTile({ value: 1 }),
    makeTile({ value: 4 }),
  ];

  expect(shouldShowStackItHintForTiles(tiles, () => true)).toBe(true);
});

test('does not show STACK IT when fewer than two active tiles exist', () => {
  expect(shouldShowStackItHintForTiles([makeTile({ value: 4 })], () => true)).toBe(false);
});

test('does not show STACK IT when no stack or merge is possible', () => {
  const tiles = [makeTile({ value: 4 }), makeTile({ value: 4 })];
  expect(shouldShowStackItHintForTiles(tiles, () => false)).toBe(false);
});

test('keeps wild-star boards quiet because special dice already have their own guidance', () => {
  const tiles = [
    makeTile({ value: 4 }),
    makeTile({ value: 0, special: 'wild' }),
  ];

  expect(shouldShowStackItHintForTiles(tiles, () => true)).toBe(false);
});

test('treats missing or failing merge detector as not eligible', () => {
  const tiles = [makeTile({ value: 2 }), makeTile({ value: 3 })];

  expect(shouldShowStackItHintForTiles(tiles)).toBe(false);
  expect(shouldShowStackItHintForTiles(tiles, () => { throw new Error('bad board state'); })).toBe(false);
});
