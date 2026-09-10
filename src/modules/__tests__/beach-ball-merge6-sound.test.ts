import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL4_DELAY_MS,
  BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BALL5_DELAY_MS,
  BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BOOM_SOUND_SOURCE,
  BEACH_BALL_MERGE6_BOOM_VOLUME,
  BEACH_BALL_MERGE6_CRASH_PLAYBACK_RATE,
  BEACH_BALL_MERGE6_CRASH_SOUND_SOURCE,
  BEACH_BALL_MERGE6_CRASH_VOLUME,
  BEACH_BALL_MERGE6_IMPACT_BASE_VOLUME,
  BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE,
  BEACH_BALL_MERGE6_IMPACT_VOLUME,
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
  selectBeachBallMerge6Variant,
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

  test('locks both two-layer Ball variants and the immediate fifty-percent impact', () => {
    expect(selectBeachBallMerge6Variant(0)).toEqual({
      primarySource: BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE,
      secondarySource: BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE,
      secondaryDelayMs: BEACH_BALL_MERGE6_BALL4_DELAY_MS,
    });
    expect(selectBeachBallMerge6Variant(0.4999).primarySource).toBe(
      BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE,
    );
    expect(selectBeachBallMerge6Variant(0.5)).toEqual({
      primarySource: BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE,
      secondarySource: BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE,
      secondaryDelayMs: BEACH_BALL_MERGE6_BALL5_DELAY_MS,
    });
    expect(BEACH_BALL_MERGE6_BALL4_DELAY_MS).toBe(0);
    expect(BEACH_BALL_MERGE6_BALL5_DELAY_MS).toBe(100);
    expect(BEACH_BALL_MERGE6_LAYER_BASE_VOLUME).toBeCloseTo(2 / 3);
    expect(BEACH_BALL_MERGE6_LAYER_VOLUME).toBeCloseTo(0.4);
    expect(BEACH_BALL_MERGE6_IMPACT_BASE_VOLUME).toBe(0.5);
    expect(BEACH_BALL_MERGE6_IMPACT_VOLUME).toBeCloseTo(0.3);
  });

  test('preserves the exact supplied Ball sound bytes', () => {
    const expected = [
      [BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE, '47c3461d3828b84d27e0fdfc21607e4d1a28cb04aecddfbaf7dde261ad8ee9c8'],
      [BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE, 'a7ad757c798ef9575fe6e94fc35f7db6efebeebb9e497a1be271cef773dd2ee9'],
      [BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE, '00caf761f231858b8d607bb98322a3618db7d17e1eb875454de558ed3b4bf682'],
      [BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE, 'f9832d654f2664110e8a530928205a29f5d3632117114622dd33af3cce80e76d'],
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

  test('plays Ball 2, Ball 4 and impact immediately', () => {
    expect(preloadBeachBallMerge6Sounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(9);
    const bySource = new Map(MockAudio.instances.map((audio) => [audio.src, audio]));
    const ball2 = bySource.get(BEACH_BALL_MERGE6_BALL2_SOUND_SOURCE)!;
    const ball4 = bySource.get(BEACH_BALL_MERGE6_BALL4_SOUND_SOURCE)!;
    const impact = bySource.get(BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE)!;
    jest.spyOn(Math, 'random').mockReturnValue(0.25);

    expect(playBeachBallMerge6Sound()).toBe(true);
    expect(ball2.play).toHaveBeenCalledTimes(1);
    expect(ball2.volume).toBeCloseTo(0.4);
    expect(impact.play).toHaveBeenCalledTimes(1);
    expect(impact.volume).toBeCloseTo(0.3);
    expect(ball4.play).toHaveBeenCalledTimes(1);
    expect(ball4.volume).toBeCloseTo(0.4);
  });

  test('plays Ball 1 and impact immediately, then Ball 5 after one hundred milliseconds', () => {
    expect(preloadBeachBallMerge6Sounds()).toBe(true);
    const bySource = new Map(MockAudio.instances.map((audio) => [audio.src, audio]));
    const ball1 = bySource.get(BEACH_BALL_MERGE6_BALL1_SOUND_SOURCE)!;
    const ball5 = bySource.get(BEACH_BALL_MERGE6_BALL5_SOUND_SOURCE)!;
    const impact = bySource.get(BEACH_BALL_MERGE6_IMPACT_SOUND_SOURCE)!;
    jest.spyOn(Math, 'random').mockReturnValue(0.75);

    expect(playBeachBallMerge6Sound()).toBe(true);
    expect(ball1.play).toHaveBeenCalledTimes(1);
    expect(impact.play).toHaveBeenCalledTimes(1);
    expect(ball5.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(99);
    expect(ball5.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(ball5.play).toHaveBeenCalledTimes(1);
  });

  test('obeys Sounds OFF and stops every base/custom voice plus delayed starts', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areBeachBallMerge6SoundsEnabled()).toBe(false);
    expect(preloadBeachBallMerge6Sounds()).toBe(false);
    expect(playBeachBallMerge6Sound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadBeachBallMerge6Sounds();
    jest.spyOn(Math, 'random').mockReturnValue(0.25);
    playBeachBallMerge6Sound();
    stopBeachBallMerge6Sounds();
    expect(jest.getTimerCount()).toBe(0);
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });
});
