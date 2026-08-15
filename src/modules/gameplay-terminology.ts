export type GameplayProgressMode = 'journey' | 'arcade';

export const GAMEPLAY_PROGRESS_TERMS = Object.freeze({
  journey: Object.freeze({ singular: 'Stage', plural: 'Stages' }),
  arcade: Object.freeze({ singular: 'Round', plural: 'Rounds' }),
});

export function getGameplayProgressTerm(
  mode: GameplayProgressMode,
  options: { plural?: boolean } = {},
): string {
  const terms = GAMEPLAY_PROGRESS_TERMS[mode];
  return options.plural ? terms.plural : terms.singular;
}

export function formatGameplayProgressLabel(
  mode: GameplayProgressMode,
  value: number | string,
  options: { padTo?: number } = {},
): string {
  const rawValue = String(value);
  const formattedValue = options.padTo
    ? rawValue.padStart(options.padTo, '0')
    : rawValue;
  return `${getGameplayProgressTerm(mode)} ${formattedValue}`;
}

const JOURNEY_RESULT_WORLD_NAMES = Object.freeze([
  'Forest',
  'Beach',
  'Area 55',
]);

export function formatGameplayResultProgressLabel(
  mode: GameplayProgressMode,
  value: number | string,
): string {
  if (mode === 'arcade') {
    return formatGameplayProgressLabel('arcade', value, { padTo: 2 });
  }

  const safeBoardNumber = Math.max(1, Math.floor(Number(value) || 1));
  const worldIndex = Math.floor((safeBoardNumber - 1) / 10);
  const worldName = JOURNEY_RESULT_WORLD_NAMES[worldIndex];
  if (!worldName) {
    return formatGameplayProgressLabel('journey', safeBoardNumber, { padTo: 2 });
  }

  const localStageNumber = ((safeBoardNumber - 1) % 10) + 1;
  return `${worldName} ${String(localStageNumber).padStart(2, '0')}`;
}
