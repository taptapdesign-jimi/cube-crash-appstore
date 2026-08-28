import { gsap } from 'gsap';
import animationManager from '../animation-manager.js';
import {
  attachSpaceshipFinaleScene,
  getSpaceshipDebrisMotion,
  SPACESHIP_BEAM_DISCONNECT_AT_SECONDS,
  SPACESHIP_BEAM_EXIT_ALTERNATING_STATES,
  SPACESHIP_BEAM_EXIT_FADE_DURATION,
  SPACESHIP_BEAM_EXIT_FLASH_DURATION,
  SPACESHIP_BEAM_EXIT_FLASH_STARTS,
  SPACESHIP_BEAM_HIDDEN_AT_SECONDS,
  SPACESHIP_DEBRIS_HIDE_DELAY_SECONDS,
  SPACESHIP_PULL_PLAN,
  SPACESHIP_SAUCER_EXIT_AT_SECONDS,
  SPACESHIP_SAUCER_FRAME_COUNT,
  SPACESHIP_SAUCER_FRAME_START_AT_SECONDS,
  SPACESHIP_SAUCER_FRAME_STEP_SECONDS,
  SPACESHIP_SCENE_SECONDS,
} from '../spaceship-finale-scene.js';

const rect = (left: number, top: number, width = 0, height = 0): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON: () => ({}),
} as DOMRect);

describe('Spaceship finale rendered lifecycle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as any).__ccSpaceshipSuctionTrace;
  });

  test('pulls the below-screen reference formation continuously into the live intake, then cleans every owner', () => {
    const viewportWidth = 390;
    const viewportHeight = 844;
    const nativeSetAttribute = Element.prototype.setAttribute;
    jest.spyOn(Element.prototype, 'setAttribute').mockImplementation(function rejectInvalidWebKitAttribute(name, value) {
      if (name.includes(',')) throw new DOMException(`Invalid qualified name: '${name}'`, 'InvalidCharacterError');
      return nativeSetAttribute.call(this, name, value);
    });
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect() {
      const element = this as HTMLElement;
      if (element.classList.contains('cc-spaceship-finale-scene')) {
        return rect(0, 0, viewportWidth, viewportHeight);
      }
      if (element.classList.contains('cc-spaceship-intake-marker')) {
        const rig = element.parentElement;
        const rigX = rig ? Number(gsap.getProperty(rig, 'x')) || 0 : 0;
        const markerPercent = Number.parseFloat(element.style.left) || 50;
        return rect(195 + (markerPercent - 50) * 2.97 + rigX, 178, 1, 1);
      }
      if (element.classList.contains('cc-spaceship-finale-debris-mover')) {
        const left = element.style.left.endsWith('%')
          ? Number.parseFloat(element.style.left) * viewportWidth / 100
          : Number.parseFloat(element.style.left) || 0;
        const top = element.style.top.endsWith('%')
          ? Number.parseFloat(element.style.top) * viewportHeight / 100
          : Number.parseFloat(element.style.top) || 0;
        const size = Number.parseFloat(element.style.width) || 0;
        return rect(left - size / 2, top - size / 2, size, size);
      }
      return rect(0, 0);
    });

    const tracked: gsap.core.Timeline[] = [];
    const track = animationManager.trackExternalTimeline.bind(animationManager);
    jest.spyOn(animationManager, 'trackExternalTimeline').mockImplementation((timeline) => {
      tracked.push(timeline);
      return track(timeline);
    });
    const baseline = animationManager.getStats().activeTimelines;
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);

    const cleanup = attachSpaceshipFinaleScene(overlay, { exitRandom: () => 0 });
    tracked.forEach((timeline) => timeline.pause(0));
    const movers = Array.from(overlay.querySelectorAll<HTMLElement>('.cc-spaceship-finale-debris-mover'));

    expect(movers).toHaveLength(25);
    expect(tracked).toHaveLength(2);
    const fakeDice = Array.from(overlay.querySelectorAll<HTMLElement>('.cc-spaceship-finale-fake-die'));
    expect(fakeDice.map(({ dataset }) => Number(dataset.spaceshipDieValue))).toEqual([3, 2, 4, 1, 2, 5, 4, 3]);
    expect(overlay.querySelectorAll('.cc-spaceship-finale-fake-die-pip')).toHaveLength(24);
    const beams = Array.from(overlay.querySelectorAll<HTMLElement>('.cc-spaceship-finale-beam'));
    SPACESHIP_BEAM_EXIT_ALTERNATING_STATES.forEach(([leftOpacity, rightOpacity], index) => {
      const duration = index === SPACESHIP_BEAM_EXIT_ALTERNATING_STATES.length - 1
        ? SPACESHIP_BEAM_EXIT_FADE_DURATION
        : SPACESHIP_BEAM_EXIT_FLASH_DURATION;
      tracked[1].seek(SPACESHIP_BEAM_EXIT_FLASH_STARTS[index] + duration);
      expect(Number(gsap.getProperty(beams[0], 'opacity'))).toBeCloseTo(leftOpacity, 2);
      expect(Number(gsap.getProperty(beams[1], 'opacity'))).toBeCloseTo(rightOpacity, 2);
    });
    const beamRig = overlay.querySelector<HTMLElement>('.cc-spaceship-finale-beam-rig');
    const saucerRig = overlay.querySelector<HTMLElement>('.cc-spaceship-finale-saucer-rig');
    const saucer = overlay.querySelector<HTMLImageElement>('.cc-spaceship-finale-saucer');
    expect(overlay.querySelectorAll('.cc-spaceship-finale-saucer')).toHaveLength(1);
    tracked[0].seek(SPACESHIP_SAUCER_EXIT_AT_SECONDS - 0.001, false);
    expect(beamRig!.isConnected).toBe(true);
    expect(saucerRig!.isConnected).toBe(true);
    expect(Number(gsap.getProperty(saucerRig!, 'opacity'))).toBe(1);
    tracked[0].seek(SPACESHIP_SAUCER_EXIT_AT_SECONDS + 0.10, false);
    expect(Number(gsap.getProperty(saucerRig!, 'x'))).toBeLessThan(0);
    expect(Number(gsap.getProperty(saucerRig!, 'rotation'))).toBeLessThan(0);
    tracked[0].seek(SPACESHIP_BEAM_DISCONNECT_AT_SECONDS - 0.001, false);
    expect(Number(gsap.getProperty(saucerRig!, 'x'))).toBeLessThan(0);
    expect(Math.abs(Number(gsap.getProperty(saucerRig!, 'rotation')))).toBeLessThan(20);
    tracked[1].seek(SPACESHIP_BEAM_HIDDEN_AT_SECONDS, false);
    beams.forEach((beam) => {
      expect(Number(gsap.getProperty(beam, 'opacity'))).toBe(0);
      expect(gsap.getProperty(beam, 'visibility')).toBe('hidden');
    });
    expect(gsap.getProperty(beamRig!, 'opacity')).toBe(0);
    expect(gsap.getProperty(beamRig!, 'visibility')).toBe('hidden');
    expect(gsap.getProperty(beamRig!, 'display')).toBe('none');
    tracked[0].seek(SPACESHIP_BEAM_DISCONNECT_AT_SECONDS - 0.001, false);
    expect(beamRig!.isConnected).toBe(true);
    const beforeDetachPose = {
      x: Number(gsap.getProperty(saucerRig!, 'x')),
      y: Number(gsap.getProperty(saucerRig!, 'y')),
      rotation: Number(gsap.getProperty(saucerRig!, 'rotation')),
    };
    tracked[0].seek(SPACESHIP_BEAM_DISCONNECT_AT_SECONDS, false);
    expect(beamRig!.isConnected).toBe(false);
    expect(overlay.querySelector('.cc-spaceship-finale-beam-rig')).toBeNull();
    expect(saucerRig!.isConnected).toBe(true);
    beams.forEach((beam) => {
      expect(Number(gsap.getProperty(beam, 'opacity'))).toBe(0);
      expect(gsap.getProperty(beam, 'visibility')).toBe('hidden');
    });
    expect(beamRig!.isConnected).toBe(false);
    expect(saucerRig!.isConnected).toBe(true);
    expect(Number(gsap.getProperty(saucerRig!, 'opacity'))).toBe(1);
    expect(gsap.getProperty(saucerRig!, 'visibility')).not.toBe('hidden');
    const atDetachPose = {
      x: Number(gsap.getProperty(saucerRig!, 'x')),
      y: Number(gsap.getProperty(saucerRig!, 'y')),
      rotation: Number(gsap.getProperty(saucerRig!, 'rotation')),
    };
    expect(Math.hypot(atDetachPose.x - beforeDetachPose.x, atDetachPose.y - beforeDetachPose.y)).toBeLessThan(2);
    expect(Math.abs(atDetachPose.rotation - beforeDetachPose.rotation)).toBeLessThan(1);
    tracked[0].seek(SPACESHIP_BEAM_DISCONNECT_AT_SECONDS + 0.001, false);
    const afterDetachDistance = Math.hypot(
      Number(gsap.getProperty(saucerRig!, 'x')) - atDetachPose.x,
      Number(gsap.getProperty(saucerRig!, 'y')) - atDetachPose.y,
    );
    expect(afterDetachDistance).toBeLessThan(2);
    tracked[0].seek(SPACESHIP_BEAM_DISCONNECT_AT_SECONDS + 0.40, false);
    expect(Number(gsap.getProperty(saucerRig!, 'y'))).toBeLessThan(0);
    expect(Number(gsap.getProperty(saucerRig!, 'x'))).toBeLessThan(0);
    const penultimateFrameAt = SPACESHIP_SAUCER_FRAME_START_AT_SECONDS
      + (SPACESHIP_SAUCER_FRAME_COUNT - 2) * SPACESHIP_SAUCER_FRAME_STEP_SECONDS;
    const finalFrameAt = SPACESHIP_SAUCER_FRAME_START_AT_SECONDS
      + (SPACESHIP_SAUCER_FRAME_COUNT - 1) * SPACESHIP_SAUCER_FRAME_STEP_SECONDS;
    expect(penultimateFrameAt).toBeGreaterThan(SPACESHIP_SAUCER_EXIT_AT_SECONDS);
    expect(finalFrameAt).toBeLessThanOrEqual(SPACESHIP_SCENE_SECONDS);
    expect(SPACESHIP_SCENE_SECONDS - finalFrameAt).toBeLessThan(SPACESHIP_SAUCER_FRAME_STEP_SECONDS);
    tracked[0].seek(penultimateFrameAt + 0.001, false);
    const penultimateExitSource = saucer!.getAttribute('src');
    tracked[0].seek(finalFrameAt + 0.001, false);
    expect(saucer!.getAttribute('src')).not.toBe(penultimateExitSource);
    tracked[0].seek(SPACESHIP_SCENE_SECONDS - 0.001, false);
    expect(Number(gsap.getProperty(saucerRig!, 'y'))).toBeLessThan(-400);
    expect(Number(gsap.getProperty(saucerRig!, 'opacity'))).toBe(1);
    const tracePhases = (window as any).__ccSpaceshipSuctionTrace
      .map(({ phase }: { phase: string }) => phase);
    expect(tracePhases).toContain('beam-off');
    expect(tracePhases.indexOf('saucer-exit-motion')).toBeLessThan(tracePhases.indexOf('beam-disconnected'));
    expect(tracePhases.indexOf('saucer-exit-start')).toBeLessThan(tracePhases.indexOf('beam-disconnected'));
    expect(overlay.querySelectorAll('.cc-spaceship-finale-scene')).toHaveLength(1);
    expect(SPACESHIP_BEAM_HIDDEN_AT_SECONDS).toBeGreaterThan(SPACESHIP_SAUCER_EXIT_AT_SECONDS);
    tracked[0].seek(0, false).pause();
    movers.forEach((mover, index) => {
      const plan = SPACESHIP_PULL_PLAN[index];
      const delaysAppearance = 'value' in plan && plan.value === 3;
      expect(Number(gsap.getProperty(mover, 'opacity'))).toBe(delaysAppearance ? 0 : 1);
      expect(Number.parseFloat(mover.style.top)).toBeGreaterThan(100);
      expect(mover.getBoundingClientRect().top).toBeGreaterThan(viewportHeight);

      const timeline = tracked[0];
      const initialTop = Number.parseFloat(mover.style.top) * viewportHeight / 100;
      const motion = getSpaceshipDebrisMotion(plan);
      if (delaysAppearance) {
        timeline.seek(Math.max(0, motion.travelStartAt - 0.01), false);
        expect(Number.parseFloat(mover.style.top) * viewportHeight / 100).toBeCloseTo(initialTop, 5);
        expect(Number(gsap.getProperty(mover, 'opacity'))).toBe(0);
      }
      timeline.seek(motion.travelStartAt + 0.15, false);
      expect(Number.parseFloat(mover.style.top)).toBeLessThan(initialTop);
      if (delaysAppearance) expect(Number(gsap.getProperty(mover, 'opacity'))).toBeGreaterThan(0);
      timeline.seek(0, false).pause();
    });

    SPACESHIP_PULL_PLAN.forEach((plan, index) => {
      const motion = getSpaceshipDebrisMotion(plan);
      const timeline = tracked[0];
      const marker = overlay.querySelector<HTMLElement>(
        `.cc-spaceship-intake-marker-${(Math.floor(plan.pullOrder) % 3) + 1}`,
      );
      const markerLeftSamples: number[] = [];
      if ('value' in plan) {
        const visual = movers[index].querySelector<HTMLElement>('.cc-spaceship-finale-fake-die');
        for (let step = 0; step <= 19; step += 1) {
          timeline.seek(motion.travelStartAt + motion.travelSeconds * step / 20, false);
          expect(Math.abs(Number(gsap.getProperty(visual!, 'rotation')))).toBeLessThanOrEqual(60.001);
        }
        timeline.seek(0, false).pause();
      }
      for (let step = 0; step <= 7; step += 1) {
        const liveTime = motion.arrivalAt - 0.07 + step * 0.01;
        tracked[0].seek(liveTime);
        timeline.seek(liveTime, false);
        markerLeftSamples.push(marker!.getBoundingClientRect().left);
      }
      timeline.seek(motion.arrivalAt + 0.001, false);
      expect(Number(gsap.getProperty(movers[index], 'opacity'))).toBe(1);
      const moverRect = movers[index].getBoundingClientRect();
      const markerRect = marker!.getBoundingClientRect();
      expect(Math.max(...markerLeftSamples) - Math.min(...markerLeftSamples)).toBeGreaterThan(0.1);
      const intakeDistance = Math.hypot(
        moverRect.left + moverRect.width / 2 - (markerRect.left + markerRect.width / 2),
        moverRect.top + moverRect.height / 2 - (markerRect.top + markerRect.height / 2),
      );
      if (intakeDistance > 1) {
        throw new Error(`${plan.id} missed moving intake by ${intakeDistance.toFixed(3)}px (mover ${movers[index].style.left}/${movers[index].style.top}, marker ${markerRect.left}/${markerRect.top})`);
      }
      timeline.seek(motion.arrivalAt + SPACESHIP_DEBRIS_HIDE_DELAY_SECONDS + 0.001, false);
      expect(Number(gsap.getProperty(movers[index], 'opacity'))).toBe(0);
    });

    cleanup();
    cleanup();
    expect(overlay.querySelector('.cc-spaceship-finale-scene')).toBeNull();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });
});
