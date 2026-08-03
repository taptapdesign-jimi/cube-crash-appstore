import { resolveWildMeterProgressDecision } from '../wild-meter-progress-decision';

describe('wild meter progress decision', () => {
  test('keeps the last-merge reset when no earlier resolver proved continuation', () => {
    expect(resolveWildMeterProgressDecision({
      permission: { action: 'block', reason: 'last-merge' },
      confirmedNonFinal: false,
    })).toEqual({ action: 'reset', reason: 'last-merge' });
  });

  test('credits progress when an immutable merge snapshot already proved non-final', () => {
    expect(resolveWildMeterProgressDecision({
      permission: { action: 'block', reason: 'last-merge' },
      confirmedNonFinal: true,
    })).toEqual({ action: 'add', reason: 'confirmed-non-final-merge' });
  });

  test('does not bypass unrelated meter blockers', () => {
    expect(resolveWildMeterProgressDecision({
      permission: { action: 'block', reason: 'busyEnding' },
      confirmedNonFinal: true,
    })).toEqual({ action: 'skip', reason: 'busyEnding' });
  });

  test('preserves legacy fill when only spawning is disabled', () => {
    expect(resolveWildMeterProgressDecision({
      permission: { action: 'block', reason: 'wild-spawn-disabled' },
      confirmedNonFinal: false,
    })).toEqual({ action: 'add', reason: 'wild-spawn-disabled' });
  });
});
