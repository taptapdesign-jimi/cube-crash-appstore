import { gsap } from 'gsap';
import { spawnBounce } from '../spawn-helpers';
import {
  hasOwnedOuterTileTransform,
  repairUnownedCollapsedTileScale,
} from '../tile-visual-repair-policy';

function tile() {
  return {
    value: 2,
    locked: false,
    visible: true,
    alpha: 1,
    scale: { x: 1, y: 1, set(x: number, y = x) { this.x = x; this.y = y; } },
    rotG: { alpha: 1, rotation: 0 },
    base: { alpha: 1 },
    overlay: { alpha: 1, visible: false },
    num: { alpha: 1 },
    pips: { alpha: 1 },
  } as any;
}

describe('tile visual repair ownership policy', () => {
  afterEach(() => { gsap.globalTimeline.clear(); });

  test('both repair paths must preserve a real reserved Laser standard bounce from 0.30', () => {
    const target = tile();
    target._ccTntBonusOwned = true;
    const done = jest.fn();
    const interrupted = jest.fn();
    const handle = spawnBounce(target, gsap, {
      startScale: 0.30,
      max: 1.08,
      compress: 0.96,
      rebound: 1.02,
      keepFullOpacity: true,
    }, done, interrupted);

    expect(target.scale.x).toBeCloseTo(0.30);
    expect(hasOwnedOuterTileTransform(target)).toBe(true);
    expect(repairUnownedCollapsedTileScale({
      tile: target,
      killScaleTweens: (scale) => gsap.killTweensOf(scale),
    })).toBe(false);
    expect(target.scale.x).toBeCloseTo(0.30);
    expect(interrupted).not.toHaveBeenCalled();

    handle.scaleTimeline.progress(1);
    handle.rotationTimeline.progress(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(target.scale.x).toBe(1);
  });

  test('repairs only an unowned collapsed residue', () => {
    const target = tile();
    target.scale.set(0.3);
    const kill = jest.fn();
    expect(repairUnownedCollapsedTileScale({ tile: target, killScaleTweens: kill })).toBe(true);
    expect(kill).toHaveBeenCalledWith(target.scale);
    expect(target.scale).toMatchObject({ x: 1, y: 1 });
  });
});
