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

test('future wild-prefixed special dice count as active and do not look like last merge alone', () => {
  expect(hasLastMergeTile({
    tiles: [
      makeTile({ value: 6, _isLastMerge: true }),
      makeTile({ value: 0, special: 'wild-hurricane' }),
    ],
    devLog,
  })).toBe(false);
});

test('clears stale last-merge flag when multiple active tiles remain', () => {
  const merge6 = makeTile({ value: 6, _isLastMerge: true });

  expect(hasLastMergeTile({
    tiles: [
      merge6,
      makeTile({ value: 0, special: 'wild-hurricane' }),
    ],
    devLog,
  })).toBe(false);
  expect((merge6 as any)._isLastMerge).toBe(false);
});
