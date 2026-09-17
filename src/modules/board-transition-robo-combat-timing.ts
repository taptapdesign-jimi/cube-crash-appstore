export const ROBO_AIR_COMBAT_COMPLETION_PADDING_SECONDS = 0.08;
export const ROBO_AREA55_EXIT_ADVANCE_SECONDS = 0.40;
export const ROBO_AREA55_EXIT_SHORTEN_SECONDS = 0.50;
export const ROBO_FIGHTER_FINALE_SHORTEN_SECONDS = 1.50;
// Keep the departure inside the shared NN/scenery exit instead of extending
// the transition tail. Geometry, rather than a visibility toggle, owns hiding.
export const ROBO_FIGHTER_FINALE_MIN_DURATION_SECONDS = 0.12;

export function resolveRoboFighterFinaleDuration(availableDurationSeconds: number): number {
  const safeAvailableDurationSeconds = Math.max(0.001, availableDurationSeconds);
  return Math.min(
    safeAvailableDurationSeconds,
    Math.max(
      ROBO_FIGHTER_FINALE_MIN_DURATION_SECONDS,
      safeAvailableDurationSeconds - ROBO_FIGHTER_FINALE_SHORTEN_SECONDS,
    ),
  );
}

export function resolveRoboFighterFinaleWindow(
  sceneStartSeconds: number,
  sceneEndSeconds: number,
): Readonly<{ start: number; end: number; duration: number }> {
  const startBoundary = Math.max(0, Number.isFinite(sceneStartSeconds) ? sceneStartSeconds : 0);
  const endBoundary = Math.max(
    startBoundary + 0.001,
    Number.isFinite(sceneEndSeconds) ? sceneEndSeconds : startBoundary + 0.001,
  );
  const duration = resolveRoboFighterFinaleDuration(endBoundary - startBoundary);
  return Object.freeze({
    start: Math.max(startBoundary, endBoundary - duration),
    end: endBoundary,
    duration,
  });
}

export function resolveRoboArea55ExitTimeScale(exitDurationSeconds: number): number {
  const safeDurationSeconds = Math.max(0.001, exitDurationSeconds);
  const shortenedDurationSeconds = Math.max(
    0.001,
    safeDurationSeconds - ROBO_AREA55_EXIT_SHORTEN_SECONDS,
  );
  return safeDurationSeconds / shortenedDurationSeconds;
}

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
