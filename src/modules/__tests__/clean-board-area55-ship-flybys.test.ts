import fs from 'node:fs';
import path from 'node:path';
import {
  CLEAN_BOARD_AREA55_SHIP_MAX_WOBBLE_PX,
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

  test('samples continuously moving full-celebration paths with bounded two-axis wobble', () => {
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

    expect(first.corridor).toBe('left');
    expect(second.corridor).toBe('right');
    expect(first.startEdge).toBe('top');
    expect(first.endEdge).toBe('left');
    expect(second.startEdge).toBe('bottom');
    expect(second.endEdge).toBe('right');
    expect(first.keyframes.length).toBeGreaterThan(200);
    expect(first.keyframes.length).toBeLessThan(400);
    expect(first.keyframes[0]).toMatchObject({ offset: 0, opacity: 0 });
    expect(first.keyframes[first.keyframes.length - 1]).toMatchObject({ offset: 1, opacity: 0 });
    expect(first.keyframes.find((frame) => Number(frame.offset) >= 0.2)).toMatchObject({ opacity: 0.7 });
    expect(first.keyframes[0].transform).toContain('-112.000px');
    expect(first.keyframes[first.keyframes.length - 1]?.transform).toContain('-112.000px');
    expect(first.durationMs).toBe(CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS);
    expect(second.durationMs).toBe(CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS);
    expect(first.keyframes).not.toEqual(second.keyframes);
  });

  test.each([0, 0.2, 0.5, 0.8, 0.99])('keeps the two independently sampled routes visibly far apart (seed %s)', (seed) => {
    let behindState = Math.floor(seed * 0xffffffff) ^ 0x13579bdf;
    let frontState = Math.floor(seed * 0xffffffff) ^ 0x2468ace0;
    const next = (state: number): [number, number] => {
      const value = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return [value, value / 0x100000000];
    };
    const behind = createCleanBoardArea55ShipFlightPlan({
      depth: 'behind', viewportWidth: 390, viewportHeight: 844,
      random: () => {
        const sampled = next(behindState);
        behindState = sampled[0];
        return sampled[1];
      },
    });
    const front = createCleanBoardArea55ShipFlightPlan({
      depth: 'front', viewportWidth: 390, viewportHeight: 844,
      random: () => {
        const sampled = next(frontState);
        frontState = sampled[0];
        return sampled[1];
      },
    });
    const x = (frame: Keyframe): number => Number(
      String(frame.transform).match(/translate3d\((-?[\d.]+)px/)?.[1],
    );
    behind.keyframes.forEach((behindFrame, index) => {
      const t = Number(behindFrame.offset);
      if (t < 0.16 || t > 0.85) return;
      const visualGap = x(front.keyframes[index]) - (x(behindFrame) + 62);
      expect(visualGap).toBeGreaterThan(48);
    });
    expect(behind.keyframes).not.toEqual(front.keyframes);
  });

  test.each([0, 0.25, 0.5, 0.75, 0.99])('smoothly reverses and banks without waypoint impacts (seed %s)', (seed) => {
    let state = Math.floor(seed * 0xffffffff);
    const plan = createCleanBoardArea55ShipFlightPlan({
      depth: 'front', viewportWidth: 390, viewportHeight: 844,
      random: () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
      },
    });
    const poses = plan.keyframes.map((frame) => {
      const match = String(frame.transform).match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0\) rotate\((-?[\d.]+)deg\)/)!;
      return { x: Number(match[1]), y: Number(match[2]), rotation: Number(match[3]), t: Number(frame.offset) };
    });
    const dt = plan.durationMs / 1000 / (poses.length - 1);
    const velocities = poses.slice(1).map((point, i) => ({
      x: (point.x - poses[i].x) / dt, y: (point.y - poses[i].y) / dt, t: point.t,
    }));
    const interior = velocities.filter(({ t }) => t > 0.2 && t < 0.8);
    expect(interior.some(({ x }) => x > 10)).toBe(true);
    expect(interior.some(({ x }) => x < -10)).toBe(true);
    expect(interior.some(({ y }) => y > 10)).toBe(true);
    expect(interior.some(({ y }) => y < -10)).toBe(true);
    // At 30Hz, a turn must change velocity gradually; the old 10-point
    // polygon exceeds these bounds at its corners. Include entry/exit joins.
    for (let i = 1; i < velocities.length; i++) {
      const delta = Math.hypot(velocities[i].x - velocities[i - 1].x, velocities[i].y - velocities[i - 1].y);
      expect(delta).toBeLessThan(95);
      if (velocities[i].t > 0.2 && velocities[i].t < 0.8) expect(delta).toBeLessThan(20);
      expect(Math.abs(poses[i].rotation - poses[i - 1].rotation)).toBeLessThan(3);
    }
    for (const point of poses.filter(({ t }) => t > 0.16 && t < 0.85)) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(390 - 74);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(844 - 74);
      expect(Math.abs(point.rotation)).toBeLessThanOrEqual(14);
    }
    expect(plan.keyframes.every((frame) => frame.easing === 'linear')).toBe(true);
    expect(CLEAN_BOARD_AREA55_SHIP_MAX_WOBBLE_PX).toBe(60);
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
