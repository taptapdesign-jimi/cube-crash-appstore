import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  REGULAR_MERGE6_BOOM_SOUND_SOURCE,
  REGULAR_MERGE6_BOOM_VOLUME,
  REGULAR_MERGE6_CRASH_AUDIBLE_DURATION_MS,
  REGULAR_MERGE6_CRASH_BASE_AUDIBLE_DURATION_MS,
  REGULAR_MERGE6_CRASH_FADE_OUT_DURATION_MS,
  REGULAR_MERGE6_CRASH_KEEP_RATIO,
  REGULAR_MERGE6_CRASH_LENGTH_REDUCTION_MS,
  REGULAR_MERGE6_CRASH_PLAYBACK_RATE,
  REGULAR_MERGE6_CRASH_SOUND_SOURCE,
  REGULAR_MERGE6_CRASH_VOLUME,
  REGULAR_MERGE6_SOUND_PLAYBACK_RATE,
  REGULAR_MERGE6_SOUND_SOURCE,
  REGULAR_MERGE6_SOUND_VOLUME,
  REGULAR_MERGE6_STACK_BASE_VOLUME,
  REGULAR_MERGE6_STACK_SOUND_SOURCE,
  REGULAR_MERGE6_STACK_VOLUME,
  areRegularMerge6SoundsEnabled,
  playRegularMerge6Sound,
  preloadRegularMerge6Sounds,
  resetRegularMerge6SoundCacheForTests,
  stopRegularMerge6Sounds,
} from '../regular-merge6-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  preload = '';
  currentTime = 7;
  defaultPlaybackRate = 3;
  playbackRate = 3;
  volume = 0.25;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

describe('regular merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetRegularMerge6SoundCacheForTests();
  });

  afterEach(() => {
    resetRegularMerge6SoundCacheForTests();
    jest.useRealTimers();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  it('locks the requested source, speed, gain, and crash-length mix', () => {
    expect(REGULAR_MERGE6_SOUND_SOURCE).toBe('./assets/sound/merge 6/merge six obicna.mp3');
    expect(REGULAR_MERGE6_SOUND_PLAYBACK_RATE).toBe(1.3);
    expect(REGULAR_MERGE6_SOUND_VOLUME).toBe(0.3);
    expect(REGULAR_MERGE6_CRASH_SOUND_SOURCE).toBe('./assets/sound/merge 6/merge6 crash.mp3');
    expect(REGULAR_MERGE6_CRASH_PLAYBACK_RATE).toBe(1.3);
    expect(REGULAR_MERGE6_CRASH_VOLUME).toBeCloseTo(0.1632);
    expect(REGULAR_MERGE6_CRASH_KEEP_RATIO).toBe(0.6);
    expect(REGULAR_MERGE6_CRASH_BASE_AUDIBLE_DURATION_MS).toBe(942);
    expect(REGULAR_MERGE6_CRASH_LENGTH_REDUCTION_MS).toBe(50);
    expect(REGULAR_MERGE6_CRASH_AUDIBLE_DURATION_MS).toBe(892);
    expect(REGULAR_MERGE6_CRASH_FADE_OUT_DURATION_MS).toBe(120);
    expect(REGULAR_MERGE6_BOOM_SOUND_SOURCE).toBe('./assets/sound/merge 6/merge6 boom.mp3');
    expect(REGULAR_MERGE6_BOOM_VOLUME).toBeCloseTo(0.36);
    expect(REGULAR_MERGE6_STACK_SOUND_SOURCE).toBe('./assets/sound/merge 6/stack.mp3');
    expect(REGULAR_MERGE6_STACK_BASE_VOLUME).toBe(0.6);
    expect(REGULAR_MERGE6_STACK_VOLUME).toBeCloseTo(0.36);
  });

  it('is called once only by the committed ordinary die-on-die Merge-6 branch', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore.match(/playRegularMerge6Sound\(\);/g)).toHaveLength(1);
    expect(appCore).toContain(
      "if (!wildActive && !srcSpecial && !dstSpecial) {\n      playRegularMerge6Sound();",
    );
    expect(appCore.indexOf('if (effSum === 6){')).toBeLessThan(
      appCore.indexOf('playRegularMerge6Sound();'),
    );
  });

  it('does not allocate or play when game sounds are off', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areRegularMerge6SoundsEnabled()).toBe(false);
    expect(preloadRegularMerge6Sounds()).toBe(false);
    expect(playRegularMerge6Sound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);
  });

  it('starts the first two at 1.3x while leaving boom unchanged', () => {
    expect(preloadRegularMerge6Sounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(4);
    const [primary, crash, boom, stack] = MockAudio.instances;
    expect(primary.src).toBe(REGULAR_MERGE6_SOUND_SOURCE);
    expect(crash.src).toBe(REGULAR_MERGE6_CRASH_SOUND_SOURCE);
    expect(boom.src).toBe(REGULAR_MERGE6_BOOM_SOUND_SOURCE);
    expect(stack.src).toBe(REGULAR_MERGE6_STACK_SOUND_SOURCE);
    expect(primary.load).toHaveBeenCalledTimes(1);
    expect(crash.load).toHaveBeenCalledTimes(1);
    expect(boom.load).toHaveBeenCalledTimes(1);
    expect(stack.load).toHaveBeenCalledTimes(1);

    expect(playRegularMerge6Sound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(4);
    expect(primary.playbackRate).toBe(1.3);
    expect(crash.playbackRate).toBe(1.3);
    expect(boom.playbackRate).toBe(1);
    expect(stack.playbackRate).toBe(1);
    expect(primary.volume).toBe(0.3);
    expect(crash.volume).toBeCloseTo(0.1632);
    expect(boom.volume).toBeCloseTo(0.36);
    expect(stack.volume).toBeCloseTo(0.36);
    expect(primary.currentTime).toBe(0);
    expect(crash.currentTime).toBe(0);
    expect(boom.currentTime).toBe(0);
    expect(stack.currentTime).toBe(0);
    expect(primary.play).toHaveBeenCalledTimes(1);
    expect(crash.play).toHaveBeenCalledTimes(1);
    expect(boom.play).toHaveBeenCalledTimes(1);
    expect(stack.play).toHaveBeenCalledTimes(1);
  });

  it('fades and cuts only the crash layer 50ms before its previous endpoint', () => {
    preloadRegularMerge6Sounds();
    playRegularMerge6Sound();
    const [primary, crash, boom, stack] = MockAudio.instances;
    primary.pause.mockClear();
    crash.pause.mockClear();
    boom.pause.mockClear();
    stack.pause.mockClear();

    const fadeStartMs = REGULAR_MERGE6_CRASH_AUDIBLE_DURATION_MS -
      REGULAR_MERGE6_CRASH_FADE_OUT_DURATION_MS;
    jest.advanceTimersByTime(fadeStartMs);
    expect(crash.volume).toBeCloseTo(0.1632);
    jest.advanceTimersByTime(REGULAR_MERGE6_CRASH_FADE_OUT_DURATION_MS / 2);
    expect(crash.volume).toBeCloseTo(0.0816);
    expect(crash.pause).not.toHaveBeenCalled();
    jest.advanceTimersByTime(REGULAR_MERGE6_CRASH_FADE_OUT_DURATION_MS / 2 - 1);
    expect(crash.pause).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(crash.pause).toHaveBeenCalledTimes(1);
    expect(crash.volume).toBe(0);
    expect(crash.currentTime).toBe(0);
    expect(primary.pause).not.toHaveBeenCalled();
    expect(boom.pause).not.toHaveBeenCalled();
    expect(stack.pause).not.toHaveBeenCalled();
  });

  it('stops and rewinds all four owned voices', () => {
    preloadRegularMerge6Sounds();
    playRegularMerge6Sound();
    stopRegularMerge6Sounds();
    for (const audio of MockAudio.instances) {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    }
    expect(jest.getTimerCount()).toBe(0);
  });
});
