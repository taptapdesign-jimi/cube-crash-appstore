import fs from 'node:fs';
import path from 'node:path';
import {
  WILD_SPECIAL_MERGE6_POOF_BASE_VOLUME,
  WILD_SPECIAL_MERGE6_POOF_SOUND_SOURCES,
  WILD_SPECIAL_MERGE6_POOF_VOLUME,
  isWildSpecialMerge6PoofEvent,
  playWildSpecialMerge6PoofSounds,
  preloadWildSpecialMerge6PoofSounds,
  resetWildSpecialMerge6PoofSoundCacheForTests,
  stopWildSpecialMerge6PoofSounds,
} from '../wild-special-merge6-poof-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  preload = '';
  currentTime = 2;
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

describe('shared Wild/Special Merge-6 poofs', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetWildSpecialMerge6PoofSoundCacheForTests();
  });

  afterEach(() => {
    resetWildSpecialMerge6PoofSoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  test('uses the two main Merge-6 poofs at the same gain as the former Bee layers', () => {
    expect(WILD_SPECIAL_MERGE6_POOF_SOUND_SOURCES).toEqual([
      './assets/sound/merge 6/poof1.wav',
      './assets/sound/merge 6/poof2.wav',
    ]);
    expect(WILD_SPECIAL_MERGE6_POOF_BASE_VOLUME).toBe(1);
    expect(WILD_SPECIAL_MERGE6_POOF_VOLUME).toBeCloseTo(0.6);
  });

  test.each(['wild', 'wild-juice', 'wild-magnet', 'wild-tnt'])(
    'accepts core %s Merge-6',
    (special) => {
      expect(isWildSpecialMerge6PoofEvent({ effectiveSum: 6, srcSpecial: special })).toBe(true);
    },
  );

  test.each([
    'fish', 'kanta', 'bee', 'cubero', 'mushroom', 'robo-cube',
    'spaceship', 'bottle', 'honey', 'laser-gun', 'flower', 'beach-ball',
  ])('accepts registered %s Merge-6 provenance', (variantId) => {
    expect(isWildSpecialMerge6PoofEvent({
      effectiveSum: 6,
      dstSpecialDiceVariantId: variantId,
    })).toBe(true);
  });

  test('rejects ordinary, non-six and internally pulled ordinary events', () => {
    expect(isWildSpecialMerge6PoofEvent({ effectiveSum: 6 })).toBe(false);
    expect(isWildSpecialMerge6PoofEvent({ effectiveSum: 5, srcSpecial: 'wild' })).toBe(false);
    expect(isWildSpecialMerge6PoofEvent({ effectiveSum: 6, srcSpecial: 'regular' })).toBe(false);
  });

  test('plays both layers once, obeys Sounds OFF and rewinds on cleanup', () => {
    expect(preloadWildSpecialMerge6PoofSounds()).toBe(true);
    expect(playWildSpecialMerge6PoofSounds()).toBe(true);
    WILD_SPECIAL_MERGE6_POOF_SOUND_SOURCES.forEach((source) => {
      const audio = MockAudio.instances.find((candidate) => candidate.src === source)!;
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.volume).toBeCloseTo(0.6);
      expect(audio.playbackRate).toBe(1);
    });
    stopWildSpecialMerge6PoofSounds();
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
    (window as any)._settings.gameSoundsEnabled = false;
    expect(playWildSpecialMerge6PoofSounds()).toBe(false);
  });

  test('is called exactly once from committed Merge-6 routing and removed from Bee local layers', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const bee = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/bee-merge6-sound.ts'), 'utf8');
    expect(appCore.match(/playWildSpecialMerge6PoofSounds\(\);/g)).toHaveLength(1);
    expect(appCore).toContain('isWildSpecialMerge6PoofEvent({');
    expect(bee).not.toContain("`${BEE_SOUND_BASE}poof1.wav`");
    expect(bee).not.toContain("`${BEE_SOUND_BASE}poof2.wav`");
  });
});
