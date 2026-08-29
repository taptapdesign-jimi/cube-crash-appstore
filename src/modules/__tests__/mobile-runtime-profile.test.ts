import {
  resolveMobileRuntimePlatform,
  resolveMobileRuntimeProfile,
} from '../mobile-runtime-profile';

describe('mobile runtime thermal profile', () => {
  test.each([
    [{ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)' }, 'ios'],
    [{ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X)' }, 'ios'],
    [{ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 }, 'ios'],
    [{ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro)' }, 'android'],
    [{ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 0 }, 'desktop'],
  ] as const)('detects %s as %s', (environment, expected) => {
    expect(resolveMobileRuntimePlatform(environment)).toBe(expected);
  });

  test('bounds settled work only on mobile devices', () => {
    expect(resolveMobileRuntimeProfile({ userAgent: 'Android' })).toMatchObject({
      isMobileDevice: true,
      settledIdleMaxFramesPerSecond: 24,
      spatialMaxFramesPerSecond: 24,
      ambientPixelRatioCap: 1.25,
      ambientVisibilityMarginPx: 80,
      ambientSpriteBudget: 10,
      area55ShipBudget: 2,
      journeyVisibleUnitBudget: 2,
    });
    expect(resolveMobileRuntimeProfile({ userAgent: 'Desktop Browser' })).toMatchObject({
      platform: 'desktop',
      isMobileDevice: false,
      settledIdleMaxFramesPerSecond: 0,
      spatialMaxFramesPerSecond: 0,
      ambientPixelRatioCap: 2,
      ambientVisibilityMarginPx: 180,
      ambientSpriteBudget: 0,
      area55ShipBudget: 0,
      journeyVisibleUnitBudget: 3,
    });
  });
});
