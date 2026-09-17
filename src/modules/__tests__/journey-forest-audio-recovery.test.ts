/** @jest-environment jsdom */
import * as decoded from '../gameplay-audio-buffer-player';
import {
  playJourneyForestAmbientSounds, stopJourneyForestAmbientSounds, fadeOutJourneyForestAmbientSounds,
  resetJourneyForestAmbientSoundsForTests,
} from '../journey-forest-ambient-sound';
import {
  playJourneyForestGameplaySound, stopJourneyForestGameplaySound,
  resetJourneyForestGameplaySoundForTests,
} from '../journey-forest-gameplay-sound';

class TestContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = async () => {};
  close = async () => {};
  decodeAudioData = async () => ({ length: 48000, numberOfChannels: 2, duration: 1 });
  createGain() {
    return { gain: { setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} };
  }
  createBufferSource() {
    return { playbackRate: { setValueAtTime() {} }, start() {}, stop() {}, connect() {}, disconnect() {}, onended: null };
  }
}
const owners = [
  { name: 'world ambience', play: playJourneyForestAmbientSounds, stop: stopJourneyForestAmbientSounds, voices: 2 },
  { name: 'gameplay ambience', play: () => playJourneyForestGameplaySound({ boardNumber: 1, isArcade: false }), stop: stopJourneyForestGameplaySound, voices: 1 },
];
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };

describe('Forest audio owner deferred failure recovery', () => {
  const originalContext = window.AudioContext;
  const originalFetch = global.fetch;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: TestContext });
    (window as any)._settings = { gameSoundsEnabled: true };
    global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) })) as jest.Mock;
  });
  afterEach(() => {
    resetJourneyForestAmbientSoundsForTests();
    resetJourneyForestGameplaySoundForTests();
    decoded.resetDecodedGameplayAudioForTests();
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalContext });
    global.fetch = originalFetch;
    delete (window as any)._settings;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test.each(owners)('$name retries after actual queued decode failure instead of staying falsely active', async (owner) => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('transient load failure'));
    expect(owner.play()).toBe(true);
    await flush();
    expect(decoded.getDecodedGameplayAudioStats()).toMatchObject({ activeVoices: 0, pendingVoiceStarts: 0 });
    jest.advanceTimersByTime(2001);
    expect(owner.play()).toBe(true);
    await flush();
    expect(decoded.getDecodedGameplayAudioStats()).toMatchObject({ activeVoices: owner.voices, pendingVoiceStarts: 0 });
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(owner.voices);
  });

  test('returning during a fallback fade stops old media before decoded ambience takes over', () => {
    const originalAudio = global.Audio;
    const media: Array<{ paused: boolean; play: () => Promise<void>; pause: () => void }> = [];
    global.Audio = jest.fn(() => {
      const voice = { paused: true, currentTime: 0, volume: 1, loop: true, preload: 'auto',
        load() {}, play: async () => { voice.paused = false; }, pause: () => { voice.paused = true; } };
      media.push(voice);
      return voice;
    }) as unknown as typeof Audio;
    const state = jest.spyOn(decoded, 'getDecodedGameplaySoundsState').mockReturnValue('unavailable');
    const play = jest.spyOn(decoded, 'playDecodedGameplaySound').mockReturnValue('played');
    try {
      playJourneyForestAmbientSounds();
      expect(media.every((voice) => !voice.paused)).toBe(true);
      fadeOutJourneyForestAmbientSounds();
      state.mockReturnValue('ready');
      playJourneyForestAmbientSounds();
      expect(media.every((voice) => voice.paused)).toBe(true);
      expect(play).toHaveBeenCalledTimes(2);
    } finally { global.Audio = originalAudio; }
  });

  test.each(owners)('$name ignores a stale failure from a stopped generation', (owner) => {
    const callbacks: Array<() => void> = [];
    jest.spyOn(decoded, 'getDecodedGameplaySoundsState').mockReturnValue('pending');
    const play = jest.spyOn(decoded, 'playDecodedGameplaySound').mockImplementation((_source, options) => {
      callbacks.push(options.onDeferredUnavailable!);
      return 'pending';
    });
    owner.play();
    const stale = callbacks[0];
    owner.stop();
    owner.play();
    const calls = play.mock.calls.length;
    stale();
    owner.play();
    expect(play).toHaveBeenCalledTimes(calls);
    callbacks[callbacks.length - 1]();
    owner.play();
    expect(play.mock.calls.length).toBe(calls + owner.voices);
  });
});
