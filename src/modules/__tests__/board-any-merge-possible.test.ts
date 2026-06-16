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
