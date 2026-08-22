export type RendererPerformanceProfile = {
  resolution: number;
  powerPreference: 'low-power' | 'high-performance';
};

export function getRendererPerformanceProfile(
  rawDevicePixelRatio: number,
  isIOSRuntime: boolean,
): RendererPerformanceProfile {
  const safeDevicePixelRatio = Number.isFinite(rawDevicePixelRatio) && rawDevicePixelRatio > 0
    ? rawDevicePixelRatio
    : 1;

  if (isIOSRuntime) {
    return {
      resolution: Math.min(1.5, safeDevicePixelRatio),
      powerPreference: 'low-power',
    };
  }

  return {
    resolution: safeDevicePixelRatio,
    powerPreference: 'high-performance',
  };
}
