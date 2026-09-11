import {
  CTA_ACTIVATION_SOUND_BASE_VOLUMES,
  CTA_ACTIVATION_SOUND_SOURCES,
  CTA_ACTIVATION_SOUND_VOLUMES,
  playCtaActivationSounds,
  resetCtaActivationSoundsForTests,
  stopCtaActivationSounds,
} from '../cta-activation-sound.ts';

describe('shared CTA activation sound', () => {
  beforeEach(() => {
    (window as any)._settings = { gameSoundsEnabled: true };
    resetCtaActivationSoundsForTests();
  });

  afterEach(() => {
    stopCtaActivationSounds();
    delete (window as any)._settings;
  });

  test('uses all four supplied CTA layers at the requested action levels', () => {
    expect(CTA_ACTIVATION_SOUND_SOURCES).toEqual([
      './assets/sound/CTA/tap 1.wav',
      './assets/sound/CTA/tap2.wav',
      './assets/sound/CTA/tap3.wav',
      './assets/sound/CTA/tap4.wav',
    ]);
    expect(CTA_ACTIVATION_SOUND_BASE_VOLUMES).toEqual([0.5, 0.4, 0.4, 0.4]);
    expect(CTA_ACTIVATION_SOUND_VOLUMES).toEqual([0.3, 0.24, 0.24, 0.24]);
  });

  test('obeys Sounds OFF', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(playCtaActivationSounds()).toBe(false);
  });
});
