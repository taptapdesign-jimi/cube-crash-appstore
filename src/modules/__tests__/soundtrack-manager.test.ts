import fs from 'node:fs';
import path from 'node:path';
import {
  SOUNDTRACK_LOOP_FADE_IN_MS,
  SOUNDTRACK_LOOP_FADE_OUT_MS,
  SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS,
  SOUNDTRACK_GAMEPLAY_VOLUME,
  SOUNDTRACK_GAMEPLAY_VOLUME_RATIO,
  SOUNDTRACK_RESUME_FADE_IN_MS,
  SOUNDTRACK_URL,
  SOUNDTRACK_VOLUME,
  completeGameplayTransitionFade,
  fadeInAndResume,
  fadeOutSoundtrackForGameplay,
  resetSoundtrackForTests,
  soundtrackManager,
  startSoundtrack,
  stopSoundtrack,
} from '../soundtrack-manager';

class MockAudio {
  static instances: MockAudio[] = [];
  static rejectNextPlay = false;
  readonly src: string;
  preload = '';
  loop = true;
  volume = 1;
  currentTime = 0;
  duration = 183.024;
  paused = true;
  private listeners = new Map<string, Set<() => void>>();

  play = jest.fn(() => {
    if (MockAudio.rejectNextPlay) {
      MockAudio.rejectNextPlay = false;
      return Promise.reject(new DOMException('User activation required', 'NotAllowedError'));
    }
    this.paused = false;
    return Promise.resolve();
  });

  pause = jest.fn(() => {
    this.paused = true;
  });

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    this.listeners.get(type)?.forEach((listener) => listener());
  }
}

describe('global Stack to Six soundtrack', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    MockAudio.rejectNextPlay = false;
    (global as any).Audio = MockAudio;
    (window as any)._settings = { musicEnabled: true };
    resetSoundtrackForTests();
  });

  afterEach(() => {
    resetSoundtrackForTests();
    delete (window as any)._settings;
    (global as any).Audio = originalAudio;
    jest.useRealTimers();
  });

  it('uses only the supplied theme with a very short loop transition', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/soundtrack-manager.ts'),
      'utf8',
    );

    expect(SOUNDTRACK_URL).toBe('./assets/sound/soundtrack/stack to six theme.wav');
    expect(SOUNDTRACK_LOOP_FADE_OUT_MS).toBe(180);
    expect(SOUNDTRACK_LOOP_FADE_IN_MS).toBe(180);
    expect(SOUNDTRACK_VOLUME).toBe(0.68);
    expect(SOUNDTRACK_GAMEPLAY_VOLUME_RATIO).toBe(0.20);
    expect(SOUNDTRACK_GAMEPLAY_VOLUME).toBeCloseTo(0.136, 10);
    expect(SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS).toBe(320);
    expect(SOUNDTRACK_RESUME_FADE_IN_MS).toBe(420);
    expect(source).not.toContain('stacktosix-soundtrack.mp3');
    expect(source).not.toContain('stacktosix-soundtrackold.mp3');
    expect(source).not.toContain('oldstacktosix-soundtrack.mp3');
  });

  it('ducks to 20% across a gameplay intro and restores full volume without restarting', async () => {
    const appCore = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/app-core.ts'),
      'utf8',
    );
    const boardTransition = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/board-transition-screen.ts'),
      'utf8',
    );

    expect(appCore).not.toContain('fadeOutAndPause');
    expect(boardTransition).toContain('beginGameplayTransitionFade');
    expect(boardTransition).toContain('continueGameplayTransitionFade');
    expect(boardTransition).toContain('completeGameplayTransitionFade');

    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
    expect(soundtrackManager.isStarted).toBe(true);

    const fadeGeneration = fadeOutSoundtrackForGameplay(1000);
    jest.advanceTimersByTime(520);
    expect(currentAudio.volume).toBeGreaterThan(SOUNDTRACK_GAMEPLAY_VOLUME);
    expect(currentAudio.volume).toBeLessThan(SOUNDTRACK_VOLUME);

    jest.advanceTimersByTime(500);
    completeGameplayTransitionFade(fadeGeneration);
    expect(currentAudio.volume).toBeGreaterThan(SOUNDTRACK_GAMEPLAY_VOLUME);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);
    expect(currentAudio.pause).not.toHaveBeenCalled();

    fadeInAndResume();
    jest.advanceTimersByTime(SOUNDTRACK_RESUME_FADE_IN_MS + 20);
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
    expect(currentAudio.currentTime).toBe(0);
    expect(currentAudio.volume).toBe(SOUNDTRACK_VOLUME);

    completeGameplayTransitionFade(fadeGeneration);
    expect(currentAudio.volume).toBe(SOUNDTRACK_VOLUME);
  });

  it('keeps looping at the ducked gameplay level', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    const fadeGeneration = fadeOutSoundtrackForGameplay(100);
    jest.advanceTimersByTime(100);
    completeGameplayTransitionFade(fadeGeneration);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);

    currentAudio.emit('ended');
    await Promise.resolve();
    expect(currentAudio.play).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(SOUNDTRACK_LOOP_FADE_IN_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);
  });

  it('does not attenuate below 20% on a later transition while gameplay is already ducked', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    const firstGeneration = fadeOutSoundtrackForGameplay(100);
    jest.advanceTimersByTime(100);
    completeGameplayTransitionFade(firstGeneration);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);

    fadeOutSoundtrackForGameplay(1000);
    jest.advanceTimersByTime(500);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);
  });

  it('fades out and back in around each loop boundary', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    jest.advanceTimersByTime(currentAudio.duration * 1000 - SOUNDTRACK_LOOP_FADE_OUT_MS);
    jest.advanceTimersByTime(SOUNDTRACK_LOOP_FADE_OUT_MS + 20);
    expect(currentAudio.volume).toBe(0);

    currentAudio.emit('ended');
    await Promise.resolve();
    expect(currentAudio.currentTime).toBe(0);
    expect(currentAudio.play).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(SOUNDTRACK_LOOP_FADE_IN_MS + 20);
    expect(currentAudio.volume).toBe(SOUNDTRACK_VOLUME);
    expect(soundtrackManager.isStarted).toBe(true);
  });

  it('keeps Music OFF authoritative and rewinds the single owned voice', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    (window as any)._settings.musicEnabled = false;
    stopSoundtrack();
    expect(currentAudio.pause).toHaveBeenCalled();
    expect(currentAudio.currentTime).toBe(0);
    expect(currentAudio.volume).toBe(0);
    expect(soundtrackManager.isStarted).toBe(false);

    fadeInAndResume();
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
  });

  it('waits for touch pointerup before retrying an autoplay-blocked theme', async () => {
    MockAudio.rejectNextPlay = true;
    startSoundtrack();
    await Promise.resolve();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
    expect(soundtrackManager.isStarted).toBe(false);

    const pointerDown = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(pointerDown, 'pointerType', { value: 'touch' });
    document.dispatchEvent(pointerDown);
    expect(currentAudio.play).toHaveBeenCalledTimes(1);

    const pointerUp = new Event('pointerup', { bubbles: true });
    Object.defineProperty(pointerUp, 'pointerType', { value: 'touch' });
    document.dispatchEvent(pointerUp);
    await Promise.resolve();

    expect(currentAudio.play).toHaveBeenCalledTimes(2);
    expect(soundtrackManager.isStarted).toBe(true);
  });
});
