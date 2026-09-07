import {
  ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS,
  ROBO_AREA55_EXIT_ADVANCE_SECONDS,
  ROBO_AREA55_EXIT_SHORTEN_SECONDS,
  ROBO_FIGHTER_FINALE_MIN_DURATION_SECONDS,
  ROBO_FIGHTER_FINALE_SHORTEN_SECONDS,
  resolveRoboArea55ExitTimeScale,
  resolveRoboAirCombatHoldSeconds,
  resolveRoboFighterFinaleDuration,
} from '../board-transition-robo-combat-timing';

describe('Robo board-transition combat timing', () => {
  test('shortens only the saucer finale by 1.5 seconds while preserving a readable exit', () => {
    expect(resolveRoboFighterFinaleDuration(2.40)).toBeCloseTo(
      2.40 - ROBO_FIGHTER_FINALE_SHORTEN_SECONDS,
      10,
    );
    expect(resolveRoboFighterFinaleDuration(1.165)).toBe(
      ROBO_FIGHTER_FINALE_MIN_DURATION_SECONDS,
    );
  });

  test.each([
    { digitCompletion: 2.05, label: 'one digit' },
    { digitCompletion: 2.35, label: 'two digits' },
  ])('starts the complete Area55 exit 400ms before the Gameplay KING flight boundary for $label', ({ digitCompletion }) => {
    const combatEnd = 3.00;
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

  test('shortens the complete Area55 exit by exactly 500ms without cutting the late beam', () => {
    const exitStart = 3.00
      + ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS
      - ROBO_AREA55_EXIT_ADVANCE_SECONDS;
    const baselineExitDuration = 1.516;
    const exitTimeScale = resolveRoboArea55ExitTimeScale(baselineExitDuration);
    const shortenedExitDuration = baselineExitDuration / exitTimeScale;
    const combatOwnershipHandoff = exitStart + 0.35 / exitTimeScale;

    const lateBeamEnd = 2.12 + 0.60 + 0.10 + 0.07;
    expect(exitStart).toBeCloseTo(2.68, 10);
    expect(shortenedExitDuration).toBeCloseTo(
      baselineExitDuration - ROBO_AREA55_EXIT_SHORTEN_SECONDS,
      10,
    );
    expect(combatOwnershipHandoff).toBeGreaterThan(lateBeamEnd);
  });

  test('keeps the saucer departure inside the shared NN and scenery exit', () => {
    const exitTimeScale = resolveRoboArea55ExitTimeScale(1.516);
    const wallClockFinaleSeconds = ROBO_FIGHTER_FINALE_MIN_DURATION_SECONDS / exitTimeScale;
    const wallClockOutboundSeconds = wallClockFinaleSeconds * (1 - 0.38);

    expect(wallClockFinaleSeconds).toBeCloseTo(0.080, 2);
    expect(wallClockOutboundSeconds).toBeCloseTo(0.050, 2);
  });

  test('preserves the authored minimum hold after combat already completed', () => {
    expect(resolveRoboAirCombatHoldSeconds({
      minimumHoldSeconds: 1.95,
      combatDurationSeconds: 4,
      combatElapsedSeconds: 4.2,
    })).toBe(1.95);
  });
});
