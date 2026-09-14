import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BOARD_TRANSITION_FOREST_AMBIENT_SOUND_SOURCE,
  BOARD_TRANSITION_FOREST_AMBIENT_BOOST,
  BOARD_TRANSITION_FOREST_AMBIENT_SOUND_VOLUME,
  BOARD_TRANSITION_FOREST_BEES_SMALL_ACTION_VOLUME,
  BOARD_TRANSITION_FOREST_BEES_SMALL_DURATION_SECONDS,
  BOARD_TRANSITION_FOREST_BEES_SMALL_FADE_OUT_SECONDS,
  BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_SOURCE,
  BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_VOLUME,
  playBoardTransitionForestAmbientSound,
  preloadBoardTransitionForestAmbientSound,
  resetBoardTransitionForestAmbientSoundForTests,
  stopBoardTransitionForestAmbientSound,
} from '../board-transition-forest-ambient-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  preload = '';
  currentTime = 3;
  volume = 0;
  paused = true;
  load = jest.fn();
  pause = jest.fn(() => { this.paused = true; });
  play = jest.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });

  constructor(public src: string) {
    MockAudio.instances.push(this);
  }
}

describe('Forest Board Transition ambiance', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetBoardTransitionForestAmbientSoundForTests();
  });

  afterEach(() => {
    resetBoardTransitionForestAmbientSoundForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('locks the scalable Forest-folder sources and their independent gains', () => {
    expect(BOARD_TRANSITION_FOREST_AMBIENT_SOUND_SOURCE)
      .toBe('./assets/sound/Board transitions/Forest/Forest.wav');
    expect(BOARD_TRANSITION_FOREST_AMBIENT_BOOST).toBe(1.2);
    expect(BOARD_TRANSITION_FOREST_AMBIENT_SOUND_VOLUME).toBeCloseTo(0.72);
    const bytes = fs.readFileSync(path.resolve(
      process.cwd(),
      BOARD_TRANSITION_FOREST_AMBIENT_SOUND_SOURCE.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(bytes).digest('hex'))
      .toBe('87b600b5bfb2a67ed8810135d230eae0716b956f14545b5b11728a23313550a6');
    expect(BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_SOURCE)
      .toBe('./assets/sound/Board transitions/Forest/bees small.wav');
    expect(BOARD_TRANSITION_FOREST_BEES_SMALL_ACTION_VOLUME).toBe(0.2);
    expect(BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_VOLUME).toBeCloseTo(0.144);
    expect(BOARD_TRANSITION_FOREST_BEES_SMALL_DURATION_SECONDS).toBe(4);
    expect(BOARD_TRANSITION_FOREST_BEES_SMALL_FADE_OUT_SECONDS).toBe(1);
    const beesBytes = fs.readFileSync(path.resolve(
      process.cwd(),
      BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_SOURCE.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(beesBytes).digest('hex'))
      .toBe('8a65c25cb66adec22c10ffeac7f081cdbb78ad87d56feb9015950a1333a1f6b2');
  });

  test('preloads both layers and fades only Small Bees over its final second', () => {
    expect(preloadBoardTransitionForestAmbientSound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(2);
    expect(playBoardTransitionForestAmbientSound()).toBe(true);
    const [ambientAudio, beesAudio] = MockAudio.instances;
    expect(ambientAudio.src).toBe(BOARD_TRANSITION_FOREST_AMBIENT_SOUND_SOURCE);
    expect(beesAudio.src).toBe(BOARD_TRANSITION_FOREST_BEES_SMALL_SOUND_SOURCE);
    expect(ambientAudio.play).toHaveBeenCalledTimes(1);
    expect(beesAudio.play).toHaveBeenCalledTimes(1);
    expect(ambientAudio.volume).toBeCloseTo(0.72);
    expect(beesAudio.volume).toBeCloseTo(0.144);
    expect(ambientAudio.currentTime).toBe(0);
    expect(beesAudio.currentTime).toBe(0);

    jest.advanceTimersByTime(3000);
    expect(beesAudio.paused).toBe(false);
    expect(beesAudio.volume).toBeCloseTo(0.144);
    jest.advanceTimersByTime(500);
    expect(beesAudio.volume).toBeGreaterThan(0);
    expect(beesAudio.volume).toBeLessThan(0.144);
    expect(ambientAudio.paused).toBe(false);
    jest.advanceTimersByTime(500);
    expect(beesAudio.paused).toBe(true);
    expect(beesAudio.currentTime).toBe(0);
    expect(beesAudio.volume).toBeCloseTo(0.144);
    expect(ambientAudio.paused).toBe(false);

    stopBoardTransitionForestAmbientSound();
    expect(ambientAudio.pause).toHaveBeenCalled();
    expect(ambientAudio.currentTime).toBe(0);
  });

  test('obeys Sounds OFF, starts only for Forest, and survives transition cleanup', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadBoardTransitionForestAmbientSound()).toBe(false);
    expect(playBoardTransitionForestAmbientSound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    const owner = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/board-transition-screen.ts'),
      'utf8',
    );
    expect(owner).toContain("const isForestWorldTransition = resolvedTheme === 'forest' && runMode === RUN_MODE_JOURNEY;");
    expect(owner).toContain('if (isForestWorldTransition) preloadBoardTransitionForestAmbientSound();');
    expect(owner).toContain('if (isForestWorldTransition) playBoardTransitionForestAmbientSound();');
    const soundOwner = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/board-transition-forest-ambient-sound.ts'),
      'utf8',
    );
    expect(soundOwner).toContain('stopAfterSeconds: BOARD_TRANSITION_FOREST_BEES_SMALL_DURATION_SECONDS');
    expect(soundOwner).toContain('fadeOutSeconds: BOARD_TRANSITION_FOREST_BEES_SMALL_FADE_OUT_SECONDS');
    const cleanupOwner = owner.slice(owner.indexOf('function cleanup('));
    expect(cleanupOwner).not.toContain('stopBoardTransitionForestAmbientSound');
  });
});
