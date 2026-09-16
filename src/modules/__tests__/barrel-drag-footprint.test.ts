import { getBarrelDragFootprint } from '../barrel-drag-footprint';

function overlapOfTarget(source: { x: number; y: number; w: number; h: number }, target: { x: number; y: number; w: number; h: number }) {
  const width = Math.max(0, Math.min(source.x + source.w, target.x + target.w) - Math.max(source.x, target.x));
  const height = Math.max(0, Math.min(source.y + source.h, target.y + target.h) - Math.max(source.y, target.y));
  return width * height / (target.w * target.h);
}

describe('Barrel drag footprint', () => {
  test('does not select a tile across the narrow empty gap but selects once the bodies overlap', () => {
    const barrel = getBarrelDragFootprint({ x: 0, y: 0 }, 128);
    const farTile = { x: 125 - 64, y: -64, w: 128, h: 128 };
    const nearTile = { x: 115 - 64, y: -64, w: 128, h: 128 };
    const threshold = 0.05;

    expect(barrel.w).toBeCloseTo(128);
    expect(overlapOfTarget(barrel, farTile)).toBeLessThan(threshold);
    expect(overlapOfTarget(barrel, nearTile)).toBeGreaterThan(threshold);
  });

  test('follows the dragged die scale', () => {
    expect(getBarrelDragFootprint({ x: 0, y: 0 }, 128, 1.1).w).toBeCloseTo(140.8);
  });
});
