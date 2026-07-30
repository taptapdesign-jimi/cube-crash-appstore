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
