import {
  acquireCriticalGameplayAudioWindow,
  acquireDecodedGameplayAudioPackage,
  releaseUnprotectedIdleDecodedGameplayAudio,
} from '../gameplay-audio-buffer-player.ts';
import {
  JOURNEY_CRITICAL_AUDIO_WORKING_SET_MAX_BYTES,
  JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES,
  acquireJourneyCriticalAudioWorkingSet,
  releaseJourneyCoreAudioWorkingSet,
  resetJourneyCriticalAudioWorkingSetForTests,
  stopJourneyCriticalAudioWorkingSets,
} from '../journey-audio-working-set.ts';
import { releaseActiveSpecialAudioResidency } from '../special-sound-warmup.ts';

jest.mock('../gameplay-audio-buffer-player.ts', () => ({
  acquireCriticalGameplayAudioWindow: jest.fn(),
  acquireDecodedGameplayAudioPackage: jest.fn(),
  releaseUnprotectedIdleDecodedGameplayAudio: jest.fn(),
}));
jest.mock('../special-sound-warmup.ts', () => ({
  releaseActiveSpecialAudioResidency: jest.fn(),
}));

describe('Journey critical decoded-audio working set', () => {
  const releaseCritical = jest.fn();
  const releasePackage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetJourneyCriticalAudioWorkingSetForTests();
    (window as any)._settings = { gameSoundsEnabled: true };
    jest.mocked(acquireCriticalGameplayAudioWindow).mockReturnValue(releaseCritical);
    jest.mocked(acquireDecodedGameplayAudioPackage).mockReturnValue({
      admitted: true,
      isCurrent: () => true,
      release: releasePackage,
    });
  });

  afterEach(() => {
    stopJourneyCriticalAudioWorkingSets();
    delete (window as any)._settings;
  });

  test('owns the exact bounded short-cue package without Journey long loops or reward finale cues', () => {
    expect(JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES).toHaveLength(15);
    expect(new Set(JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES).size).toBe(15);
    expect(JOURNEY_CRITICAL_AUDIO_WORKING_SET_MAX_BYTES).toBe(4 * 1024 * 1024);
    expect(JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES).toEqual(expect.arrayContaining([
      './assets/sound/CTA/deeper.wav',
      './assets/sound/crate and backpack animaitons/backpack/backpack1.wav',
      './assets/sound/cjelina flip/flip.wav',
      './assets/sound/Board transitions/elements down1.wav',
      './assets/sound/Board transitions/elemens down2.wav',
    ]));
    expect(JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES).not.toContain(
      './assets/sound/worlds/crumbleworlds.wav',
    );
    expect(JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES).not.toContain(
      './assets/sound/card reveal/crumble.wav',
    );
  });

  test('suspends, sweeps only unrelated idle data, leases atomically and releases idempotently', () => {
    const release = acquireJourneyCriticalAudioWorkingSet();

    expect(acquireCriticalGameplayAudioWindow).toHaveBeenCalledTimes(1);
    expect(releaseActiveSpecialAudioResidency).toHaveBeenCalledTimes(1);
    expect(releaseUnprotectedIdleDecodedGameplayAudio).toHaveBeenCalledWith(
      JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES,
      JOURNEY_CRITICAL_AUDIO_WORKING_SET_MAX_BYTES,
    );
    expect(acquireDecodedGameplayAudioPackage).toHaveBeenCalledWith(
      'journey-core-navigation',
      expect.objectContaining({
        id: 'journey-critical-navigation',
        sources: JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES,
        maxDecodedBytes: 4 * 1024 * 1024,
        replaceIdleWorkingSet: true,
      }),
    );
    expect(jest.mocked(acquireCriticalGameplayAudioWindow).mock.invocationCallOrder[0])
      .toBeLessThan(jest.mocked(releaseUnprotectedIdleDecodedGameplayAudio).mock.invocationCallOrder[0]);
    expect(jest.mocked(releaseUnprotectedIdleDecodedGameplayAudio).mock.invocationCallOrder[0])
      .toBeLessThan(jest.mocked(acquireDecodedGameplayAudioPackage).mock.invocationCallOrder[0]);

    release();
    release();
    expect(releasePackage).not.toHaveBeenCalled();
    expect(releaseCritical).toHaveBeenCalledTimes(1);
    releaseJourneyCoreAudioWorkingSet();
    releaseJourneyCoreAudioWorkingSet();
    expect(releasePackage).toHaveBeenCalledTimes(1);
  });

  test('global Settings cleanup releases every active transition and Sounds OFF allocates nothing', () => {
    acquireJourneyCriticalAudioWorkingSet();
    acquireJourneyCriticalAudioWorkingSet();
    stopJourneyCriticalAudioWorkingSets();
    expect(releasePackage).toHaveBeenCalledTimes(1);
    expect(releaseCritical).toHaveBeenCalledTimes(2);
    expect(releaseUnprotectedIdleDecodedGameplayAudio).toHaveBeenCalledTimes(1);
    expect(acquireDecodedGameplayAudioPackage).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    (window as any)._settings.gameSoundsEnabled = false;
    acquireJourneyCriticalAudioWorkingSet()();
    expect(acquireCriticalGameplayAudioWindow).not.toHaveBeenCalled();
    expect(releaseUnprotectedIdleDecodedGameplayAudio).not.toHaveBeenCalled();
    expect(acquireDecodedGameplayAudioPackage).not.toHaveBeenCalled();
  });
});
