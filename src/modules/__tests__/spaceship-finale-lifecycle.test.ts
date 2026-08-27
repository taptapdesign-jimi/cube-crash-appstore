import { gsap } from 'gsap';
import animationManager from '../animation-manager.js';
import {
  attachSpaceshipFinaleScene,
  getSpaceshipDebrisMotion,
  SPACESHIP_DEBRIS_PLAN,
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

    const cleanup = attachSpaceshipFinaleScene(overlay);
    tracked.forEach((timeline) => timeline.pause(0));
    const movers = Array.from(overlay.querySelectorAll<HTMLElement>('.cc-spaceship-finale-debris-mover'));

    expect(movers).toHaveLength(12);
    expect(tracked).toHaveLength(14);
    movers.forEach((mover, index) => {
      expect(Number(gsap.getProperty(mover, 'opacity'))).toBe(1);
      expect(Number.parseFloat(mover.style.top)).toBeGreaterThan(100);
      expect(mover.getBoundingClientRect().top).toBeGreaterThan(viewportHeight);

      const timeline = tracked[index + 2];
      const initialTop = Number.parseFloat(mover.style.top) * viewportHeight / 100;
      timeline.seek(0.15);
      expect(Number.parseFloat(mover.style.top)).toBeLessThan(initialTop);
      timeline.pause(0);
    });

    SPACESHIP_DEBRIS_PLAN.forEach((plan, index) => {
      const motion = getSpaceshipDebrisMotion(plan);
      const timeline = tracked[index + 2];
      const marker = overlay.querySelector<HTMLElement>(
        `.cc-spaceship-intake-marker-${(plan.pullOrder % 3) + 1}`,
      );
      const markerStartLeft = marker!.getBoundingClientRect().left;
      for (let step = 0; step <= 7; step += 1) {
        const liveTime = motion.arrivalAt - 0.07 + step * 0.01;
        tracked[0].seek(liveTime);
        timeline.seek(liveTime);
      }
      timeline.seek(motion.arrivalAt + 0.001);
      expect(Number(gsap.getProperty(movers[index], 'opacity'))).toBe(1);
      const moverRect = movers[index].getBoundingClientRect();
      const markerRect = marker!.getBoundingClientRect();
      expect(Math.abs(markerRect.left - markerStartLeft)).toBeGreaterThan(0.1);
      const intakeDistance = Math.hypot(
        moverRect.left + moverRect.width / 2 - (markerRect.left + markerRect.width / 2),
        moverRect.top + moverRect.height / 2 - (markerRect.top + markerRect.height / 2),
      );
      if (intakeDistance > 1) {
        throw new Error(`${plan.id} missed moving intake by ${intakeDistance.toFixed(3)}px (mover ${movers[index].style.left}/${movers[index].style.top}, marker ${markerRect.left}/${markerRect.top})`);
      }
      timeline.seek(motion.arrivalAt + 0.026);
      expect(Number(gsap.getProperty(movers[index], 'opacity'))).toBe(0);
    });

    cleanup();
    cleanup();
    expect(overlay.querySelector('.cc-spaceship-finale-scene')).toBeNull();
    expect(animationManager.getStats().activeTimelines).toBe(baseline);
  });
});
