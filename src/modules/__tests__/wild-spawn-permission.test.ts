import { resolveWildSpawnPermission } from '../wild-spawn-permission';

const makeTile = (overrides: Partial<any> = {}) => ({
  value: 0,
  special: null,
  destroyed: false,
  visible: true,
  alpha: 1,
  eventMode: 'static',
  ...overrides,
});

test('allows wild spawn when meter is ready and no blockers exist', () => {
  expect(resolveWildSpawnPermission({
    tiles: [makeTile({ value: 2 }), makeTile({ value: 5 })],
    wildMeter: 1,
  })).toEqual({ action: 'allow', reason: 'ready' });
});

test('blocks wild spawn during final merge flag', () => {
  expect(resolveWildSpawnPermission({
    tiles: [makeTile({ value: 6, _isLastMerge: true })],
    wildMeter: 1,
  })).toEqual({ action: 'block', reason: 'last-merge' });
});

test('blocks wild spawn when fail screen is pending', () => {
  expect(resolveWildSpawnPermission({
    tiles: [makeTile({ value: 2 }), makeTile({ value: 5 })],
    wildMeter: 1,
    failScreenPending: true,
  })).toEqual({ action: 'block', reason: 'fail-screen-pending' });
});

test('requests retry while animation guard is active', () => {
  expect(resolveWildSpawnPermission({
    tiles: [makeTile({ value: 2 }), makeTile({ value: 5 })],
    wildMeter: 1,
    activeAnimationBlockReason: 'merge6-spawn-in-progress',
  })).toEqual({
    action: 'retry',
    reason: 'merge6-spawn-in-progress',
    retryDelayMs: 520,
  });
});

test('visible disabled wild is still active, so spawn can be evaluated normally', () => {
  expect(resolveWildSpawnPermission({
    tiles: [
      makeTile({ value: 5 }),
      makeTile({ value: 0, special: 'wild-juice', _ccWildSpawnDropping: true, eventMode: 'none' }),
    ],
    wildMeter: 1,
  })).toEqual({ action: 'allow', reason: 'ready' });
});
