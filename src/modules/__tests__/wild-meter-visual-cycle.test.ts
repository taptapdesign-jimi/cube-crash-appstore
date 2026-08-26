import {
  clampWildMeterRatio,
  getWildMeterDrainGeometry,
  getWildMeterRefillWidth,
} from '../wild-meter-visual-cycle';

describe('wild meter visual cycle geometry', () => {
  test('drains left-to-right while keeping the right edge fixed', () => {
    expect(getWildMeterDrainGeometry(200, 0)).toEqual({ left: 0, width: 200 });
    expect(getWildMeterDrainGeometry(200, 0.5)).toEqual({ left: 100, width: 100 });
    expect(getWildMeterDrainGeometry(200, 1)).toEqual({ left: 200, width: 0 });

    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      const geometry = getWildMeterDrainGeometry(200, progress);
      expect(geometry.left + geometry.width).toBeCloseTo(200);
    }
  });

  test('refills only the preserved overflow after one full charge', () => {
    expect(getWildMeterRefillWidth(200, 0.5)).toBe(100);
    expect(getWildMeterRefillWidth(200, 1.4)).toBe(200);
    expect(getWildMeterRefillWidth(200, -1)).toBe(0);
    expect(clampWildMeterRatio(Number.NaN)).toBe(0);
  });
});
