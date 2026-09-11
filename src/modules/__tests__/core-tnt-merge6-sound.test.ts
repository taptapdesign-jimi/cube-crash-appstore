import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CORE_TNT_BONUS_IMPACT_BASE_VOLUMES,
  CORE_TNT_BONUS_IMPACT_PLAYBACK_RATE,
  CORE_TNT_BONUS_IMPACT_SOUND_SOURCES,
  CORE_TNT_BONUS_IMPACT_VOLUMES,
  CORE_TNT_BONUS_MINI2_VOLUME_SCALE,
  CORE_TNT_BONUS_MINI5_BASE_VOLUME,
  CORE_TNT_BONUS_MINI5_VOLUME,
  CORE_TNT_MERGE6_BOOM_SOUND_SOURCE,
  CORE_TNT_MERGE6_BOOM_VOLUME,
  CORE_TNT_MERGE6_CRASH_PLAYBACK_RATE,
  CORE_TNT_MERGE6_CRASH_SOUND_SOURCE,
  CORE_TNT_MERGE6_CRASH_VOLUME,
  CORE_TNT_MERGE6_HORN_BASE_VOLUME,
  CORE_TNT_MERGE6_HORN_PLAYBACK_RATE,
  CORE_TNT_MERGE6_HORN_SOUND_SOURCE,
  CORE_TNT_MERGE6_HORN_VOLUME,
  CORE_TNT_MERGE6_PRIMARY_PLAYBACK_RATE,
  CORE_TNT_MERGE6_PRIMARY_SOUND_SOURCE,
  CORE_TNT_MERGE6_PRIMARY_VOLUME,
  CORE_TNT_MERGE6_SOUND_BASE_VOLUME,
  CORE_TNT_MERGE6_SOUND_DELAY_MS,
  CORE_TNT_MERGE6_SOUND_PLAYBACK_RATE,
  CORE_TNT_MERGE6_SOUND_SOURCE,
  CORE_TNT_MERGE6_SOUND_VOLUME,
  CORE_TNT_MERGE6_STACK_SOUND_SOURCE,
  CORE_TNT_MERGE6_STACK_BASE_VOLUME,
  CORE_TNT_MERGE6_STACK_VOLUME,
  CORE_TNT_MERGE6_WOOD_BASE_VOLUME,
  CORE_TNT_MERGE6_WOOD_BREAK_DELAY_MS,
  CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE,
  CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE,
  CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS,
  CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE,
  CORE_TNT_MERGE6_WOOD_VOLUME,
  areCoreTntMerge6SoundsEnabled,
  isCoreTntMerge6SoundEvent,
  playCoreTntBonusImpactSound,
  playCoreTntMerge6Sound,
  preloadCoreTntMerge6Sound,
  resetCoreTntMerge6SoundCacheForTests,
  stopCoreTntMerge6Sound,
} from '../core-tnt-merge6-sound';

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

describe('core TNT merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetCoreTntMerge6SoundCacheForTests();
  });

  afterEach(() => {
    resetCoreTntMerge6SoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('inherits the complete ordinary Merge-6 foundation with its shared eighty-percent stack layer', () => {
    expect(CORE_TNT_MERGE6_PRIMARY_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge six obicna.mp3',
    );
    expect(CORE_TNT_MERGE6_PRIMARY_PLAYBACK_RATE).toBe(1.3);
    expect(CORE_TNT_MERGE6_PRIMARY_VOLUME).toBeCloseTo(0.3);
    expect(CORE_TNT_MERGE6_CRASH_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge6 crash.mp3',
    );
    expect(CORE_TNT_MERGE6_CRASH_PLAYBACK_RATE).toBe(1.3);
    expect(CORE_TNT_MERGE6_CRASH_VOLUME).toBeCloseTo(0.1632);
    expect(CORE_TNT_MERGE6_BOOM_SOUND_SOURCE).toBe(
      './assets/sound/merge 6/merge6 boom.mp3',
    );
    expect(CORE_TNT_MERGE6_BOOM_VOLUME).toBeCloseTo(0.36);
    expect(CORE_TNT_MERGE6_STACK_SOUND_SOURCE).toBe('./assets/sound/merge 6/stack.mp3');
    expect(CORE_TNT_MERGE6_STACK_BASE_VOLUME).toBe(0.8);
    expect(CORE_TNT_MERGE6_STACK_VOLUME).toBeCloseTo(0.48);
  });

  test('locks tnt3, horn, staggered wood, and the five mini-crash source variants', () => {
    expect(CORE_TNT_MERGE6_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/tnt/tnt3.wav',
    );
    expect(CORE_TNT_MERGE6_SOUND_PLAYBACK_RATE).toBe(1);
    expect(CORE_TNT_MERGE6_SOUND_DELAY_MS).toBe(500);
    expect(CORE_TNT_MERGE6_SOUND_BASE_VOLUME).toBe(0.56);
    expect(CORE_TNT_MERGE6_SOUND_VOLUME).toBeCloseTo(0.336);
    expect(CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/tnt/wood break.wav',
    );
    expect(CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/tnt/wood ssplinter.wav',
    );
    expect(CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE).toBe(1);
    expect(CORE_TNT_MERGE6_WOOD_BASE_VOLUME).toBe(0.9);
    expect(CORE_TNT_MERGE6_WOOD_VOLUME).toBeCloseTo(0.54);
    expect(CORE_TNT_MERGE6_WOOD_BREAK_DELAY_MS).toBe(0);
    expect(CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS).toBe(100);
    expect(CORE_TNT_MERGE6_HORN_SOUND_SOURCE).toBe(
      './assets/sound/Wild and special kockice/tnt/horn.wav',
    );
    expect(CORE_TNT_MERGE6_HORN_PLAYBACK_RATE).toBe(1);
    expect(CORE_TNT_MERGE6_HORN_BASE_VOLUME).toBe(0.8);
    expect(CORE_TNT_MERGE6_HORN_VOLUME).toBeCloseTo(0.48);
    expect(CORE_TNT_BONUS_IMPACT_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/tnt/mini crash1.wav',
      './assets/sound/mini explozije/mini2.mp3',
      './assets/sound/mini explozije/mini3.wav',
      './assets/sound/mini explozije/mini4.wav',
      './assets/sound/mini explozije/mini5.wav',
    ]);
    expect(CORE_TNT_BONUS_IMPACT_PLAYBACK_RATE).toBe(1);
    expect(CORE_TNT_BONUS_IMPACT_BASE_VOLUMES).toEqual([0.48, 0.56, 0.63, 0.56]);
    expect(CORE_TNT_BONUS_IMPACT_VOLUMES[0]).toBeCloseTo(0.288);
    expect(CORE_TNT_BONUS_IMPACT_VOLUMES[1]).toBeCloseTo(0.336);
    expect(CORE_TNT_BONUS_IMPACT_VOLUMES[2]).toBeCloseTo(0.378);
    expect(CORE_TNT_BONUS_IMPACT_VOLUMES[3]).toBeCloseTo(0.336);
    expect(CORE_TNT_BONUS_MINI5_BASE_VOLUME).toBe(0.25);
    expect(CORE_TNT_BONUS_MINI5_VOLUME).toBeCloseTo(0.15);
    expect(CORE_TNT_BONUS_MINI2_VOLUME_SCALE).toBe(0.5);

    const expected = [
      [CORE_TNT_MERGE6_SOUND_SOURCE, 'd122630b22e524839e1e63c15cd58058ce202ff1a74bb9914f664d1496192d48'],
      [CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE, '616a19c56cf3b54749519e5aa538c248d08f732d6522dab3e9f0f7275f3f2bcd'],
      [CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE, '419b194e80ac980f4948447589546c9e058ad178566eca5c90f38c25bf678d07'],
      [CORE_TNT_MERGE6_HORN_SOUND_SOURCE, '827024784d0f00db17bb3a7632ea818b4b18ff5b27c012fc9e1a479253acf5e0'],
      [CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[0], 'fd2a7674cb5df28b109ab042fca8b82dfe2a911afcb7848e6030d0e047d5ff71'],
      [CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[1], '3fbca6ea392b682bf5f2a19a2571e714fdb880ceff457233e19bd752b56f4d9c'],
      [CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[2], '86bd5c112d5c6bfccf11b209be2530d20aa6a669d11f548a2b1550435b1983bf'],
      [CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[3], '95b6e8b3f7216e9f4d0917d92402f121997b764d87bee4574b30d2cd6b126110'],
      [CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[4], 'f3659db501a80a5fd7c08ae920fe316f46c7878566283ca3c6266625d42cf910'],
    ] as const;
    expected.forEach(([source, hash]) => {
      const bytes = fs.readFileSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')));
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(hash);
    });
  });

  test('accepts only core TNT plus a regular die at committed Merge-6', () => {
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: 'wild-tnt',
      dstSpecial: null,
    })).toBe(true);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: null,
      dstSpecial: 'wild-tnt',
    })).toBe(true);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 5,
      srcSpecial: 'wild-tnt',
    })).toBe(false);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: 'wild-tnt',
      srcSpecialDiceVariantId: 'beach-ball',
    })).toBe(false);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      dstSpecial: 'wild-tnt',
      dstSpecialDiceVariantId: 'flower',
    })).toBe(false);
    expect(isCoreTntMerge6SoundEvent({
      effectiveSum: 6,
      srcSpecial: 'wild-tnt',
      dstSpecial: 'wild',
    })).toBe(false);
  });

  test('is called once and exposes its exact bonus-impact mix to Flower only', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore.match(/playCoreTntMerge6Sound\(\);/g)).toHaveLength(1);
    expect(appCore).toContain('if (isCoreTntMerge6SoundEvent({');
    expect(appCore).toContain('srcSpecialDiceVariantId: srcSpecialVariantAtMergeEntry?.id');
    expect(appCore).toContain('dstSpecialDiceVariantId: dstSpecialVariantAtMergeEntry?.id');
    expect(appCore.indexOf('if (effSum === 6){')).toBeLessThan(
      appCore.indexOf('playCoreTntMerge6Sound();'),
    );
    expect(appCore).toContain("onImpact: tntVariantForMerge && tntVariantForMerge.id !== 'flower'");
    expect(appCore).toContain('if (tntBonusSoundRunGeneration !== gameplayRunGeneration) return;');
    expect(appCore).toContain('playCoreTntBonusImpactSound(impactIndex);');
    expect(appCore).toContain('try { onImpact?.(i); }');
  });

  test('starts the long tnt3 crash five hundred milliseconds after the immediate Merge-6 foundation', () => {
    expect(preloadCoreTntMerge6Sound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(13);
    const tnt3 = MockAudio.instances.find((audio) => audio.src === CORE_TNT_MERGE6_SOUND_SOURCE)!;
    const horn = MockAudio.instances.find((audio) => audio.src === CORE_TNT_MERGE6_HORN_SOUND_SOURCE)!;
    const stack = MockAudio.instances.find((audio) => audio.src === CORE_TNT_MERGE6_STACK_SOUND_SOURCE)!;
    const woodBreak = MockAudio.instances.find(
      (audio) => audio.src === CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE,
    )!;
    const woodSplinter = MockAudio.instances.find(
      (audio) => audio.src === CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE,
    )!;

    expect(playCoreTntMerge6Sound()).toBe(true);
    expect(tnt3.play).not.toHaveBeenCalled();
    expect(horn.play).toHaveBeenCalledTimes(1);
    expect(horn.playbackRate).toBe(1);
    expect(horn.volume).toBeCloseTo(0.48);
    expect(stack.play).toHaveBeenCalledTimes(1);
    expect(stack.volume).toBeCloseTo(0.48);
    expect(woodBreak.play).toHaveBeenCalledTimes(1);
    expect(woodBreak.volume).toBeCloseTo(0.54);
    expect(woodSplinter.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(99);
    expect(tnt3.play).not.toHaveBeenCalled();
    expect(woodSplinter.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(tnt3.play).not.toHaveBeenCalled();
    expect(woodSplinter.play).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(399);
    expect(tnt3.play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(tnt3.play).toHaveBeenCalledTimes(1);
    expect(tnt3.playbackRate).toBe(1);
    expect(tnt3.volume).toBeCloseTo(0.336);
    expect(tnt3.currentTime).toBe(0);
    expect(woodSplinter.volume).toBeCloseTo(0.54);
    expect(MockAudio.instances).toHaveLength(13);
  });

  test('plays four unique mini-crash variants at the requested per-impact levels', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(preloadCoreTntMerge6Sound()).toBe(true);
    expect(playCoreTntMerge6Sound()).toBe(true);

    for (let index = 0; index < 4; index += 1) {
      expect(playCoreTntBonusImpactSound(index)).toBe(true);
    }
    expect(playCoreTntBonusImpactSound(4)).toBe(false);

    const miniSources = new Set(CORE_TNT_BONUS_IMPACT_SOUND_SOURCES);
    const playedMiniLayers = MockAudio.instances
      .filter((audio) => miniSources.has(audio.src as typeof CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[number]))
      .filter((audio) => audio.play.mock.calls.length > 0)
      .sort((a, b) => a.play.mock.invocationCallOrder[0] - b.play.mock.invocationCallOrder[0]);
    expect(playedMiniLayers).toHaveLength(4);
    expect(new Set(playedMiniLayers.map((audio) => audio.src)).size).toBe(4);
    expect(playedMiniLayers[0].src).toBe(CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[1]);
    expect(playedMiniLayers[0].volume).toBeCloseTo(0.144);
    expect(playedMiniLayers[1].volume).toBeCloseTo(0.336);
    expect(playedMiniLayers[2].volume).toBeCloseTo(0.378);
    expect(playedMiniLayers[3].src).toBe(CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[4]);
    expect(playedMiniLayers[3].volume).toBeCloseTo(0.15);
    playedMiniLayers.forEach((audio) => {
      expect(audio.playbackRate).toBe(1);
      expect(audio.currentTime).toBe(0);
    });
  });

  test('keeps mini5 at twenty-five percent regardless of its shuffled impact position', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(preloadCoreTntMerge6Sound()).toBe(true);
    expect(playCoreTntMerge6Sound()).toBe(true);
    for (let index = 0; index < 4; index += 1) {
      expect(playCoreTntBonusImpactSound(index)).toBe(true);
    }

    const mini5 = MockAudio.instances.find(
      (audio) => audio.src === CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[4],
    )!;
    expect(mini5.play).toHaveBeenCalledTimes(1);
    expect(mini5.volume).toBeCloseTo(0.15);
  });

  test('plays mini2 at half of its shuffled impact-position volume', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(preloadCoreTntMerge6Sound()).toBe(true);
    expect(playCoreTntMerge6Sound()).toBe(true);
    expect(playCoreTntBonusImpactSound(0)).toBe(true);

    const mini2 = MockAudio.instances.find(
      (audio) => audio.src === CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[1],
    )!;
    expect(mini2.play).toHaveBeenCalledTimes(1);
    expect(mini2.volume).toBeCloseTo(CORE_TNT_BONUS_IMPACT_VOLUMES[0] * 0.5);
  });

  test('obeys Sounds OFF and stops the ordinary base plus all TNT layers', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areCoreTntMerge6SoundsEnabled()).toBe(false);
    expect(preloadCoreTntMerge6Sound()).toBe(false);
    expect(playCoreTntMerge6Sound()).toBe(false);
    expect(playCoreTntBonusImpactSound(0)).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadCoreTntMerge6Sound();
    playCoreTntMerge6Sound();
    stopCoreTntMerge6Sound();
    expect(jest.getTimerCount()).toBe(0);
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });
});
