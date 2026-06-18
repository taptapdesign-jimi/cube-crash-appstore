import { hasLastMergeTile } from '../app-core-wild-preload';

const devLog = jest.fn();

const makeTile = (overrides: Partial<any> = {}) => ({
  value: 0,
  special: null,
  destroyed: false,
  ...overrides,
});

beforeEach(() => {
  devLog.mockClear();
});

test('blocks preload when only one merge-6 tile remains', () => {
  expect(hasLastMergeTile({
    tiles: [makeTile({ value: 6 })],
    devLog,
  })).toBe(true);
});

test('final merge flag blocks preload even while another wild tile is still visible', () => {
  expect(hasLastMergeTile({
    tiles: [
      makeTile({ value: 6, _isLastMerge: true }),
      makeTile({ value: 0, special: 'wild-hurricane' }),
    ],
    devLog,
  })).toBe(true);
});

test('does not clear final merge flag when multiple active tiles are still visible during animation', () => {
  const merge6 = makeTile({ value: 6, _isLastMerge: true });

  expect(hasLastMergeTile({
    tiles: [
      merge6,
      makeTile({ value: 0, special: 'wild-hurricane' }),
    ],
    devLog,
  })).toBe(true);
  expect((merge6 as any)._isLastMerge).toBe(true);
});
