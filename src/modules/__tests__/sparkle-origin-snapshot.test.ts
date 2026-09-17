import * as starBurst from '../text-sparkles';
import * as bee from '../bee-finale-scene';
import * as fish from '../fish-finale-bubbles';
import * as kanta from '../kanta-finale-scene';
import { showSparkleText, stopSparkleText } from '../splash-text-overlay';

describe('Sparkle origin snapshot ownership', () => {
  beforeEach(() => {
    jest.spyOn(starBurst, 'attachSmallStarCenterBurst').mockReturnValue(() => {});
    jest.spyOn(bee, 'attachBeeFinaleScene').mockReturnValue(() => {});
    jest.spyOn(fish, 'attachFishFinaleBubbles').mockReturnValue(() => {});
    jest.spyOn(kanta, 'attachKantaFinaleScene').mockReturnValue(() => {});
  });
  afterEach(() => {
    stopSparkleText();
    document.body.replaceChildren();
  });

  test('Kanta never requests an unused canvas origin', () => {
    const measure = jest.fn(() => ({ x: 120, y: 240 }));
    showSparkleText(measure, { finaleScene: 'kanta-center-sequence' });
    expect(measure).not.toHaveBeenCalled();
    expect(kanta.attachKantaFinaleScene).toHaveBeenCalledTimes(1);
    expect(starBurst.attachSmallStarCenterBurst).not.toHaveBeenCalled();
  });

  test.each([undefined, 'bee-forest-flight', 'fish-bubbles'])('%s snapshots once before retiring previous DOM or writing new styles', (finaleScene) => {
    showSparkleText({ x: 1, y: 2 });
    const previous = document.querySelector('[data-effect-text]')!;
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true, attributes: true, subtree: true });
    const point = { x: 120, y: 240 };
    const measure = jest.fn(() => {
      expect(previous.isConnected).toBe(true);
      expect(observer.takeRecords()).toHaveLength(0);
      return point;
    });
    try {
      showSparkleText(measure, { finaleScene });
      expect(measure).toHaveBeenCalledTimes(1);
      expect(previous.isConnected).toBe(false);
      if (finaleScene === 'bee-forest-flight') {
        expect(bee.attachBeeFinaleScene).toHaveBeenLastCalledWith(expect.any(HTMLElement), 1, point, expect.any(Object));
      } else if (finaleScene === 'fish-bubbles') {
        expect(fish.attachFishFinaleBubbles).toHaveBeenLastCalledWith(expect.any(HTMLElement), point);
      } else {
        expect(starBurst.attachSmallStarCenterBurst).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ origin: point }));
      }
    } finally { observer.disconnect(); }
  });

  test('existing point and omitted-origin callers remain compatible', () => {
    const point = { x: 42, y: 63 };
    showSparkleText(point);
    expect(starBurst.attachSmallStarCenterBurst).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ origin: point }));
    showSparkleText();
    expect(starBurst.attachSmallStarCenterBurst).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ origin: undefined }));
  });
});
