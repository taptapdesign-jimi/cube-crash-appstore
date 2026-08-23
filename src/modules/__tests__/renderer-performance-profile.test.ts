import { getRendererPerformanceProfile } from '../renderer-performance-profile';

describe('renderer performance profile', () => {
  test('caps a high-density mobile renderer at 1.5x and avoids forcing the high-performance GPU profile', () => {
    expect(getRendererPerformanceProfile(3, true)).toEqual({
      resolution: 1.5,
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
});
