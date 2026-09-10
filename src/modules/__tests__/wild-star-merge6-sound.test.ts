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
  WILD_STAR_MERGE6_CRASH_BASE_VOLUME,
  WILD_STAR_MERGE6_CRASH_PLAYBACK_RATE,
  WILD_STAR_MERGE6_CRASH_SOUND_SOURCE,
  WILD_STAR_MERGE6_CRASH_VOLUME,
  WILD_STAR_MERGE6_PRIMARY_BASE_VOLUME,
  WILD_STAR_MERGE6_PRIMARY_PLAYBACK_RATE,
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
  WILD_STAR_MERGE6_SPARKLE_VOLUME_SCALE,
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

  it('locks the complete ordinary Merge-6 base plus both magic variants and quieter sparkle', () => {
    expect(WILD_STAR_MERGE6_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/star/long_magica_happy_ac_%232-1788980185281.wav',
    );
    expect(WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/star/long_magica_happy_ac_%233-1788980189939.wav',
    );
    expect(WILD_STAR_MERGE6_SOUND_PLAYBACK_RATE).toBe(1);
    expect(WILD_STAR_MERGE6_SOUND_BASE_VOLUME).toBeCloseTo(2 / 3);
    expect(WILD_STAR_MERGE6_SOUND_VOLUME).toBeCloseTo(0.4);
    expect(WILD_STAR_MERGE6_ALTERNATE_SOUND_BASE_VOLUME).toBeCloseTo(2 / 3);
    expect(WILD_STAR_MERGE6_ALTERNATE_SOUND_VOLUME).toBeCloseTo(0.4);
    expect(WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/star/magicle_sparkle_for__%231-1788980027254.wav',
    );
    expect(WILD_STAR_MERGE6_SPARKLE_VOLUME_SCALE).toBe(0.85);
    expect(WILD_STAR_MERGE6_SPARKLE_BASE_VOLUME).toBeCloseTo(0.51);
    expect(WILD_STAR_MERGE6_SPARKLE_VOLUME).toBeCloseTo(0.306);
    expect(WILD_STAR_MERGE6_SPARKLE_DELAY_MS).toBe(200);

    expect(WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge six obicna.mp3',
    );
    expect(WILD_STAR_MERGE6_PRIMARY_PLAYBACK_RATE).toBe(1.3);
    expect(WILD_STAR_MERGE6_PRIMARY_BASE_VOLUME).toBe(0.5);
    expect(WILD_STAR_MERGE6_PRIMARY_VOLUME).toBeCloseTo(0.3);
    expect(WILD_STAR_MERGE6_CRASH_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge6 crash.mp3',
    );
    expect(WILD_STAR_MERGE6_CRASH_PLAYBACK_RATE).toBe(1.3);
    expect(WILD_STAR_MERGE6_CRASH_BASE_VOLUME).toBe(0.272);
    expect(WILD_STAR_MERGE6_CRASH_VOLUME).toBeCloseTo(0.1632);
    expect(WILD_STAR_MERGE6_BOOM_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge6 boom.mp3',
    );
    expect(WILD_STAR_MERGE6_BOOM_BASE_VOLUME).toBe(0.6);
    expect(WILD_STAR_MERGE6_BOOM_VOLUME).toBeCloseTo(0.36);
    expect(WILD_STAR_MERGE6_STACK_SOUND_SOURCE).toBe('./assets/sound/merge 6/stack.mp3');
    expect(WILD_STAR_MERGE6_STACK_BASE_VOLUME).toBe(0.6);
    expect(WILD_STAR_MERGE6_STACK_VOLUME).toBeCloseTo(0.36);
  });

  it('URL-encodes filename hashes so browsers request the complete WAV path', () => {
    const wavSources = [
      WILD_STAR_MERGE6_SOUND_SOURCE,
      WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE,
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
      [WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE, 'eb6bd4cf538f00c9da587cd33a0f181e7d164a7768a76ead37fa24b8e4a071bc'],
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

  it('plays the exact ordinary four-layer mix plus one selected magic bed and delayed sparkle', () => {
    expect(preloadWildStarMerge6Sound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(7);
    const [primary, crash, boom, stack, magic, alternateMagic, sparkle] = MockAudio.instances;
    expect(primary.src).toBe(WILD_STAR_MERGE6_PRIMARY_SOUND_SOURCE);
    expect(crash.src).toBe(WILD_STAR_MERGE6_CRASH_SOUND_SOURCE);
    expect(boom.src).toBe(WILD_STAR_MERGE6_BOOM_SOUND_SOURCE);
    expect(stack.src).toBe(WILD_STAR_MERGE6_STACK_SOUND_SOURCE);
    expect(magic.src).toBe(WILD_STAR_MERGE6_SOUND_SOURCE);
    expect(alternateMagic.src).toBe(WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE);
    expect(sparkle.src).toBe(WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE);
    MockAudio.instances.forEach((audio) => expect(audio.load).toHaveBeenCalledTimes(1));

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.75);
    expect(playWildStarMerge6Sound()).toBe(true);
    expect(randomSpy).toHaveBeenCalledTimes(1);
    expect(MockAudio.instances).toHaveLength(7);
    expect(primary.playbackRate).toBe(1.3);
    expect(crash.playbackRate).toBe(1.3);
    expect(boom.playbackRate).toBe(1);
    expect(stack.playbackRate).toBe(1);
    expect(alternateMagic.playbackRate).toBe(1);
    expect(primary.volume).toBeCloseTo(0.3);
    expect(crash.volume).toBeCloseTo(0.1632);
    expect(boom.volume).toBeCloseTo(0.36);
    expect(stack.volume).toBeCloseTo(0.36);
    expect(alternateMagic.volume).toBeCloseTo(0.4);
    expect(primary.currentTime).toBe(0);
    expect(crash.currentTime).toBe(0);
    expect(boom.currentTime).toBe(0);
    expect(stack.currentTime).toBe(0);
    expect(alternateMagic.currentTime).toBe(0);
    expect(magic.play).not.toHaveBeenCalled();
    expect(primary.play).toHaveBeenCalledTimes(1);
    expect(crash.play).toHaveBeenCalledTimes(1);
    expect(boom.play).toHaveBeenCalledTimes(1);
    expect(stack.play).toHaveBeenCalledTimes(1);
    expect(alternateMagic.play).toHaveBeenCalledTimes(1);
    expect(sparkle.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(199);
    expect(sparkle.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(sparkle.play).toHaveBeenCalledTimes(1);
    expect(sparkle.volume).toBeCloseTo(0.306);
    expect(sparkle.currentTime).toBe(0);
  });

  it('does not allocate while Settings sounds are off and stops all seven preloaded sources', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areWildStarMerge6SoundsEnabled()).toBe(false);
    expect(preloadWildStarMerge6Sound()).toBe(false);
    expect(playWildStarMerge6Sound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadWildStarMerge6Sound();
    stopWildStarMerge6Sound();
    expect(MockAudio.instances).toHaveLength(7);
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });
});
