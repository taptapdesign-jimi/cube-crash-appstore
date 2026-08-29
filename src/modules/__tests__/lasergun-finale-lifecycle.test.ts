/** @jest-environment jsdom */

import animationManager from '../animation-manager';
import { gsap } from 'gsap';
import {
  attachLaserGunFinaleScene,
  LASERGUN_BEAM_COUNT,
  LASERGUN_FRAME_SEQUENCE,
  LASERGUN_MAX_TARGETS,
  setActiveLaserGunFinaleTargets,
  triggerActiveLaserGunFinaleImpact,
} from '../lasergun-finale-scene';

describe('LaserGun finale lifecycle', () => {
  beforeEach(() => animationManager.killAll());
  afterEach(() => {
    animationManager.killAll();
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('renders the bounded crossfire composition and releases every owner', () => {
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const baseline = animationManager.getStats().activeTimelines;
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });

    expect(overlay.querySelectorAll('.cc-lasergun-rig')).toHaveLength(LASERGUN_MAX_TARGETS);
    expect(overlay.querySelectorAll('.cc-lasergun-frame')).toHaveLength(LASERGUN_MAX_TARGETS);
    expect(overlay.querySelectorAll('.cc-lasergun-axis-marker')).toHaveLength(LASERGUN_MAX_TARGETS);
    expect(overlay.querySelectorAll('.cc-lasergun-beam')).toHaveLength(LASERGUN_BEAM_COUNT);
    expect(overlay.querySelectorAll('.cc-lasergun-beam-left')).toHaveLength(2);
    expect(overlay.querySelectorAll('.cc-lasergun-beam-right')).toHaveLength(2);
    const baseField = overlay.querySelector('.cc-lasergun-finale-scene') as HTMLElement;
    const rightGunField = overlay.querySelector('.cc-lasergun-right-gun-layer') as HTMLElement;
    expect(baseField.style.zIndex).toBe('1');
    expect(rightGunField.style.zIndex).toBe('3');
    expect(baseField.querySelectorAll('.cc-lasergun-rig-left')).toHaveLength(2);
    expect(baseField.querySelectorAll('.cc-lasergun-rig-right')).toHaveLength(0);
    expect(rightGunField.querySelectorAll('.cc-lasergun-rig-right')).toHaveLength(2);
    expect((overlay.querySelector('.cc-lasergun-rig-left .cc-lasergun-orientation') as HTMLElement)?.style.transform)
      .toBe('rotate(45deg) scaleX(-1)');
    expect(document.querySelector('.cc-lasergun-impact')).toBeNull();
    expect(document.querySelector('.cc-lasergun-rendered-die')).toBeNull();
    expect(document.querySelector('.cc-lasergun-impact-rock')).toBeNull();
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);

    setActiveLaserGunFinaleTargets([
      { x: 72, y: 220, shooter: 'right' },
      { x: 315, y: 330, shooter: 'left' },
      { x: 120, y: 510, shooter: 'right' },
      { x: 280, y: 640, shooter: 'left' },
      { x: 999, y: 999, shooter: 'right' },
    ]);
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 3);
    const visibleGuns = Array.from(overlay.querySelectorAll('.cc-lasergun-rig'))
      .filter((gun) => (gun as HTMLElement).style.visibility === 'visible');
    expect(visibleGuns).toHaveLength(4);

    cleanup();
    cleanup();
    expect(overlay.querySelector('.cc-lasergun-finale-scene')).toBeNull();
    expect(overlay.querySelector('.cc-lasergun-right-gun-layer')).toBeNull();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });

  test('stays bounded through repeated interrupted finales', () => {
    const baseline = animationManager.getStats().activeTimelines;
    for (let run = 0; run < 20; run += 1) {
      const overlay = document.createElement('div');
      document.body.appendChild(overlay);
      const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.25 });
      setActiveLaserGunFinaleTargets([{ x: 180, y: 420, shooter: 'right' }]);
      cleanup();
      overlay.remove();
      expect(animationManager.getStats().activeTimelines).toBe(baseline);
      expect(document.querySelector('.cc-lasergun-finale-scene')).toBeNull();
    }
  });

  test('paints only the reserved beam after the native impact requests its paint barrier', () => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now());
      return 1;
    });
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    setActiveLaserGunFinaleTargets([{ x: 80, y: 260, shooter: 'right' }]);

    triggerActiveLaserGunFinaleImpact(0);

    const rightBeam = overlay.querySelector('.cc-lasergun-beam-right') as HTMLElement;
    const rightGunFrame = overlay.querySelector('.cc-lasergun-rig-right .cc-lasergun-frame') as HTMLElement;
    expect(rightBeam.style.opacity).toBe('1');
    expect(rightBeam.style.filter).toContain('brightness(1.18)');
    const recoilTween = gsap.getTweensOf(rightGunFrame)
      .find((tween) => Math.abs(tween.duration() - 0.055) < 0.001);
    expect(recoilTween).toBeDefined();
    const recoilTimeline = recoilTween?.parent as gsap.core.Timeline | undefined;
    recoilTimeline!.progress(1);
    expect(Number(gsap.getProperty(rightGunFrame, 'x'))).toBeCloseTo(0, 6);
    expect(Number(gsap.getProperty(rightGunFrame, 'y'))).toBeCloseTo(0, 6);
    expect(document.querySelector('.cc-lasergun-rendered-die')).toBeNull();
    expect(document.querySelector('.cc-lasergun-impact-rock')).toBeNull();
    expect((overlay.querySelector('.cc-lasergun-rig-left') as HTMLElement).style.visibility).toBe('hidden');

    triggerActiveLaserGunFinaleImpact(0);
    cleanup();
    expect(overlay.querySelector('.cc-lasergun-finale-scene')).toBeNull();
  });

  test('waits a complete gun-only paint between final alignment and beam reveal', () => {
    const scheduledFrames: FrameRequestCallback[] = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrames.push(callback);
      return scheduledFrames.length;
    });
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    setActiveLaserGunFinaleTargets([{ x: 80, y: 260, shooter: 'right' }]);
    const rightBeam = overlay.querySelector('.cc-lasergun-beam-right') as HTMLElement;
    const rightAim = overlay.querySelector('.cc-lasergun-rig-right .cc-lasergun-aim') as HTMLElement;
    const transformBeforeImpact = rightAim.style.transform;

    triggerActiveLaserGunFinaleImpact(0);

    expect(rightBeam.style.opacity).toBe('0');
    expect(rightAim.style.transform).toBe(transformBeforeImpact);
    expect(scheduledFrames).toHaveLength(1);
    scheduledFrames.shift()!(performance.now());
    expect(rightBeam.style.opacity).toBe('0');
    expect(scheduledFrames).toHaveLength(1);
    scheduledFrames.shift()!(performance.now());
    expect(rightBeam.style.opacity).toBe('0');
    expect(scheduledFrames).toHaveLength(1);
    scheduledFrames.shift()!(performance.now());
    expect(rightBeam.style.opacity).toBe('1');

    cleanup();
  });

  test('aim completion only prepares a hidden beam and native impact owns its paint-barrier reveal', () => {
    const scheduledFrames: FrameRequestCallback[] = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrames.push(callback);
      return scheduledFrames.length;
    });
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    setActiveLaserGunFinaleTargets([{ x: 80, y: 260, shooter: 'right' }]);

    const activeBeam = overlay.querySelector('.cc-lasergun-beam-right') as HTMLElement;
    const inactiveBeams = Array.from(overlay.querySelectorAll('.cc-lasergun-beam'))
      .filter((beam) => beam !== activeBeam) as HTMLElement[];
    const activeAim = overlay.querySelector('.cc-lasergun-rig-right .cc-lasergun-aim') as HTMLElement;
    const aimTween = gsap.getTweensOf(activeAim)
      .find((tween) => Math.abs(tween.duration() - 0.16) < 0.001);
    expect(aimTween).toBeDefined();

    // Reproduce the real race: GSAP finishes aiming before the native Pixi
    // explosion callback requests the shot. Preparation may solve geometry,
    // but it must never paint a laser on its own.
    aimTween!.progress(1);
    while (scheduledFrames.length) scheduledFrames.shift()!(performance.now());
    expect(activeBeam.style.opacity).toBe('0');
    expect(inactiveBeams.every((beam) => beam.style.opacity === '0')).toBe(true);

    triggerActiveLaserGunFinaleImpact(0);
    // The gun-only paint barrier already completed while hidden, so the native
    // impact can reveal this exact armed beam without touching aim again.
    expect(activeBeam.style.opacity).toBe('1');
    expect(scheduledFrames).toHaveLength(0);
    expect(inactiveBeams.every((beam) => beam.style.opacity === '0')).toBe(true);

    cleanup();
  });

  test('runs the complete sprite sequence on every one of four active guns without revealing beams', () => {
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    setActiveLaserGunFinaleTargets([
      { x: 80, y: 180, shooter: 'right' },
      { x: 310, y: 300, shooter: 'left' },
      { x: 100, y: 500, shooter: 'right' },
      { x: 300, y: 650, shooter: 'left' },
    ]);

    const activeRigs = Array.from(overlay.querySelectorAll('.cc-lasergun-rig'))
      .filter((rig) => (rig as HTMLElement).style.visibility === 'visible') as HTMLElement[];
    const frames = activeRigs.map((rig) => rig.querySelector('.cc-lasergun-frame') as HTMLImageElement);
    const paintedSequences = frames.map(() => [] as string[]);
    frames.forEach((frame, index) => {
      let currentSource = frame.src;
      Object.defineProperty(frame, 'src', {
        configurable: true,
        get: () => currentSource,
        set: (nextSource: string) => {
          currentSource = String(nextSource);
          paintedSequences[index].push(currentSource);
        },
      });
    });

    const introTween = gsap.getTweensOf(activeRigs[0])
      .find((tween) => Math.abs(tween.duration() - 0.50) < 0.001);
    const introTimeline = introTween?.parent as gsap.core.Timeline | undefined;
    expect(introTimeline).toBeDefined();
    introTimeline!.progress(1);

    expect(paintedSequences).toHaveLength(4);
    paintedSequences.forEach((sequence) => {
      expect(sequence).toEqual([...LASERGUN_FRAME_SEQUENCE.slice(1)]);
    });
    expect(Array.from(overlay.querySelectorAll('.cc-lasergun-beam'))
      .every((beam) => (beam as HTMLElement).style.opacity === '0')).toBe(true);

    cleanup();
  });

  test('shows exactly one unique gun per target with separated same-side slots', () => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now());
      return 1;
    });
    for (let count = 1; count <= LASERGUN_MAX_TARGETS; count += 1) {
      const overlay = document.createElement('div');
      document.body.appendChild(overlay);
      const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
      const targets = Array.from({ length: count }, (_, index) => ({
        x: 80 + index * 60,
        y: 180 + index * 90,
        shooter: (index % 2 === 0 ? 'left' : 'right') as 'left' | 'right',
      }));
      setActiveLaserGunFinaleTargets(targets);

      const visible = Array.from(overlay.querySelectorAll('.cc-lasergun-rig'))
        .filter((gun) => (gun as HTMLElement).style.visibility === 'visible') as HTMLElement[];
      expect(visible).toHaveLength(count);
      const assignedBeams = Array.from(overlay.querySelectorAll('.cc-lasergun-beam'))
        .filter((beam) => (beam as HTMLElement).dataset.lasergunTarget !== undefined) as HTMLElement[];
      expect(assignedBeams).toHaveLength(count);
      expect(new Set(assignedBeams.map((beam) => beam.dataset.lasergunTarget)).size).toBe(count);
      expect(new Set(visible.map((gun) => gun.dataset.lasergunTarget)).size).toBe(count);
      for (let targetIndex = 0; targetIndex < count; targetIndex += 1) {
        const targetKey = String(targetIndex);
        const gun = visible.find((candidate) => candidate.dataset.lasergunTarget === targetKey)!;
        const beam = assignedBeams.find((candidate) => candidate.dataset.lasergunTarget === targetKey)!;
        const gunSide = gun.classList.contains('cc-lasergun-rig-left') ? 'left' : 'right';
        expect(beam.classList.contains(`cc-lasergun-beam-${gunSide}`)).toBe(true);
        expect(beam.dataset.lasergunSlot).toBe(`${gunSide}-${gun.classList.contains(`cc-lasergun-rig-${gunSide}-1`) ? 1 : 0}`);
        triggerActiveLaserGunFinaleImpact(targetIndex);
      }
      expect(assignedBeams.every((beam) => beam.style.opacity === '1')).toBe(true);
      if (count === 4) {
        for (const side of ['left', 'right']) {
          const sideGuns = visible.filter((gun) => gun.classList.contains(`cc-lasergun-rig-${side}`));
          const tops = sideGuns.map((gun) => Number.parseFloat(gun.style.top)).sort((a, b) => a - b);
          expect(tops[1] - tops[0]).toBeCloseTo(200, 6);
        }
      }
      cleanup();
      overlay.remove();
    }
  });
});
