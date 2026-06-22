import { shouldShowJourneyBottomDecor } from '../journey-bottom-decor-decision';

describe('journey-bottom-decor-decision', () => {
  it('shows bottom decor for journey board gameplay', () => {
    expect(shouldShowJourneyBottomDecor({ isArcade: false, isJourneyOrigin: false })).toBe(true);
  });

  it('hides bottom decor for plain arcade gameplay', () => {
    expect(shouldShowJourneyBottomDecor({ isArcade: true, isJourneyOrigin: false })).toBe(false);
  });

  it('hides bottom decor in arcade even when stale journey origin exists', () => {
    expect(shouldShowJourneyBottomDecor({ isArcade: true, isJourneyOrigin: true })).toBe(false);
  });
});
