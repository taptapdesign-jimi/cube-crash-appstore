import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CORE_TNT_MERGE6_BOOM_SOUND_SOURCE,
  CORE_TNT_MERGE6_BOOM_VOLUME,
  CORE_TNT_MERGE6_CRASH_PLAYBACK_RATE,
  CORE_TNT_MERGE6_CRASH_SOUND_SOURCE,
  CORE_TNT_MERGE6_CRASH_VOLUME,
  CORE_TNT_MERGE6_PRIMARY_PLAYBACK_RATE,
  CORE_TNT_MERGE6_PRIMARY_SOUND_SOURCE,
  CORE_TNT_MERGE6_PRIMARY_VOLUME,
  CORE_TNT_MERGE6_SOUND_BASE_VOLUME,
  CORE_TNT_MERGE6_SOUND_PLAYBACK_RATE,
  CORE_TNT_MERGE6_SOUND_SOURCE,
  CORE_TNT_MERGE6_SOUND_VOLUME,
  CORE_TNT_MERGE6_STACK_SOUND_SOURCE,
  CORE_TNT_MERGE6_STACK_VOLUME,
  CORE_TNT_MERGE6_WOOD_BASE_VOLUME,
  CORE_TNT_MERGE6_WOOD_BREAK_DELAY_MS,
  CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE,
  CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE,
  CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS,
  CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE,
  CORE_TNT_MERGE6_WOOD_VOLUME,
  areCoreTntMerge6SoundsEnabled,
  isCoreTntMerge6SoundEvent,
  playCoreTntMerge6Sound,
  preloadCoreTntMerge6Sound,
  resetCoreTntMerge6SoundCacheForTests,
  stopCoreTntMerge6Sound,
} from '../core-tnt-merge6-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  preload = '';
  currentTime = 3;
  defaultPlaybackRate = 2;
  playbackRate = 2;
  volume = 0;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

describe('core TNT merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetCoreTntMerge6SoundCacheForTests();
  });

  afterEach(() => {
    resetCoreTntMerge6SoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('inherits the complete ordinary Merge-6 foundation unchanged', () => {
    expect(CORE_TNT_MERGE6_PRIMARY_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge six obicna.mp3',
    );
    expect(CORE_TNT_MERGE6_PRIMARY_PLAYBACK_RATE).toBe(1.3);
    expect(CORE_TNT_MERGE6_PRIMARY_VOLUME).toBeCloseTo(0.3);
    expect(CORE_TNT_MERGE6_CRASH_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge6 crash.mp3',
    );
    expect(CORE_TNT_MERGE6_CRASH_PLAYBACK_RATE).toBe(1.3);
    expect(CORE_TNT_MERGE6_CRASH_VOLUME).toBeCloseTo(0.1632);
    expect(CORE_TNT_MERGE6_BOOM_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge6 boom.mp3',
    );
    expect(CORE_TNT_MERGE6_BOOM_VOLUME).toBeCloseTo(0.36);
    expect(CORE_TNT_MERGE6_STACK_SOUND_SOURCE).toBe('./assets/sound/merge 6/stack.mp3');
    expect(CORE_TNT_MERGE6_STACK_VOLUME).toBeCloseTo(0.36);
  });

  test('locks tnt3 plus the staggered ninety-percent wood layers', () => {
    expect(CORE_TNT_MERGE6_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/tnt/tnt3.wav',
    );
    expect(CORE_TNT_MERGE6_SOUND_PLAYBACK_RATE).toBe(1);
    expect(CORE_TNT_MERGE6_SOUND_BASE_VOLUME).toBe(0.7);
    expect(CORE_TNT_MERGE6_SOUND_VOLUME).toBeCloseTo(0.42);
    expect(CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/tnt/wood break.wav',
    );
    expect(CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/tnt/wood ssplinter.wav',
    );
    expect(CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE).toBe(1);
    expect(CORE_TNT_MERGE6_WOOD_BASE_VOLUME).toBe(0.9);
    expect(CORE_TNT_MERGE6_WOOD_VOLUME).toBeCloseTo(0.54);
    expect(CORE_TNT_MERGE6_WOOD_BREAK_DELAY_MS).toBe(0);
    expect(CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS).toBe(100);

    const expected = [
      [CORE_TNT_MERGE6_SOUND_SOURCE, 'd122630b22e524839e1e63c15cd58058ce202ff1a74bb9914f664d1496192d48'],
      [CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE, '616a19c56cf3b54749519e5aa538c248d08f732d6522dab3e9f0f7275f3f2bcd'],
      [CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE, '419b194e80ac980f4948447589546c9e058ad178566eca5c90f38c25bf678d07'],
    ] as const;
    expected.forEach(([source, hash]) => {
      const bytes = fs.readFileSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')));
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(hash);
    });
  });

  test('accepts only core TNT plus a regular die at committed Merge-6', () => {
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: 'wild-tnt',
      dstSpecial: null,
    })).toBe(true);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: null,
      dstSpecial: 'wild-tnt',
    })).toBe(true);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 5,
      srcSpecial: 'wild-tnt',
    })).toBe(false);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: 'wild-tnt',
      srcSpecialDiceVariantId: 'beach-ball',
    })).toBe(false);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      dstSpecial: 'wild-tnt',
      dstSpecialDiceVariantId: 'flower',
    })).toBe(false);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: 'wild-tnt',
      dstSpecial: 'wild',
    })).toBe(false);
  });

  test('is called once from the committed Merge-6 branch with entry-time provenance', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore.match(/playCoreTntMerge6Sound\(\);/g)).toHaveLength(1);
    expect(appCore).toContain('if (isCoreTntMerge6SoundEvent({');
    expect(appCore).toContain('srcSpecialDiceVariantId: srcSpecialVariantAtMergeEntry?.id');
    expect(appCore).toContain('dstSpecialDiceVariantId: dstSpecialVariantAtMergeEntry?.id');
    expect(appCore.indexOf('if (effSum === 6){')).toBeLessThan(
      appCore.indexOf('playCoreTntMerge6Sound();'),
    );
  });

  test('plays tnt3 and wood break immediately, then wood splinter at one hundred milliseconds', () => {
    expect(preloadCoreTntMerge6Sound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(7);
    const tnt3 = MockAudio.instances.find((audio) => audio.src === CORE_TNT_MERGE6_SOUND_SOURCE)!;
    const woodBreak = MockAudio.instances.find(
      (audio) => audio.src === CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE,
    )!;
    const woodSplinter = MockAudio.instances.find(
      (audio) => audio.src === CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE,
    )!;

    expect(playCoreTntMerge6Sound()).toBe(true);
    expect(tnt3.play).toHaveBeenCalledTimes(1);
    expect(tnt3.playbackRate).toBe(1);
    expect(tnt3.volume).toBeCloseTo(0.42);
    expect(tnt3.currentTime).toBe(0);
    expect(woodBreak.play).toHaveBeenCalledTimes(1);
    expect(woodBreak.volume).toBeCloseTo(0.54);
    expect(woodSplinter.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(99);
    expect(woodSplinter.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(woodSplinter.play).toHaveBeenCalledTimes(1);
    expect(woodSplinter.volume).toBeCloseTo(0.54);
    expect(MockAudio.instances).toHaveLength(7);
  });

  test('obeys Sounds OFF and stops the ordinary base plus all TNT layers', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areCoreTntMerge6SoundsEnabled()).toBe(false);
    expect(preloadCoreTntMerge6Sound()).toBe(false);
    expect(playCoreTntMerge6Sound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadCoreTntMerge6Sound();
    playCoreTntMerge6Sound();
    stopCoreTntMerge6Sound();
    expect(jest.getTimerCount()).toBe(0);
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });
});
