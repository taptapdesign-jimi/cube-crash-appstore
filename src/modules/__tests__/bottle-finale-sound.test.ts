import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BOTTLE_FINALE_BOTTLE1_SOUND_SOURCE,
  BOTTLE_FINALE_BOTTLE2_SOUND_SOURCE,
  BOTTLE_FINALE_BOTTLE_BASE_VOLUME,
  BOTTLE_FINALE_BOTTLE_VOLUME,
  BOTTLE_FINALE_BUBLESI_BASE_VOLUME,
  BOTTLE_FINALE_BUBLESI_SOUND_SOURCE,
  BOTTLE_FINALE_BUBLESI_VOLUME,
  BOTTLE_FINALE_CLING2_SOUND_SOURCE,
  BOTTLE_FINALE_CLING_BASE_VOLUME,
  BOTTLE_FINALE_CLING_SOUND_SOURCE,
  BOTTLE_FINALE_CLING_VOLUME,
  BOTTLE_FINALE_PLAYBACK_RATE,
  BOTTLE_FINALE_SOUND_SOURCES,
  BOTTLE_FINALE_WATER_WAVES_BASE_VOLUME,
  BOTTLE_FINALE_WATER_WAVES_SOUND_SOURCE,
  BOTTLE_FINALE_WATER_WAVES_VOLUME,
  BOTTLE_MERGE6_BOOM_SOUND_SOURCE,
  BOTTLE_MERGE6_BOOM_VOLUME,
  BOTTLE_MERGE6_CRASH_PLAYBACK_RATE,
  BOTTLE_MERGE6_CRASH_SOUND_SOURCE,
  BOTTLE_MERGE6_CRASH_VOLUME,
  BOTTLE_MERGE6_PRIMARY_PLAYBACK_RATE,
  BOTTLE_MERGE6_PRIMARY_SOUND_SOURCE,
  BOTTLE_MERGE6_PRIMARY_VOLUME,
  BOTTLE_MERGE6_STACK_SOUND_SOURCE,
  BOTTLE_MERGE6_STACK_VOLUME,
  areBottleFinaleSoundsEnabled,
  isBottleMerge6SoundEvent,
  playBottleFinaleSound,
  preloadBottleFinaleSounds,
  resetBottleFinaleSoundCacheForTests,
  stopBottleFinaleSounds,
} from '../bottle-finale-sound';
import {
  BOTTLE_FINALE_BUBLESI_PATH_RATIO,
  BOTTLE_FINALE_CLING_PATH_RATIO,
  BOTTLE_FINALE_CLING2_PATH_RATIO,
  BOTTLE_FINALE_SECOND_CUE_PATH_RATIO,
} from '../bottle-finale-scene';
import {
  REGULAR_MERGE6_BOOM_SOUND_SOURCE,
  REGULAR_MERGE6_BOOM_VOLUME,
  REGULAR_MERGE6_CRASH_PLAYBACK_RATE,
  REGULAR_MERGE6_CRASH_SOUND_SOURCE,
  REGULAR_MERGE6_CRASH_VOLUME,
  REGULAR_MERGE6_SOUND_PLAYBACK_RATE,
  REGULAR_MERGE6_SOUND_SOURCE,
  REGULAR_MERGE6_SOUND_VOLUME,
  REGULAR_MERGE6_STACK_SOUND_SOURCE,
  REGULAR_MERGE6_STACK_VOLUME,
} from '../regular-merge6-sound';

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

describe('Bottle finale sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetBottleFinaleSoundCacheForTests();
  });

  afterEach(() => {
    resetBottleFinaleSoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
  });

  test('locks the six supplied WAV files and requested gains', () => {
    expect(BOTTLE_FINALE_SOUND_SOURCES).toEqual([
      BOTTLE_FINALE_WATER_WAVES_SOUND_SOURCE,
      BOTTLE_FINALE_BOTTLE1_SOUND_SOURCE,
      BOTTLE_FINALE_BOTTLE2_SOUND_SOURCE,
      BOTTLE_FINALE_CLING_SOUND_SOURCE,
      BOTTLE_FINALE_CLING2_SOUND_SOURCE,
      BOTTLE_FINALE_BUBLESI_SOUND_SOURCE,
    ]);
    expect(BOTTLE_FINALE_PLAYBACK_RATE).toBe(1);
    expect(BOTTLE_FINALE_WATER_WAVES_BASE_VOLUME).toBe(0.4);
    expect(BOTTLE_FINALE_WATER_WAVES_VOLUME).toBeCloseTo(0.24);
    expect(BOTTLE_FINALE_BOTTLE_BASE_VOLUME).toBe(1);
    expect(BOTTLE_FINALE_BOTTLE_VOLUME).toBeCloseTo(0.6);
    expect(BOTTLE_FINALE_CLING_BASE_VOLUME).toBe(0.378);
    expect(BOTTLE_FINALE_CLING_VOLUME).toBeCloseTo(0.2268);
    expect(BOTTLE_FINALE_BUBLESI_BASE_VOLUME).toBe(0.64);
    expect(BOTTLE_FINALE_BUBLESI_VOLUME).toBeCloseTo(0.384);

    const expected = [
      [BOTTLE_FINALE_WATER_WAVES_SOUND_SOURCE, '1010c84935af1564f6e58534d82a11da16f7c5a1665ddc29775dbab48b3f10f1'],
      [BOTTLE_FINALE_BOTTLE1_SOUND_SOURCE, '4c70a030c9fa798d6a15dcf6de4a09afca7511297554d0041b2b5bf0d94bd2fd'],
      [BOTTLE_FINALE_BOTTLE2_SOUND_SOURCE, 'fdc7221c530f6f7a6b67121640a03a05e0cd6d2011974cdf28230adc16739bed'],
      [BOTTLE_FINALE_CLING_SOUND_SOURCE, '435003d483bd036285c61a5f9558197d22009e016130418d9f92106425980206'],
      [BOTTLE_FINALE_CLING2_SOUND_SOURCE, 'f7ffb001791398edaf50ab6932a9e198884a7a071ce6253b1b8f17af25f513e9'],
      [BOTTLE_FINALE_BUBLESI_SOUND_SOURCE, 'c558c986894c622367ce0ffc4710fa327a43288210c9bda97f7313646c014eca'],
    ] as const;
    expected.forEach(([source, hash]) => {
      const bytes = fs.readFileSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')));
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(hash);
    });
  });

  test('inherits the complete ordinary Merge-6 foundation at Bottle merge commit', () => {
    expect(BOTTLE_MERGE6_PRIMARY_SOUND_SOURCE).toBe(REGULAR_MERGE6_SOUND_SOURCE);
    expect(BOTTLE_MERGE6_PRIMARY_PLAYBACK_RATE).toBe(REGULAR_MERGE6_SOUND_PLAYBACK_RATE);
    expect(BOTTLE_MERGE6_PRIMARY_VOLUME).toBe(REGULAR_MERGE6_SOUND_VOLUME);
    expect(BOTTLE_MERGE6_CRASH_SOUND_SOURCE).toBe(REGULAR_MERGE6_CRASH_SOUND_SOURCE);
    expect(BOTTLE_MERGE6_CRASH_PLAYBACK_RATE).toBe(REGULAR_MERGE6_CRASH_PLAYBACK_RATE);
    expect(BOTTLE_MERGE6_CRASH_VOLUME).toBe(REGULAR_MERGE6_CRASH_VOLUME);
    expect(BOTTLE_MERGE6_BOOM_SOUND_SOURCE).toBe(REGULAR_MERGE6_BOOM_SOUND_SOURCE);
    expect(BOTTLE_MERGE6_BOOM_VOLUME).toBe(REGULAR_MERGE6_BOOM_VOLUME);
    expect(BOTTLE_MERGE6_STACK_SOUND_SOURCE).toBe(REGULAR_MERGE6_STACK_SOUND_SOURCE);
    expect(BOTTLE_MERGE6_STACK_VOLUME).toBe(REGULAR_MERGE6_STACK_VOLUME);

    expect(isBottleMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecialDiceVariantId: 'bottle',
    })).toBe(true);
    expect(isBottleMerge6SoundEvent({
      effectiveSum: 6,
      dstSpecialDiceVariantId: 'bottle',
    })).toBe(true);
    expect(isBottleMerge6SoundEvent({
      effectiveSum: 5,
      srcSpecialDiceVariantId: 'bottle',
    })).toBe(false);
    expect(isBottleMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecialDiceVariantId: 'beach-ball',
    })).toBe(false);

    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore).toContain('if (isBottleMerge6SoundEvent({');
    expect(appCore).toContain('playBottleMerge6Foundation();');
  });

  test('plays each cue on one bounded fallback voice at its assigned gain', () => {
    expect(preloadBottleFinaleSounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(6);

    const expectedVolumes = new Map([
      [BOTTLE_FINALE_WATER_WAVES_SOUND_SOURCE, 0.24],
      [BOTTLE_FINALE_BOTTLE1_SOUND_SOURCE, 0.6],
      [BOTTLE_FINALE_BOTTLE2_SOUND_SOURCE, 0.6],
      [BOTTLE_FINALE_CLING_SOUND_SOURCE, 0.2268],
      [BOTTLE_FINALE_CLING2_SOUND_SOURCE, 0.2268],
      [BOTTLE_FINALE_BUBLESI_SOUND_SOURCE, 0.384],
    ]);
    const cues = ['water-waves', 'bottle1', 'bottle2', 'cling', 'cling2', 'bublesi'] as const;
    cues.forEach((cue, index) => {
      expect(playBottleFinaleSound(cue)).toBe(true);
      const audio = MockAudio.instances[index];
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.currentTime).toBe(0);
      expect(audio.playbackRate).toBe(1);
      expect(audio.volume).toBeCloseTo(expectedVolumes.get(audio.src)!);
    });
  });

  test('obeys Settings Sounds and rewinds every cue on cleanup', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areBottleFinaleSoundsEnabled()).toBe(false);
    expect(preloadBottleFinaleSounds()).toBe(false);
    expect(playBottleFinaleSound('water-waves')).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadBottleFinaleSounds();
    playBottleFinaleSound('water-waves');
    playBottleFinaleSound('bottle1');
    stopBottleFinaleSounds();
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });

  test('binds the cue order to the owned Bottle fall timeline and cleanup', () => {
    expect(BOTTLE_FINALE_SECOND_CUE_PATH_RATIO).toBe(0.2);
    expect(BOTTLE_FINALE_CLING_PATH_RATIO).toBe(0.55);
    expect(BOTTLE_FINALE_CLING2_PATH_RATIO).toBe(0.75);
    expect(BOTTLE_FINALE_BUBLESI_PATH_RATIO).toBe(0.3);
    expect(BOTTLE_FINALE_CLING_PATH_RATIO).toBeGreaterThan(0.5);
    expect(BOTTLE_FINALE_CLING2_PATH_RATIO).toBeGreaterThan(0.5);
    const scene = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/bottle-finale-scene.ts'),
      'utf8',
    );
    expect(scene).toContain("playBottleFinaleSound('water-waves');");
    expect(scene).toContain("soundTimeline.call(() => playBottleFinaleSound('bottle1'), [], 0);");
    expect(scene).toContain("() => playBottleFinaleSound('bottle2')");
    expect(scene).toContain('BOTTLE_SINK_DURATION_SECONDS * BOTTLE_FINALE_SECOND_CUE_PATH_RATIO');
    expect(scene).toContain("() => playBottleFinaleSound('cling')");
    expect(scene).toContain('BOTTLE_SINK_DURATION_SECONDS * BOTTLE_FINALE_CLING_PATH_RATIO');
    expect(scene).toContain("() => playBottleFinaleSound('cling2')");
    expect(scene).toContain('BOTTLE_SINK_DURATION_SECONDS * BOTTLE_FINALE_CLING2_PATH_RATIO');
    expect(scene).toContain("() => playBottleFinaleSound('bublesi')");
    expect(scene).toContain('BOTTLE_SINK_DURATION_SECONDS * BOTTLE_FINALE_BUBLESI_PATH_RATIO');
    expect(scene).toContain('soundTimeline.play(0);');
    expect(scene.match(/stopBottleFinaleSounds\(\);/g)?.length).toBeGreaterThanOrEqual(3);
  });

  test('preloads on Arcade and Journey entry and stops on global sound-off/reset', () => {
    const ui = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');
    const journey = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(ui).toContain("import { preloadBottleFinaleSounds } from './bottle-finale-sound.ts';");
    expect(ui).toContain("import('./bottle-finale-sound.ts').then(({ stopBottleFinaleSounds }) => {");
    expect(journey).toContain("import { preloadBottleFinaleSounds } from './bottle-finale-sound.ts';");
    expect(appCore).toContain('stopBottleFinaleSounds,');
    expect(appCore).toContain("} from './bottle-finale-sound.ts';");
    expect(appCore).toContain('try { stopBottleFinaleSounds(); } catch {}');
  });
});
