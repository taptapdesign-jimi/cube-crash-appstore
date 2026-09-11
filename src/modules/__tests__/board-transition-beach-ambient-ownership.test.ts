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

  test('gives each Beach float one conflict-free long-travel stepped motion owner', () => {
    expect(source).toContain('new Map<HTMLElement, gsap.core.Timeline[]>()');
    expect(floatSource).toContain('stopBeachAmbientMotion(sceneImg)');
    expect(floatSource.match(/trackTimeline\(/g)).toHaveLength(1);
    expect(floatSource).toContain('const motionTimeline = trackTimeline({ repeat: -1, yoyo: true })');
    expect(floatSource).toContain('ownAmbientTimeline(motionTimeline)');
    expect(floatSource).toContain('stepIndex < BEACH_FLOAT_MOTION_STEP_COUNT');
    expect(floatSource).toContain('x: horizontalDirection * horizontalTravelPx * progress');
    expect(floatSource).toContain('y: stepDirection * bouncePx');
    expect(floatSource).toContain('rotation: stepDirection * rotationLimit');
    expect(floatSource).toContain('duration: gsap.utils.random(0.32, 0.48)');
    expect(floatSource).toContain('const bouncePx = window.innerHeight * BEACH_FLOAT_BOUNCE_VIEWPORT_RATIO');
    expect(source).toContain('export const BEACH_FLOAT_BOUNCE_VIEWPORT_RATIO = 0.05');
    expect(source).toContain('export const BEACH_FLOAT_MOTION_STEP_COUNT = 6');
    expect(source).toContain('export const BEACH_BOTTLE_HORIZONTAL_TRAVEL_RATIOS = [0.66, 0.74]');
    expect(source).toContain('export const BEACH_BALL_HORIZONTAL_TRAVEL_RATIOS = [0.62, 0.70]');
    expect(floatSource).toContain('const rotationLimit = isBottle ? 44 : 120');

    expect(seaSource.match(/trackTimeline\(/g)).toHaveLength(1);
    expect(seaSource).toContain('const boingTimeline = gsap.timeline({ repeat: -1');
    expect(seaSource).not.toContain('trackTimeline({ repeat: -1, repeatDelay');
    expect(seaSource).toContain('ambientTimeline.add(boingTimeline, 0)');
    expect(seaSource).toContain('ambientTimeline.play(0)');
    expect(seaSource).toContain('const boingDuration = 0.2 + Math.random() * 0.35');
    expect(seaSource).toContain('repeatDelay: 0.18 + Math.random() * 0.35');
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
