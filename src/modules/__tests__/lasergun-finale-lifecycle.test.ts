/** @jest-environment jsdom */

import animationManager from '../animation-manager';
import { gsap } from 'gsap';
import { LASERGUN_TIMING_SCALE } from '../laser-gun-impact-scheduler';
import {
  attachLaserGunFinaleScene,
  cancelActiveLaserGunFinaleImpact,
  completeActiveLaserGunFinaleImpacts,
  LASERGUN_BEAM_BRIGHTNESS_SCALE,
  LASERGUN_BEAM_COUNT,
  LASERGUN_BEAM_FADE_SECONDS,
  LASERGUN_BEAM_FADE_DELAY_SECONDS,
  LASERGUN_BEAM_GLOW_ALPHA,
  LASERGUN_BEAM_GLOW_BLUR_PX,
  LASERGUN_BEAM_LAUNCH_SCALE,
  LASERGUN_BEAM_SATURATION_SCALE,
  LASERGUN_BEAM_TRAVEL_SECONDS,
  LASERGUN_BUILDUP_START_SECONDS,
  LASERGUN_ENTRY_DURATION_SECONDS,
  LASERGUN_EXIT_DELAY_SECONDS,
  LASERGUN_EXIT_TRAVEL_SECONDS,
  LASERGUN_FRAME_STEP_SECONDS,
  LASERGUN_FRAME_SOURCES,
  LASERGUN_LEFT_BEAM_GEOMETRY,
  LASERGUN_MAX_TARGETS,
  LASERGUN_PREFIRE_SETTLE_SECONDS,
  LASERGUN_TARGET_LOCK_TOLERANCE_PX,
  prepareActiveLaserGunFinaleImpact,
  setActiveLaserGunFinaleTargets,
  triggerActiveLaserGunFinaleImpact,
  waitForActiveLaserGunFinaleImpactArrival,
} from '../lasergun-finale-scene';

describe('LaserGun finale lifecycle', () => {
  const targets = [
    { x: 80, y: 180, shooter: 'right' as const },
    { x: 310, y: 300, shooter: 'left' as const },
    { x: 100, y: 500, shooter: 'right' as const },
    { x: 300, y: 650, shooter: 'left' as const },
  ];

  const completeGunEntry = (overlay: HTMLElement, index: number): void => {
    const activeRig = overlay.querySelector(
      `.cc-lasergun-rig[data-lasergun-target="${index}"]`,
    ) as HTMLElement | null;
    expect(activeRig).not.toBeNull();
    expect(activeRig!.style.visibility).toBe('visible');
    const introTween = gsap.getTweensOf(activeRig!)
      .find((tween) => Math.abs(tween.duration() - LASERGUN_ENTRY_DURATION_SECONDS) < 0.001);
    const introTimeline = introTween?.parent as gsap.core.Timeline | undefined;
    if (!introTimeline) {
      expect(Number(gsap.getProperty(activeRig!, 'opacity'))).toBe(1);
      return;
    }
    introTimeline!.progress(1);
  };

  const installRafQueue = (): FrameRequestCallback[] => {
    const frames: FrameRequestCallback[] = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    return frames;
  };

  const flushRafQueue = (frames: FrameRequestCallback[]): void => {
    while (frames.length) frames.shift()!(performance.now());
  };

  const findNewPreflight = (
    animationsBefore: Set<gsap.core.Animation>,
  ): gsap.core.Timeline => {
    const preflight = gsap.globalTimeline.getChildren(true, true, true)
      .find((animation) => (
        !animationsBefore.has(animation)
        && animation instanceof gsap.core.Timeline
        && Math.abs(
          animation.duration() - (LASERGUN_BUILDUP_START_SECONDS + LASERGUN_PREFIRE_SETTLE_SECONDS),
        ) < 0.001
      )) as gsap.core.Timeline | undefined;
    expect(preflight).toBeDefined();
    return preflight!;
  };

  const enterAndPaint = async (
    _overlay: HTMLElement,
    frames: FrameRequestCallback[],
  ): Promise<void> => {
    const readiness = setActiveLaserGunFinaleTargets(targets);
    flushRafQueue(frames);
    await expect(readiness).resolves.toBe('painted');
  };

  const prepareShot = async (
    overlay: HTMLElement,
    frames: FrameRequestCallback[],
    index: number,
  ): Promise<void> => {
    const animationsBefore = new Set(gsap.globalTimeline.getChildren(true, true, true));
    const readiness = prepareActiveLaserGunFinaleImpact(index, targets[index]);
    const aim = overlay.querySelector(
      `.cc-lasergun-rig[data-lasergun-target="${index}"] .cc-lasergun-aim`,
    ) as HTMLElement;
    expect(gsap.getTweensOf(aim)).toHaveLength(0);
    findNewPreflight(animationsBefore).progress(1);
    completeGunEntry(overlay, index);
    await Promise.resolve();
    flushRafQueue(frames);
    await expect(readiness).resolves.toBe(true);
  };

  beforeEach(() => animationManager.killAll());
  afterEach(() => {
    animationManager.killAll();
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('renders four bounded crossfire owners and releases every owner', () => {
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const baseline = animationManager.getStats().activeTimelines;
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });

    expect(overlay.querySelectorAll('.cc-lasergun-rig')).toHaveLength(0);
    expect(overlay.querySelectorAll('.cc-lasergun-beam')).toHaveLength(0);
    void setActiveLaserGunFinaleTargets([...targets, { x: 999, y: 999, shooter: 'right' }]);
    expect(overlay.querySelectorAll('.cc-lasergun-rig')).toHaveLength(LASERGUN_MAX_TARGETS);
    expect(overlay.querySelectorAll('.cc-lasergun-frame')).toHaveLength(LASERGUN_MAX_TARGETS);
    expect(overlay.querySelectorAll('.cc-lasergun-beam')).toHaveLength(LASERGUN_BEAM_COUNT);
    expect(overlay.querySelectorAll('.cc-lasergun-beam-left')).toHaveLength(2);
    expect(overlay.querySelectorAll('.cc-lasergun-beam-right')).toHaveLength(2);
    const firstBeam = overlay.querySelector('.cc-lasergun-beam') as HTMLElement;
    expect(firstBeam.style.filter).toContain(`brightness(${LASERGUN_BEAM_BRIGHTNESS_SCALE})`);
    expect(firstBeam.style.filter).toContain(`saturate(${LASERGUN_BEAM_SATURATION_SCALE})`);
    expect(firstBeam.style.filter).toContain(`${LASERGUN_BEAM_GLOW_BLUR_PX}px`);
    expect(firstBeam.style.filter).toContain(`${LASERGUN_BEAM_GLOW_ALPHA})`);
    expect(animationManager.getStats().activeTimelines).toBe(baseline + 1);
    expect(Array.from(overlay.querySelectorAll('.cc-lasergun-rig'))
      .filter((gun) => (gun as HTMLElement).style.visibility === 'visible')).toHaveLength(0);

    cleanup();
    cleanup();
    expect(overlay.querySelector('.cc-lasergun-finale-scene')).toBeNull();
    expect(overlay.querySelector('.cc-lasergun-right-gun-layer')).toBeNull();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });

  test('dynamically supports four readable shots from one edge without spare owners', () => {
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const baseline = animationManager.getStats().activeTimelines;
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    void setActiveLaserGunFinaleTargets(targets.map((target) => ({
      ...target,
      shooter: 'left' as const,
    })));

    expect(overlay.querySelectorAll('.cc-lasergun-rig')).toHaveLength(4);
    expect(overlay.querySelectorAll('.cc-lasergun-rig-left')).toHaveLength(4);
    expect(overlay.querySelectorAll('.cc-lasergun-rig-right')).toHaveLength(0);
    expect(overlay.querySelectorAll('.cc-lasergun-beam-left')).toHaveLength(4);
    expect(overlay.querySelectorAll('.cc-lasergun-beam-right')).toHaveLength(0);

    cleanup();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });

  test('starts only gun 1, gives every later gun its own frame-1 entry and exits each gun on fire', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    const readiness = setActiveLaserGunFinaleTargets(targets);

    const leftGunAndBeamField = overlay.querySelector('.cc-lasergun-finale-scene') as HTMLElement;
    const rightGunField = overlay.querySelector('.cc-lasergun-right-gun-layer') as HTMLElement;
    expect(leftGunAndBeamField.style.zIndex).toBe('1');
    expect(rightGunField.style.zIndex).toBe('3');
    expect(overlay.querySelector('.cc-lasergun-shot-text-layer')).toBeNull();

    expect(await prepareActiveLaserGunFinaleImpact(2, targets[2])).toBe(false);
    expect(triggerActiveLaserGunFinaleImpact(2)).toBe(false);
    expect(Array.from(overlay.querySelectorAll('.cc-lasergun-beam'))
      .every((beam) => (beam as HTMLElement).style.opacity === '0')).toBe(true);

    flushRafQueue(frames);
    await expect(readiness).resolves.toBe('painted');

    const guns = Array.from(overlay.querySelectorAll('.cc-lasergun-rig')) as HTMLElement[];
    const orderedGuns = [...guns].sort(
      (a, b) => Number(a.dataset.lasergunTarget) - Number(b.dataset.lasergunTarget),
    );
    expect(orderedGuns.map((gun) => gun.style.visibility)).toEqual([
      'hidden', 'hidden', 'hidden', 'hidden',
    ]);

    for (let index = 0; index < targets.length; index += 1) {
      const gun = orderedGuns[index];
      const frame = gun.querySelector('.cc-lasergun-frame') as HTMLImageElement;
      const animationsBefore = new Set(gsap.globalTimeline.getChildren(true, true, true));
      const poseReadiness = prepareActiveLaserGunFinaleImpact(index, targets[index]);
      expect(gun.style.visibility).toBe('visible');
      expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[0].replace('./', '/'));

      const aim = gun.querySelector('.cc-lasergun-aim') as HTMLElement;
      const lockedAimRotation = Number(gsap.getProperty(aim, 'rotation'));
      const lockedRigRotation = Number(gsap.getProperty(gun, 'rotation'));
      expect(gsap.getTweensOf(aim)).toHaveLength(0);
      const preflight = findNewPreflight(animationsBefore);
      preflight.time(LASERGUN_BUILDUP_START_SECONDS, false);
      expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[1].replace('./', '/'));
      expect(Number(gsap.getProperty(aim, 'rotation'))).toBeCloseTo(lockedAimRotation, 6);
      expect(Number(gsap.getProperty(gun, 'rotation'))).toBeCloseTo(lockedRigRotation, 6);
      preflight.progress(1);
      expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[4].replace('./', '/'));
      expect(frame.src).not.toContain(LASERGUN_FRAME_SOURCES[5].replace('./', '/'));
      expect(Number(gsap.getProperty(aim, 'rotation'))).toBeCloseTo(lockedAimRotation, 6);
      expect(Number(gsap.getProperty(gun, 'rotation'))).toBeCloseTo(lockedRigRotation, 6);

      completeGunEntry(overlay, index);
      expect(Number(gsap.getProperty(aim, 'rotation'))).toBeCloseTo(lockedAimRotation, 6);
      expect(Number(gsap.getProperty(gun, 'rotation'))).toBeCloseTo(lockedRigRotation, 6);
      await Promise.resolve();
      flushRafQueue(frames);
      await expect(poseReadiness).resolves.toBe(true);
      expect(triggerActiveLaserGunFinaleImpact(index)).toBe(true);
      expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[5].replace('./', '/'));
      expect(overlay.querySelectorAll('.cc-lasergun-shot-text')).toHaveLength(0);
      expect(gsap.getTweensOf(gun).some((tween) => (
        Math.abs(tween.duration() - LASERGUN_EXIT_TRAVEL_SECONDS) < 0.001
      ))).toBe(true);
      if (index < targets.length - 1) {
        expect(orderedGuns[index + 1].style.visibility).toBe('hidden');
      }
    }
    cleanup();
  });

  test('runs gun 1 sprite build-up during its enter, then reveals its beam only from the settled muzzle', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    const sceneReadiness = setActiveLaserGunFinaleTargets(targets);
    flushRafQueue(frames);
    await expect(sceneReadiness).resolves.toBe('painted');

    const gun = overlay.querySelector('.cc-lasergun-rig[data-lasergun-target="0"]') as HTMLElement;
    const frame = gun.querySelector('.cc-lasergun-frame') as HTMLImageElement;
    const beam = overlay.querySelector('.cc-lasergun-beam[data-lasergun-target="0"]') as HTMLElement;
    let poseSettled = false;
    const animationsBefore = new Set(gsap.globalTimeline.getChildren(true, true, true));
    const poseReadiness = prepareActiveLaserGunFinaleImpact(0, targets[0]).then((ready) => {
      poseSettled = ready;
      return ready;
    });
    const entryTween = gsap.getTweensOf(gun)
      .find((tween) => Math.abs(tween.duration() - LASERGUN_ENTRY_DURATION_SECONDS) < 0.001)!;
    const introTimeline = entryTween.parent as gsap.core.Timeline;
    introTimeline.time(0.32 * LASERGUN_TIMING_SCALE, false);
    expect(Number(gsap.getProperty(gun, 'opacity'))).toBeGreaterThan(0);
    expect(Number(gsap.getProperty(gun, 'opacity'))).toBeLessThan(1.2);

    const aim = gun.querySelector('.cc-lasergun-aim') as HTMLElement;
    expect(gsap.getTweensOf(aim)).toHaveLength(0);
    findNewPreflight(animationsBefore).progress(1);
    expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[4].replace('./', '/'));
    expect(beam.style.opacity).toBe('0');
    expect(poseSettled).toBe(false);

    introTimeline.time(LASERGUN_ENTRY_DURATION_SECONDS, false);
    await Promise.resolve();
    flushRafQueue(frames);
    await expect(poseReadiness).resolves.toBe(true);
    expect(triggerActiveLaserGunFinaleImpact(0)).toBe(true);
    expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[5].replace('./', '/'));
    expect(beam.style.opacity).toBe('1');
    cleanup();
  });

  test('travels monotonically from the muzzle and resolves impact only when the tip reaches the cube', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    await enterAndPaint(overlay, frames);
    await prepareShot(overlay, frames, 0);

    const beam = overlay.querySelector(
      '.cc-lasergun-beam[data-lasergun-target="0"]',
    ) as HTMLElement;
    const scaleLayer = beam.closest('.cc-lasergun-beam-scale') as HTMLElement;
    const finalScaleX = Number(gsap.getProperty(scaleLayer, 'scaleX'));
    const animationsBeforeCommit = new Set(gsap.globalTimeline.getChildren(true, true, true));

    expect(triggerActiveLaserGunFinaleImpact(0)).toBe(true);
    const arrival = waitForActiveLaserGunFinaleImpactArrival(0);
    expect(Number(gsap.getProperty(scaleLayer, 'scaleX'))).toBeCloseTo(
      finalScaleX * LASERGUN_BEAM_LAUNCH_SCALE,
      3,
    );
    expect(beam.style.opacity).toBe('1');

    const beamTimeline = gsap.globalTimeline.getChildren(true, true, true)
      .find((animation) => (
        !animationsBeforeCommit.has(animation)
        && animation instanceof gsap.core.Timeline
        && Math.abs(
          animation.duration() - (
            LASERGUN_BEAM_TRAVEL_SECONDS
            + LASERGUN_BEAM_FADE_DELAY_SECONDS
            + LASERGUN_BEAM_FADE_SECONDS
          ),
        ) < 0.001
      )) as gsap.core.Timeline | undefined;
    expect(beamTimeline).toBeDefined();
    const travelTween = gsap.getTweensOf(scaleLayer)
      .find((tween) => Math.abs(tween.duration() - LASERGUN_BEAM_TRAVEL_SECONDS) < 0.001);
    expect(travelTween?.vars.ease).toBe('power2.out');

    beamTimeline!.time(LASERGUN_BEAM_TRAVEL_SECONDS * 0.5, false);
    const halfScaleX = Number(gsap.getProperty(scaleLayer, 'scaleX'));
    expect(halfScaleX).toBeGreaterThan(finalScaleX * LASERGUN_BEAM_LAUNCH_SCALE);
    expect(halfScaleX).toBeLessThan(finalScaleX);

    beamTimeline!.time(LASERGUN_BEAM_TRAVEL_SECONDS + 0.001, false);
    expect(Number(gsap.getProperty(scaleLayer, 'scaleX'))).toBeCloseTo(finalScaleX, 6);
    expect(beam.style.opacity).toBe('1');
    let arrivalSettled = false;
    void arrival.then(() => { arrivalSettled = true; });
    await Promise.resolve();
    expect(arrivalSettled).toBe(false);
    expect(frames).toHaveLength(1);
    frames.shift()!(performance.now());
    await Promise.resolve();
    expect(arrivalSettled).toBe(false);
    expect(frames).toHaveLength(1);
    frames.shift()!(performance.now());
    await expect(arrival).resolves.toBe(true);
    expect(arrivalSettled).toBe(true);
    expect(Number(gsap.getProperty(scaleLayer, 'scaleX'))).toBeCloseTo(finalScaleX, 6);

    beamTimeline!.progress(1, false);
    expect(Number(gsap.getProperty(beam, 'opacity'))).toBeCloseTo(0, 6);
    cleanup();
  });

  test('atomically hides a stalled beam and prevents a late arrival callback', async () => {
    const frames = installRafQueue();
    const cancelRafSpy = jest.spyOn(window, 'cancelAnimationFrame');
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    await enterAndPaint(overlay, frames);
    await prepareShot(overlay, frames, 0);

    const animationsBeforeCommit = new Set(gsap.globalTimeline.getChildren(true, true, true));
    expect(triggerActiveLaserGunFinaleImpact(0)).toBe(true);
    const arrival = waitForActiveLaserGunFinaleImpactArrival(0);
    const beam = overlay.querySelector(
      '.cc-lasergun-beam[data-lasergun-target="0"]',
    ) as HTMLElement;
    expect(beam.style.opacity).toBe('1');
    const beamTimeline = gsap.globalTimeline.getChildren(true, true, true)
      .find((animation) => (
        !animationsBeforeCommit.has(animation)
        && animation instanceof gsap.core.Timeline
        && Math.abs(
          animation.duration() - (
            LASERGUN_BEAM_TRAVEL_SECONDS
            + LASERGUN_BEAM_FADE_DELAY_SECONDS
            + LASERGUN_BEAM_FADE_SECONDS
          ),
        ) < 0.001
      )) as gsap.core.Timeline | undefined;
    expect(beamTimeline).toBeDefined();
    beamTimeline!.time(LASERGUN_BEAM_TRAVEL_SECONDS + 0.001, false);
    expect(frames).toHaveLength(1);

    cancelActiveLaserGunFinaleImpact(0);

    await expect(arrival).resolves.toBe(false);
    expect(cancelRafSpy).toHaveBeenCalledWith(1);
    frames.shift()!(performance.now());
    expect(frames).toHaveLength(0);
    expect(Number(gsap.getProperty(beam, 'opacity'))).toBe(0);
    expect(gsap.getTweensOf(beam)).toHaveLength(0);
    cleanup();
  });

  test('keeps all four angles locked while each firing sprite returns 6 to 1', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    await enterAndPaint(overlay, frames);

    for (let index = 0; index < targets.length; index += 1) {
      await prepareShot(overlay, frames, index);
      const beam = overlay.querySelector(
        `.cc-lasergun-beam[data-lasergun-target="${index}"]`,
      ) as HTMLElement;
      const gun = overlay.querySelector(
        `.cc-lasergun-rig[data-lasergun-target="${index}"]`,
      ) as HTMLElement;
      const aim = gun.querySelector('.cc-lasergun-aim') as HTMLElement;
      const frame = gun.querySelector('.cc-lasergun-frame') as HTMLImageElement;
      const uncommittedBeams = Array.from(overlay.querySelectorAll('.cc-lasergun-beam'))
        .filter((candidate) => Number((candidate as HTMLElement).dataset.lasergunTarget) > index);

      expect(beam.style.opacity).toBe('0');
      expect(uncommittedBeams.every((candidate) => (candidate as HTMLElement).style.opacity === '0')).toBe(true);
      const aimedRotation = Number(gsap.getProperty(aim, 'rotation'));
      const aimedRigX = Number(gsap.getProperty(gun, 'x'));
      const aimedRigRotation = Number(gsap.getProperty(gun, 'rotation'));
      const aimedRigY = Number(gsap.getProperty(gun, 'y'));
      const aimedRigScaleX = Number(gsap.getProperty(gun, 'scaleX'));
      const aimedRigScaleY = Number(gsap.getProperty(gun, 'scaleY'));
      const animationsBeforeCommit = new Set(
        gsap.globalTimeline.getChildren(true, true, true),
      );
      expect(triggerActiveLaserGunFinaleImpact(index)).toBe(true);
      expect(beam.style.opacity).toBe('1');
      expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[5].replace('./', '/'));
      const firedImageScaleX = Number(gsap.getProperty(frame, 'scaleX'));
      const firedImageScaleY = Number(gsap.getProperty(frame, 'scaleY'));
      const firedImageRotation = Number(gsap.getProperty(frame, 'rotation'));
      expect(triggerActiveLaserGunFinaleImpact(index)).toBe(false);
      expect(uncommittedBeams.every((candidate) => (candidate as HTMLElement).style.opacity === '0')).toBe(true);

      expect(gsap.getTweensOf(aim)).toHaveLength(0);
      expect(gsap.getTweensOf(frame)).toHaveLength(0);
      const returnFramesTimeline = gsap.globalTimeline.getChildren(true, true, true)
        .find((animation) => (
          !animationsBeforeCommit.has(animation)
          && animation instanceof gsap.core.Timeline
          && Math.abs(animation.duration() - 5 * LASERGUN_FRAME_STEP_SECONDS) < 0.001
        )) as gsap.core.Timeline | undefined;
      expect(returnFramesTimeline).toBeDefined();
      LASERGUN_FRAME_SOURCES.slice(0, 5).reverse().forEach((source, frameIndex) => {
        returnFramesTimeline!.time((frameIndex + 1) * LASERGUN_FRAME_STEP_SECONDS + 0.0001, false);
        expect(frame.src).toContain(source.replace('./', '/'));
        expect(Number(gsap.getProperty(aim, 'rotation'))).toBeCloseTo(aimedRotation, 6);
        expect(Number(gsap.getProperty(gun, 'rotation'))).toBeCloseTo(aimedRigRotation, 6);
      });
      expect(gsap.getTweensOf(gun).some((tween) => (
        Math.abs(tween.duration() - LASERGUN_EXIT_TRAVEL_SECONDS) < 0.001
      ))).toBe(true);
      const exitTravelTween = gsap.getTweensOf(gun)
        .find((tween) => Math.abs(tween.duration() - LASERGUN_EXIT_TRAVEL_SECONDS) < 0.001)!;
      const exitTimeline = exitTravelTween.parent as gsap.core.Timeline;
      exitTimeline.time(LASERGUN_EXIT_DELAY_SECONDS * 0.75, false);
      expect(Number(gsap.getProperty(aim, 'rotation'))).toBeCloseTo(aimedRotation, 6);
      expect(Number(gsap.getProperty(gun, 'x'))).toBeCloseTo(aimedRigX, 6);
      expect(Number(gsap.getProperty(gun, 'rotation'))).toBeCloseTo(aimedRigRotation, 6);
      expect(Number(gsap.getProperty(gun, 'y'))).toBeCloseTo(aimedRigY, 6);
      expect(Number(gsap.getProperty(gun, 'scaleX'))).toBeCloseTo(aimedRigScaleX, 6);
      expect(Number(gsap.getProperty(gun, 'scaleY'))).toBeCloseTo(aimedRigScaleY, 6);
      expect(Number(gsap.getProperty(frame, 'scaleX'))).toBeCloseTo(firedImageScaleX, 6);
      expect(Number(gsap.getProperty(frame, 'scaleY'))).toBeCloseTo(firedImageScaleY, 6);
      expect(Number(gsap.getProperty(frame, 'rotation'))).toBeCloseTo(firedImageRotation, 6);
      expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[0].replace('./', '/'));
      expect(beam.style.opacity).toBe('1');
      expect(Number(gsap.getProperty(gun, 'opacity'))).toBe(1);

      exitTimeline.time(
        LASERGUN_EXIT_DELAY_SECONDS + LASERGUN_EXIT_TRAVEL_SECONDS * 0.5,
        false,
      );
      const midExitX = Number(gsap.getProperty(gun, 'x'));
      expect(midExitX).not.toBeCloseTo(aimedRigX, 3);
      if (gun.classList.contains('cc-lasergun-rig-left')) {
        expect(midExitX).toBeLessThan(aimedRigX);
      } else {
        expect(midExitX).toBeGreaterThan(aimedRigX);
      }
      expect(Number(gsap.getProperty(aim, 'rotation'))).toBeCloseTo(aimedRotation, 6);
      expect(Number(gsap.getProperty(gun, 'rotation'))).toBeCloseTo(aimedRigRotation, 6);
      expect(Number(gsap.getProperty(gun, 'y'))).toBeCloseTo(aimedRigY, 6);
      expect(Number(gsap.getProperty(gun, 'scaleX'))).toBeCloseTo(aimedRigScaleX, 6);
      expect(Number(gsap.getProperty(gun, 'scaleY'))).toBeCloseTo(aimedRigScaleY, 6);
      expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[0].replace('./', '/'));
      exitTimeline.progress(1, false);
      expect(gun.style.visibility).toBe('hidden');
      expect(Number(gsap.getProperty(aim, 'rotation'))).toBeCloseTo(aimedRotation, 6);
      expect(Number(gsap.getProperty(gun, 'rotation'))).toBeCloseTo(aimedRigRotation, 6);
      expect(frame.src).toContain(LASERGUN_FRAME_SOURCES[0].replace('./', '/'));
    }

    completeActiveLaserGunFinaleImpacts();
    const lastBeam = overlay.querySelector('.cc-lasergun-beam[data-lasergun-target="3"]') as HTMLElement;
    const fadeTween = gsap.getTweensOf(lastBeam)
      .find((tween) => Math.abs(tween.duration() - LASERGUN_BEAM_FADE_SECONDS) < 0.001);
    expect(fadeTween).toBeDefined();
    expect(Array.from(overlay.querySelectorAll('.cc-lasergun-rig')).every(
      (candidate) => (candidate as HTMLElement).style.visibility === 'hidden',
    )).toBe(true);
    cleanup();
  });

  test('rejects a late relative target drift without changing the locked aim or revealing a beam', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    await enterAndPaint(overlay, frames);
    await prepareShot(overlay, frames, 0);

    const liveTarget = { x: 300, y: 120 };
    const aim = overlay.querySelector('.cc-lasergun-rig[data-lasergun-target="0"] .cc-lasergun-aim') as HTMLElement;
    const transformBeforeValidation = aim.style.transform;
    const readiness = prepareActiveLaserGunFinaleImpact(0, liveTarget);
    expect(gsap.getTweensOf(aim)).toHaveLength(0);
    await expect(readiness).resolves.toBe(false);
    expect(aim.style.transform).toBe(transformBeforeValidation);

    const beam = overlay.querySelector('.cc-lasergun-beam[data-lasergun-target="0"]') as HTMLElement;
    expect(Number(gsap.getProperty(beam, 'opacity'))).toBe(0);
    expect(Math.hypot(
      liveTarget.x - targets[0].x,
      liveTarget.y - targets[0].y,
    )).toBeGreaterThan(LASERGUN_TARGET_LOCK_TOLERANCE_PX);
    cleanup();
  });

  test('relocks a later hidden relay gun instead of retiring shots two through four', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    await enterAndPaint(overlay, frames);

    const shiftedTarget = {
      x: targets[1].x + 24,
      y: targets[1].y - 18,
    };
    const gun = overlay.querySelector(
      '.cc-lasergun-rig[data-lasergun-target="1"]',
    ) as HTMLElement;
    expect(gun.style.visibility).toBe('hidden');

    const animationsBefore = new Set(gsap.globalTimeline.getChildren(true, true, true));
    const readiness = prepareActiveLaserGunFinaleImpact(1, shiftedTarget);
    expect(gun.style.visibility).toBe('visible');
    findNewPreflight(animationsBefore).progress(1);
    completeGunEntry(overlay, 1);
    await Promise.resolve();
    flushRafQueue(frames);
    await expect(readiness).resolves.toBe(true);
    expect(triggerActiveLaserGunFinaleImpact(1)).toBe(true);
    const beam = overlay.querySelector(
      '.cc-lasergun-beam[data-lasergun-target="1"]',
    ) as HTMLElement;
    expect(Number(gsap.getProperty(beam, 'opacity'))).toBe(1);
    cleanup();
  });

  test('cancels a shared parent shake exactly once when resolving the live barrel origin', async () => {
    const frames = installRafQueue();
    let sharedShakeX = 30;
    const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
      x: left,
      y: top,
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect);
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect() {
      if (this.classList.contains('cc-lasergun-finale-scene')) {
        return rect(sharedShakeX, 0, 390, 844);
      }
      if (this.classList.contains('cc-lasergun-rig')) {
        return rect(sharedShakeX, 0, 200, 183);
      }
      if (this.classList.contains('cc-lasergun-barrel-marker')) {
        return rect(sharedShakeX + 50, 100, 1, 1);
      }
      if (this.classList.contains('cc-lasergun-axis-marker')) {
        return rect(sharedShakeX + 10, 100, 1, 1);
      }
      return rect(0, 0, 0, 0);
    });

    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    const target = { x: sharedShakeX + 200.5, y: 100.5, shooter: 'left' as const };
    const sceneReadiness = setActiveLaserGunFinaleTargets([target]);
    flushRafQueue(frames);
    await expect(sceneReadiness).resolves.toBe('painted');

    sharedShakeX = 50;
    const animationsBefore = new Set(gsap.globalTimeline.getChildren(true, true, true));
    const poseReadiness = prepareActiveLaserGunFinaleImpact(0, {
      x: sharedShakeX + 200.5,
      y: 100.5,
    });
    findNewPreflight(animationsBefore).progress(1);
    completeGunEntry(overlay, 0);
    await Promise.resolve();
    flushRafQueue(frames);
    await expect(poseReadiness).resolves.toBe(true);

    const beam = overlay.querySelector('.cc-lasergun-beam[data-lasergun-target="0"]') as HTMLElement;
    const beamRig = beam.closest('.cc-lasergun-beam-rig') as HTMLElement;
    expect(Number(gsap.getProperty(beamRig, 'x'))).toBeCloseTo(50.5, 6);
    cleanup();
  });

  test('freezes the target in the live field space when shake starts after attachment', async () => {
    const frames = installRafQueue();
    let sharedShakeX = 0;
    const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
      x: left,
      y: top,
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect);
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect() {
      if (this.classList.contains('cc-lasergun-finale-scene')) {
        return rect(sharedShakeX, 0, 390, 844);
      }
      if (this.classList.contains('cc-lasergun-rig')) {
        return rect(sharedShakeX, 0, 200, 183);
      }
      if (this.classList.contains('cc-lasergun-barrel-marker')) {
        return rect(sharedShakeX + 50, 100, 1, 1);
      }
      if (this.classList.contains('cc-lasergun-axis-marker')) {
        return rect(sharedShakeX + 10, 100, 1, 1);
      }
      return rect(0, 0, 0, 0);
    });

    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });

    // The scene attached at x=0; the shared TNT shake begins before targets
    // arrive. Both the absolute target and field now include the same -40px.
    sharedShakeX = -40;
    const localTarget = { x: 300.5, y: 100.5 };
    const sceneReadiness = setActiveLaserGunFinaleTargets([{
      x: sharedShakeX + localTarget.x,
      y: localTarget.y,
      shooter: 'left',
    }]);
    flushRafQueue(frames);
    await expect(sceneReadiness).resolves.toBe('painted');

    sharedShakeX = 0;
    const animationsBefore = new Set(gsap.globalTimeline.getChildren(true, true, true));
    const poseReadiness = prepareActiveLaserGunFinaleImpact(0, localTarget);
    findNewPreflight(animationsBefore).progress(1);
    completeGunEntry(overlay, 0);
    await Promise.resolve();
    flushRafQueue(frames);
    await expect(poseReadiness).resolves.toBe(true);

    const beam = overlay.querySelector('.cc-lasergun-beam[data-lasergun-target="0"]') as HTMLElement;
    const beamRig = beam.closest('.cc-lasergun-beam-rig') as HTMLElement;
    const scaleLayer = beam.closest('.cc-lasergun-beam-scale') as HTMLElement;
    const barrelX = Number(gsap.getProperty(beamRig, 'x'));
    const barrelY = Number(gsap.getProperty(beamRig, 'y'));
    const rotation = Number(gsap.getProperty(beamRig, 'rotation')) * Math.PI / 180;
    const baselineLength = Math.hypot(
      LASERGUN_LEFT_BEAM_GEOMETRY.impactX - LASERGUN_LEFT_BEAM_GEOMETRY.sourceX,
      LASERGUN_LEFT_BEAM_GEOMETRY.impactY - LASERGUN_LEFT_BEAM_GEOMETRY.sourceY,
    );
    const finalScaleX = Number(gsap.getProperty(scaleLayer, 'scaleX'));
    const renderedImpact = {
      x: barrelX + baselineLength * finalScaleX * Math.cos(rotation),
      y: barrelY + baselineLength * finalScaleX * Math.sin(rotation),
    };
    expect(Math.hypot(
      renderedImpact.x - localTarget.x,
      renderedImpact.y - localTarget.y,
    )).toBeLessThanOrEqual(0.05);
    cleanup();
  });

  test('resolves interrupted entry as cancelled without stale paint', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    const readiness = setActiveLaserGunFinaleTargets(targets);
    flushRafQueue(frames);
    await expect(readiness).resolves.toBe('painted');
    const poseReadiness = prepareActiveLaserGunFinaleImpact(0, targets[0]);
    cleanup();

    await expect(poseReadiness).resolves.toBe(false);
    expect(frames).toHaveLength(0);
    expect(overlay.querySelector('.cc-lasergun-finale-scene')).toBeNull();
    expect(overlay.querySelector('.cc-lasergun-right-gun-layer')).toBeNull();
  });

  test('resolves interrupted per-gun pose preparation instead of stranding the shot chain', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    await enterAndPaint(overlay, frames);
    const poseReadiness = prepareActiveLaserGunFinaleImpact(0, targets[0]);

    cleanup();

    await expect(poseReadiness).resolves.toBe(false);
    expect(frames).toHaveLength(0);
  });

  test('kills an active straight exit on interrupted scene cleanup', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const baseline = animationManager.getStats().activeTimelines;
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    await enterAndPaint(overlay, frames);
    await prepareShot(overlay, frames, 0);

    expect(triggerActiveLaserGunFinaleImpact(0)).toBe(true);
    const frame = overlay.querySelector(
      '.cc-lasergun-rig[data-lasergun-target="0"] .cc-lasergun-frame',
    ) as HTMLImageElement;
    const aim = frame.closest('.cc-lasergun-rig')!.querySelector('.cc-lasergun-aim') as HTMLElement;
    expect(gsap.getTweensOf(frame)).toHaveLength(0);
    expect(gsap.getTweensOf(aim)).toHaveLength(0);
    expect(gsap.getTweensOf(frame.closest('.cc-lasergun-rig')).some((tween) => (
      Math.abs(tween.duration() - LASERGUN_EXIT_TRAVEL_SECONDS) < 0.001
    ))).toBe(true);

    cleanup();

    expect(animationManager.getStats().activeTimelines).toBe(baseline);
    expect(frame.isConnected).toBe(false);
  });

  test('shows one unique gun per target with separated same-side slots', async () => {
    const frames = installRafQueue();
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.5 });
    await enterAndPaint(overlay, frames);

    const assigned = Array.from(overlay.querySelectorAll('.cc-lasergun-rig'))
      .filter((gun) => (gun as HTMLElement).dataset.lasergunTarget !== undefined) as HTMLElement[];
    const visible = assigned.filter((gun) => gun.style.visibility === 'visible');
    const assignedBeams = Array.from(overlay.querySelectorAll('.cc-lasergun-beam'))
      .filter((beam) => (beam as HTMLElement).dataset.lasergunTarget !== undefined) as HTMLElement[];
    expect(assigned).toHaveLength(4);
    expect(visible).toHaveLength(0);
    expect(assignedBeams).toHaveLength(4);
    expect(new Set(assigned.map((gun) => gun.dataset.lasergunTarget)).size).toBe(4);
    expect(new Set(assignedBeams.map((beam) => beam.dataset.lasergunTarget)).size).toBe(4);
    for (const side of ['left', 'right']) {
      const sideGuns = assigned.filter((gun) => gun.classList.contains(`cc-lasergun-rig-${side}`));
      const tops = sideGuns.map((gun) => Number.parseFloat(gun.style.top)).sort((a, b) => a - b);
      expect(tops[1] - tops[0]).toBeCloseTo(200, 6);
    }
    const leftAnchors = assigned
      .filter((gun) => gun.classList.contains('cc-lasergun-rig-left'))
      .map((gun) => Number.parseFloat(gun.style.left));
    const rightAnchors = assigned
      .filter((gun) => gun.classList.contains('cc-lasergun-rig-right'))
      .map((gun) => Number.parseFloat(gun.style.left));
    // Rig centres now sit on the physical edge. Only each gun's muzzle enters
    // far enough to read, instead of parking the full sprite at 14%/86%.
    expect(leftAnchors.every((anchor) => anchor >= 0 && anchor <= 24)).toBe(true);
    expect(rightAnchors.every((anchor) => (
      anchor >= window.innerWidth - 27 && anchor <= window.innerWidth
    ))).toBe(true);
    expect((overlay.querySelector('.cc-lasergun-finale-scene') as HTMLElement).style.overflow).toBe('visible');
    expect((overlay.querySelector('.cc-lasergun-right-gun-layer') as HTMLElement).style.overflow).toBe('visible');
    cleanup();
  });

  test('stays bounded through repeated interrupted finales', () => {
    const baseline = animationManager.getStats().activeTimelines;
    for (let run = 0; run < 20; run += 1) {
      const overlay = document.createElement('div');
      document.body.appendChild(overlay);
      const cleanup = attachLaserGunFinaleScene(overlay, { random: () => 0.25 });
      void setActiveLaserGunFinaleTargets([{ x: 180, y: 420, shooter: 'right' }]);
      cleanup();
      overlay.remove();
      expect(animationManager.getStats().activeTimelines).toBe(baseline);
    }
  });
});
