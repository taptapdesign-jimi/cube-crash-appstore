import {
  getBeeLeafAssetSource,
  resolveBeeLeafGravity,
  sampleBeeLeafParticlePose,
  type BeeLeafParticleMotion,
} from '../bee-leaf-particle-motion';

describe('shared Bee leaf particle motion', () => {
  const particle: BeeLeafParticleMotion = {
    birth: 2,
    lifetime: 1.4,
    birthX: 120,
    birthY: -30,
    velocityX: 45,
    velocityY: -80,
    gravity: 640,
    flutter: 1.3,
    spin: -308,
    scale: 1.08,
    peakOpacity: 0.86,
  };

  test('uses the authored Bee ballistic, flutter, rotation and squash formula', () => {
    const elapsed = 2.7;
    const age = elapsed - particle.birth;
    const progress = age / particle.lifetime;
    const pose = sampleBeeLeafParticlePose(particle, elapsed);

    expect(pose.visible).toBe(true);
    expect(pose.x).toBeCloseTo(
      particle.birthX + particle.velocityX * age
        + Math.sin(age * 8.5 + particle.flutter) * (18 + 28 * progress),
      8,
    );
    expect(pose.y).toBeCloseTo(
      particle.birthY + particle.velocityY * age + particle.gravity * age * age * 0.5
        + Math.cos(age * 10.5 + particle.flutter) * (14 + 19 * progress),
      8,
    );
    expect(pose.rotation).toBeCloseTo(
      particle.spin * age + Math.sin(age * 11 + particle.flutter) * 16,
      8,
    );
    expect(pose.skewX).toBeCloseTo(Math.sin(age * 13 + particle.flutter) * 9, 8);
  });

  test('solves gravity against the same Bee floor distance with a 320 minimum', () => {
    expect(resolveBeeLeafGravity({
      viewportHeight: 844,
      birthY: -30,
      velocityY: -80,
      lifetime: 1.4,
    })).toBeCloseTo(2 * ((844 + 30 + 110) - (-80 * 1.4)) / (1.4 * 1.4), 8);
    expect(resolveBeeLeafGravity({
      viewportHeight: 10,
      birthY: 0,
      velocityY: 500,
      lifetime: 2,
    })).toBe(320);
  });

  test('cycles only through the six authored Bee leaf assets', () => {
    const sources = Array.from({ length: 12 }, (_, index) => getBeeLeafAssetSource(index));
    expect(new Set(sources).size).toBe(6);
    expect(sources[0]).toContain('/bee/leaf1');
    expect(sources[5]).toContain('/bee/leaf6');
    expect(sources[6]).toBe(sources[0]);
  });
});
