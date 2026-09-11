import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  FISH_MERGE6_BOOM_SOUND_SOURCE,
  FISH_MERGE6_BOOM_VOLUME,
  FISH_MERGE6_CRASH_PLAYBACK_RATE,
  FISH_MERGE6_CRASH_SOUND_SOURCE,
  FISH_MERGE6_CRASH_VOLUME,
  FISH_MERGE6_FISH0_SOUND_SOURCE,
  FISH_MERGE6_FISH0_VOLUME,
  FISH_MERGE6_FISH1_SOUND_SOURCE,
  FISH_MERGE6_FISH1_VOLUME,
  FISH_MERGE6_FISH2_DELAY_MS,
  FISH_MERGE6_FISH2_SOUND_SOURCE,
  FISH_MERGE6_FISH2_START_RATIO,
  FISH_MERGE6_FISH2_VOLUME,
  FISH_MERGE6_PRIMARY_PLAYBACK_RATE,
  FISH_MERGE6_PRIMARY_SOUND_SOURCE,
  FISH_MERGE6_PRIMARY_VOLUME,
  FISH_MERGE6_PLOMP_SOUND_SOURCE,
  FISH_MERGE6_PLOMP_VOLUME,
  FISH_MERGE6_SPEAKS_SOUND_SOURCE,
  FISH_MERGE6_SPEAKS_VOLUME,
  FISH_MERGE6_STACK_SOUND_SOURCE,
  FISH_MERGE6_STACK_VOLUME,
  FISH_MERGE6_VISUAL_DURATION_MS,
  areFishMerge6SoundsEnabled,
  isFishMerge6SoundEvent,
  playFishMerge6Sound,
  preloadFishMerge6Sounds,
  resetFishMerge6SoundCacheForTests,
  stopFishMerge6Sounds,
} from '../fish-merge6-sound';

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

describe('Fish merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetFishMerge6SoundCacheForTests();
  });

  afterEach(() => {
    resetFishMerge6SoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('inherits the complete ordinary Merge-6 foundation unchanged', () => {
    expect(FISH_MERGE6_PRIMARY_SOUND_SOURCE).toBe('./assets/sound/merge 6/merge six obicna.mp3');
    expect(FISH_MERGE6_PRIMARY_PLAYBACK_RATE).toBe(1.3);
    expect(FISH_MERGE6_PRIMARY_VOLUME).toBeCloseTo(0.3);
    expect(FISH_MERGE6_CRASH_SOUND_SOURCE).toBe('./assets/sound/merge 6/merge6 crash.mp3');
    expect(FISH_MERGE6_CRASH_PLAYBACK_RATE).toBe(1.3);
    expect(FISH_MERGE6_CRASH_VOLUME).toBeCloseTo(0.1632);
    expect(FISH_MERGE6_BOOM_SOUND_SOURCE).toBe('./assets/sound/merge 6/merge6 boom.mp3');
    expect(FISH_MERGE6_BOOM_VOLUME).toBeCloseTo(0.36);
    expect(FISH_MERGE6_STACK_SOUND_SOURCE).toBe('./assets/sound/merge 6/stack.mp3');
    expect(FISH_MERGE6_STACK_VOLUME).toBeCloseTo(0.36);
  });

  test('locks exact Fish timing to the midpoint of the 3.6-second finale', () => {
    expect(FISH_MERGE6_VISUAL_DURATION_MS).toBe(3600);
    expect(FISH_MERGE6_FISH2_START_RATIO).toBe(0.5);
    expect(FISH_MERGE6_FISH2_DELAY_MS).toBe(1800);
    expect(FISH_MERGE6_FISH0_VOLUME).toBeCloseTo(0.24);
    expect(FISH_MERGE6_FISH1_VOLUME).toBeCloseTo(0.4);
    expect(FISH_MERGE6_FISH2_VOLUME).toBeCloseTo(0.4);
    expect(FISH_MERGE6_PLOMP_VOLUME).toBeCloseTo(0.4);
    expect(FISH_MERGE6_SPEAKS_VOLUME).toBeCloseTo(0.24);
  });

  test('preserves the exact supplied Fish WAV bytes', () => {
    const expected = [
      [FISH_MERGE6_FISH0_SOUND_SOURCE, '59cf7dddaf445cc2c18fc75df5467d6c81395a7b58c0783b1b6c3c8f7c8eb93a'],
      [FISH_MERGE6_FISH1_SOUND_SOURCE, '4950808c3e04cfe5ae268e40dfefa9b7672ebfc7796a3dc2dcb8d2ce7e92773f'],
      [FISH_MERGE6_FISH2_SOUND_SOURCE, '17b4ebdd8907a1df9e717a10b5dc3d4618a8b4eabad8ca7ea2c84130b10cf7c6'],
      [FISH_MERGE6_PLOMP_SOUND_SOURCE, '86bd5c112d5c6bfccf11b209be2530d20aa6a669d11f548a2b1550435b1983bf'],
      [FISH_MERGE6_SPEAKS_SOUND_SOURCE, '4de4d40ad7558fc9f7fe87c13fd1f7e2400568dcc646ec1e9252aabb5d693e82'],
    ] as const;
    expected.forEach(([source, hash]) => {
      const bytes = fs.readFileSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')));
      expect(bytes.length).toBeGreaterThan(0);
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(hash);
    });
  });

  test('accepts only a committed Fish Merge-6 event', () => {
    expect(isFishMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'fish' })).toBe(true);
    expect(isFishMerge6SoundEvent({ effectiveSum: 6, dstSpecialDiceVariantId: 'fish' })).toBe(true);
    expect(isFishMerge6SoundEvent({ effectiveSum: 5, srcSpecialDiceVariantId: 'fish' })).toBe(false);
    expect(isFishMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'bee' })).toBe(false);
  });

  test('is called once from the committed Merge-6 branch using entry-time variant identity', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore.match(/playFishMerge6Sound\(\);/g)).toHaveLength(1);
    expect(appCore).toContain('if (isFishMerge6SoundEvent({');
    expect(appCore).toContain('srcSpecialDiceVariantId: srcSpecialVariantAtMergeEntry?.id');
    expect(appCore).toContain('dstSpecialDiceVariantId: dstSpecialVariantAtMergeEntry?.id');
    expect(appCore.indexOf('if (effSum === 6){')).toBeLessThan(appCore.indexOf('playFishMerge6Sound();'));
  });

  test('starts fish0, fish1, plomp and fish speaks immediately, then fish2 at exactly 50 percent', () => {
    expect(preloadFishMerge6Sounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(9);
    const bySource = new Map(MockAudio.instances.map((audio) => [audio.src, audio]));
    const fish0 = bySource.get(FISH_MERGE6_FISH0_SOUND_SOURCE)!;
    const fish1 = bySource.get(FISH_MERGE6_FISH1_SOUND_SOURCE)!;
    const fish2 = bySource.get(FISH_MERGE6_FISH2_SOUND_SOURCE)!;
    const plomp = bySource.get(FISH_MERGE6_PLOMP_SOUND_SOURCE)!;
    const speaks = bySource.get(FISH_MERGE6_SPEAKS_SOUND_SOURCE)!;

    expect(playFishMerge6Sound()).toBe(true);
    expect(fish0.play).toHaveBeenCalledTimes(1);
    expect(fish0.volume).toBeCloseTo(0.24);
    expect(fish1.play).toHaveBeenCalledTimes(1);
    expect(fish1.volume).toBeCloseTo(0.4);
    expect(plomp.play).toHaveBeenCalledTimes(1);
    expect(plomp.playbackRate).toBe(1);
    expect(plomp.volume).toBeCloseTo(0.4);
    expect(speaks.play).toHaveBeenCalledTimes(1);
    expect(speaks.playbackRate).toBe(1);
    expect(speaks.volume).toBeCloseTo(0.24);
    expect(fish2.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1799);
    expect(fish2.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fish2.play).toHaveBeenCalledTimes(1);
    expect(fish2.playbackRate).toBe(1);
    expect(fish2.volume).toBeCloseTo(0.4);
  });

  test('obeys Sounds OFF and cleanup cancels the delayed midpoint layer', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areFishMerge6SoundsEnabled()).toBe(false);
    expect(preloadFishMerge6Sounds()).toBe(false);
    expect(playFishMerge6Sound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadFishMerge6Sounds();
    playFishMerge6Sound();
    stopFishMerge6Sounds();
    expect(jest.getTimerCount()).toBe(0);
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });
});
