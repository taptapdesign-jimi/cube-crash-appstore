import {
  createMushroomSporeFlightProfiles,
  MUSHROOM_SPORE_TIME_SCALE,
} from '../mushroom-spore-flight-plan';

describe('Mushroom spore flight profiles', () => {
  test('guarantees widely separated travel, death and oscillation profiles', () => {
    let sample = 0;
    const random = () => ((sample++ * 37) % 101) / 100;
    const profiles = createMushroomSporeFlightProfiles(72, random);

    expect(profiles).toHaveLength(72);
    expect(profiles.some((profile) => profile.travelRatio < 0.25)).toBe(true);
    expect(profiles.some((profile) => profile.travelRatio > 0.60)).toBe(true);
    expect(Math.max(...profiles.map((profile) => profile.riseDuration))
      - Math.min(...profiles.map((profile) => profile.riseDuration))).toBeGreaterThan(1.35);
    expect(Math.max(...profiles.map((profile) => profile.arrivalDuration))
      - Math.min(...profiles.map((profile) => profile.arrivalDuration))).toBeGreaterThan(0.5);
    expect(Math.max(...profiles.map((profile) => profile.swayAmplitudeRatio)))
      .toBeGreaterThan(0.09);
    expect(Math.min(...profiles.map((profile) => profile.swayAmplitudeRatio)))
      .toBeLessThan(0.03);
  });

  test('is bounded and creates no runtime owner or display object', () => {
    const profiles = createMushroomSporeFlightProfiles(72, () => 0.5);
    profiles.forEach((profile) => {
      expect(profile.birthDelay).toBeGreaterThanOrEqual(0);
      expect(profile.birthDelay).toBeLessThanOrEqual(0.78 * MUSHROOM_SPORE_TIME_SCALE);
      expect(profile.travelRatio).toBeGreaterThanOrEqual(0.16);
      expect(profile.travelRatio).toBeLessThanOrEqual(0.76);
      expect(profile.birthDelay + profile.riseDuration + profile.arrivalDuration).toBeLessThan(5);
    });
  });
});
