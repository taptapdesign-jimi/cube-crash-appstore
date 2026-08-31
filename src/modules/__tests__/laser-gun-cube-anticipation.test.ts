import {
  getLaserGunCubeAnticipationFrames,
  LASERGUN_CUBE_MAX_ROTATION_DEGREES,
  LASERGUN_CUBE_MIN_ROTATION_DEGREES,
  LASERGUN_CUBE_ANTICIPATION_SCALE,
  LASERGUN_CUBE_ANTICIPATION_SECONDS,
  LASERGUN_CUBE_CONTRACT_SCALE,
  LASERGUN_CUBE_CONTRACT_SECONDS,
  LASERGUN_CUBE_INFLATE_SECONDS,
  LASERGUN_CUBE_REBOUND_SCALE,
  LASERGUN_CUBE_REBOUND_SECONDS,
  LASERGUN_CUBE_SETTLE_SECONDS,
} from '../laser-gun-cube-anticipation';

describe('LaserGun cube impact anticipation', () => {
  test('shakes through the connected 0.41-second spring impact', () => {
    const frames = getLaserGunCubeAnticipationFrames(() => 0);
    const lastFrame = frames[frames.length - 1];

    expect(LASERGUN_CUBE_ANTICIPATION_SECONDS).toBe(0.41);
    expect(LASERGUN_CUBE_ANTICIPATION_SCALE).toBe(1.30);
    expect(frames).toHaveLength(6);
    expect(frames.reduce((total, frame) => total + frame.durationSeconds, 0))
      .toBeCloseTo(LASERGUN_CUBE_ANTICIPATION_SECONDS, 10);
    expect(lastFrame.startAtSeconds + lastFrame.durationSeconds)
      .toBeCloseTo(LASERGUN_CUBE_ANTICIPATION_SECONDS, 10);
    expect(lastFrame.scale).toBeCloseTo(LASERGUN_CUBE_ANTICIPATION_SCALE, 10);
    expect(frames.slice(1).every((frame, index) => frame.scale > frames[index].scale)).toBe(true);
    expect(frames.some(({ offsetX }) => offsetX < 0)).toBe(true);
    expect(frames.some(({ offsetX }) => offsetX > 0)).toBe(true);
    expect(lastFrame.offsetX).toBe(0);
    expect(lastFrame.rotation * 180 / Math.PI).toBeCloseTo(-LASERGUN_CUBE_MIN_ROTATION_DEGREES, 10);
  });

  test('runs exactly one continuous 1.30 -> 0.70 -> 1.20 -> 1 spring', () => {
    expect(LASERGUN_CUBE_INFLATE_SECONDS).toBe(0.155);
    expect(LASERGUN_CUBE_CONTRACT_SCALE).toBe(0.70);
    expect(LASERGUN_CUBE_CONTRACT_SECONDS).toBe(0.075);
    expect(LASERGUN_CUBE_REBOUND_SCALE).toBe(1.20);
    expect(LASERGUN_CUBE_REBOUND_SECONDS).toBe(0.10);
    expect(LASERGUN_CUBE_SETTLE_SECONDS).toBe(0.08);
    expect(
      LASERGUN_CUBE_INFLATE_SECONDS
      + LASERGUN_CUBE_CONTRACT_SECONDS
      + LASERGUN_CUBE_REBOUND_SECONDS
      + LASERGUN_CUBE_SETTLE_SECONDS
    )
      .toBeCloseTo(LASERGUN_CUBE_ANTICIPATION_SECONDS, 10);
  });

  test('chooses one bounded random rotation direction for the pre-break pose', () => {
    const leftFrames = getLaserGunCubeAnticipationFrames(() => 0);
    const rightFrames = getLaserGunCubeAnticipationFrames(() => 0.999);
    const leftDegrees = leftFrames[leftFrames.length - 1].rotation * 180 / Math.PI;
    const rightDegrees = rightFrames[rightFrames.length - 1].rotation * 180 / Math.PI;

    expect(leftDegrees).toBeCloseTo(-LASERGUN_CUBE_MIN_ROTATION_DEGREES, 10);
    expect(rightDegrees).toBeCloseTo(
      LASERGUN_CUBE_MIN_ROTATION_DEGREES
        + 0.999 * (LASERGUN_CUBE_MAX_ROTATION_DEGREES - LASERGUN_CUBE_MIN_ROTATION_DEGREES),
      10,
    );
    expect(leftDegrees).toBeLessThan(0);
    expect(rightDegrees).toBeGreaterThan(0);
  });
});
