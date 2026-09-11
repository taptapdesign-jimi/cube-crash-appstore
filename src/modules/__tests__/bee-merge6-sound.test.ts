import fs from 'node:fs';
import path from 'node:path';
import {
  BEE_MERGE6_BASE_VOLUME,
  BEE_MERGE6_BEE_BASE_VOLUME,
  BEE_MERGE6_BEE_SOUND_SOURCE,
  BEE_MERGE6_BEE_VOLUME,
  BEE_MERGE6_BRUSHING_BASE_VOLUME,
  BEE_MERGE6_BRUSHING_SOUND_SOURCE,
  BEE_MERGE6_BRUSHING_VOLUME,
  BEE_MERGE6_FINALE_SOUND_SOURCES,
  BEE_MERGE6_HAPPY_BASE_VOLUME,
  BEE_MERGE6_HAPPY_SOUND_SOURCE,
  BEE_MERGE6_HAPPY_VOLUME,
  BEE_MERGE6_IMMEDIATE_SOUND_SOURCES,
  BEE_MERGE6_SOUND_SOURCES,
  BEE_MERGE6_START_BASE_VOLUME,
  BEE_MERGE6_START_SOUND_SOURCE,
  BEE_MERGE6_START_VOLUME,
  BEE_MERGE6_VOLUME,
  areBeeMerge6SoundsEnabled,
  isBeeMerge6SoundEvent,
  playBeeMerge6FinaleSounds,
  playBeeMerge6Sound,
  preloadBeeMerge6Sounds,
  resetBeeMerge6SoundCacheForTests,
  stopBeeMerge6Sounds,
} from '../bee-merge6-sound';

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

describe('Bee merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetBeeMerge6SoundCacheForTests();
  });

  afterEach(() => {
    resetBeeMerge6SoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
  });

  test('locks the revised Bee sources and excludes every removed layer', () => {
    expect(BEE_MERGE6_IMMEDIATE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/bee/bee start.wav',
      './assets/sound/Wild and special kockice/bee/BEE.wav',
      './assets/sound/Wild and special kockice/bee/brushing.wav',
    ]);
    expect(BEE_MERGE6_FINALE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/bee/happy bee.wav',
    ]);
    expect(BEE_MERGE6_BRUSHING_SOUND_SOURCE).toContain('brushing.wav');
    expect(BEE_MERGE6_SOUND_SOURCES).toHaveLength(4);
    expect(BEE_MERGE6_SOUND_SOURCES.some((source) => source.includes('fishy wee.wav'))).toBe(false);
    expect(BEE_MERGE6_SOUND_SOURCES.some((source) => source.includes('/poof'))).toBe(false);
    expect(BEE_MERGE6_SOUND_SOURCES.some((source) => source.endsWith('/smile.wav'))).toBe(false);
    expect(BEE_MERGE6_SOUND_SOURCES.some((source) => source.includes('smile bee.wav'))).toBe(false);
    expect(BEE_MERGE6_SOUND_SOURCES.some((source) => source.includes('leaves trail.wav'))).toBe(false);
    expect(BEE_MERGE6_SOUND_SOURCES.some((source) => source.endsWith('/leaves.wav'))).toBe(false);
    expect(BEE_MERGE6_BASE_VOLUME).toBe(1);
    expect(BEE_MERGE6_VOLUME).toBeCloseTo(0.6);
    expect(BEE_MERGE6_START_BASE_VOLUME).toBe(0.75);
    expect(BEE_MERGE6_START_VOLUME).toBeCloseTo(0.45);
    expect(BEE_MERGE6_BEE_BASE_VOLUME).toBe(0.7);
    expect(BEE_MERGE6_BEE_VOLUME).toBeCloseTo(0.42);
    expect(BEE_MERGE6_BRUSHING_BASE_VOLUME).toBe(0.8);
    expect(BEE_MERGE6_BRUSHING_VOLUME).toBeCloseTo(0.48);
    expect(BEE_MERGE6_HAPPY_BASE_VOLUME).toBe(0.2);
    expect(BEE_MERGE6_HAPPY_VOLUME).toBeCloseTo(0.12);
  });

  test('matches only exact Bee Merge-6 provenance', () => {
    expect(isBeeMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'bee' })).toBe(true);
    expect(isBeeMerge6SoundEvent({ effectiveSum: 6, dstSpecialDiceVariantId: 'bee' })).toBe(true);
    expect(isBeeMerge6SoundEvent({ effectiveSum: 5, srcSpecialDiceVariantId: 'bee' })).toBe(false);
    expect(isBeeMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'flower' })).toBe(false);
  });

  test('plays foundation and immediate pair first, then only callback-owned groups', () => {
    expect(preloadBeeMerge6Sounds()).toBe(true);
    expect(playBeeMerge6Sound()).toBe(true);
    const played = (source: string) => MockAudio.instances.find((audio) => audio.src === source)!;
    expect(played('./assets/sound/merge 6/stack.mp3').play).toHaveBeenCalledTimes(1);
    BEE_MERGE6_IMMEDIATE_SOUND_SOURCES.forEach((source) => {
      expect(played(source).play).toHaveBeenCalledTimes(1);
      expect(played(source).volume).toBeCloseTo(
        source === BEE_MERGE6_START_SOUND_SOURCE
          ? 0.45
          : source === BEE_MERGE6_BEE_SOUND_SOURCE
            ? 0.42
            : source === BEE_MERGE6_BRUSHING_SOUND_SOURCE
              ? 0.48
              : 0.6,
      );
    });
    BEE_MERGE6_FINALE_SOUND_SOURCES.forEach((source) => {
      expect(played(source).play).not.toHaveBeenCalled();
    });
    expect(playBeeMerge6FinaleSounds()).toBe(true);
    BEE_MERGE6_FINALE_SOUND_SOURCES.forEach((source) => {
      expect(played(source).play).toHaveBeenCalledTimes(1);
    });
    expect(played(BEE_MERGE6_HAPPY_SOUND_SOURCE).volume).toBeCloseTo(0.12);
  });

  test('wires Bee start and exact visual-owner milestones without entering Flower/TNT timing', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const scene = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/bee-finale-scene.ts'), 'utf8');
    const splash = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/splash-text-overlay.ts'), 'utf8');
    expect(appCore.match(/playBeeMerge6Sound\(\);/g)).toHaveLength(1);
    expect(scene).toContain('BEE_FINALE_HAPPY_SOUND_PROGRESS = 0.4');
    expect(scene).toContain('BEE_FINALE_HAPPY_SOUND_SECONDS');
    expect(splash).toContain('onFinale: playBeeMerge6FinaleSounds');
  });

  test('obeys Sounds OFF and cleanup rewinds all Bee-owned layers', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areBeeMerge6SoundsEnabled()).toBe(false);
    expect(preloadBeeMerge6Sounds()).toBe(false);
    expect(playBeeMerge6Sound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);
    (window as any)._settings.gameSoundsEnabled = true;
    preloadBeeMerge6Sounds();
    playBeeMerge6Sound();
    playBeeMerge6FinaleSounds();
    stopBeeMerge6Sounds();
    MockAudio.instances
      .filter((audio) => BEE_MERGE6_SOUND_SOURCES.includes(
        audio.src as typeof BEE_MERGE6_SOUND_SOURCES[number],
      ))
      .forEach((audio) => {
        expect(audio.pause).toHaveBeenCalled();
        expect(audio.currentTime).toBe(0);
      });
  });
});
