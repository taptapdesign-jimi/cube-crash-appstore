import { gsap } from 'gsap';
import { killPixiGsapSubtrees } from '../pixi-gsap-cleanup';

describe('batched retiring-board tween ownership', () => {
  afterEach(() => { gsap.globalTimeline.clear(); gsap.ticker.sleep(); });

  test('visits distinct tile descendants and points once without admitting scalar values', () => {
    const sharedPoint = { x: 1, y: 1 };
    const child = { position: sharedPoint, scale: { x: 1, y: 1 }, alpha: 1, rotation: 0 };
    const tile = { children: [child], position: sharedPoint, alpha: 1 };
    const extra = { children: [{ outsideOwner: true }] };
    const killTweensOf = jest.fn();
    killPixiGsapSubtrees({ killTweensOf }, [tile, tile, child], [extra, sharedPoint]);
    expect(killTweensOf).toHaveBeenCalledTimes(1);
    const targets = killTweensOf.mock.calls[0][0];
    expect(new Set(targets)).toEqual(new Set([tile, child, sharedPoint, child.scale, extra]));
    expect(targets).not.toContain(extra.children[0]);
  });

  test('retires actual nested Pixi-like tweens while preserving unrelated Journey and effect owners', () => {
    const point = { x: 0 };
    const tile = { alpha: 0, children: [{ position: point }] };
    const header = { alpha: 0 };
    const journey = { alpha: 0 };
    const unrelatedEffect = { alpha: 0 };
    gsap.to(point, { x: 1, duration: 10 }).progress(0.1);
    gsap.to(tile, { alpha: 1, duration: 10 }).progress(0.1);
    gsap.to(header, { alpha: 1, duration: 10 }).progress(0.1);
    gsap.to(journey, { alpha: 1, duration: 10 }).progress(0.1);
    gsap.to(unrelatedEffect, { alpha: 1, duration: 10 }).progress(0.1);
    killPixiGsapSubtrees(gsap, [tile], [header]);
    expect(gsap.getTweensOf([point, tile, header])).toHaveLength(0);
    expect(gsap.getTweensOf(journey)).toHaveLength(1);
    expect(gsap.getTweensOf(unrelatedEffect)).toHaveLength(1);
  });

  test('handles shared/cyclic children, destroyed getters and empty owner sets', () => {
    const tile: any = { children: [], scale: { x: 1 } };
    tile.children.push(tile);
    Object.defineProperty(tile, 'position', { get() { throw new Error('destroyed point'); } });
    const killTweensOf = jest.fn();
    killPixiGsapSubtrees({ killTweensOf }, [tile, null]);
    expect(killTweensOf).toHaveBeenCalledWith([tile, tile.scale]);
    killTweensOf.mockClear();
    killPixiGsapSubtrees({ killTweensOf }, []);
    expect(killTweensOf).not.toHaveBeenCalled();
  });
});
