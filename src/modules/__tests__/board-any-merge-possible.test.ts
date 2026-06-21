import { anyMergePossible } from '../board';

const makeTile = (value: number, overrides: Partial<any> = {}) => ({
  value,
  special: null,
  locked: false,
  destroyed: false,
  visible: true,
  ...overrides,
});

test.each([
  [[5, 5, 2, 5, 5]],
  [[5, 5, 5, 5, 4, 3, 4]],
  [[4, 4, 5]],
  [[5, 5, 5, 5]],
  [[4, 5, 4, 5, 5, 4]],
  [[3]],
])('no-moves board %p is not treated as playable', (values) => {
  const tiles = values.map((value) => makeTile(value));

  expect(anyMergePossible(tiles as any)).toBe(false);
});

test.each([
  [[1, 1]],
  [[2, 2]],
  [[3, 3]],
  [[1, 5]],
  [[2, 4]],
  [[6, 5]],
])('playable board %p is treated as playable', (values) => {
  const tiles = values.map((value) => makeTile(value));

  expect(anyMergePossible(tiles as any)).toBe(true);
});

test('merge 6 continuation still counts as playable', () => {
  const tiles = [makeTile(6), makeTile(2), makeTile(5)];

  expect(anyMergePossible(tiles as any)).toBe(true);
});

test('future wild-prefixed special dice keep board playable', () => {
  const tiles = [
    makeTile(5),
    makeTile(0, { special: 'wild-feather', locked: true }),
  ];

  expect(anyMergePossible(tiles as any)).toBe(true);
});

test('visible locked non-interactive special dice keep board playable', () => {
  const tiles = [
    makeTile(5),
    makeTile(0, {
      special: 'wild-tnt',
      locked: true,
      eventMode: 'none',
      alpha: 1,
    }),
  ];

  expect(anyMergePossible(tiles as any)).toBe(true);
});

test('future magnet-archetype special dice keep board playable', () => {
  const tiles = [
    makeTile(5),
    makeTile(0, {
      special: 'wild-magnet',
      _ccSpecialDiceArchetype: 'wild-magnet',
      locked: true,
    }),
  ];

  expect(anyMergePossible(tiles as any)).toBe(true);
});

test('stale wild pulled by magnet does not keep a 4+3 board playable', () => {
  const tiles = [
    makeTile(4),
    makeTile(3),
    makeTile(0, {
      special: 'wild',
      locked: true,
      eventMode: 'none',
      _wildMagnetAffected: true,
    }),
  ];

  expect(anyMergePossible(tiles as any)).toBe(false);
});

test('visible non-interactive wild residue does not keep a no-moves board playable', () => {
  const tiles = [
    makeTile(5),
    makeTile(5),
    makeTile(4),
    makeTile(0, {
      special: 'wild-juice',
      visible: true,
      alpha: 1,
      eventMode: 'none',
      _isBeingSpawned: false,
    }),
  ];

  expect(anyMergePossible(tiles as any)).toBe(false);
});
