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

  test('restores independent simultaneous drift, bounce, and rotation channels for Beach floats', () => {
    expect(source).toContain('new Map<HTMLElement, gsap.core.Timeline[]>()');
    expect(floatSource.match(/trackTimeline\(/g)).toHaveLength(3);
    expect(floatSource).toContain('horizontalTimeline.to(sceneImg');
    expect(floatSource).toContain('bounceTimeline.to(sceneImg');
    expect(floatSource).toContain('rotationTimeline.to(sceneImg');
    expect(floatSource).toContain('ownAmbientTimeline(horizontalTimeline)');
    expect(floatSource).toContain('ownAmbientTimeline(bounceTimeline)');
    expect(floatSource).toContain('ownAmbientTimeline(rotationTimeline)');
    expect(floatSource.match(/repeat: -1/g)).toHaveLength(3);
    expect(floatSource.match(/repeatRefresh: true/g)).toHaveLength(3);
    expect(floatSource.match(/yoyo: true/g)).toHaveLength(2);
    expect(floatSource).toContain('duration: () => gsap.utils.random(4.68, 6.24)');
    expect(floatSource.match(/duration: \(\) => gsap\.utils\.random\(0\.58, 0\.96\)/g)).toHaveLength(2);

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
