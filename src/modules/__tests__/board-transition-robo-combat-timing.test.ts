import {
  ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS,
  resolveRoboAirCombatHoldSeconds,
} from '../board-transition-robo-combat-timing';

describe('Robo board-transition combat timing', () => {
  test.each([
    { digitCompletion: 2.05, label: 'one digit' },
    { digitCompletion: 2.35, label: 'two digits' },
  ])('releases $label transition immediately after the gentle ship exit', ({ digitCompletion }) => {
    const combatEnd = 3.00;
    const hold = resolveRoboAirCombatHoldSeconds({
      minimumHoldSeconds: 0,
      combatDurationSeconds: combatEnd,
      combatElapsedSeconds: digitCompletion,
    });

    expect(digitCompletion + hold).toBeCloseTo(
      combatEnd + ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS,
      10,
    );
  });

  test('preserves the authored minimum hold after combat already completed', () => {
    expect(resolveRoboAirCombatHoldSeconds({
      minimumHoldSeconds: 1.95,
      combatDurationSeconds: 4,
      combatElapsedSeconds: 4.2,
    })).toBe(1.95);
  });
});
