import {
  getOrganicRadialSmokeLayout,
  getRegularMerge6FxProfile,
  getRegularStackSmokeProfile,
  getSmokeCloudParticleAlpha,
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

  it('makes merge-6 shards larger and wider while keeping smoke organically distributed', () => {
    const full = getRegularMerge6FxProfile(false);
    const reduced = getRegularMerge6FxProfile(true);

    expect(full.shardVisualScale).toBeGreaterThan(1);
    expect(full.shardDistanceScale).toBeGreaterThan(1);
    expect(full.shardDensity).toBe(1);
    expect(reduced.shardDensity).toBeLessThan(full.shardDensity);
    expect(full.smokeSizeScale).toBeGreaterThan(1.3);
    expect(full.smokeDistanceScale).toBeGreaterThan(1.1);
    expect(full.smokeCountScale).toBeLessThanOrEqual(0.9);
    expect(full.smokeSpawnShape).toBe('organic-radial');
    expect(reduced.smokeSpawnShape).toBe('organic-radial');
    expect(full.smokeEllipseChance).toBeGreaterThan(0.5);
    expect(full.smokeEllipseAspectMin).toBeLessThan(0.7);
    expect(full.smokeEllipseAspectMax).toBeGreaterThan(1.3);
  });

  it('varies merge-6 smoke starts from the core to beyond the cube edge without a fixed ring', () => {
    let seed = 0x51f15e;
    const seededRandom = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const layouts = Array.from({ length: 80 }, () => getOrganicRadialSmokeLayout(100, 1, seededRandom));
    const startRadii = layouts.map(({ sx, sy }) => Math.hypot(sx, sy));
    const travelDistances = layouts.map(({ sx, sy, dx, dy }) => Math.hypot(dx - sx, dy - sy));

    expect(Math.min(...startRadii)).toBeLessThan(8);
    expect(Math.max(...startRadii)).toBeGreaterThan(50);
    expect(startRadii.filter((radius) => radius < 25).length).toBeGreaterThan(10);
    expect(startRadii.filter((radius) => radius > 45).length).toBeGreaterThan(8);
    expect(Math.max(...travelDistances) - Math.min(...travelDistances)).toBeGreaterThan(30);
  });

  it('keeps the merge smoke core strong while softening randomized cloud edges', () => {
    expect(getSmokeCloudParticleAlpha(1, 0.5)).toBeGreaterThanOrEqual(0.95);
    expect(getSmokeCloudParticleAlpha(0, 0.5)).toBeLessThan(0.4);
    expect(getSmokeCloudParticleAlpha(0, 0)).toBeGreaterThanOrEqual(0.3);
    expect(getSmokeCloudParticleAlpha(1, 1)).toBeLessThanOrEqual(1);
  });
});
