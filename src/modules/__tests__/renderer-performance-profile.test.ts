import { getRendererPerformanceProfile } from '../renderer-performance-profile';

describe('renderer performance profile', () => {
  afterEach(() => {
    delete (window as Window & { __ccThermalPixiResolutionCap?: number })
      .__ccThermalPixiResolutionCap;
  });

  test('uses the physically accepted 1x mobile renderer and avoids forcing the high-performance GPU profile', () => {
    expect(getRendererPerformanceProfile(3, true)).toEqual({
      resolution: 1,
      powerPreference: 'low-power',
    });
  });

  test('does not upscale lower-density mobile displays', () => {
    expect(getRendererPerformanceProfile(1, true).resolution).toBe(1);
  });

  test('preserves desktop renderer quality and power profile', () => {
    expect(getRendererPerformanceProfile(2, false)).toEqual({
      resolution: 2,
      powerPreference: 'high-performance',
    });
  });

  test('falls back safely when device pixel ratio is invalid', () => {
    expect(getRendererPerformanceProfile(Number.NaN, true).resolution).toBe(1);
  });

  test('uses the explicit 1x mobile diagnostic without changing desktop quality', () => {
    (window as Window & { __ccThermalPixiResolutionCap?: number })
      .__ccThermalPixiResolutionCap = 1;

    expect(getRendererPerformanceProfile(3, true).resolution).toBe(1);
    expect(getRendererPerformanceProfile(3, false).resolution).toBe(3);
  });
});
