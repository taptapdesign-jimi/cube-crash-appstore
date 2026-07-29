import {
  getRegularMerge6FxProfile,
  getRegularStackSmokeProfile,
} from '../gameplay-fx-profile.js';

describe('gameplay FX profile', () => {
  it('keeps stack smoke readable while reduced mode retains the lower particle density', () => {
    const full = getRegularStackSmokeProfile(false);
    const reduced = getRegularStackSmokeProfile(true);

    expect(reduced.sizeScale).toBeGreaterThanOrEqual(1);
    expect(reduced.countScale).toBeLessThan(full.countScale);
    expect(full.countScale).toBeLessThan(0.6);
    expect(reduced.durationScale).toBeLessThan(full.durationScale);
  });

  it('makes merge-6 shards larger and wider without increasing their density', () => {
    const full = getRegularMerge6FxProfile(false);
    const reduced = getRegularMerge6FxProfile(true);

    expect(full.shardVisualScale).toBeGreaterThan(1);
    expect(full.shardDistanceScale).toBeGreaterThan(1);
    expect(full.shardDensity).toBe(1);
    expect(reduced.shardDensity).toBeLessThan(full.shardDensity);
    expect(full.smokeSizeScale).toBeGreaterThan(1.3);
    expect(full.smokeDistanceScale).toBeGreaterThan(1.1);
    expect(full.smokeCountScale).toBeLessThanOrEqual(0.9);
    expect(full.smokeUpwardBias).toBeGreaterThan(0);
  });
});
