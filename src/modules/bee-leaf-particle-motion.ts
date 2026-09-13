export const BEE_LEAF_PARTICLE_COUNT = 42;
export const BEE_LEAF_START_SECONDS = 0;
export const BEE_LEAF_END_SECONDS = 2.90;
export const BEE_LEAF_LAST_END_SECONDS = 3.86;
export const BEE_LEAVES_PER_BURST = 3;

export const BEE_LEAF_STAGGER_SECONDS = (
  BEE_LEAF_END_SECONDS - BEE_LEAF_START_SECONDS
) / (BEE_LEAF_PARTICLE_COUNT / BEE_LEAVES_PER_BURST - 1);

export interface BeeLeafParticleMotion {
  birth: number;
  lifetime: number;
  birthX: number;
  birthY: number;
  velocityX: number;
  velocityY: number;
  gravity: number;
  flutter: number;
  spin: number;
  scale: number;
  peakOpacity: number;
}

export interface BeeLeafParticlePose {
  visible: boolean;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  rotation: number;
  skewX: number;
  imageScaleX: number;
  imageScaleY: number;
}

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export function getBeeLeafAssetSource(assetIndex: number): string {
  const safeIndex = ((Math.trunc(assetIndex) % 6) + 6) % 6;
  const use2x = typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return `./assets/shop/bee/leaf${safeIndex + 1}${use2x ? '@2x' : ''}.png`;
}

export function resolveBeeLeafGravity(options: {
  viewportHeight: number;
  birthY: number;
  velocityY: number;
  lifetime: number;
}): number {
  const floorDistance = Math.max(120, options.viewportHeight - options.birthY + 110);
  return Math.max(
    320,
    2 * (floorDistance - options.velocityY * options.lifetime)
      / (options.lifetime * options.lifetime),
  );
}

// Shared by the Bee finale and Forest Clean Board so the authored leaf
// gravity, flutter, amplitude, fade, rotation and squash cannot drift apart.
export function sampleBeeLeafParticlePose(
  particle: BeeLeafParticleMotion,
  elapsedSeconds: number,
): BeeLeafParticlePose {
  const age = elapsedSeconds - particle.birth;
  if (age < 0 || age > particle.lifetime) {
    return {
      visible: false,
      x: particle.birthX,
      y: particle.birthY,
      opacity: 0,
      scale: 0,
      rotation: 0,
      skewX: 0,
      imageScaleX: 1,
      imageScaleY: 1,
    };
  }

  const progress = clamp(age / particle.lifetime, 0, 1);
  const enter = clamp(age / 0.07, 0, 1);
  const exit = progress > 0.72 ? clamp((1 - progress) / 0.28, 0, 1) : 1;
  const wildX = Math.sin(age * 8.5 + particle.flutter) * (18 + 28 * progress);
  const wildY = Math.cos(age * 10.5 + particle.flutter) * (14 + 19 * progress);

  return {
    visible: true,
    x: particle.birthX + particle.velocityX * age + wildX,
    y: particle.birthY + particle.velocityY * age
      + particle.gravity * age * age * 0.5 + wildY,
    opacity: particle.peakOpacity * enter * exit,
    scale: particle.scale * (0.45 + enter * 0.7) * (1 - progress * 0.18),
    rotation: particle.spin * age + Math.sin(age * 11 + particle.flutter) * 16,
    skewX: Math.sin(age * 13 + particle.flutter) * 9,
    imageScaleX: 0.96 + Math.sin(age * 12 + particle.flutter) * 0.07,
    imageScaleY: 1.01 - Math.sin(age * 12 + particle.flutter) * 0.06,
  };
}
