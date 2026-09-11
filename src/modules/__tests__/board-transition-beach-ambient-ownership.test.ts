import fs from 'node:fs';
import path from 'node:path';

describe('Beach transition ambient ownership', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/board-transition-screen.ts'),
    'utf8',
  );
  const start = source.indexOf('function startBeachAmbientMotion');
  const shoreStart = source.indexOf('function startBeachSharedShoreAmbientMotion', start);
  const ambientSource = source.slice(start, shoreStart);
  const floatStart = ambientSource.indexOf("if (motionRole === 'float')");
  const seaStart = ambientSource.indexOf("if (motionRole === 'sea')");
  const floatSource = ambientSource.slice(floatStart, seaStart);
  const seaSource = ambientSource.slice(seaStart);

  test('gives each Beach float one conflict-free waterline drift, bounce, and wobble owner', () => {
    expect(source).toContain('new Map<HTMLElement, gsap.core.Timeline[]>()');
    expect(floatSource).toContain('stopBeachAmbientMotion(sceneImg)');
    expect(floatSource.match(/trackTimeline\(/g)).toHaveLength(1);
    expect(floatSource).toContain('const motionTimeline = trackTimeline()');
    expect(floatSource).toContain('ownAmbientTimeline(motionTimeline)');
    expect(floatSource).toContain('motionTimeline.to(motionClock, {');
    expect(floatSource).toContain("ease: 'none'");
    expect(floatSource).toContain('repeat: -1');
    expect(floatSource).not.toContain('yoyo: true');
    expect(floatSource).toContain('x: horizontalDirection * horizontalTravelPx * horizontalProgress');
    expect(floatSource).toContain('y: -waveHeightPx * riseWave');
    expect(floatSource).toContain('rotation: rotationWave * rotationLimit');
    expect(source).toContain('export const BEACH_FLOAT_MOTION_CYCLE_SECONDS = 12');
    expect(source).toContain('export const BEACH_FLOAT_BOUNCE_CYCLE_SECONDS = 1');
    expect(source).toContain('export const BEACH_FLOAT_WOBBLE_CYCLE_SECONDS = 1.5');
    expect(source).toContain('BEACH_FLOAT_LEFT_EDGE_RATIO');
    expect(source).toContain('BEACH_FLOAT_RIGHT_EDGE_RATIO');
    expect(source).toContain('BEACH_FLOAT_HORIZONTAL_TRAVEL_SCALE');
    expect(floatSource).toContain('sampleBeachFloatHorizontalProgress(elapsedSeconds)');
    expect(floatSource).toContain('BEACH_FLOAT_RIGHT_EDGE_RATIO - BEACH_FLOAT_LEFT_EDGE_RATIO');
    expect(source).toContain('export const BEACH_BOTTLE_BOUNCE_PX = 18');
    expect(source).toContain('export const BEACH_BALL_BOUNCE_PX = 22');
    expect(source).toContain('export const BEACH_BOTTLE_WOBBLE_DEGREES = 50.4');
    expect(source).toContain('export const BEACH_BALL_WOBBLE_DEGREES = 117.6');
    expect(floatSource.match(/onUpdate:/g)).toHaveLength(1);
    expect(floatSource.match(/gsap\.set\(sceneImg/g)).toHaveLength(2);

    expect(seaSource.match(/trackTimeline\(/g)).toHaveLength(1);
    expect(seaSource).toContain('const boingTimeline = gsap.timeline({ repeat: -1');
    expect(seaSource).not.toContain('trackTimeline({ repeat: -1, repeatDelay');
    expect(seaSource).toContain('ambientTimeline.add(boingTimeline, 0)');
    expect(seaSource).toContain('ambientTimeline.play(0)');
    expect(seaSource).toContain('const boingDuration = 0.2 + Math.random() * 0.35');
    expect(seaSource).toContain('repeatDelay: 0.18 + Math.random() * 0.35');
  });

  test('preserves the completed horizontal position when Beach floats exit', () => {
    const exitStart = source.indexOf('function startExitAnimation');
    const exitSource = source.slice(exitStart);

    expect(exitSource).toContain("const isBeachFloatExit = isBeachSceneExit && sceneImg.dataset.motionRole === 'float'");
    expect(exitSource).toContain('...(isBeachFloatExit ? {} : { x: 0 })');
  });

  test('stops only the requested element owner and retains the shared shore owner', () => {
    const stopStart = source.indexOf('function stopBeachAmbientMotion');
    const stopEnd = source.indexOf('function startRoboGroundAmbientMotion', stopStart);
    const stopSource = source.slice(stopStart, stopEnd);

    expect(stopSource).toContain("if (sceneImg.dataset.motionRole === 'shore' && beachShoreAmbientTimeline)");
    expect(stopSource).toContain('const owned = beachAmbientTimelines.get(sceneImg) ?? []');
    expect(stopSource).toContain('owned.forEach((timeline) => {');
    expect(stopSource).toContain('timeline.kill()');
    expect(stopSource).toContain('beachAmbientTimelines.delete(sceneImg)');
  });
});
