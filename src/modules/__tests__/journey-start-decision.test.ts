import { resolveJourneyStartDecision } from '../journey-start-decision';

describe('journey-start-decision', () => {
  it('uses the regular start path when no journey origin flags are active', () => {
    expect(resolveJourneyStartDecision({})).toEqual({
      cameFromJourney: false,
      isInterimBoard: false,
      cameFromInterimBoard: false,
      shouldUseJourneyStart: false,
    });
  });

  it('uses journey start when the run came from journey', () => {
    expect(resolveJourneyStartDecision({ cameFromJourney: true }).shouldUseJourneyStart).toBe(true);
  });

  it('uses journey start for interim board flags', () => {
    expect(resolveJourneyStartDecision({ isInterimBoard: true }).shouldUseJourneyStart).toBe(true);
    expect(resolveJourneyStartDecision({ cameFromInterimBoard: true }).shouldUseJourneyStart).toBe(true);
  });
});
