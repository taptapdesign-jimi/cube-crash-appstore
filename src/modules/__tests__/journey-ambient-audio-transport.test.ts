import { MOBILE_RUNTIME_PROFILE } from '../mobile-runtime-profile';
import * as decoded from '../gameplay-audio-buffer-player';
import {
  preloadJourneyWorldsHubSound, playJourneyWorldsHubSound, stopJourneyWorldsHubSound,
  resetJourneyWorldsHubSoundForTests, reduceJourneyWorldsSoundForWorld,
  JOURNEY_WORLDS_HUB_SOUND_SOURCE, JOURNEY_WORLDS_HUB_VOLUME,
  JOURNEY_WORLDS_WORLD_VOLUME, JOURNEY_WORLDS_WORLD_FADE_DELAY_MS, JOURNEY_WORLDS_WORLD_FADE_OUT_MS,
} from '../journey-worlds-hub-sound';
import {
  preloadJourneyForestAmbientSounds, playJourneyForestAmbientSounds, stopJourneyForestAmbientSounds,
  resetJourneyForestAmbientSoundsForTests, fadeOutJourneyForestAmbientSounds,
  JOURNEY_FOREST_AMBIENT_SOUND_SOURCES, JOURNEY_FOREST_AMBIENT_VOLUME, JOURNEY_FOREST_AMBIENT_FADE_OUT_MS,
} from '../journey-forest-ambient-sound';
import {
  preloadJourneyForestGameplaySound, playJourneyForestGameplaySound, stopJourneyForestGameplaySound,
  resetJourneyForestGameplaySoundForTests, fadeOutJourneyForestGameplaySound,
  JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE, JOURNEY_FOREST_GAMEPLAY_VOLUME, JOURNEY_FOREST_GAMEPLAY_FADE_OUT_MS,
} from '../journey-forest-gameplay-sound';
import { resetThermalAudioIsolationForTests, setThermalAudioSuppressed } from '../../utils/thermal-audio-isolation';

jest.mock('../mobile-runtime-profile', () => ({ MOBILE_RUNTIME_PROFILE: { isMobileDevice: true } }));
jest.mock('../gameplay-audio-buffer-player', () => ({
  preloadDecodedGameplaySounds: jest.fn(), getDecodedGameplaySoundsState: jest.fn(),
  playDecodedGameplaySound: jest.fn(), stopDecodedGameplayVoice: jest.fn(),
  stopDecodedGameplayVoices: jest.fn(), fadeOutDecodedGameplayVoice: jest.fn(),
  setDecodedGameplayVoiceVolume: jest.fn(),
}));

class MockAudio {
  static instances: MockAudio[] = [];
  preload = '';
  loop = false;
  currentTime = 5;
  volume = 1;
  paused = true;
  load = jest.fn();
  pause = jest.fn(() => { this.paused = true; });
  play = jest.fn(() => { this.paused = false; return Promise.resolve(); });
  constructor(public src: string) { MockAudio.instances.push(this); }
}

const forest = { boardNumber: 7, isArcade: false };
const owners = [
  { name: 'Worlds hub', preload: preloadJourneyWorldsHubSound, play: playJourneyWorldsHubSound, stop: stopJourneyWorldsHubSound, reset: resetJourneyWorldsHubSoundForTests, sources: [JOURNEY_WORLDS_HUB_SOUND_SOURCE], volume: JOURNEY_WORLDS_HUB_VOLUME },
  { name: 'Forest world', preload: preloadJourneyForestAmbientSounds, play: playJourneyForestAmbientSounds, stop: stopJourneyForestAmbientSounds, reset: resetJourneyForestAmbientSoundsForTests, sources: [...JOURNEY_FOREST_AMBIENT_SOUND_SOURCES], volume: JOURNEY_FOREST_AMBIENT_VOLUME },
  { name: 'Forest gameplay', preload: () => preloadJourneyForestGameplaySound(forest), play: () => playJourneyForestGameplaySound(forest), stop: stopJourneyForestGameplaySound, reset: resetJourneyForestGameplaySoundForTests, sources: [JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE], volume: JOURNEY_FOREST_GAMEPLAY_VOLUME },
];

describe('Journey ambient transport ownership', () => {
  const originalAudio = global.Audio;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    resetThermalAudioIsolationForTests();
    MOBILE_RUNTIME_PROFILE.isMobileDevice = true;
    (window as any)._settings = { gameSoundsEnabled: true };
    (global as any).Audio = MockAudio;
    MockAudio.instances = [];
    owners.forEach(owner => owner.reset());
    jest.clearAllMocks();
    jest.mocked(decoded.preloadDecodedGameplaySounds).mockReturnValue(true);
    jest.mocked(decoded.getDecodedGameplaySoundsState).mockReturnValue('ready');
    jest.mocked(decoded.playDecodedGameplaySound).mockReturnValue('played');
  });
  afterEach(() => {
    owners.forEach(owner => owner.reset());
    resetThermalAudioIsolationForTests();
    delete (window as any).__ccThermalIsolation;
    delete (window as any)._settings;
    (global as any).Audio = originalAudio;
    jest.useRealTimers();
  });

  test.each(owners)('mobile $name reuses media without preparing or playing a decoded buffer', owner => {
    for (let retry = 0; retry < 3; retry++) {
      expect(owner.preload()).toBe(true);
      expect(owner.play()).toBe(true);
      expect(owner.play()).toBe(true);
      expect(MockAudio.instances.map(audio => audio.src)).toEqual(owner.sources);
      MockAudio.instances.forEach(audio => {
        expect(audio.volume).toBeCloseTo(owner.volume);
        expect(audio.loop).toBe(true);
        expect(audio.currentTime).toBe(0);
        expect(audio.paused).toBe(false);
        expect(audio.load).toHaveBeenCalledTimes(1);
        expect(audio.play).toHaveBeenCalledTimes(retry + 1);
      });
      owner.stop();
      MockAudio.instances.forEach(audio => expect(audio.paused).toBe(true));
    }
    Object.values(decoded).filter(jest.isMockFunction).forEach(operation => expect(operation).not.toHaveBeenCalled());
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(owners)('desktop $name retains decoded preload and loop playback', owner => {
    MOBILE_RUNTIME_PROFILE.isMobileDevice = false;
    expect(owner.preload()).toBe(true);
    expect(decoded.preloadDecodedGameplaySounds).toHaveBeenCalledTimes(1);
    expect(jest.mocked(decoded.preloadDecodedGameplaySounds).mock.calls[0][0]).toEqual(owner.sources);
    expect(owner.play()).toBe(true);
    expect(owner.play()).toBe(true);
    expect(decoded.getDecodedGameplaySoundsState).toHaveBeenCalledWith(owner.sources);
    expect(decoded.playDecodedGameplaySound).toHaveBeenCalledTimes(owner.sources.length);
    owner.sources.forEach(source => expect(decoded.playDecodedGameplaySound).toHaveBeenCalledWith(source, expect.objectContaining({ loop: true, volume: owner.volume })));
    expect(MockAudio.instances).toHaveLength(0);
    owner.stop();
  });

  test.each(owners)('mobile $name is gated before allocation by Settings and diagnostic isolation', owner => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(owner.preload()).toBe(false);
    expect(owner.play()).toBe(false);
    (window as any)._settings.gameSoundsEnabled = true;
    (window as any).__ccThermalIsolation = true;
    setThermalAudioSuppressed(true);
    expect(owner.preload()).toBe(false);
    expect(owner.play()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);
    Object.values(decoded).filter(jest.isMockFunction).forEach(operation => expect(operation).not.toHaveBeenCalled());
    setThermalAudioSuppressed(false);
    expect(MockAudio.instances).toHaveLength(0);
  });

  test('mobile Forest fades retain their durations, rewind and bounded media owners', () => {
    playJourneyForestAmbientSounds();
    playJourneyForestGameplaySound(forest);
    fadeOutJourneyForestAmbientSounds();
    fadeOutJourneyForestGameplaySound();
    stopJourneyForestAmbientSounds({ preserveActiveFade: true });
    stopJourneyForestGameplaySound({ preserveActiveFade: true });
    jest.advanceTimersByTime(750);
    MockAudio.instances.forEach(audio => {
      expect(audio.paused).toBe(false);
      expect(audio.volume).toBeGreaterThan(0);
      expect(audio.volume).toBeLessThan(audio.src === JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE ? JOURNEY_FOREST_GAMEPLAY_VOLUME : JOURNEY_FOREST_AMBIENT_VOLUME);
    });
    jest.advanceTimersByTime(JOURNEY_FOREST_AMBIENT_FADE_OUT_MS - 750);
    expect(MockAudio.instances.slice(0, 2).every(audio => audio.paused && audio.currentTime === 0)).toBe(true);
    expect(MockAudio.instances[2].paused).toBe(false);
    jest.advanceTimersByTime(JOURNEY_FOREST_GAMEPLAY_FADE_OUT_MS - JOURNEY_FOREST_AMBIENT_FADE_OUT_MS);
    expect(MockAudio.instances[2].paused).toBe(true);
    expect(MockAudio.instances[2].currentTime).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(decoded.fadeOutDecodedGameplayVoice).not.toHaveBeenCalled();
  });

  test('mobile Hub preserves World attenuation, five-second hold and final fade', () => {
    playJourneyWorldsHubSound();
    const audio = MockAudio.instances[0];
    audio.currentTime = 12;
    reduceJourneyWorldsSoundForWorld();
    jest.advanceTimersByTime(1000);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_WORLD_VOLUME);
    expect(audio.currentTime).toBe(12);
    expect(audio.play).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(JOURNEY_WORLDS_WORLD_FADE_DELAY_MS - 1000);
    expect(audio.paused).toBe(false);
    jest.advanceTimersByTime(JOURNEY_WORLDS_WORLD_FADE_OUT_MS);
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_HUB_VOLUME);
    expect(jest.getTimerCount()).toBe(0);
    expect(decoded.setDecodedGameplayVoiceVolume).not.toHaveBeenCalled();
    expect(decoded.fadeOutDecodedGameplayVoice).not.toHaveBeenCalled();
  });
});
