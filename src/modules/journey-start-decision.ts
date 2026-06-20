export interface JourneyStartFlags {
  cameFromJourney?: boolean;
  isInterimBoard?: boolean;
  cameFromInterimBoard?: boolean;
}

export interface JourneyStartDecision extends Required<JourneyStartFlags> {
  shouldUseJourneyStart: boolean;
}

export function resolveJourneyStartDecision(flags: JourneyStartFlags): JourneyStartDecision {
  const cameFromJourney = flags.cameFromJourney === true;
  const isInterimBoard = flags.isInterimBoard === true;
  const cameFromInterimBoard = flags.cameFromInterimBoard === true;

  return {
    cameFromJourney,
    isInterimBoard,
    cameFromInterimBoard,
    shouldUseJourneyStart: cameFromJourney || isInterimBoard || cameFromInterimBoard,
  };
}
