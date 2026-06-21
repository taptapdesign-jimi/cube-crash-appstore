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

test('pending-removal residue does not keep preload alive after final merge', () => {
  expect(hasLastMergeTile({
    tiles: [
      makeTile({ value: 6 }),
      makeTile({ value: 2, _pendingRemoval: true }),
    ],
    devLog,
  })).toBe(true);
});

test('visible locked special dice prevents false last-merge preload block', () => {
  expect(hasLastMergeTile({
    tiles: [
      makeTile({ value: 6 }),
      makeTile({
        value: 0,
        special: 'wild-tnt',
        locked: true,
        eventMode: 'none',
        alpha: 1,
      }),
    ],
    devLog,
  })).toBe(false);
});
