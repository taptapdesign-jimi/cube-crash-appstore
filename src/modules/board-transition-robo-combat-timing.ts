export const ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS = 0.08;
export const ROBO_AREA55_EXIT_ADVANCE_SECONDS = 0.40;

export function resolveRoboAirCombatHoldSeconds(options: {
  minimumHoldSeconds: number;
  combatDurationSeconds: number;
  combatElapsedSeconds: number;
}): number {
  const remainingCombatSeconds = Math.max(
    0,
    options.combatDurationSeconds - options.combatElapsedSeconds,
  );
  return Math.max(
    options.minimumHoldSeconds,
    remainingCombatSeconds
      + ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS
      - ROBO_AREA55_EXIT_ADVANCE_SECONDS,
  );
}
