export type RendererPerformanceProfile = {
  resolution: number;
  powerPreference: 'low-power' | 'high-performance';
};

function getDiagnosticMobileResolutionCap(): number | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { __ccThermalPixiResolutionCap?: unknown })
    .__ccThermalPixiResolutionCap === 1
    ? 1
    : null;
}

export function getRendererPerformanceProfile(
  rawDevicePixelRatio: number,
  isMobileRuntime: boolean,
): RendererPerformanceProfile {
  const safeDevicePixelRatio = Number.isFinite(rawDevicePixelRatio) && rawDevicePixelRatio > 0
    ? rawDevicePixelRatio
    : 1;

  if (isMobileRuntime) {
    const diagnosticResolutionCap = getDiagnosticMobileResolutionCap();
    return {
      // The physical iPhone acceptance found the 1x Pixi board sharp while it
      // avoided native serious through the complete Forest + Beach route.
      // DOM HUD/text and authored sprite geometry keep their exact layout.
      resolution: Math.min(diagnosticResolutionCap ?? 1, safeDevicePixelRatio),
      powerPreference: 'low-power',
    };
  }

  return {
    resolution: safeDevicePixelRatio,
    powerPreference: 'high-performance',
  };
}
