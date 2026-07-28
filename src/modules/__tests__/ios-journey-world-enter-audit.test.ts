import { summarizeJourneyWorldEnterFrames } from '../../utils/ios-journey-world-enter-audit.js';

describe('Journey world enter performance audit', () => {
  it('summarizes frame pressure without allowing invalid or unbounded samples', () => {
    expect(summarizeJourneyWorldEnterFrames([16, 17, 21, 35, 78, Number.NaN, 900])).toEqual({
      count: 6,
      averageMs: 69.5,
      worstMs: 250,
      over20: 4,
      over34: 3,
      over50: 2,
    });
  });

  it('returns a stable empty summary', () => {
    expect(summarizeJourneyWorldEnterFrames([])).toEqual({
      count: 0,
      averageMs: 0,
      worstMs: 0,
      over20: 0,
      over34: 0,
      over50: 0,
    });
  });
});
