/** @jest-environment jsdom */
import animationManager from '../animation-manager';
import { attachLaserGunFinaleScene, preloadLaserGunFinaleAssets } from '../lasergun-finale-scene';

test('preload and repeated finale entry never create central energy media', async () => {
  const createElement = jest.spyOn(document, 'createElement');
  const load = jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const complete = jest.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  try {
    await preloadLaserGunFinaleAssets();
    for (let entry = 0; entry < 3; entry += 1) {
      const overlay = document.createElement('div');
      document.body.append(overlay);
      const cleanup = attachLaserGunFinaleScene(overlay);
      try {
        expect(overlay.querySelector('video, .cc-lasergun-orbs-layer')).toBeNull();
        expect(Array.from(overlay.querySelectorAll('img')).some((image) => /orbs/i.test(image.src))).toBe(false);
      } finally {
        cleanup();
        cleanup();
        overlay.remove();
      }
    }
    expect(createElement.mock.calls.some(([tag]) => tag === 'video')).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  } finally {
    complete.mockRestore();
    animationManager.killAll();
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  }
});
