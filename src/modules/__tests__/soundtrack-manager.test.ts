import fs from 'node:fs';
import path from 'node:path';
import {
  SOUNDTRACK_LOOP_FADE_IN_MS,
  SOUNDTRACK_LOOP_FADE_OUT_MS,
  SOUNDTRACK_URL,
  SOUNDTRACK_VOLUME,
  fadeInAndResume,
  resetSoundtrackForTests,
  soundtrackManager,
  startSoundtrack,
  stopSoundtrack,
} from '../soundtrack-manager';

class MockAudio {
  static instances: MockAudio[] = [];
  readonly src: string;
  preload = '';
  loop = true;
  volume = 1;
  currentTime = 0;
  duration = 183.024;
  paused = true;
  private listeners = new Map<string, Set<() => void>>();

  play = jest.fn(() => {
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
    expect(SOUNDTRACK_VOLUME).toBe(0.8);
    expect(source).not.toContain('stacktosix-soundtrack.mp3');
    expect(source).not.toContain('stacktosix-soundtrackold.mp3');
    expect(source).not.toContain('oldstacktosix-soundtrack.mp3');
  });

  it('does not pause or restart the theme at board and transition boundaries', async () => {
    const appCore = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/app-core.ts'),
      'utf8',
    );
    const boardTransition = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/board-transition-screen.ts'),
      'utf8',
    );

    expect(appCore).not.toContain('fadeOutAndPause');
    expect(boardTransition).not.toContain('fadeOutAndPause');

    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
    expect(soundtrackManager.isStarted).toBe(true);

    startSoundtrack();
    fadeInAndResume();
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
    expect(currentAudio.currentTime).toBe(0);
    expect(currentAudio.volume).toBe(SOUNDTRACK_VOLUME);
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
});
