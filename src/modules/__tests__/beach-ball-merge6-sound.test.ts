import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL4_DELAY_MS,
  BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL5_DELAY_MS,
  BEACH_BALL_MERGE6_BALL5_PLAYBACK_RATE,
  BEACH_BALL_MERGE6_BALL5_SOURCE_DURATION_SECONDS,
  BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BOOM_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BOOM_VOLUME,
  BEACH_BALL_MERGE6_CRASH_PLAYBACK_RATE,
  BEACH_BALL_MERGE6_CRASH_SOUND_SOURCE,
  BEACH_BALL_MERGE6_CRASH_VOLUME,
  BEACH_BALL_MERGE6_IMPACT_BASE_VOLUME,
  BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE,
  BEACH_BALL_MERGE6_IMPACT_VOLUME,
  BEACH_BALL_MERGE6_IMMEDIATE_SOUND_SOURCES,
  BEACH_BALL_MERGE6_LAYER_BASE_VOLUME,
  BEACH_BALL_MERGE6_LAYER_VOLUME,
  BEACH_BALL_MERGE6_PRIMARY_PLAYBACK_RATE,
  BEACH_BALL_MERGE6_PRIMARY_SOUND_SOURCE,
  BEACH_BALL_MERGE6_PRIMARY_VOLUME,
  BEACH_BALL_MERGE6_STACK_SOUND_SOURCE,
  BEACH_BALL_MERGE6_STACK_VOLUME,
  areBeachBallMerge6SoundsEnabled,
  isBeachBallMerge6SoundEvent,
  playBeachBallMerge6Sound,
  preloadBeachBallMerge6Sounds,
  resetBeachBallMerge6SoundCacheForTests,
  stopBeachBallMerge6Sounds,
} from '../beach-ball-merge6-sound';

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

describe('Beach Ball merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetBeachBallMerge6SoundCacheForTests();
  });

  afterEach(() => {
    resetBeachBallMerge6SoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('inherits the complete ordinary Merge-6 foundation unchanged', () => {
    expect(BEACH_BALL_MERGE6_PRIMARY_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge six obicna.mp3',
    );
    expect(BEACH_BALL_MERGE6_PRIMARY_PLAYBACK_RATE).toBe(1.3);
    expect(BEACH_BALL_MERGE6_PRIMARY_VOLUME).toBeCloseTo(0.3);
    expect(BEACH_BALL_MERGE6_CRASH_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge6 crash.mp3',
    );
    expect(BEACH_BALL_MERGE6_CRASH_PLAYBACK_RATE).toBe(1.3);
    expect(BEACH_BALL_MERGE6_CRASH_VOLUME).toBeCloseTo(0.1632);
    expect(BEACH_BALL_MERGE6_BOOM_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge6 boom.mp3',
    );
    expect(BEACH_BALL_MERGE6_BOOM_VOLUME).toBeCloseTo(0.36);
    expect(BEACH_BALL_MERGE6_STACK_SOUND_SOURCE).toBe('./assets/sound/merge 6/stack.mp3');
    expect(BEACH_BALL_MERGE6_STACK_VOLUME).toBeCloseTo(0.36);
  });

  test('locks one fixed Ball sequence and the immediate fifty-percent impact', () => {
    expect(BEACH_BALL_MERGE6_IMMEDIATE_SOUND_SOURCES).toEqual([
      BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE,
      BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE,
      BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE,
    ]);
    expect(BEACH_BALL_MERGE6_BALL4_DELAY_MS).toBe(0);
    expect(BEACH_BALL_MERGE6_BALL5_DELAY_MS).toBe(100);
    expect(BEACH_BALL_MERGE6_BALL5_PLAYBACK_RATE).toBe(1.8);
    expect(BEACH_BALL_MERGE6_BALL5_SOURCE_DURATION_SECONDS).toBe(1.2);
    expect(BEACH_BALL_MERGE6_LAYER_BASE_VOLUME).toBeCloseTo(2 / 3);
    expect(BEACH_BALL_MERGE6_LAYER_VOLUME).toBeCloseTo(0.4);
    expect(BEACH_BALL_MERGE6_IMPACT_BASE_VOLUME).toBe(0.5);
    expect(BEACH_BALL_MERGE6_IMPACT_VOLUME).toBeCloseTo(0.3);
  });

  test('preserves the supplied Ball sources and locks the derived sixty-percent Ball 5 bytes', () => {
    const expected = [
      [BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE, '47c3461d3828b84d27e0fdfc21607e4d1a28cb04aecddfbaf7dde261ad8ee9c8'],
      [BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE, 'edcd1c1f575cdd596f93749af2b73f7adbd104d9d8dd404057b52d8f9d207358'],
      [BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE, '00caf761f231858b8d607bb98322a3618db7d17e1eb875454de558ed3b4bf682'],
      ['./assets/sound/Wild and special kockice/ball/ball5.wav', 'f9832d654f2664110e8a530928205a29f5d3632117114622dd33af3cce80e76d'],
      [BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE, 'e00f5903a2a479f55c7b1b2c9238b5e6c12f20817b6d1acca3f351cd64365cb2'],
      [BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE, '3fbca6ea392b682bf5f2a19a2571e714fdb880ceff457233e19bd752b56f4d9c'],
    ] as const;
    expected.forEach(([source, hash]) => {
      const bytes = fs.readFileSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')));
      expect(bytes.length).toBeGreaterThan(0);
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(hash);
    });
  });

  test('accepts only a committed Beach Ball Merge-6 event', () => {
    expect(isBeachBallMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecialDiceVariantId: 'beach-ball',
    })).toBe(true);
    expect(isBeachBallMerge6SoundEvent({
      effectiveSum: 6,
      dstSpecialDiceVariantId: 'beach-ball',
    })).toBe(true);
    expect(isBeachBallMerge6SoundEvent({
      effectiveSum: 5,
      srcSpecialDiceVariantId: 'beach-ball',
    })).toBe(false);
    expect(isBeachBallMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecialDiceVariantId: 'bottle',
    })).toBe(false);
  });

  test('is called once from the committed Merge-6 branch using entry-time variant identity', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore.match(/playBeachBallMerge6Sound\(\);/g)).toHaveLength(1);
    expect(appCore).toContain('if (isBeachBallMerge6SoundEvent({');
    expect(appCore).toContain('srcSpecialDiceVariantId: srcSpecialVariantAtMergeEntry?.id');
    expect(appCore).toContain('dstSpecialDiceVariantId: dstSpecialVariantAtMergeEntry?.id');
    expect(appCore.indexOf('if (effSum === 6){')).toBeLessThan(
      appCore.indexOf('playBeachBallMerge6Sound();'),
    );
  });

  test('always plays Ball 1, Ball 2, Ball 4 and impact immediately, then Ball 5 at 100ms', () => {
    expect(preloadBeachBallMerge6Sounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(9);
    const bySource = new Map(MockAudio.instances.map((audio) => [audio.src, audio]));
    const ball1 = bySource.get(BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE)!;
    const ball2 = bySource.get(BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE)!;
    const ball4 = bySource.get(BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE)!;
    const ball5 = bySource.get(BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE)!;
    const impact = bySource.get(BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE)!;

    expect(playBeachBallMerge6Sound()).toBe(true);
    expect(ball1.play).toHaveBeenCalledTimes(1);
    expect(ball1.volume).toBeCloseTo(0.4);
    expect(ball2.play).toHaveBeenCalledTimes(1);
    expect(ball2.volume).toBeCloseTo(0.4);
    expect(impact.play).toHaveBeenCalledTimes(1);
    expect(impact.volume).toBeCloseTo(0.3);
    expect(ball4.play).toHaveBeenCalledTimes(1);
    expect(ball4.volume).toBeCloseTo(0.4);
    expect(ball5.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(99);
    expect(ball5.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(ball5.play).toHaveBeenCalledTimes(1);
    expect(ball5.playbackRate).toBe(1.8);
    expect(ball5.volume).toBeCloseTo(0.4);
  });

  test('obeys Sounds OFF and stops every base/custom voice plus delayed starts', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areBeachBallMerge6SoundsEnabled()).toBe(false);
    expect(preloadBeachBallMerge6Sounds()).toBe(false);
    expect(playBeachBallMerge6Sound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadBeachBallMerge6Sounds();
    playBeachBallMerge6Sound();
    stopBeachBallMerge6Sounds();
    expect(jest.getTimerCount()).toBe(0);
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });
});
