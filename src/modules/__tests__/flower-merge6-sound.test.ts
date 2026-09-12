import fs from 'node:fs';
import path from 'node:path';
import {
  CORE_TNT_BONUS_IMPACT_SOUND_SOURCES,
  playCoreTntBonusImpactSound,
  resetCoreTntMerge6SoundCacheForTests,
} from '../core-tnt-merge6-sound';
import {
  FLOWER_MERGE6_BUSH0_BASE_VOLUME,
  FLOWER_MERGE6_BUSH0_SOUND_SOURCE,
  FLOWER_MERGE6_BUSH0_VOLUME,
  FLOWER_MERGE6_BUSH2_BASE_VOLUME,
  FLOWER_MERGE6_BUSH2_SOUND_SOURCE,
  FLOWER_MERGE6_BUSH2_VOLUME,
  FLOWER_MERGE6_BUSH3_BASE_VOLUME,
  FLOWER_MERGE6_BUSH3_SOUND_SOURCE,
  FLOWER_MERGE6_BUSH3_VOLUME,
  FLOWER_MERGE6_BOOM_BASE_VOLUME,
  FLOWER_MERGE6_BOOM_SOUND_SOURCE,
  FLOWER_MERGE6_BOOM_VOLUME,
  FLOWER_MERGE6_IMMEDIATE_SOUND_SOURCES,
  FLOWER_MERGE6_LEAVES_BASE_VOLUME,
  FLOWER_MERGE6_LEAVES_START_RATIO,
  FLOWER_MERGE6_LEAVES_SOUND_SOURCE,
  FLOWER_MERGE6_LEAVES_VOLUME,
  FLOWER_MERGE6_SOUND_SOURCES,
  FLOWER_MERGE6_SPARK_BASE_VOLUME,
  FLOWER_MERGE6_SPARK_SOUND_SOURCE,
  FLOWER_MERGE6_SPARK_VOLUME,
  areFlowerMerge6SoundsEnabled,
  isFlowerMerge6SoundEvent,
  playFlowerMerge6Sound,
  playFlowerMerge6LeavesSound,
  playFlowerMerge6SparkSound,
  preloadFlowerMerge6Sounds,
  resetFlowerMerge6SoundCacheForTests,
  stopFlowerMerge6Sounds,
} from '../flower-merge6-sound';

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

describe('Flower merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetCoreTntMerge6SoundCacheForTests();
    resetFlowerMerge6SoundCacheForTests();
  });

  afterEach(() => {
    resetFlowerMerge6SoundCacheForTests();
    resetCoreTntMerge6SoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('uses bush0, bush2, bush3 and boom immediately, excludes bush1, and reserves spark for the end', () => {
    expect(FLOWER_MERGE6_IMMEDIATE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/flower/bush0.wav',
      './assets/sound/Wild and special kockice/flower/bush2.wav',
      './assets/sound/Wild and special kockice/flower/bush3.wav',
      './assets/sound/Wild and special kockice/flower/boom.wav',
    ]);
    expect(FLOWER_MERGE6_SOUND_SOURCES).toEqual([
      ...FLOWER_MERGE6_IMMEDIATE_SOUND_SOURCES,
      './assets/sound/Wild and special kockice/flower/leaves.wav',
      './assets/sound/Wild and special kockice/flower/spark.wav',
    ]);
    expect(FLOWER_MERGE6_SOUND_SOURCES.some((source) => source.includes('bush1'))).toBe(false);
    expect(FLOWER_MERGE6_BUSH0_BASE_VOLUME).toBe(0.8);
    expect(FLOWER_MERGE6_BUSH0_VOLUME).toBeCloseTo(0.48);
    expect(FLOWER_MERGE6_BUSH2_BASE_VOLUME).toBe(1);
    expect(FLOWER_MERGE6_BUSH2_VOLUME).toBeCloseTo(0.6);
    expect(FLOWER_MERGE6_BUSH3_BASE_VOLUME).toBe(0.35);
    expect(FLOWER_MERGE6_BUSH3_VOLUME).toBeCloseTo(0.21);
    expect(FLOWER_MERGE6_BOOM_BASE_VOLUME).toBe(1);
    expect(FLOWER_MERGE6_BOOM_VOLUME).toBeCloseTo(0.6);
    expect(FLOWER_MERGE6_LEAVES_BASE_VOLUME).toBe(0.8);
    expect(FLOWER_MERGE6_LEAVES_VOLUME).toBeCloseTo(0.48);
    expect(FLOWER_MERGE6_LEAVES_START_RATIO).toBe(0.9);
    expect(FLOWER_MERGE6_SPARK_BASE_VOLUME).toBe(0.6);
    expect(FLOWER_MERGE6_SPARK_VOLUME).toBeCloseTo(0.36);
  });

  test('matches only the exact Flower Merge-6 event', () => {
    expect(isFlowerMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecialDiceVariantId: 'flower',
    })).toBe(true);
    expect(isFlowerMerge6SoundEvent({
      effectiveSum: 6,
      dstSpecialDiceVariantId: 'flower',
    })).toBe(true);
    expect(isFlowerMerge6SoundEvent({
      effectiveSum: 5,
      srcSpecialDiceVariantId: 'flower',
    })).toBe(false);
    expect(isFlowerMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecialDiceVariantId: 'beach-ball',
    })).toBe(false);
  });

  test('starts Merge-6 foundation plus bush0, bush2, bush3 and boom immediately, then spark only on its callback', () => {
    expect(preloadFlowerMerge6Sounds()).toBe(true);
    expect(playFlowerMerge6Sound()).toBe(true);

    const bush0 = MockAudio.instances.find((audio) => audio.src === FLOWER_MERGE6_BUSH0_SOUND_SOURCE)!;
    const bush2 = MockAudio.instances.find((audio) => audio.src === FLOWER_MERGE6_BUSH2_SOUND_SOURCE)!;
    const bush3 = MockAudio.instances.find((audio) => audio.src === FLOWER_MERGE6_BUSH3_SOUND_SOURCE)!;
    const boom = MockAudio.instances.find((audio) => audio.src === FLOWER_MERGE6_BOOM_SOUND_SOURCE)!;
    const spark = MockAudio.instances.find((audio) => audio.src === FLOWER_MERGE6_SPARK_SOUND_SOURCE)!;
    const stack = MockAudio.instances.find(
      (audio) => audio.src === './assets/sound/merge 6/stack.mp3',
    )!;

    expect(stack.play).toHaveBeenCalledTimes(1);
    expect(bush0.play).toHaveBeenCalledTimes(1);
    expect(bush0.volume).toBeCloseTo(0.48);
    expect(bush2.play).toHaveBeenCalledTimes(1);
    expect(bush2.volume).toBeCloseTo(0.6);
    expect(bush3.play).toHaveBeenCalledTimes(1);
    expect(bush3.volume).toBeCloseTo(0.21);
    expect(boom.play).toHaveBeenCalledTimes(1);
    expect(boom.volume).toBeCloseTo(0.6);
    expect(spark.play).not.toHaveBeenCalled();

    expect(playFlowerMerge6SparkSound()).toBe(true);
    expect(spark.play).toHaveBeenCalledTimes(1);
    expect(spark.volume).toBeCloseTo(0.36);
  });

  test('shares the same shuffled four-impact source pool as TNT', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    preloadFlowerMerge6Sounds();
    playFlowerMerge6Sound();
    for (let index = 0; index < 4; index += 1) {
      expect(playCoreTntBonusImpactSound(index)).toBe(true);
    }

    const miniSources = new Set(CORE_TNT_BONUS_IMPACT_SOUND_SOURCES);
    const playedMiniLayers = MockAudio.instances.filter(
      (audio) => miniSources.has(audio.src as typeof CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[number])
        && audio.play.mock.calls.length > 0,
    );
    expect(playedMiniLayers).toHaveLength(4);
    expect(new Set(playedMiniLayers.map((audio) => audio.src)).size).toBe(4);
  });

  test('plays one eighty-percent leaves voice at its dedicated visual-progress callback', () => {
    preloadFlowerMerge6Sounds();
    playFlowerMerge6Sound();
    for (let index = 0; index < 4; index += 1) {
      expect(playCoreTntBonusImpactSound(index)).toBe(true);
    }

    const leavesLayers = MockAudio.instances.filter(
      (audio) => audio.src === FLOWER_MERGE6_LEAVES_SOUND_SOURCE,
    );
    expect(leavesLayers).toHaveLength(1);
    expect(leavesLayers[0].play).not.toHaveBeenCalled();
    expect(playFlowerMerge6LeavesSound()).toBe(true);
    expect(leavesLayers[0].play).toHaveBeenCalledTimes(1);
    expect(leavesLayers[0].volume).toBeCloseTo(0.48);
    expect(leavesLayers[0].playbackRate).toBe(1);
    expect(leavesLayers[0].currentTime).toBe(0);
  });

  test('wires start, final spark, cleanup and four impacts to Flower milestones', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const tntAnimation = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/tnt-animation.ts'), 'utf8');
    expect(appCore.match(/playFlowerMerge6Sound\(\);/g)).toHaveLength(1);
    expect(appCore).toContain("tntVariantForMerge && tntVariantForMerge.id !== 'flower'");
    expect(appCore).toContain("if (tntVariantForMerge?.id === 'flower') {");
    expect(appCore).not.toContain('playFlowerMerge6ImpactLeavesSound(impactIndex);');
    expect(appCore).toContain('spriteSequenceProgressRatio: tntVariantForMerge?.id === \'flower\'');
    expect(appCore).toContain('? FLOWER_MERGE6_LEAVES_START_RATIO');
    expect(appCore).toContain('? () => playFlowerMerge6LeavesSound()');
    expect(appCore).toContain('playFlowerMerge6SparkSound();');
    expect(appCore).toContain('stopFlowerMerge6Sounds();');
    expect(tntAnimation).toContain('standardSpriteSequenceEndTime * boundedProgressRatio');
  });

  test('obeys Sounds OFF and rewinds every owned Flower layer', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areFlowerMerge6SoundsEnabled()).toBe(false);
    expect(preloadFlowerMerge6Sounds()).toBe(false);
    expect(playFlowerMerge6Sound()).toBe(false);
    expect(playFlowerMerge6SparkSound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadFlowerMerge6Sounds();
    playFlowerMerge6Sound();
    playFlowerMerge6SparkSound();
    stopFlowerMerge6Sounds();
    MockAudio.instances
      .filter((audio) => FLOWER_MERGE6_SOUND_SOURCES.includes(
        audio.src as typeof FLOWER_MERGE6_SOUND_SOURCES[number],
      ))
      .forEach((audio) => {
        expect(audio.pause).toHaveBeenCalled();
        expect(audio.currentTime).toBe(0);
      });
  });
});
