export type JourneyNewCardTapAction = 'reveal' | 'queue-collect' | 'collect' | 'ignore';

export function resolveJourneyNewCardTapAction(options: {
  revealed: boolean;
  revealRunning: boolean;
  resolved: boolean;
  disposed: boolean;
}): JourneyNewCardTapAction {
  if (options.resolved || options.disposed) return 'ignore';
  if (options.revealed && !options.revealRunning) return 'collect';
  if (options.revealRunning) return 'queue-collect';
  return 'reveal';
}
