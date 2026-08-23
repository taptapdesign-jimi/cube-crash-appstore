export type MobileRuntimePlatform = 'ios' | 'android' | 'desktop';

export interface MobileRuntimeProfile {
  platform: MobileRuntimePlatform;
  isMobileDevice: boolean;
  settledIdleMaxFramesPerSecond: number;
  spatialMaxFramesPerSecond: number;
  ambientPixelRatioCap: number;
  ambientVisibilityMarginPx: number;
}

export interface MobileRuntimeEnvironment {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

const MOBILE_SETTLED_IDLE_FPS = 30;
const MOBILE_AMBIENT_PIXEL_RATIO_CAP = 1.5;
const MOBILE_AMBIENT_VISIBILITY_MARGIN_PX = 120;

function readRuntimeEnvironment(): Required<MobileRuntimeEnvironment> {
  if (typeof navigator === 'undefined') {
    return { userAgent: '', platform: '', maxTouchPoints: 0 };
  }
  return {
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
  };
}

export function resolveMobileRuntimePlatform(
  environment: MobileRuntimeEnvironment = readRuntimeEnvironment(),
): MobileRuntimePlatform {
  const userAgent = environment.userAgent || '';
  const platform = environment.platform || '';
  const maxTouchPoints = environment.maxTouchPoints || 0;
  const isIPadDesktopUserAgent = platform === 'MacIntel' && maxTouchPoints > 1;

  if (/iPad|iPhone|iPod/i.test(userAgent) || isIPadDesktopUserAgent) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
}

/**
 * Stack to Six is mobile-first. Settled animation work is deliberately bounded
 * on iPhone, iPad and Android, while authored transitions remain free to use
 * the display refresh rate. Desktop browser behavior is not the optimization
 * target and therefore keeps the existing unrestricted cadence.
 */
export function resolveMobileRuntimeProfile(
  environment: MobileRuntimeEnvironment = readRuntimeEnvironment(),
): MobileRuntimeProfile {
  const platform = resolveMobileRuntimePlatform(environment);
  const isMobileDevice = platform !== 'desktop';
  return {
    platform,
    isMobileDevice,
    settledIdleMaxFramesPerSecond: isMobileDevice ? MOBILE_SETTLED_IDLE_FPS : 0,
    spatialMaxFramesPerSecond: isMobileDevice ? MOBILE_SETTLED_IDLE_FPS : 0,
    ambientPixelRatioCap: isMobileDevice ? MOBILE_AMBIENT_PIXEL_RATIO_CAP : 2,
    ambientVisibilityMarginPx: isMobileDevice ? MOBILE_AMBIENT_VISIBILITY_MARGIN_PX : 180,
  };
}

export const MOBILE_RUNTIME_PROFILE = resolveMobileRuntimeProfile();
