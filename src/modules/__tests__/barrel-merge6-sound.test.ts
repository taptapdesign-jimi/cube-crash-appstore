import {
  BARREL_SOUND_SOURCES,
  BARREL_PUF1_VOLUME,
  BARREL_PUF2_VOLUME,
  BARREL_PLANKS_BASE_VOLUME,
  BARREL_PLANKS_DELAY_AFTER_ANIMATION_MS,
  BARREL_PLANKS_VOLUME,
  BARREL_FOUNDATION_BOOM_VOLUME_SCALE,
  BARREL_SMOKE_POOF_VOLUME,
  playBarrelMerge6Sound,
  playBarrelPlanksAfterAnimationStart,
  playBarrelSmokePoofSound,
  preloadBarrelMerge6Sounds,
  resetBarrelMerge6SoundCacheForTests,
  stopBarrelMerge6Sounds,
} from '../barrel-merge6-sound';
import { resetCoreTntMerge6SoundCacheForTests } from '../core-tnt-merge6-sound';
import { REGULAR_MERGE6_BOOM_SOUND_SOURCE, resetRegularMerge6SoundCacheForTests } from '../regular-merge6-sound';

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

describe('Barrel Merge-6 sound timing', () => {
  const originalAudio = global.Audio;
  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetCoreTntMerge6SoundCacheForTests();
    resetRegularMerge6SoundCacheForTests();
    resetBarrelMerge6SoundCacheForTests();
  });
  afterEach(() => {
    resetBarrelMerge6SoundCacheForTests();
    resetRegularMerge6SoundCacheForTests();
    resetCoreTntMerge6SoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.useRealTimers();
  });

  test('uses TNT local timing plus puf1 immediately and puf2 after 100ms', () => {
    expect(preloadBarrelMerge6Sounds()).toBe(true);
    expect(playBarrelMerge6Sound()).toBe(true);
    const get = (source: string) => MockAudio.instances.find((audio) => audio.src === source)!;
    const horn = get(BARREL_SOUND_SOURCES.horn);
    const breakWood = get(BARREL_SOUND_SOURCES.woodBreak);
    const splinter = get(BARREL_SOUND_SOURCES.woodSplinter);
    const tnt3 = get(BARREL_SOUND_SOURCES.tnt3);
    const puf1 = get(BARREL_SOUND_SOURCES.puf1);
    const puf2 = get(BARREL_SOUND_SOURCES.puf2);
    const planks = get(BARREL_SOUND_SOURCES.planks);
    const boom = get(REGULAR_MERGE6_BOOM_SOUND_SOURCE);
    expect(horn.play).toHaveBeenCalledTimes(1);
    expect(horn.volume).toBeCloseTo(0.312);
    expect(BARREL_FOUNDATION_BOOM_VOLUME_SCALE).toBe(1.3);
    expect(boom.play).toHaveBeenCalledTimes(1);
    expect(boom.volume).toBeCloseTo(0.3042);
    expect(breakWood.play).toHaveBeenCalledTimes(1);
    expect(breakWood.volume).toBeCloseTo(0.351);
    expect(puf1.play).toHaveBeenCalledTimes(1);
    expect(puf1.volume).toBeCloseTo(BARREL_PUF1_VOLUME);
    expect(BARREL_PLANKS_BASE_VOLUME).toBe(0.7);
    expect(BARREL_PLANKS_DELAY_AFTER_ANIMATION_MS).toBe(200);
    expect(planks.play).not.toHaveBeenCalled();
    expect(splinter.play).not.toHaveBeenCalled();
    expect(puf2.play).not.toHaveBeenCalled();
    expect(tnt3.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(splinter.play).toHaveBeenCalledTimes(1);
    expect(splinter.volume).toBeCloseTo(0.351);
    expect(puf2.play).toHaveBeenCalledTimes(1);
    expect(puf2.volume).toBeCloseTo(BARREL_PUF2_VOLUME);
    jest.advanceTimersByTime(400);
    expect(tnt3.play).toHaveBeenCalledTimes(1);
    expect(tnt3.volume).toBeCloseTo(0.2184);
  });

  test('starts planks 200ms after the visible animation, regardless of merge-entry wait', () => {
    preloadBarrelMerge6Sounds();
    playBarrelMerge6Sound();
    const planks = MockAudio.instances.find((audio) => audio.src === BARREL_SOUND_SOURCES.planks)!;
    jest.advanceTimersByTime(350);
    expect(planks.play).not.toHaveBeenCalled();
    expect(playBarrelPlanksAfterAnimationStart()).toBe(true);
    expect(playBarrelPlanksAfterAnimationStart()).toBe(false);
    jest.advanceTimersByTime(199);
    expect(planks.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(planks.play).toHaveBeenCalledTimes(1);
    expect(planks.volume).toBeCloseTo(BARREL_PLANKS_VOLUME);
    expect(planks.volume).toBeCloseTo(0.42);
  });

  test('cancels delayed layers when Sounds OFF takes ownership', () => {
    preloadBarrelMerge6Sounds();
    playBarrelMerge6Sound();
    expect(playBarrelPlanksAfterAnimationStart()).toBe(true);
    (window as any)._settings.gameSoundsEnabled = false;
    stopBarrelMerge6Sounds();
    jest.advanceTimersByTime(500);
    const planks = MockAudio.instances.find((audio) => audio.src === BARREL_SOUND_SOURCES.planks);
    expect(planks?.pause).toHaveBeenCalled();
    expect(planks?.currentTime).toBe(0);
    expect(planks?.play).not.toHaveBeenCalled();
    expect(playBarrelPlanksAfterAnimationStart()).toBe(false);
    const delayed = [BARREL_SOUND_SOURCES.tnt3, BARREL_SOUND_SOURCES.woodSplinter, BARREL_SOUND_SOURCES.puf2];
    delayed.forEach((source) => {
      expect(MockAudio.instances.find((audio) => audio.src === source)?.play).not.toHaveBeenCalled();
    });
  });

  test('plays poof once only at the live smoke midpoint and disarms on cleanup', () => {
    preloadBarrelMerge6Sounds();
    playBarrelMerge6Sound();
    const poof = MockAudio.instances.find((audio) => audio.src === BARREL_SOUND_SOURCES.poof)!;
    expect(poof.play).not.toHaveBeenCalled();
    expect(playBarrelSmokePoofSound()).toBe(true);
    expect(poof.play).toHaveBeenCalledTimes(1);
    expect(poof.volume).toBeCloseTo(BARREL_SMOKE_POOF_VOLUME);
    expect(BARREL_SMOKE_POOF_VOLUME).toBeCloseTo(0.21);
    expect(playBarrelSmokePoofSound()).toBe(false);
    playBarrelMerge6Sound();
    stopBarrelMerge6Sounds();
    expect(playBarrelSmokePoofSound()).toBe(false);
    expect(poof.play).toHaveBeenCalledTimes(1);
  });
});
