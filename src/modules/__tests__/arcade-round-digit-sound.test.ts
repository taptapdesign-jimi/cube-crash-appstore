import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ARCADE_ROUND_DIGIT_SOUND_BASE_VOLUME,
  ARCADE_ROUND_DIGIT_SOUND_PLAYBACK_RATE,
  ARCADE_ROUND_DIGIT_SOUND_SOURCES,
  ARCADE_ROUND_DIGIT_SOUND_VOLUME,
  ARCADE_ROUND_EXIT_SOUND_SOURCE,
  ARCADE_ROUND_FIRST_DIGIT_SOUND_SOURCE,
  ARCADE_ROUND_SECOND_DIGIT_SOUND_SOURCE,
  areArcadeRoundDigitSoundsEnabled,
  playArcadeRoundDigitSound,
  playArcadeRoundExitSound,
  playBoardTransitionDigitSound,
  playBoardTransitionExitSound,
  preloadArcadeRoundDigitSounds,
  preloadBoardTransitionDigitSounds,
  resetArcadeRoundDigitSoundCacheForTests,
  stopArcadeRoundDigitSounds,
  stopBoardTransitionDigitSounds,
} from '../arcade-round-digit-sound';

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

describe('Arcade Round digit sounds', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetArcadeRoundDigitSoundCacheForTests();
  });

  afterEach(() => {
    resetArcadeRoundDigitSoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
  });

  test('locks the supplied first- and second-digit WAV files', () => {
    expect(ARCADE_ROUND_DIGIT_SOUND_SOURCES).toEqual([
      ARCADE_ROUND_FIRST_DIGIT_SOUND_SOURCE,
      ARCADE_ROUND_SECOND_DIGIT_SOUND_SOURCE,
      ARCADE_ROUND_EXIT_SOUND_SOURCE,
    ]);
    expect(ARCADE_ROUND_DIGIT_SOUND_PLAYBACK_RATE).toBe(1);
    expect(ARCADE_ROUND_DIGIT_SOUND_BASE_VOLUME).toBe(0.7);
    expect(ARCADE_ROUND_DIGIT_SOUND_VOLUME).toBeCloseTo(0.42);

    const expected = [
      [ARCADE_ROUND_FIRST_DIGIT_SOUND_SOURCE, '8ce95523fe197165b079d99aa98e5958604866fe1457407cdebc06509555509d'],
      [ARCADE_ROUND_SECOND_DIGIT_SOUND_SOURCE, 'c16d07981e894a4451b858d7237d71fe80f0fccfc6ea78267bacbbc884809683'],
      [ARCADE_ROUND_EXIT_SOUND_SOURCE, '876e21fe2b9c2befd02123654ce61b31689f89c18288da94350b4d440a9407b2'],
    ] as const;
    expected.forEach(([source, hash]) => {
      const bytes = fs.readFileSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')));
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(hash);
    });
  });

  test('starts one distinct sound from each of the first two digit animation callbacks', () => {
    expect(preloadArcadeRoundDigitSounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(3);
    const first = MockAudio.instances.find(
      (audio) => audio.src === ARCADE_ROUND_FIRST_DIGIT_SOUND_SOURCE,
    )!;
    const second = MockAudio.instances.find(
      (audio) => audio.src === ARCADE_ROUND_SECOND_DIGIT_SOUND_SOURCE,
    )!;

    expect(playArcadeRoundDigitSound(0)).toBe(true);
    expect(first.play).toHaveBeenCalledTimes(1);
    expect(first.currentTime).toBe(0);
    expect(first.volume).toBeCloseTo(0.42);
    expect(second.play).not.toHaveBeenCalled();

    expect(playArcadeRoundDigitSound(1)).toBe(true);
    expect(second.play).toHaveBeenCalledTimes(1);
    expect(second.currentTime).toBe(0);
    expect(second.volume).toBeCloseTo(0.42);
    expect(playArcadeRoundDigitSound(2)).toBe(false);
  });

  test('starts exit.wav only from the first digit exit animation callback', () => {
    expect(preloadArcadeRoundDigitSounds()).toBe(true);
    const exit = MockAudio.instances.find(
      (audio) => audio.src === ARCADE_ROUND_EXIT_SOUND_SOURCE,
    )!;

    expect(exit.play).not.toHaveBeenCalled();
    expect(playArcadeRoundExitSound()).toBe(true);
    expect(exit.play).toHaveBeenCalledTimes(1);
    expect(exit.currentTime).toBe(0);
    expect(exit.volume).toBeCloseTo(0.42);
  });

  test('is owned by Settings Sounds and rewinds both bounded voices on cleanup', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(areArcadeRoundDigitSoundsEnabled()).toBe(false);
    expect(preloadArcadeRoundDigitSounds()).toBe(false);
    expect(playArcadeRoundDigitSound(0)).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadArcadeRoundDigitSounds();
    playArcadeRoundDigitSound(0);
    playArcadeRoundDigitSound(1);
    stopArcadeRoundDigitSounds();
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });

  test('is wired to each digit timeline start and stopped by the Round overlay owner', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/arcade-stage-clear-modal.ts'),
      'utf8',
    );
    const phase = source.slice(
      source.indexOf('async function playRoundNumberPhase'),
      source.indexOf('export async function showArcadeStageClearModal'),
    );
    expect(phase).toContain('preloadArcadeRoundDigitSounds();');
    expect(phase).toContain('onStart: () => {\n          playArcadeRoundDigitSound(index);');
    expect(phase).toContain('if (index === 0) playArcadeRoundExitSound();');
    const cleanup = source.slice(source.indexOf('export function cleanupArcadeStageClearModal'));
    expect(cleanup).toContain('stopArcadeRoundDigitSounds();');
  });

  test('reuses the same mix from exact Board Transition digit callbacks with isolated voices', () => {
    expect(preloadArcadeRoundDigitSounds()).toBe(true);
    expect(preloadBoardTransitionDigitSounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(6);

    const boardVoices = MockAudio.instances.slice(3);
    expect(playBoardTransitionDigitSound(0)).toBe(true);
    expect(playBoardTransitionDigitSound(1)).toBe(true);
    expect(playBoardTransitionDigitSound(2)).toBe(false);
    expect(playBoardTransitionExitSound()).toBe(true);
    boardVoices.forEach((audio) => {
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.volume).toBeCloseTo(0.42);
    });

    stopBoardTransitionDigitSounds();
    boardVoices.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
    MockAudio.instances.slice(0, 3).forEach((audio) => {
      expect(audio.pause).not.toHaveBeenCalled();
    });
  });

  test('wires Board Transition sounds to visual timeline starts without parallel timers', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/board-transition-screen.ts'),
      'utf8',
    );
    expect(source).toContain('preloadBoardTransitionDigitSounds();');
    expect(source).toContain('onStart: () => {\n            playBoardTransitionDigitSound(index);');
    expect(source).toContain('if (index === 0) playBoardTransitionExitSound();');
    expect(source).toContain('stopBoardTransitionDigitSounds();');
  });
});
