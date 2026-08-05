import {
  isWildContinuationPending,
  isWildMeterReady,
  resolveStuckWildDeferralDecision,
  resolveWildSpawnGuardReleaseContinuation,
  shouldScheduleWildSpawnRetry,
} from '../wild-spawn-continuation';

test('treats floating-point full meter as ready without widening gameplay balance', () => {
  expect(isWildMeterReady(0.9999999999999999)).toBe(true);
  expect(isWildMeterReady(0.999)).toBe(false);
});

test('queues wild continuation after guard release when meter is ready', () => {
  expect(resolveWildSpawnGuardReleaseContinuation({
    wildMeter: 1,
  })).toEqual({ action: 'queue', reason: 'ready' });
});

test('skips wild continuation after guard release when meter is not ready', () => {
  expect(resolveWildSpawnGuardReleaseContinuation({
    wildMeter: 0.99,
  })).toEqual({ action: 'skip', reason: 'wild-meter-not-ready' });
});

test('skips wild continuation after guard release while ending flow is active', () => {
  expect(resolveWildSpawnGuardReleaseContinuation({
    wildMeter: 1,
    busyEnding: true,
  })).toEqual({ action: 'skip', reason: 'busy-ending' });
});

test('does not retry terminal wild spawn blockers', () => {
  expect(shouldScheduleWildSpawnRetry('busyEnding')).toBe(false);
  expect(shouldScheduleWildSpawnRetry('fail-screen-pending')).toBe(false);
  expect(shouldScheduleWildSpawnRetry('board-transition')).toBe(false);
});

test('retries transient wild spawn blockers', () => {
  expect(shouldScheduleWildSpawnRetry('merge6-spawn-in-progress')).toBe(true);
  expect(shouldScheduleWildSpawnRetry('regular-merge6-handoff')).toBe(true);
  expect(shouldScheduleWildSpawnRetry('wild-magnet-pull')).toBe(true);
});

test('detects pending wild continuation from meter, spawn, retry, or drop state', () => {
  expect(isWildContinuationPending({ wildMeter: 1 })).toBe(true);
  expect(isWildContinuationPending({ wildMeter: 0, wildSpawnInProgress: true })).toBe(true);
  expect(isWildContinuationPending({ wildMeter: 0, wildSpawnRetryPending: true })).toBe(true);
  expect(isWildContinuationPending({ wildMeter: 0, wildSpawnDropInProgress: true })).toBe(true);
  expect(isWildContinuationPending({ wildMeter: 0 })).toBe(false);
  expect(isWildContinuationPending({ wildMeter: 0.9999999999999999 })).toBe(true);
});

test('defers stuck fail while wild continuation is still within timeout', () => {
  expect(resolveStuckWildDeferralDecision({
    wildContinuationPending: true,
    startedAt: null,
    now: 1000,
    maxDeferralMs: 2200,
  })).toEqual({
    action: 'defer',
    reason: 'wild-continuation-pending',
    startedAt: 1000,
    deferMs: 0,
  });

  expect(resolveStuckWildDeferralDecision({
    wildContinuationPending: true,
    startedAt: 1000,
    now: 2500,
    maxDeferralMs: 2200,
  })).toEqual({
    action: 'defer',
    reason: 'wild-continuation-pending',
    startedAt: 1000,
    deferMs: 1500,
  });
});

test('forces stuck fail after wild continuation timeout', () => {
  expect(resolveStuckWildDeferralDecision({
    wildContinuationPending: true,
    startedAt: 1000,
    now: 3300,
    maxDeferralMs: 2200,
  })).toEqual({
    action: 'force-fail',
    reason: 'wild-continuation-timeout',
    startedAt: 1000,
    deferMs: 2300,
  });
});

test('continues fail immediately when no wild continuation is pending', () => {
  expect(resolveStuckWildDeferralDecision({
    wildContinuationPending: false,
    startedAt: 1000,
    now: 1500,
    maxDeferralMs: 2200,
  })).toEqual({
    action: 'continue-fail',
    reason: 'no-wild-continuation',
    startedAt: null,
    deferMs: 0,
  });
});
