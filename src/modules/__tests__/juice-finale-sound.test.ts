/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import * as decodedAudio from '../gameplay-audio-buffer-player';
import {
  JUICE_BUBBLE_END_SECONDS,
  JUICE_BUBBLE_FADE_SECONDS,
  JUICE_FINALE_ACTION_VOLUMES,
  JUICE_FINALE_SOUND_SOURCES,
  JUICE_INTRO_BUBBLE_DELAY_MS,
  playJuiceFinaleSound,
  preloadJuiceMerge6Sounds,
  resetJuiceFinaleSoundCacheForTests,
  shouldPlayJuiceIntroBubble,
  stopJuiceMerge6Sounds,
} from '../juice-finale-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  preload = '';
  currentTime = 2;
  volume = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

describe('core Juice Merge-6 finale sound owner', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    (global as any).Audio = MockAudio;
    MockAudio.instances = [];
    (window as any)._settings = { gameSoundsEnabled: true };
    resetJuiceFinaleSoundCacheForTests();
    jest.spyOn(decodedAudio, 'preloadDecodedGameplaySounds').mockReturnValue(false);
    jest.spyOn(decodedAudio, 'getDecodedGameplaySoundsState').mockReturnValue('unavailable');
  });

  afterEach(() => {
    resetJuiceFinaleSoundCacheForTests();
    jest.restoreAllMocks();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  test('prewarms and plays each supplied cue with an independent bounded voice', () => {
    expect(Object.values(JUICE_FINALE_SOUND_SOURCES)).toEqual([
      './assets/sound/Wild and special kockice/juice/bubble.wav',
      './assets/sound/Wild and special kockice/juice/introbubble.wav',
      './assets/sound/Wild and special kockice/juice/mini2.mp3',
      './assets/sound/Wild and special kockice/juice/mini3.wav',
      './assets/sound/Wild and special kockice/juice/mini4.wav',
    ]);
    Object.values(JUICE_FINALE_SOUND_SOURCES).forEach((source) => {
      expect(fs.existsSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')))).toBe(true);
    });
    expect(preloadJuiceMerge6Sounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(5);
    for (const cue of Object.keys(JUICE_FINALE_SOUND_SOURCES) as Array<keyof typeof JUICE_FINALE_SOUND_SOURCES>) {
      expect(playJuiceFinaleSound(cue)).toBe(true);
      const audio = MockAudio.instances.find(({ src }) => src === JUICE_FINALE_SOUND_SOURCES[cue])!;
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.volume).toBeCloseTo(JUICE_FINALE_ACTION_VOLUMES[cue] * 0.6);
    }
    stopJuiceMerge6Sounds();
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });

  test('ends only the long bubble cue one second early with a decoded fade', () => {
    jest.spyOn(decodedAudio, 'getDecodedGameplaySoundsState').mockReturnValue('ready');
    const playDecoded = jest.spyOn(decodedAudio, 'playDecodedGameplaySound').mockReturnValue('played');
    expect(playJuiceFinaleSound('bubble')).toBe(true);
    expect(playDecoded).toHaveBeenCalledWith(JUICE_FINALE_SOUND_SOURCES.bubble,
      expect.objectContaining({
        stopAfterSeconds: JUICE_BUBBLE_END_SECONDS,
        fadeOutSeconds: JUICE_BUBBLE_FADE_SECONDS,
      }));
    expect(playJuiceFinaleSound('introBubble')).toBe(true);
    expect(playDecoded.mock.calls[1][1].stopAfterSeconds).toBeUndefined();
    expect(playDecoded.mock.calls[1][1].fadeOutSeconds).toBeUndefined();
  });

  test('fades and rewinds the same bubble endpoint on media fallback', async () => {
    jest.useFakeTimers();
    try {
      expect(playJuiceFinaleSound('bubble')).toBe(true);
      const audio = MockAudio.instances.find(({ src }) => src === JUICE_FINALE_SOUND_SOURCES.bubble)!;
      await Promise.resolve();
      audio.currentTime = JUICE_BUBBLE_END_SECONDS - JUICE_BUBBLE_FADE_SECONDS;
      jest.advanceTimersByTime(50);
      expect(audio.volume).toBeCloseTo(JUICE_FINALE_ACTION_VOLUMES.bubble * 0.6);
      audio.currentTime = JUICE_BUBBLE_END_SECONDS - JUICE_BUBBLE_FADE_SECONDS / 2;
      jest.advanceTimersByTime(50);
      expect(audio.volume).toBeCloseTo(JUICE_FINALE_ACTION_VOLUMES.bubble * 0.6 * 0.5);
      audio.currentTime = JUICE_BUBBLE_END_SECONDS;
      jest.advanceTimersByTime(50);
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.volume).toBe(0);
      expect(audio.currentTime).toBe(0);
    } finally {
      stopJuiceMerge6Sounds();
      jest.useRealTimers();
    }
  });

  test.each(['onended', 'onerror'] as const)('retires the bubble interval on early %s before the authored endpoint', async event => {
    jest.useFakeTimers();
    try {
      playJuiceFinaleSound('bubble');
      await Promise.resolve();
      const audio = MockAudio.instances[0];
      expect(jest.getTimerCount()).toBe(1);
      audio.currentTime = 0.2;
      audio[event]?.();
      expect(jest.getTimerCount()).toBe(0);
      expect(audio.onended).toBeNull();
      expect(audio.onerror).toBeNull();
      jest.advanceTimersByTime(60_000);
      expect(jest.getTimerCount()).toBe(0);
    } finally { stopJuiceMerge6Sounds(); jest.useRealTimers(); }
  });

  test('a retired ended/error receipt cannot cancel a newer bubble fade on the same media element', async () => {
    jest.useFakeTimers();
    try {
      playJuiceFinaleSound('bubble');
      await Promise.resolve();
      const audio = MockAudio.instances[0];
      const oldEnded = audio.onended;
      const oldError = audio.onerror;
      playJuiceFinaleSound('bubble');
      await Promise.resolve();
      expect(MockAudio.instances).toHaveLength(1);
      expect(jest.getTimerCount()).toBe(1);
      const currentEnded = audio.onended;
      oldEnded?.(); oldError?.();
      expect(jest.getTimerCount()).toBe(1);
      expect(audio.onended).toBe(currentEnded);
      stopJuiceMerge6Sounds();
      expect(jest.getTimerCount()).toBe(0);
      currentEnded?.();
      expect(jest.getTimerCount()).toBe(0);
    } finally { stopJuiceMerge6Sounds(); jest.useRealTimers(); }
  });

  test.each(['resolve', 'reject'] as const)('late media play %s after replacement cannot acquire or retire the newer fade', async result => {
    jest.useFakeTimers();
    try {
      preloadJuiceMerge6Sounds();
      const audio = MockAudio.instances[0];
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      audio.play.mockReturnValueOnce(new Promise<void>((yes, no) => { resolve = yes; reject = no; }));
      playJuiceFinaleSound('bubble');
      const oldEnded = audio.onended;
      playJuiceFinaleSound('bubble');
      await Promise.resolve();
      expect(jest.getTimerCount()).toBe(1);
      if (result === 'resolve') resolve();
      else reject(new Error('old play retired'));
      await Promise.resolve();
      oldEnded?.();
      expect(jest.getTimerCount()).toBe(1);
    } finally { stopJuiceMerge6Sounds(); jest.useRealTimers(); }
  });

  test('an already-reached endpoint cannot re-arm an interval during late play success', async () => {
    jest.useFakeTimers();
    try {
      playJuiceFinaleSound('bubble');
      MockAudio.instances[0].currentTime = JUICE_BUBBLE_END_SECONDS;
      await Promise.resolve();
      expect(jest.getTimerCount()).toBe(0);
    } finally { stopJuiceMerge6Sounds(); jest.useRealTimers(); }
  });

  test('holds intro until 0.8s after the first visible bubble burst', () => {
    expect(JUICE_INTRO_BUBBLE_DELAY_MS).toBe(800);
    expect(shouldPlayJuiceIntroBubble(799)).toBe(false);
    expect(shouldPlayJuiceIntroBubble(800)).toBe(true);
    expect(shouldPlayJuiceIntroBubble(1600)).toBe(true);
  });

  test('board reset stops Juice voices before its recent-finale visual guard', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const boardReset = appCore.split("function cleanupFxForBoardReset(reason: string = 'unknown') {")[1]
      ?.split('function ', 1)[0] ?? '';
    expect(boardReset).toContain('stopJuiceMerge6Sounds();');
    expect(boardReset.indexOf('stopJuiceMerge6Sounds();'))
      .toBeLessThan(boardReset.indexOf('const isRecentlyStarted'));
  });

  test('Settings Sounds OFF suppresses preload and every cue', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadJuiceMerge6Sounds()).toBe(false);
    for (const cue of Object.keys(JUICE_FINALE_SOUND_SOURCES) as Array<keyof typeof JUICE_FINALE_SOUND_SOURCES>) {
      expect(playJuiceFinaleSound(cue)).toBe(false);
    }
    expect(MockAudio.instances).toHaveLength(0);
  });
});
