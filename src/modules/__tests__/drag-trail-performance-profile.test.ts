import { getDragTrailPerformanceProfile } from '../drag-trail-performance-profile';

describe('drag trail performance profile', () => {
  test('keeps desktop trail quality unchanged', () => {
    const profile = getDragTrailPerformanceProfile(false);
    expect(profile.regularSpacingPx).toBe(16);
    expect(profile.regularParticles).toEqual({ fast: 9, slow: 7 });
    expect(profile.wildParticles).toEqual({ fast: 4, slow: 3 });
  });

  test('substantially lowers touch trail burst and particle density', () => {
    const profile = getDragTrailPerformanceProfile(true);
    expect(profile.regularSpacingPx).toBe(28);
    expect(profile.regularMaxBurstsPerFrame).toBe(1);
    expect(profile.regularParticles).toEqual({ fast: 4, slow: 3 });
    expect(profile.wildSpacingPx).toBe(26);
    expect(profile.wildParticles).toEqual({ fast: 2, slow: 1 });
  });

  test('uses the lightest touch trail after thermal reduction activates', () => {
    const normal = getDragTrailPerformanceProfile(true, false);
    const reduced = getDragTrailPerformanceProfile(true, true);
    expect(reduced.regularSpacingPx).toBeGreaterThan(normal.regularSpacingPx);
    expect(reduced.regularParticles.fast).toBeLessThan(normal.regularParticles.fast);
    expect(reduced.wildParticles.fast).toBeLessThan(normal.wildParticles.fast);
  });
});
