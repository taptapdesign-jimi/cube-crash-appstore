import { playJourneyCardManualFlipSound } from '../journey-card-entry-flip-sound';
import {
  presentJourneyCardOverlayModal,
  type JourneyCardOverlayModalController,
} from '../journey-card-overlay-modal';
import type { JourneyCardOriginLease } from '../journey-card-portal-transition';

jest.mock('../journey-card-portal-transition', () => ({ captureJourneyCardGeometry: () => null }));
jest.mock('../../utils/runtime-diagnostics-policy', () => ({ areContinuousRuntimeDiagnosticsEnabled: () => false }));
jest.mock('../journey-card-entry-flip-sound', () => ({
  preloadJourneyCardEntryFlipSounds() {}, playJourneyCardManualFlipSound: jest.fn(),
  playJourneyCardEntryFlipSounds() {}, playJourneyCardReturnFlipSounds() {}, stopJourneyCardEntryFlipSounds() {},
}));
jest.mock('../cta-system', () => ({ registerCta: () => ({ prime() {}, enter: async () => {}, dispose() {} }) }));
jest.mock('../gameplay-sheet-close', () => ({ mountGameplaySheetClose: () => ({ dispose() {} }) }));

type ControlledAnimation = {
  element: HTMLElement;
  frames: Keyframe[];
  duration: number;
  currentTime: number;
  finished: Promise<void>;
  active: boolean;
  finish: () => void;
  cancel: () => void;
};

// Execute the real mounted modal and pointer handlers. Only browser animation
// clocks are controlled; no production function is extracted or reimplemented.
describe('Journey flip and pointer-release animation ownership', () => {
  let modal: JourneyCardOverlayModalController;
  let rotor: HTMLElement;
  let animations: ControlledAnimation[];
  let rafs: Map<number, FrameRequestCallback>;
  let nextRaf: number;
  let originalAnimate: PropertyDescriptor | undefined;

  const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
  const paint = async () => {
    const pending = [...rafs.values()];
    rafs.clear();
    pending.forEach((callback) => callback(performance.now()));
    await flush();
  };
  const pointer = (type: string, x: number, id = 1, isPrimary = true, y = 400) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: id, pointerType: 'touch', isPrimary, clientX: x, clientY: y, button: 0 });
    rotor.dispatchEvent(event);
  };
  const rotorAnimation = (duration: number) => {
    const matches = animations.filter((animation) => animation.element === rotor && animation.duration === duration && animation.active);
    expect(matches).toHaveLength(1);
    return matches[0];
  };
  const finish = async (animation: ControlledAnimation) => { animation.finish(); await flush(); };
  const dragAndRelease = () => {
    pointer('pointerdown', 100);
    pointer('pointermove', 256);
    expect(animations.filter((animation) => animation.element === rotor && animation.active)).toHaveLength(0);
    pointer('pointerup', 256);
    return rotorAnimation(200);
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.mocked(playJourneyCardManualFlipSound).mockClear();
    animations = [];
    rafs = new Map();
    nextRaf = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafs.set(++nextRaf, callback);
      return nextRaf;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { rafs.delete(id); });
    jest.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: function (
      this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions,
    ) {
      let resolve!: () => void;
      const animation: ControlledAnimation = {
        element: this, frames, duration: Number(options.duration), currentTime: 0, active: true,
        finished: new Promise<void>((done) => { resolve = done; }),
        finish() { animation.currentTime = animation.duration; animation.active = false; resolve(); },
        cancel() { animation.active = false; resolve(); },
      };
      animations.push(animation);
      return animation;
    } });
    const readStyle = window.getComputedStyle.bind(window);
    jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = readStyle(element);
      const live = animations.filter((animation) => animation.element === element && animation.active);
      const animation = live[live.length - 1];
      if (element.classList.contains('journey-card-flip-rotor') && animation) {
        const from = Number(/rotateY\(([-.\d]+)deg\)/.exec(String(animation.frames[0].transform))?.[1]);
        const to = Number(/rotateY\(([-.\d]+)deg\)/.exec(String(animation.frames[animation.frames.length - 1].transform))?.[1]);
        Object.defineProperty(style, 'transform', { configurable: true, value: `rotateY(${from + (to - from) * animation.currentTime / animation.duration}deg)` });
      }
      return style;
    });
    const card = document.createElement('div');
    const origin: JourneyCardOriginLease = {
      boardId: 1, card, anchor: card, origin: { centerX: 195, centerY: 422, width: 320, height: 440, rotationDeg: 0 },
      aspectRatio: 320 / 440, isMounted: true,
      mountInto: (host) => { host.appendChild(card); }, activatePortal() {}, prepareSettledLanding() {},
      captureLandingGeometry() {}, readLiveGeometry: () => null, restoreNow: () => true, discard() {},
    };
    modal = presentJourneyCardOverlayModal({ boardId: 1, origin, hasSavedState: false });
    rotor = modal.element.querySelector<HTMLElement>('.journey-card-flip-rotor')!;
    rotor.getBoundingClientRect = () => new DOMRect(35, 200, 320, 440);
    for (let i = 0; i < 5; i += 1) await paint();
    expect(modal.element.classList.contains('is-entering')).toBe(false);
    expect(modal.element.dataset.face).toBe('back');
  });

  afterEach(async () => {
    modal?.dispose();
    await flush();
    document.body.innerHTML = '';
    if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
    else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test.each([0, 21, 25, 30, 40, 100, 190])('a duplicate release at %ims cannot steal the release flip or recoil', async (releaseAt) => {
    for (const target of ['front', 'back'] as const) {
      const flip = dragAndRelease();
      flip.currentTime = releaseAt;
      await paint();
      const count = animations.length;
      pointer('pointerup', 256);
      expect(animations).toHaveLength(count);
      await finish(flip);
      const recoil = rotorAnimation(260);
      const observers = [...rafs.keys()];
      pointer('pointerup', 256);
      expect(modal.element.dataset.face).toBe(target);
      expect(modal.element.dataset.paintFace).toBe(target);
      expect(rotor.style.transform).toBe(target === 'front' ? 'rotateY(0deg)' : 'rotateY(-180deg)');
      expect([...rafs.keys()]).toEqual(observers);
      expect(recoil.active).toBe(true);
      await finish(recoil);
      expect(modal.element.dataset.paintFace).toBe(target);
    }
    expect(playJourneyCardManualFlipSound).toHaveBeenCalledTimes(2);
  });

  test('continued held movement stays animation-free and sounds once only on release', async () => {
    pointer('pointerdown', 100);
    pointer('pointermove', 277.67);
    pointer('pointermove', 290);
    pointer('pointermove', 304.33);
    expect(rotor.style.transform).toBe(`rotateY(${-180 + 204.33 / 390 * 180}deg)`);
    expect(animations.filter((animation) => animation.element === rotor && animation.active)).toHaveLength(0);
    expect(playJourneyCardManualFlipSound).not.toHaveBeenCalled();
    pointer('pointerup', 304.33);
    const flip = rotorAnimation(200);
    expect(flip.frames[0].transform).toBe(rotor.style.transform);
    expect(playJourneyCardManualFlipSound).toHaveBeenCalledTimes(1);
    await finish(flip);
    await finish(rotorAnimation(260));
    expect(modal.element.dataset.face).toBe('front');
    expect(playJourneyCardManualFlipSound).toHaveBeenCalledTimes(1);
  });

  test('two fingers zoom only the artwork face to 120 percent and release it home without flipping', async () => {
    const flip = dragAndRelease();
    await finish(flip);
    await finish(rotorAnimation(260));
    expect(modal.element.dataset.face).toBe('front');

    const pinchShell = modal.element.querySelector<HTMLElement>('.journey-card-flip-pinch-shell')!;
    const soundCount = jest.mocked(playJourneyCardManualFlipSound).mock.calls.length;
    pointer('pointerdown', 100, 11, true);
    pointer('pointerdown', 200, 12, false);
    pointer('pointermove', 340, 12, false);

    expect(modal.element.classList.contains('is-pinching')).toBe(true);
    expect(pinchShell.style.transform).toBe('scale(1.2)');
    expect(jest.mocked(playJourneyCardManualFlipSound)).toHaveBeenCalledTimes(soundCount);

    pointer('pointerup', 340, 12, false);
    expect(modal.element.classList.contains('is-pinching')).toBe(false);
    const returnAnimation = animations.find((animation) => (
      animation.element === pinchShell && animation.duration === 220 && animation.active
    ));
    expect(returnAnimation).toBeDefined();
    await finish(returnAnimation!);
    expect(pinchShell.style.transform).toBe('none');
    expect(modal.element.dataset.face).toBe('front');
    expect(jest.mocked(playJourneyCardManualFlipSound)).toHaveBeenCalledTimes(soundCount);
  });

  test('a new pointer owns its scrub even when the previous release promises finish', async () => {
    pointer('pointerdown', 100);
    pointer('pointermove', 120);
    pointer('pointerup', 120);
    const oldPreview = rotorAnimation(180);
    pointer('pointerdown', 200, 2);
    pointer('pointermove', 215, 2);
    const ownedTransform = rotor.style.transform;
    await finish(oldPreview);
    expect(rotor.style.transform).toBe(ownedTransform);
    expect(modal.element.classList.contains('is-dragging')).toBe(true);
    pointer('pointercancel', 215, 2);
    expect(rotor.style.transform).toBe('rotateY(-180deg)');
  });

  test('a tap that interrupts a live turn continues from the painted angle', async () => {
    const oldFlip = dragAndRelease();
    oldFlip.currentTime = 100;
    await paint();
    pointer('pointerdown', 200, 2);
    const handoffTransform = rotor.style.transform;
    expect(handoffTransform).toBe('rotateY(-54deg)');
    pointer('pointerup', 200, 2);
    const nextFlip = rotorAnimation(200);
    expect(nextFlip.frames[0].transform).toBe(handoffTransform);
    expect(nextFlip.frames[nextFlip.frames.length - 1].transform).toBe('rotateY(0deg)');
    await flush();
    expect(nextFlip.active).toBe(true);
    await finish(nextFlip);
    await finish(rotorAnimation(260));
    expect(modal.element.dataset.paintFace).toBe('front');
  });

  test('partial scrubs still settle back to their starting face', async () => {
    pointer('pointerdown', 100);
    pointer('pointermove', 120);
    pointer('pointerup', 120);
    const preview = rotorAnimation(180);
    const impact = animations.find((animation) => animation.element.classList.contains('journey-card-flip-impact-shell') && animation.active)!;
    await finish(preview);
    await finish(impact);
    expect(rotor.style.transform).toBe('rotateY(-180deg)');
    expect(modal.element.dataset.paintFace).toBe('back');
    expect(modal.element.classList.contains('is-face-settling')).toBe(false);
    expect(playJourneyCardManualFlipSound).not.toHaveBeenCalled();
  });
});
