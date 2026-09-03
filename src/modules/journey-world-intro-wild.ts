export type JourneyWorldIntroWildType = 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';

export const JOURNEY_WORLD_INTRO_THEME_CHANCE = 0.60;

export function shouldUseJourneyWorldIntroTheme({
  wildSpawnCount,
  previousWildType,
  roll,
}: {
  wildSpawnCount: number;
  previousWildType?: JourneyWorldIntroWildType | null;
  roll?: number;
}): boolean {
  if (wildSpawnCount <= 0) return false;
  if (previousWildType === 'wild') return true;

  const finiteRoll = Number.isFinite(roll) ? Number(roll) : Math.random();
  const boundedRoll = Math.max(0, Math.min(1 - Number.EPSILON, finiteRoll));
  return boundedRoll < JOURNEY_WORLD_INTRO_THEME_CHANCE;
}
