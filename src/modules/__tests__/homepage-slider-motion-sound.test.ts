import {
  HOMEPAGE_SLIDER_ENTER_SOUND_SOURCE,
  HOMEPAGE_SLIDER_EXIT_SOUND_SOURCE,
  playHomepageSliderEnterSound,
  playHomepageSliderExitSound,
  preloadHomepageSliderMotionSounds,
  stopHomepageSliderMotionSounds,
} from '../homepage-slider-motion-sound';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
} from '../gameplay-audio-buffer-player';

jest.mock('../gameplay-audio-buffer-player', () => ({
  playDecodedGameplaySound: jest.fn(),
  preloadDecodedGameplaySounds: jest.fn(),
  stopDecodedGameplayVoices: jest.fn(),
}));

beforeEach(() => {
  (window as any)._settings = { gameSoundsEnabled: true };
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  jest.mocked(playDecodedGameplaySound).mockReturnValue('played');
  jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(true);
});

afterEach(() => {
  stopHomepageSliderMotionSounds();
  delete (window as any)._settings;
  delete (document as any).hidden;
});

test('preloads the exact enter and exit pair and plays one source per direction', () => {
  expect(preloadHomepageSliderMotionSounds()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([
    HOMEPAGE_SLIDER_ENTER_SOUND_SOURCE,
    HOMEPAGE_SLIDER_EXIT_SOUND_SOURCE,
  ]);
  expect(playHomepageSliderEnterSound(0.65)).toBe(true);
  expect(playHomepageSliderExitSound(0.516)).toBe(true);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source)).toEqual([
    HOMEPAGE_SLIDER_ENTER_SOUND_SOURCE,
    HOMEPAGE_SLIDER_EXIT_SOUND_SOURCE,
  ]);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls[0][1]).toMatchObject({
    volume: 0.3, stopAfterSeconds: 0.65, fadeOutSeconds: 0.05,
  });
  expect(jest.mocked(playDecodedGameplaySound).mock.calls[1][1]).toMatchObject({
    volume: 0.3, stopAfterSeconds: 0.516, fadeOutSeconds: 0.05,
  });
});

test('Sounds OFF blocks preload and both directions', () => {
  (window as any)._settings.gameSoundsEnabled = false;
  expect(preloadHomepageSliderMotionSounds()).toBe(false);
  expect(playHomepageSliderEnterSound(0.65)).toBe(false);
  expect(playHomepageSliderExitSound(0.516)).toBe(false);
  expect(playDecodedGameplaySound).not.toHaveBeenCalled();
});
