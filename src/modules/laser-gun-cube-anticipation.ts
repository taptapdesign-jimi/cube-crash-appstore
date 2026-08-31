export const LASERGUN_CUBE_ANTICIPATION_SECONDS = 0.41;
export const LASERGUN_CUBE_ANTICIPATION_SCALE = 1.30;
export const LASERGUN_CUBE_INFLATE_SECONDS = 0.155;
export const LASERGUN_CUBE_CONTRACT_SCALE = 0.70;
export const LASERGUN_CUBE_CONTRACT_SECONDS = 0.075;
export const LASERGUN_CUBE_REBOUND_SCALE = 1.20;
export const LASERGUN_CUBE_REBOUND_SECONDS = 0.10;
export const LASERGUN_CUBE_SETTLE_SECONDS = 0.08;
export const LASERGUN_CUBE_MIN_ROTATION_DEGREES = 6;
export const LASERGUN_CUBE_MAX_ROTATION_DEGREES = 10;

const SHAKE_OFFSETS = [3.5, -4.5, 4, -3, 2, 0] as const;
const SHAKE_ROTATION_JITTER = [0.025, -0.03, 0.022, -0.018, 0.01, 0] as const;

export type LaserGunCubeAnticipationFrame = {
  offsetX: number;
  rotation: number;
  scale: number;
  durationSeconds: number;
  startAtSeconds: number;
};

export function getLaserGunCubeAnticipationFrames(
  random: () => number = Math.random,
): LaserGunCubeAnticipationFrame[] {
  const durationSeconds = LASERGUN_CUBE_ANTICIPATION_SECONDS / SHAKE_OFFSETS.length;
  const direction = random() < 0.5 ? -1 : 1;
  const rotationDegrees = LASERGUN_CUBE_MIN_ROTATION_DEGREES
    + random() * (LASERGUN_CUBE_MAX_ROTATION_DEGREES - LASERGUN_CUBE_MIN_ROTATION_DEGREES);
  const targetRotation = direction * rotationDegrees * Math.PI / 180;
  return SHAKE_OFFSETS.map((offsetX, index) => ({
    offsetX,
    rotation: targetRotation * ((index + 1) / SHAKE_OFFSETS.length)
      + SHAKE_ROTATION_JITTER[index],
    scale: 1 + (LASERGUN_CUBE_ANTICIPATION_SCALE - 1) * ((index + 1) / SHAKE_OFFSETS.length),
    durationSeconds,
    startAtSeconds: index * durationSeconds,
  }));
}
