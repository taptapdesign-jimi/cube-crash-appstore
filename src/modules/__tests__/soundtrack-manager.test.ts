import * as themeTransport from '../main-theme-web-audio-transport';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ARCADE_SOUNDTRACK_ACTIVE_URL,
  ARCADE_SOUNDTRACK_ACTIVE_VOLUME,
  ARCADE_SOUNDTRACK_BAR_CROSSFADE_MS,
  ARCADE_SOUNDTRACK_BAR_SECONDS,
  ARCADE_SOUNDTRACK_CALM_URL,
  ARCADE_SOUNDTRACK_CALM_VOLUME,
  ARCADE_SOUNDTRACK_ENTRY_CROSSFADE_MS,
  ARCADE_SOUNDTRACK_RESULT_VOLUME,
  SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS,
  SOUNDTRACK_GAMEPLAY_SETTLE_MS,
  SOUNDTRACK_GAMEPLAY_VOLUME,
  SOUNDTRACK_GAMEPLAY_VOLUME_RATIO,
  SOUNDTRACK_INTRO_CROSSFADE_MS,
  SOUNDTRACK_INTRO_CROSSFADE_DELAY_MS,
  SOUNDTRACK_INTRO_DURATION_MS,
  SOUNDTRACK_INTRO_LOOP_PREROLL_SECONDS,
  SOUNDTRACK_INTRO_URL,
  SOUNDTRACK_LOOP_DURATION_SECONDS,
  SOUNDTRACK_RUNTIME_DURATION_SECONDS,
  SOUNDTRACK_RUNTIME_URL,
  SOUNDTRACK_RESUME_FADE_IN_MS,
  SOUNDTRACK_URL,
  SOUNDTRACK_VICTORY_FADE_IN_MS,
  SOUNDTRACK_VICTORY_FADE_OUT_MS,
  SOUNDTRACK_VOLUME,
  SOUNDTRACK_TRANSITION_VOLUME,
  SOUNDTRACK_TRANSITION_VOLUME_RATIO,
  completeGameplayTransitionFade,
  enterArcadeGameplaySoundtrack,
  promoteArcadeSoundtrackAfterMerge6,
  fadeInAndResume,
  fadeOutSoundtrackForGameplay,
  fadeSoundtrackForResultHook,
  resetSoundtrackForTests,
  setSoundtrackResultMix,
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
    delete (window as any).__ccRunMode;
    (global as any).Audio = originalAudio;
    jest.useRealTimers();
  });

  it('keeps the supplied theme for menus and declares the matching Arcade layers', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/soundtrack-manager.ts'),
      'utf8',
    );
    expect(source).toMatch(
      /fadeSoundtrackForResultHook\(\)[\s\S]*?playRequestToken\+\+;[\s\S]*?audio\?\.paused[\s\S]*?audio\.pause\(\);[\s\S]*?cancelIntroSequence\(true\);/,
    );
    expect(source).toMatch(
      /playSampleAccurateTheme[\s\S]*?if \(requestToken !== playRequestToken\) return;[\s\S]*?currentAudio\.pause\(\);/,
    );

    expect(SOUNDTRACK_URL)
      .toBe('./assets/sound/soundtrack/theme-loop-v1/SIx-theme-seamless-loop.wav');
    expect(SOUNDTRACK_INTRO_URL).toBe(
      './assets/sound/soundtrack/theme-loop-v1/SIx-theme-original-intro-bridge.wav',
    );
    expect(SOUNDTRACK_RUNTIME_URL).toBe(
      './assets/sound/soundtrack/theme-loop-v1/SIx-theme-runtime-intro-loop.wav',
    );
    const mainLoopBytes = fs.readFileSync(path.resolve(
      process.cwd(),
      SOUNDTRACK_URL.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(mainLoopBytes).digest('hex'))
      .toBe('b5bab3b34cd165851a25d7d3add3715417e104a4da767580e25b35f8f8e31e1a');
    const mainLoopAnalysis = JSON.parse(fs.readFileSync(path.resolve(
      process.cwd(),
      'assets/sound/soundtrack/theme-loop-v1/analysis.json',
    ), 'utf8'));
    expect(mainLoopAnalysis.source).toBe('assets/sound/soundtrack/SIx theme.wav');
    expect(mainLoopAnalysis.loopBars).toBe(28);
    expect(mainLoopAnalysis.crossfadeBars).toBe(1);
    expect(mainLoopAnalysis.durationSeconds).toBeCloseTo(57.63275, 6);
    const introBytes = fs.readFileSync(path.resolve(
      process.cwd(),
      SOUNDTRACK_INTRO_URL.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(introBytes).digest('hex'))
      .toBe(mainLoopAnalysis.introOutputSha256);
    expect(mainLoopAnalysis.introPhraseDurationSeconds).toBeCloseTo(2.0583125, 6);
    expect(mainLoopAnalysis.introBridgeDurationSeconds).toBeCloseTo(4.116625, 6);
    expect(mainLoopAnalysis.introBitDepth).toBe(16);
    const runtimeBytes = fs.readFileSync(path.resolve(
      process.cwd(),
      SOUNDTRACK_RUNTIME_URL.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(runtimeBytes).digest('hex'))
      .toBe(mainLoopAnalysis.runtimeOutputSha256);
    expect(mainLoopAnalysis.runtimeDurationSeconds).toBeCloseTo(59.6910625, 6);
    expect(mainLoopAnalysis.runtimeLoopStartSeconds).toBeCloseTo(2.0583125, 6);
    expect(mainLoopAnalysis.runtimeLoopEndSeconds).toBeCloseTo(59.6910625, 6);
    const introFrames = Math.round(mainLoopAnalysis.runtimeLoopStartSeconds * 48_000);
    expect(runtimeBytes.subarray(44 + introFrames * 6)).toEqual(mainLoopBytes.subarray(44));
    expect(SOUNDTRACK_LOOP_DURATION_SECONDS).toBeCloseTo(57.63275, 6);
    expect(SOUNDTRACK_RUNTIME_DURATION_SECONDS).toBeCloseTo(59.6910625, 6);
    expect(SOUNDTRACK_INTRO_DURATION_MS).toBeCloseTo(2058.3125, 6);
    expect(SOUNDTRACK_INTRO_CROSSFADE_MS).toBe(320);
    expect(SOUNDTRACK_INTRO_CROSSFADE_DELAY_MS).toBe(120);
    expect(SOUNDTRACK_INTRO_LOOP_PREROLL_SECONDS).toBeCloseTo(55.5744375, 6);
    expect(ARCADE_SOUNDTRACK_CALM_URL).toBe(
      './assets/sound/soundtrack/adaptive-music-v3/gameplay-bed-calm-01.wav',
    );
    expect(ARCADE_SOUNDTRACK_ACTIVE_URL).toBe(
      './assets/sound/soundtrack/adaptive-music-v3/gameplay-bed-active-01.wav',
    );
    expect(SOUNDTRACK_VOLUME).toBe(0.68);
    expect(SOUNDTRACK_TRANSITION_VOLUME_RATIO).toBe(0.20);
    expect(SOUNDTRACK_TRANSITION_VOLUME).toBeCloseTo(0.136, 10);
    expect(SOUNDTRACK_GAMEPLAY_VOLUME_RATIO).toBe(0.33);
    expect(SOUNDTRACK_GAMEPLAY_VOLUME).toBeCloseTo(0.2244, 10);
    expect(SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS).toBe(320);
    expect(SOUNDTRACK_GAMEPLAY_SETTLE_MS).toBe(320);
    expect(SOUNDTRACK_RESUME_FADE_IN_MS).toBe(420);
    expect(SOUNDTRACK_VICTORY_FADE_OUT_MS).toBe(420);
    expect(SOUNDTRACK_VICTORY_FADE_IN_MS).toBe(1000);
    expect(ARCADE_SOUNDTRACK_CALM_VOLUME).toBe(0.528);
    expect(ARCADE_SOUNDTRACK_ACTIVE_VOLUME).toBe(0.594);
    expect(ARCADE_SOUNDTRACK_BAR_SECONDS).toBeCloseTo(2.0583, 3);
    expect(ARCADE_SOUNDTRACK_BAR_CROSSFADE_MS).toBe(2058);
    expect(source).not.toContain('stacktosix-soundtrack.mp3');
    expect(source).not.toContain('stacktosix-soundtrackold.mp3');
    expect(source).not.toContain('oldstacktosix-soundtrack.mp3');
  });

  it('plays the original first-bar intro once before handing off to the seamless loop', async () => {
    startSoundtrack();
    await Promise.resolve();

    const currentAudio = MockAudio.instances.find((voice) => voice.src === SOUNDTRACK_URL);
    const currentIntroAudio = MockAudio.instances.find((voice) => voice.src === SOUNDTRACK_INTRO_URL);
    expect(currentAudio).toBeDefined();
    expect(currentIntroAudio).toBeDefined();
    expect(currentAudio?.loop).toBe(true);
    expect(currentIntroAudio?.loop).toBe(false);
    expect(currentAudio?.currentTime).toBeCloseTo(SOUNDTRACK_INTRO_LOOP_PREROLL_SECONDS, 6);
    expect(currentAudio?.volume).toBe(0);
    expect(currentIntroAudio?.currentTime).toBe(0);
    expect(currentIntroAudio?.volume).toBe(SOUNDTRACK_VOLUME);
    expect(currentAudio?.play).toHaveBeenCalledTimes(1);
    expect(currentIntroAudio?.play).toHaveBeenCalledTimes(1);

    if (currentIntroAudio) {
      currentIntroAudio.currentTime = SOUNDTRACK_INTRO_DURATION_MS / 1000 + 0.123;
    }
    jest.advanceTimersByTime(
      SOUNDTRACK_INTRO_DURATION_MS + SOUNDTRACK_INTRO_CROSSFADE_DELAY_MS +
      Math.floor(SOUNDTRACK_INTRO_CROSSFADE_MS / 2),
    );
    expect(currentAudio?.currentTime).toBeCloseTo(
      0.123,
      6,
    );
    expect(currentAudio?.volume ?? 0).toBeGreaterThan(0);
    expect(currentAudio?.volume ?? 1).toBeLessThan(SOUNDTRACK_VOLUME);
    expect(currentIntroAudio?.volume ?? 0).toBeGreaterThan(0);
    expect(currentIntroAudio?.volume ?? 1).toBeLessThan(SOUNDTRACK_VOLUME);
    expect((currentAudio?.volume ?? 0) + (currentIntroAudio?.volume ?? 0))
      .toBeCloseTo(SOUNDTRACK_VOLUME, 10);

    jest.advanceTimersByTime(Math.ceil(SOUNDTRACK_INTRO_CROSSFADE_MS / 2) + 20);
    expect(currentAudio?.volume).toBeCloseTo(SOUNDTRACK_VOLUME, 10);
    expect(currentIntroAudio?.volume).toBe(0);
    expect(currentIntroAudio?.pause).toHaveBeenCalledTimes(1);

    startSoundtrack();
    expect(MockAudio.instances).toHaveLength(2);
    expect(currentAudio?.play).toHaveBeenCalledTimes(1);
    expect(currentIntroAudio?.play).toHaveBeenCalledTimes(1);
  });

  it('crossfades Arcade from Calm to phase-matched Active, then lowers the result bed', async () => {
    (window as any).__ccRunMode = 'arcade_home';
    startSoundtrack();
    await Promise.resolve();
    const theme = MockAudio.instances[0];

    const fadeGeneration = fadeOutSoundtrackForGameplay(100);
    jest.advanceTimersByTime(100 + SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS + 20);
    expect(theme.volume).toBeCloseTo(SOUNDTRACK_TRANSITION_VOLUME, 10);
    completeGameplayTransitionFade(fadeGeneration);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_SETTLE_MS + 20);
    await Promise.resolve();

    const calm = MockAudio.instances.find((voice) => voice.src === ARCADE_SOUNDTRACK_CALM_URL);
    expect(calm).toBeDefined();
    jest.advanceTimersByTime(ARCADE_SOUNDTRACK_ENTRY_CROSSFADE_MS + 20);
    expect(calm?.volume).toBeCloseTo(ARCADE_SOUNDTRACK_CALM_VOLUME, 10);
    expect(theme.pause).toHaveBeenCalled();

    if (calm) calm.currentTime = 1;
    promoteArcadeSoundtrackAfterMerge6();
    jest.advanceTimersByTime(Math.round((ARCADE_SOUNDTRACK_BAR_SECONDS - 1) * 1000));
    await Promise.resolve();

    const active = MockAudio.instances.find((voice) => voice.src === ARCADE_SOUNDTRACK_ACTIVE_URL);
    expect(active).toBeDefined();
    expect(active?.currentTime).toBe(1);
    jest.advanceTimersByTime(ARCADE_SOUNDTRACK_BAR_CROSSFADE_MS + 20);
    expect(active?.volume).toBeCloseTo(ARCADE_SOUNDTRACK_ACTIVE_VOLUME, 10);
    expect(calm?.pause).toHaveBeenCalled();

    setSoundtrackResultMix();
    jest.advanceTimersByTime(SOUNDTRACK_RESUME_FADE_IN_MS + 20);
    expect(active?.volume).toBeCloseTo(ARCADE_SOUNDTRACK_RESULT_VOLUME, 10);

    const releaseResultHold = fadeSoundtrackForResultHook();
    expect(active?.volume).toBeCloseTo(ARCADE_SOUNDTRACK_RESULT_VOLUME, 10);
    jest.advanceTimersByTime(Math.floor(SOUNDTRACK_VICTORY_FADE_OUT_MS / 2));
    expect(active?.volume ?? 0).toBeGreaterThan(0);
    expect(active?.volume ?? 1).toBeLessThan(ARCADE_SOUNDTRACK_RESULT_VOLUME);
    jest.advanceTimersByTime(SOUNDTRACK_VICTORY_FADE_OUT_MS + 20);
    expect(active?.volume).toBe(0);
    jest.advanceTimersByTime(10000);
    expect(active?.volume).toBe(0);
    releaseResultHold();
    expect(active?.volume).toBe(0);
    jest.advanceTimersByTime(Math.floor(SOUNDTRACK_VICTORY_FADE_IN_MS / 2));
    expect(active?.volume ?? 0).toBeGreaterThan(0);
    expect(active?.volume ?? 1).toBeLessThan(ARCADE_SOUNDTRACK_CALM_VOLUME);
    jest.advanceTimersByTime(Math.ceil(SOUNDTRACK_VICTORY_FADE_IN_MS / 2) + 20);
    expect(active?.volume).toBeCloseTo(ARCADE_SOUNDTRACK_CALM_VOLUME, 10);
  });

  it('holds 20% through the intro, lifts to 33% in gameplay and restores without restarting', async () => {
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
    jest.advanceTimersByTime(1000 + SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_TRANSITION_VOLUME, 10);
    completeGameplayTransitionFade(fadeGeneration);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_SETTLE_MS + 20);
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

  it('uses native continuous looping at the gameplay level without restarting', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    const fadeGeneration = fadeOutSoundtrackForGameplay(100);
    jest.advanceTimersByTime(100 + SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_TRANSITION_VOLUME, 10);
    completeGameplayTransitionFade(fadeGeneration);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_SETTLE_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);

    expect(currentAudio.loop).toBe(true);
    currentAudio.currentTime = currentAudio.duration - 0.001;
    currentAudio.emit('timeupdate');
    currentAudio.emit('ended');
    jest.advanceTimersByTime(500);
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);
  });

  it('preserves the 20% Board Transition floor before restoring the 33% gameplay mix', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    const firstGeneration = fadeOutSoundtrackForGameplay(100);
    jest.advanceTimersByTime(100 + SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS + 20);
    completeGameplayTransitionFade(firstGeneration);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_SETTLE_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);

    const secondGeneration = fadeOutSoundtrackForGameplay(1000);
    jest.advanceTimersByTime(1000 + SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_TRANSITION_VOLUME, 10);
    completeGameplayTransitionFade(secondGeneration);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_SETTLE_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);
  });

  it('keeps Journey music silent through the full result cue, then restores the menu level', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    const fadeGeneration = fadeOutSoundtrackForGameplay(100);
    jest.advanceTimersByTime(100 + SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS + 20);
    completeGameplayTransitionFade(fadeGeneration);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_SETTLE_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);

    currentAudio.currentTime = 42;
    const releaseResultHold = fadeSoundtrackForResultHook();
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);
    expect(currentAudio.pause).not.toHaveBeenCalled();
    jest.advanceTimersByTime(Math.floor(SOUNDTRACK_VICTORY_FADE_OUT_MS / 2));
    expect(currentAudio.volume).toBeGreaterThan(0);
    expect(currentAudio.volume).toBeLessThan(SOUNDTRACK_GAMEPLAY_VOLUME);
    jest.advanceTimersByTime(SOUNDTRACK_VICTORY_FADE_OUT_MS + 20);
    expect(currentAudio.volume).toBe(0);
    jest.advanceTimersByTime(10000);
    expect(currentAudio.volume).toBe(0);
    releaseResultHold();
    expect(currentAudio.volume).toBe(0);
    jest.advanceTimersByTime(Math.floor(SOUNDTRACK_VICTORY_FADE_IN_MS / 2));
    expect(currentAudio.volume).toBeGreaterThan(0);
    expect(currentAudio.volume).toBeLessThan(SOUNDTRACK_VOLUME);
    jest.advanceTimersByTime(Math.ceil(SOUNDTRACK_VICTORY_FADE_IN_MS / 2) + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_VOLUME, 10);
    expect(currentAudio.currentTime).toBe(42);
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
  });

  it('keeps music silent through the complete three-second Fail sax hook', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    const releaseResultHold = fadeSoundtrackForResultHook();
    jest.advanceTimersByTime(SOUNDTRACK_VICTORY_FADE_OUT_MS + 20);
    expect(currentAudio.volume).toBe(0);

    jest.advanceTimersByTime(10000);
    expect(currentAudio.volume).toBe(0);
    releaseResultHold();
    expect(currentAudio.volume).toBe(0);
    jest.advanceTimersByTime(Math.floor(SOUNDTRACK_VICTORY_FADE_IN_MS / 2));
    expect(currentAudio.volume).toBeGreaterThan(0);
    expect(currentAudio.volume).toBeLessThan(SOUNDTRACK_VOLUME);
    jest.advanceTimersByTime(Math.ceil(SOUNDTRACK_VICTORY_FADE_IN_MS / 2) + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_VOLUME, 10);
    expect(currentAudio.pause).not.toHaveBeenCalled();
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
  });

  it('recovers an unexpectedly paused theme on pageshow without resetting its position', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];
    currentAudio.currentTime = 42;
    currentAudio.pause();

    window.dispatchEvent(new Event('pageshow'));
    await Promise.resolve();
    jest.advanceTimersByTime(SOUNDTRACK_RESUME_FADE_IN_MS + 20);

    expect(currentAudio.play).toHaveBeenCalledTimes(2);
    expect(currentAudio.currentTime).toBe(42);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_VOLUME, 10);
  });

  it('recovers an unexpectedly paused theme from the native app-active signal', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];
    currentAudio.currentTime = 37;
    currentAudio.pause();

    window.dispatchEvent(new Event('cc:native-audio-active'));
    await Promise.resolve();
    jest.advanceTimersByTime(SOUNDTRACK_RESUME_FADE_IN_MS + 20);

    expect(currentAudio.play).toHaveBeenCalledTimes(2);
    expect(currentAudio.currentTime).toBe(37);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_VOLUME, 10);
  });

  it('restores the Journey gameplay mix when Retry stops result audio early', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    const releaseResultHold = fadeSoundtrackForResultHook();
    jest.advanceTimersByTime(SOUNDTRACK_VICTORY_FADE_OUT_MS + 20);
    expect(currentAudio.volume).toBe(0);

    releaseResultHold('gameplay');
    jest.advanceTimersByTime(SOUNDTRACK_VICTORY_FADE_IN_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);
  });

  it('retargets a completed result restore when Retry is tapped later', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];

    const releaseResultHold = fadeSoundtrackForResultHook();
    jest.advanceTimersByTime(SOUNDTRACK_VICTORY_FADE_OUT_MS + 20);
    releaseResultHold();
    jest.advanceTimersByTime(SOUNDTRACK_VICTORY_FADE_IN_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_VOLUME, 10);

    releaseResultHold('gameplay');
    jest.advanceTimersByTime(SOUNDTRACK_VICTORY_FADE_IN_MS + 20);
    expect(currentAudio.volume).toBeCloseTo(SOUNDTRACK_GAMEPLAY_VOLUME, 10);
  });

  it('discards an interrupted Arcade fade before a fresh gameplay owner starts', async () => {
    (window as any).__ccRunMode = 'arcade_home';
    startSoundtrack();
    await Promise.resolve();

    const fadeGeneration = fadeOutSoundtrackForGameplay(0);
    completeGameplayTransitionFade(fadeGeneration);
    jest.advanceTimersByTime(SOUNDTRACK_GAMEPLAY_SETTLE_MS + 20);
    await Promise.resolve();
    jest.advanceTimersByTime(ARCADE_SOUNDTRACK_ENTRY_CROSSFADE_MS + 20);

    const oldCalm = MockAudio.instances.find((voice) => voice.src === ARCADE_SOUNDTRACK_CALM_URL);
    expect(oldCalm).toBeDefined();
    fadeInAndResume(SOUNDTRACK_RESUME_FADE_IN_MS);
    expect(oldCalm?.paused).toBe(false);

    enterArcadeGameplaySoundtrack();
    expect(oldCalm?.paused).toBe(true);
    await Promise.resolve();

    const audibleArcadeVoices = MockAudio.instances.filter((voice) => (
      (voice.src === ARCADE_SOUNDTRACK_CALM_URL || voice.src === ARCADE_SOUNDTRACK_ACTIVE_URL)
      && !voice.paused
    ));
    expect(audibleArcadeVoices).toHaveLength(1);
  });

  it('does not fade, stop or restart at the main-theme loop boundary', async () => {
    startSoundtrack();
    await Promise.resolve();
    const currentAudio = MockAudio.instances[0];
    jest.advanceTimersByTime(SOUNDTRACK_INTRO_DURATION_MS + 20);

    currentAudio.currentTime = currentAudio.duration - 0.001;
    currentAudio.emit('timeupdate');
    currentAudio.emit('ended');
    jest.advanceTimersByTime(500);
    expect(currentAudio.loop).toBe(true);
    expect(currentAudio.play).toHaveBeenCalledTimes(1);
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
  it('schedules native gain fades without frame callbacks and cancels them on Music OFF', async () => {
    const nativeVoice = Object.assign(new MockAudio(SOUNDTRACK_RUNTIME_URL), {
      sampleAccurateIntroLoop: true as const,
      dispose: jest.fn(), rampVolume: jest.fn(), cancelVolumeRamp: jest.fn(),
    });
    const factory = jest.spyOn(themeTransport, 'createSampleAccurateMainThemeVoice')
      .mockReturnValue(nativeVoice as unknown as themeTransport.SampleAccurateMainThemeVoice);
    const raf = jest.spyOn(global, 'requestAnimationFrame');
    try {
      startSoundtrack();
      await Promise.resolve();
      const transition = fadeOutSoundtrackForGameplay(500);
      completeGameplayTransitionFade(transition);
      expect(nativeVoice.rampVolume).toHaveBeenCalledWith(
        SOUNDTRACK_TRANSITION_VOLUME, 500 + SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS,
      );
      expect(raf).not.toHaveBeenCalled();
      jest.advanceTimersByTime(500 + SOUNDTRACK_GAMEPLAY_FADE_TAIL_MS);
      expect(nativeVoice.rampVolume).toHaveBeenLastCalledWith(
        SOUNDTRACK_GAMEPLAY_VOLUME, SOUNDTRACK_GAMEPLAY_SETTLE_MS,
      );
      stopSoundtrack();
      const calls = nativeVoice.rampVolume.mock.calls.length;
      jest.advanceTimersByTime(5000);
      expect(nativeVoice.rampVolume).toHaveBeenCalledTimes(calls);
      expect(nativeVoice.cancelVolumeRamp).toHaveBeenCalled();
      expect(nativeVoice.paused).toBe(true);
      expect(nativeVoice.volume).toBe(0);
    } finally { raf.mockRestore(); factory.mockRestore(); }
  });

});
