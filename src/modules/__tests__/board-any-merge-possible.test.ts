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

test.each([
  ['TNT', { special: 'wild-tnt' }],
  ['magnet', { special: 'wild-magnet' }],
  ['future TNT archetype', { special: 'wild-tnt', _ccSpecialDiceArchetype: 'wild-tnt' }],
  ['future magnet archetype', { special: 'wild-magnet', _ccSpecialDiceArchetype: 'wild-magnet' }],
])('visible non-interactive gameplay-resolving %s dice still keep regular tiles playable', (_label, specialOverrides) => {
  const tiles = [
    makeTile(4),
    makeTile(5),
    makeTile(6, {
      ...specialOverrides,
      eventMode: 'none',
      alpha: 1,
    }),
    makeTile(6, {
      ...specialOverrides,
      eventMode: 'none',
      alpha: 1,
    }),
  ];

  expect(anyMergePossible(tiles as any)).toBe(true);
});

test.each([
  ['star', { special: 'wild' }],
  ['juice', { special: 'wild-juice' }],
])('visible non-interactive %s residue does not keep a no-moves board playable', (_label, specialOverrides) => {
  const tiles = [
    makeTile(5),
    makeTile(5),
    makeTile(4),
    makeTile(0, {
      ...specialOverrides,
      visible: true,
      alpha: 1,
      eventMode: 'none',
      _isBeingSpawned: false,
    }),
  ];

  expect(anyMergePossible(tiles as any)).toBe(false);
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
