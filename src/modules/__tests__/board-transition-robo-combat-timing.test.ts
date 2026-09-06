import {
  ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS,
  ROBO_AREA55_EXIT_ADVANCE_SECONDS,
  resolveRoboAirCombatHoldSeconds,
} from '../board-transition-robo-combat-timing';

describe('Robo board-transition combat timing', () => {
  test.each([
    { digitCompletion: 2.05, label: 'one digit' },
    { digitCompletion: 2.35, label: 'two digits' },
  ])('starts the complete Area55 exit 400ms before the extended flight boundary for $label', ({ digitCompletion }) => {
    const combatEnd = 4.40;
    const hold = resolveRoboAirCombatHoldSeconds({
      minimumHoldSeconds: 0,
      combatDurationSeconds: combatEnd,
      combatElapsedSeconds: digitCompletion,
    });

    expect(digitCompletion + hold).toBeCloseTo(
      combatEnd
        + ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS
        - ROBO_AREA55_EXIT_ADVANCE_SECONDS,
      10,
    );
  });

  test('keeps the late Beam 4 complete before Area55 parallax takes combat ownership', () => {
    const exitStart = 4.40
      + ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS
      - ROBO_AREA55_EXIT_ADVANCE_SECONDS;
    const combatOwnershipHandoff = exitStart + 0.35;
    const beamFourEnd = 2.12 + 0.80;

    expect(exitStart).toBeCloseTo(4.08, 10);
    expect(combatOwnershipHandoff).toBeGreaterThan(beamFourEnd);
  });

  test('preserves the authored minimum hold after combat already completed', () => {
    expect(resolveRoboAirCombatHoldSeconds({
      minimumHoldSeconds: 1.95,
      combatDurationSeconds: 4,
      combatElapsedSeconds: 4.2,
    })).toBe(1.95);
  });
});
