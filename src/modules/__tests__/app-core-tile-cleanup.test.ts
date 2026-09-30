import { cleanupTilesForRebuild } from '../app-core-tile-cleanup';

test('production rebuild cleanup retires an active Laser impact owner before destroy', () => {
  const events: string[] = [];
  const impactHandle = { kill: jest.fn(() => events.push('impact-kill')) };
  const tile: any = {
    _ccLaserGunImpactTl: impactHandle,
    scale: {},
    rotG: {},
    removeAllListeners: jest.fn(),
    destroy: jest.fn(() => events.push('destroy')),
  };
  const gsap = { killTweensOf: jest.fn() };

  cleanupTilesForRebuild({
    tiles: [tile],
    gsap,
    stopWildIdle: jest.fn(),
    stopWildShimmer: jest.fn(),
    stopWildStars: jest.fn(),
    stopWildJuiceBubbles: jest.fn(),
    stopMagnetIdleParticles: jest.fn(),
    stopTntIdleParticles: jest.fn(),
    stopTntIdleShake: jest.fn(),
    stopSpecialDiceIdleMotion: jest.fn(),
    devWarn: jest.fn(),
  });

  expect(impactHandle.kill).toHaveBeenCalledTimes(1);
  expect(tile._ccLaserGunImpactTl).toBeNull();
  expect(events).toEqual(['impact-kill', 'destroy']);
});
