import { createJourneyHubExitSoundSession, preloadJourneyHubExitSounds, stopJourneyHubExitSounds, JOURNEY_HUB_EXIT_SOUND_SOURCES } from '../journey-hub-exit-sound';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices } from '../gameplay-audio-buffer-player';
jest.mock('../gameplay-audio-buffer-player', () => ({ playDecodedGameplaySound: jest.fn(), preloadDecodedGameplaySounds: jest.fn(), stopDecodedGameplayVoices: jest.fn() }));
describe('Hub exit elemens down2 sound', () => {
  beforeEach(() => { (window as any)._settings = { gameSoundsEnabled: true }; });
  afterEach(() => { stopJourneyHubExitSounds(); delete (window as any)._settings; });
  test('preloads supplied sources and plays once for many exit targets', () => {
    preloadJourneyHubExitSounds();
    expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(JOURNEY_HUB_EXIT_SOUND_SOURCES);
    const session = createJourneyHubExitSoundSession(); session.play(); session.play();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
    for (const call of (playDecodedGameplaySound as jest.Mock).mock.calls) expect(call[1]).toMatchObject({ volume: 0.3, stopAfterSeconds: 2 });
    session.stop(); session.play(); expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
  });
  test('stale cleanup cannot stop successor and muted contacts never replay', () => {
    const old = createJourneyHubExitSoundSession(); const next = createJourneyHubExitSoundSession();
    (stopDecodedGameplayVoices as jest.Mock).mockClear(); old.stop(); old.play();
    expect(stopDecodedGameplayVoices).not.toHaveBeenCalled();
    (window as any)._settings.gameSoundsEnabled = false; next.play();
    (window as any)._settings.gameSoundsEnabled = true; next.play();
    expect(playDecodedGameplaySound).not.toHaveBeenCalled();
  });
});
