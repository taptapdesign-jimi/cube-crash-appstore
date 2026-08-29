export type MobileRuntimePlatform = 'ios' | 'android' | 'desktop';

export interface MobileRuntimeProfile {
  platform: MobileRuntimePlatform;
  isMobileDevice: boolean;
  settledIdleMaxFramesPerSecond: number;
  spatialMaxFramesPerSecond: number;
  ambientPixelRatioCap: number;
  ambientVisibilityMarginPx: number;
  ambientSpriteBudget: number;
  area55ShipBudget: number;
  journeyVisibleUnitBudget: number;
}

export interface MobileRuntimeEnvironment {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

const MOBILE_SETTLED_IDLE_FPS = 30;
const MOBILE_AMBIENT_PIXEL_RATIO_CAP = 1.25;
const MOBILE_AMBIENT_VISIBILITY_MARGIN_PX = 80;
const MOBILE_AMBIENT_SPRITE_BUDGET = 10;
const MOBILE_AREA55_SHIP_BUDGET = 2;
const MOBILE_JOURNEY_VISIBLE_UNIT_BUDGET = 2;

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
    ambientSpriteBudget: isMobileDevice ? MOBILE_AMBIENT_SPRITE_BUDGET : 0,
    area55ShipBudget: isMobileDevice ? MOBILE_AREA55_SHIP_BUDGET : 0,
    journeyVisibleUnitBudget: isMobileDevice ? MOBILE_JOURNEY_VISIBLE_UNIT_BUDGET : 3,
  };
}

export const MOBILE_RUNTIME_PROFILE = resolveMobileRuntimeProfile();
