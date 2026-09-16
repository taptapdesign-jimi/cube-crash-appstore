import fs from 'node:fs';
import path from 'node:path';
import {
  createCleanBoardArea55ShipFlightPlan,
  startCleanBoardArea55ShipFlybys,
} from '../clean-board-area55-ship-flybys';
import { CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS } from '../confetti-system';

interface FakeAnimation {
  onfinish: (() => void) | null;
  cancel: jest.Mock;
}

describe('Clean Board Area 55 ship flybys', () => {
  const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  let animations: FakeAnimation[];

  beforeEach(() => {
    animations = [];
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({ matches: false })),
    });
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: jest.fn(() => {
        const animation: FakeAnimation = { onfinish: null, cancel: jest.fn() };
        animations.push(animation);
        return animation as unknown as Animation;
      }),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate);
    else delete (Element.prototype as Partial<Element>).animate;
    jest.restoreAllMocks();
  });

  test('samples gentle full-celebration paths with random wobble and an ease-out exit', () => {
    const first = createCleanBoardArea55ShipFlightPlan({
      depth: 'behind',
      viewportWidth: 390,
      viewportHeight: 844,
      random: () => 0,
    });
    const second = createCleanBoardArea55ShipFlightPlan({
      depth: 'front',
      viewportWidth: 390,
      viewportHeight: 844,
      random: () => 0.99,
    });

    expect(first.startEdge).toBe('top');
    expect(first.endEdge).toBe('right');
    expect(second.startEdge).toBe('left');
    expect(second.endEdge).toBe('bottom');
    expect(first.keyframes).toHaveLength(28);
    expect(first.keyframes[0]).toMatchObject({ offset: 0, opacity: 0 });
    expect(first.keyframes[1]).toMatchObject({ offset: 0.16, opacity: 0.7 });
    expect(first.keyframes[25]).toMatchObject({ offset: 0.85 });
    expect(first.keyframes[26]).toMatchObject({ offset: 0.92, easing: 'cubic-bezier(.22,.61,.36,1)' });
    expect(first.keyframes[27]).toMatchObject({ offset: 1, opacity: 0 });
    expect(first.keyframes.map((frame) => frame.transform).join(' ')).toContain('scale(');
    expect(first.keyframes.map((frame) => frame.transform).join(' ')).toContain('-112.0px');
    expect(first.durationMs).toBe(CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS);
    expect(second.durationMs).toBe(CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS);
    expect(first.keyframes).not.toEqual(second.keyframes);
  });

  test('each settled interior waypoint briefly bobs, slides and rotates before flight resumes', () => {
    const plan = createCleanBoardArea55ShipFlightPlan({
      depth: 'front',
      viewportWidth: 390,
      viewportHeight: 844,
      random: () => 0.5,
    });
    const offsets = plan.keyframes.map((frame) => frame.offset);
    const parse = (frame: Keyframe) => {
      const transform = String(frame.transform);
      const match = transform.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0\) rotate\((-?[\d.]+)deg\)/);
      expect(match).not.toBeNull();
      return { x: Number(match![1]), y: Number(match![2]), rotation: Number(match![3]) };
    };

    for (const anchorOffset of [0.16, 0.29, 0.42, 0.55, 0.68, 0.79]) {
      const anchorIndex = offsets.indexOf(anchorOffset);
      expect(anchorIndex).toBeGreaterThan(0);
      expect(offsets.slice(anchorIndex, anchorIndex + 4)).toEqual([
        anchorOffset, anchorOffset + 0.008, anchorOffset + 0.018, anchorOffset + 0.03,
      ]);
      const anchor = parse(plan.keyframes[anchorIndex]);
      const riseRight = parse(plan.keyframes[anchorIndex + 1]);
      const fallLeft = parse(plan.keyframes[anchorIndex + 2]);
      const settled = parse(plan.keyframes[anchorIndex + 3]);
      expect(riseRight.x - anchor.x).toBeCloseTo(2, 1);
      expect(riseRight.y - anchor.y).toBeCloseTo(-2, 1);
      expect(riseRight.rotation - anchor.rotation).toBeCloseTo(1.6, 1);
      expect(fallLeft.x - anchor.x).toBeCloseTo(-2, 1);
      expect(fallLeft.y - anchor.y).toBeCloseTo(1.5, 1);
      expect(fallLeft.rotation - anchor.rotation).toBeCloseTo(-1.4, 1);
      expect(settled).toEqual(anchor);
      expect(plan.keyframes[anchorIndex + 3].easing).toBe('cubic-bezier(.45,.05,.25,1)');
    }
    expect(offsets).toEqual([...offsets].sort((a, b) => Number(a) - Number(b)));
  });

  test('runs exactly one confetti-length animation for each depth layer', () => {
    const overlay = document.createElement('div');
    const content = document.createElement('div');
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    const controller = startCleanBoardArea55ShipFlybys({
      overlay,
      content,
      random: () => 0.5,
    });
    const ships = overlay.querySelectorAll<HTMLImageElement>('.cc-clean-board-area55-ship');

    expect(controller.getSnapshot()).toEqual({
      disposed: false,
      shipCount: 2,
      behindShipCount: 1,
      frontShipCount: 1,
      runningAnimationCount: 2,
      totalAnimationCount: 2,
      asset: './assets/journey assets/robo/ship1@2x.png',
    });
    expect(ships).toHaveLength(2);
    expect(ships[0].src).toContain('/assets/journey%20assets/robo/ship1@2x.png');
    expect(ships[1].src).toContain('/assets/journey%20assets/robo/ship1@2x.png');
    expect(content.style.zIndex).toBe('1');
    expect(ships[0].style.zIndex).toBe('0');
    expect(ships[1].style.zIndex).toBe('2');

    expect(animations).toHaveLength(2);
    animations[0].onfinish?.();
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      runningAnimationCount: 1,
      shipCount: 1,
    });
    animations[1].onfinish?.();
    expect(controller.getSnapshot()).toMatchObject({ disposed: true, shipCount: 0 });
  });

  test('replacement and modal removal synchronously retire animations and nodes', async () => {
    const firstOverlay = document.createElement('div');
    const firstContent = document.createElement('div');
    firstOverlay.appendChild(firstContent);
    document.body.appendChild(firstOverlay);
    const first = startCleanBoardArea55ShipFlybys({ overlay: firstOverlay, content: firstContent });

    const secondOverlay = document.createElement('div');
    const secondContent = document.createElement('div');
    secondOverlay.appendChild(secondContent);
    document.body.appendChild(secondOverlay);
    const second = startCleanBoardArea55ShipFlybys({ overlay: secondOverlay, content: secondContent });
    expect(first.getSnapshot()).toMatchObject({ disposed: true, shipCount: 0 });
    expect(secondOverlay.querySelectorAll('.cc-clean-board-area55-ship')).toHaveLength(2);

    expect(animations).toHaveLength(4);
    secondOverlay.remove();
    await Promise.resolve();
    expect(second.getSnapshot()).toMatchObject({
      disposed: true,
      shipCount: 0,
      runningAnimationCount: 0,
    });
    expect(animations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
  });

  test('honors reduced motion without creating animated nodes', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({ matches: true })),
    });
    const overlay = document.createElement('div');
    const content = document.createElement('div');
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    const controller = startCleanBoardArea55ShipFlybys({ overlay, content });
    expect(controller.getSnapshot()).toMatchObject({
      shipCount: 0,
      runningAnimationCount: 0,
      totalAnimationCount: 0,
    });
    expect(overlay.querySelectorAll('.cc-clean-board-area55-ship')).toHaveLength(0);
    expect(Element.prototype.animate).not.toHaveBeenCalled();
    controller.dispose();
  });

  test('is connected to replacement, navigation and exact overlay-removal cleanup boundaries', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/clean-board-modal.ts'),
      'utf8',
    );
    expect(source).toContain('stopCleanBoardArea55ShipFlybys();');
    expect(source).toContain('area55ShipFlybys = startCleanBoardArea55ShipFlybys');
    expect(source).toContain('area55ShipFlybys?.dispose();');
    expect(source).toContain('try { el.remove(); } catch {}');
  });
});
