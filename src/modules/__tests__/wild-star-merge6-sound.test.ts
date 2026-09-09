import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE,
  WILD_STAR_MERGE6_ALTERNATE_SOUND_BASE_VOLUME,
  WILD_STAR_MERGE6_ALTERNATE_SOUND_VOLUME,
  WILD_STAR_MERGE6_BOOM_BASE_VOLUME,
  WILD_STAR_MERGE6_BOOM_SOUND_SOURCE,
  WILD_STAR_MERGE6_BOOM_VOLUME,
  WILD_STAR_MERGE6_PRIMARY_BASE_VOLUME,
  WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE,
  WILD_STAR_MERGE6_PRIMARY_VOLUME,
  WILD_STAR_MERGE6_SOUND_BASE_VOLUME,
  WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE,
  WILD_STAR_MERGE6_SOUND_SOURCE,
  WILD_STAR_MERGE6_SOUND_VOLUME,
  WILD_STAR_MERGE6_SPARKLE_BASE_VOLUME,
  WILD_STAR_MERGE6_SPARKLE_DELAY_MS,
  WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE,
  WILD_STAR_MERGE6_SPARKLE_VOLUME,
  WILD_STAR_MERGE6_STACK_BASE_VOLUME,
  WILD_STAR_MERGE6_STACK_SOUND_SOURCE,
  WILD_STAR_MERGE6_STACK_VOLUME,
  areWildStarMerge6SoundsEnabled,
  isCoreWildStarMerge6SoundEvent,
  playWildStarMerge6Sound,
  preloadWildStarMerge6Sound,
  resetWildStarMerge6SoundCacheForTests,
  selectWildStarMerge6MagicSoundSource,
  stopWildStarMerge6Sound,
} from '../wild-star-merge6-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  preload = '';
  currentTime = 4;
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

describe('Wild Star merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetWildStarMerge6SoundCacheForTests();
  });

  afterEach(() => {
    resetWildStarMerge6SoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('locks both magic variants, original speed, and the balanced shared-master mix', () => {
    expect(WILD_STAR_MERGE6_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/star/long_magica_happy_ac_%232-1788980185281.wav',
    );
    expect(WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/star/long_magica_happy_ac_%233-1788980189939.wav',
    );
    expect(WILD_STAR_MERGE6_BOOM_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/star/big_tnt_boom_explosi_%231-1788980586466.wav',
    );
    expect(WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE).toBe(1);
    expect(WILD_STAR_MERGE6_SOUND_BASE_VOLUME).toBeCloseTo(2 / 3);
    expect(WILD_STAR_MERGE6_SOUND_VOLUME).toBeCloseTo(0.4);
    expect(WILD_STAR_MERGE6_ALTERNATE_SOUND_BASE_VOLUME).toBeCloseTo(2 / 3);
    expect(WILD_STAR_MERGE6_ALTERNATE_SOUND_VOLUME).toBeCloseTo(0.4);
    expect(WILD_STAR_MERGE6_BOOM_BASE_VOLUME).toBeCloseTo(1 / 3);
    expect(WILD_STAR_MERGE6_BOOM_VOLUME).toBeCloseTo(0.2);
    expect(WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/star/magicle_sparkle_for__%231-1788980027254.wav',
    );
    expect(WILD_STAR_MERGE6_SPARKLE_BASE_VOLUME).toBe(0.6);
    expect(WILD_STAR_MERGE6_SPARKLE_VOLUME).toBe(0.36);
    expect(WILD_STAR_MERGE6_SPARKLE_DELAY_MS).toBe(200);
    expect(WILD_STAR_MERGE6_STACK_SOUND_SOURCE).toBe('./assets/sound/merge 6/stack.mp3');
    expect(WILD_STAR_MERGE6_STACK_BASE_VOLUME).toBe(0.08);
    expect(WILD_STAR_MERGE6_STACK_VOLUME).toBeCloseTo(0.048);
    expect(WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge six obicna.mp3',
    );
    expect(WILD_STAR_MERGE6_PRIMARY_BASE_VOLUME).toBe(0.7);
    expect(WILD_STAR_MERGE6_PRIMARY_VOLUME).toBeCloseTo(0.42);
  });

  it('URL-encodes filename hashes so browsers request the complete WAV path', () => {
    const wavSources = [
      WILD_STAR_MERGE6_SOUND_SOURCE,
      WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE,
      WILD_STAR_MERGE6_BOOM_SOUND_SOURCE,
      WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE,
    ];
    wavSources.forEach((source) => {
      expect(source).not.toContain('#');
      expect(source).toContain('%23');
    });
  });

  it('preserves the exact supplied PCM WAV bytes', () => {
    const expected = [
      [WILD_STAR_MERGE6_SOUND_SOURCE, 'e0555dd5d3672d369de514fa1b25221f1f81eeb81c0d80acfb9cffb522ced3d5'],
      [WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE, '66edf82d2db355ac9a304d4d0745324fea065caf0c9ab487589535c005fa4bf4'],
      [WILD_STAR_MERGE6_BOOM_SOUND_SOURCE, '596dec8f3dd6696d82fb0064f63601578edb9cf0154641c56bc69bac94e09f5a'],
      [WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE, 'eb6bd4cf538f00c9da587cd33a0f181e7d164a7768a76ead37fa24b8e4a071bc'],
      [WILD_STAR_MERGE6_STACK_SOUND_SOURCE, 'f4f8665d607057d153812f5ce2191c9b376035db177c8129873312b32ad29926'],
      [WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE, 'e8ae31f0050a10d285f365c50f72fc0b83828e970a203f4da3e295a336f678e7'],
    ] as const;
    expected.forEach(([source, hash]) => {
      const assetPath = decodeURIComponent(source.replace(/^\.\//, ''));
      const bytes = fs.readFileSync(path.resolve(process.cwd(), assetPath));
      expect(bytes.length).toBeGreaterThan(0);
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(hash);
    });
  });

  it('chooses either magic bed with an even per-event split', () => {
    expect(selectWildStarMerge6MagicSoundSource(0)).toBe(WILD_STAR_MERGE6_SOUND_SOURCE);
    expect(selectWildStarMerge6MagicSoundSource(0.4999)).toBe(WILD_STAR_MERGE6_SOUND_SOURCE);
    expect(selectWildStarMerge6MagicSoundSource(0.5)).toBe(
      WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE,
    );
    expect(selectWildStarMerge6MagicSoundSource(0.9999)).toBe(
      WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE,
    );
  });

  it('accepts only the core Wild Star committed Merge-6 event', () => {
    expect(isCoreWildStarMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: 'wild',
      dstSpecial: null,
    })).toBe(true);
    expect(isCoreWildStarMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: null,
      dstSpecial: 'wild',
    })).toBe(true);
    expect(isCoreWildStarMerge6SoundEvent({
      effectiveSum: 5,
      srcSpecial: 'wild',
    })).toBe(false);
    expect(isCoreWildStarMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: 'wild-juice',
    })).toBe(false);
    expect(isCoreWildStarMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: 'wild',
      srcSpecialDiceVariantId: 'bee',
    })).toBe(false);
    expect(isCoreWildStarMerge6SoundEvent({
      effectiveSum: 6,
      dstSpecial: 'wild',
      dstSpecialDiceVariantId: 'kanta',
    })).toBe(false);
    expect(isCoreWildStarMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: null,
      dstSpecial: null,
    })).toBe(false);
  });

  it('is called once from the committed Merge-6 branch with entry-time variant provenance', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore.match(/playWildStarMerge6Sound\(\);/g)).toHaveLength(1);
    expect(appCore).toContain('if (isCoreWildStarMerge6SoundEvent({');
    expect(appCore).toContain('srcSpecialDiceVariantId: srcSpecialVariantAtMergeEntry?.id');
    expect(appCore).toContain('dstSpecialDiceVariantId: dstSpecialVariantAtMergeEntry?.id');
    expect(appCore.indexOf('if (effSum === 6){')).toBeLessThan(
      appCore.indexOf('playWildStarMerge6Sound();'),
    );
  });

  it('preloads both beds and plays one selected magic voice with the unchanged mix', () => {
    expect(preloadWildStarMerge6Sound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(6);
    const [magic, alternateMagic, boom, sparkle, stack, primary] = MockAudio.instances;
    expect(magic.src).toBe(WILD_STAR_MERGE6_SOUND_SOURCE);
    expect(alternateMagic.src).toBe(WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE);
    expect(boom.src).toBe(WILD_STAR_MERGE6_BOOM_SOUND_SOURCE);
    expect(sparkle.src).toBe(WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE);
    expect(stack.src).toBe(WILD_STAR_MERGE6_STACK_SOUND_SOURCE);
    expect(primary.src).toBe(WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE);
    expect(magic.load).toHaveBeenCalledTimes(1);
    expect(alternateMagic.load).toHaveBeenCalledTimes(1);
    expect(boom.load).toHaveBeenCalledTimes(1);
    expect(sparkle.load).toHaveBeenCalledTimes(1);
    expect(stack.load).toHaveBeenCalledTimes(1);
    expect(primary.load).toHaveBeenCalledTimes(1);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.75);
    expect(playWildStarMerge6Sound()).toBe(true);
    expect(randomSpy).toHaveBeenCalledTimes(1);
    expect(MockAudio.instances).toHaveLength(6);
    expect(alternateMagic.playbackRate).toBe(1);
    expect(boom.playbackRate).toBe(1);
    expect(alternateMagic.volume).toBeCloseTo(0.4);
    expect(boom.volume).toBeCloseTo(0.2);
    expect(stack.volume).toBeCloseTo(0.048);
    expect(primary.volume).toBeCloseTo(0.42);
    expect(alternateMagic.currentTime).toBe(0);
    expect(boom.currentTime).toBe(0);
    expect(stack.currentTime).toBe(0);
    expect(primary.currentTime).toBe(0);
    expect(magic.play).not.toHaveBeenCalled();
    expect(alternateMagic.play).toHaveBeenCalledTimes(1);
    expect(boom.play).toHaveBeenCalledTimes(1);
    expect(stack.play).toHaveBeenCalledTimes(1);
    expect(primary.play).toHaveBeenCalledTimes(1);
    expect(sparkle.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(199);
    expect(sparkle.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(sparkle.play).toHaveBeenCalledTimes(1);
    expect(sparkle.volume).toBe(0.36);
    expect(sparkle.currentTime).toBe(0);
  });

  it('does not allocate while Settings sounds are off and stops all six preloaded voices', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areWildStarMerge6SoundsEnabled()).toBe(false);
    expect(preloadWildStarMerge6Sound()).toBe(false);
    expect(playWildStarMerge6Sound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadWildStarMerge6Sound();
    stopWildStarMerge6Sound();
    expect(MockAudio.instances).toHaveLength(6);
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });
});
