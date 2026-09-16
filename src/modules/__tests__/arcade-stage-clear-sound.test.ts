import fs from 'node:fs';
import path from 'node:path';
import * as decodedAudio from '../gameplay-audio-buffer-player';
import {
  ARCADE_STAGE_CLEAR_APPLAUSE_ACTION_VOLUME,
  ARCADE_STAGE_CLEAR_APPLAUSE_SOUND_SOURCE,
  ARCADE_STAGE_CLEAR_APPLAUSE_VOLUME,
  ARCADE_STAGE_CLEAR_NN_EXIT_FADE_SECONDS,
  ARCADE_STAGE_CLEAR_THUMB_WHOOSH_ACTION_VOLUME,
  ARCADE_STAGE_CLEAR_THUMB_WHOOSH_SOUND_SOURCE,
  ARCADE_STAGE_CLEAR_THUMB_WHOOSH_VOLUME,
  ARCADE_STAGE_CLEAR_VICTORY_ACTION_VOLUME,
  ARCADE_STAGE_CLEAR_VICTORY_SOUND_SOURCE,
  ARCADE_STAGE_CLEAR_VICTORY_VOLUME,
  fadeOutArcadeStageClearCelebrationSounds,
  playArcadeStageClearApplauseSound,
  playArcadeStageClearCelebrationSounds,
  playArcadeStageClearThumbWhooshSound,
  playArcadeStageClearVictorySound,
  preloadArcadeStageClearSounds,
  resetArcadeStageClearSoundsForTests,
  stopArcadeStageClearSounds,
} from '../arcade-stage-clear-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  preload = '';
  currentTime = 3;
  volume = 0;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

describe('Arcade stage-clear result sounds', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    (global as any).Audio = MockAudio;
    MockAudio.instances = [];
    (window as any)._settings = { gameSoundsEnabled: true };
    resetArcadeStageClearSoundsForTests();
    jest.spyOn(decodedAudio, 'preloadDecodedGameplaySounds').mockReturnValue(false);
    jest.spyOn(decodedAudio, 'getDecodedGameplaySoundsState').mockReturnValue('unavailable');
  });

  afterEach(() => {
    resetArcadeStageClearSoundsForTests();
    jest.restoreAllMocks();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  test('plays existing victory sax and applause together, with only one hand woosh', () => {
    expect(ARCADE_STAGE_CLEAR_VICTORY_SOUND_SOURCE)
      .toBe('./assets/sound/Clean board/happy victory sax .wav');
    expect(ARCADE_STAGE_CLEAR_THUMB_WHOOSH_SOUND_SOURCE)
      .toBe('./assets/sound/cjelina flip/flip soft.wav');
    expect(ARCADE_STAGE_CLEAR_APPLAUSE_SOUND_SOURCE)
      .toBe('./assets/sound/Clean board/applause.wav');
    expect(fs.existsSync(ARCADE_STAGE_CLEAR_VICTORY_SOUND_SOURCE.replace(/^\.\//, ''))).toBe(true);
    expect(fs.existsSync(ARCADE_STAGE_CLEAR_THUMB_WHOOSH_SOUND_SOURCE.replace(/^\.\//, ''))).toBe(true);
    expect(fs.existsSync(ARCADE_STAGE_CLEAR_APPLAUSE_SOUND_SOURCE.replace(/^\.\//, ''))).toBe(true);
    expect(ARCADE_STAGE_CLEAR_VICTORY_ACTION_VOLUME).toBe(0.76);
    expect(ARCADE_STAGE_CLEAR_VICTORY_VOLUME).toBeCloseTo(0.456);
    expect(ARCADE_STAGE_CLEAR_APPLAUSE_ACTION_VOLUME).toBe(0.6);
    expect(ARCADE_STAGE_CLEAR_APPLAUSE_VOLUME).toBeCloseTo(0.36);
    expect(ARCADE_STAGE_CLEAR_THUMB_WHOOSH_ACTION_VOLUME).toBe(1);
    expect(ARCADE_STAGE_CLEAR_THUMB_WHOOSH_VOLUME).toBeCloseTo(0.6);

    expect(preloadArcadeStageClearSounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(3);
    const victory = MockAudio.instances.find(audio => audio.src === ARCADE_STAGE_CLEAR_VICTORY_SOUND_SOURCE)!;
    const applause = MockAudio.instances.find(audio => audio.src === ARCADE_STAGE_CLEAR_APPLAUSE_SOUND_SOURCE)!;
    const whoosh = MockAudio.instances.find(audio => audio.src === ARCADE_STAGE_CLEAR_THUMB_WHOOSH_SOUND_SOURCE)!;
    expect(playArcadeStageClearCelebrationSounds()).toBe(true);
    expect(victory.play).toHaveBeenCalledTimes(1);
    expect(victory.volume).toBeCloseTo(0.456);
    expect(applause.play).toHaveBeenCalledTimes(1);
    expect(applause.volume).toBeCloseTo(0.36);
    expect(whoosh.play).not.toHaveBeenCalled();
    expect(playArcadeStageClearThumbWhooshSound()).toBe(true);
    expect(whoosh.play).toHaveBeenCalledTimes(1);
    expect(whoosh.volume).toBeCloseTo(0.6);

    stopArcadeStageClearSounds();
    expect(victory.pause).toHaveBeenCalled();
    expect(applause.pause).toHaveBeenCalled();
    expect(whoosh.pause).toHaveBeenCalled();
    expect(victory.currentTime).toBe(0);
    expect(applause.currentTime).toBe(0);
    expect(whoosh.currentTime).toBe(0);
  });

  test('starts at the clear headline and thumb motion, and stays out of a resumed Round cue', () => {
    const modal = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');
    const clear = modal.slice(modal.indexOf('async function playClearPhase('), modal.indexOf('function animateBottomHudStageIndicator('));
    const resumedRound = modal.slice(
      modal.indexOf('export async function showArcadeContinuationRoundCue('),
      modal.indexOf('export function cancelArcadeStageClearModal('),
    );
    expect(clear).toContain('onStart: () => {\n        if (isCurrent()) playArcadeStageClearThumbWhooshSound();');
    expect(clear).toContain('playBubblyLetterEnter(titleLetters, 0, () => {\n    if (isCurrent()) playArcadeStageClearCelebrationSounds();');
    expect(modal).toContain('if (index === 0 && isCurrent()) onFirstDigitExit?.();');
    expect(modal).toContain('playRoundNumberPhase(parts, nextStage, isCurrent, fadeOutArcadeStageClearCelebrationSounds)');
    expect(modal).toContain('onStart: index === 0 ? onFirstLetterStart : undefined');
    expect(modal).toContain('preloadArcadeStageClearSounds();');
    expect(modal).toContain('stopArcadeStageClearSounds();');
    expect(resumedRound).not.toContain('playArcadeStageClearCelebrationSounds();');
    expect(resumedRound).not.toContain('fadeOutArcadeStageClearCelebrationSounds');
    expect(resumedRound).not.toContain('playArcadeStageClearThumbWhooshSound();');
    expect(resumedRound).not.toContain('preloadArcadeStageClearSounds();');
    const settings = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');
    expect(settings).toContain("import('./arcade-stage-clear-sound.ts').then(({ stopArcadeStageClearSounds })");
  });

  test('obeys Sounds OFF', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadArcadeStageClearSounds()).toBe(false);
    expect(playArcadeStageClearVictorySound()).toBe(false);
    expect(playArcadeStageClearApplauseSound()).toBe(false);
    expect(playArcadeStageClearCelebrationSounds()).toBe(false);
    expect(playArcadeStageClearThumbWhooshSound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);
  });

  test('fades both result voices at NN exit but leaves the hand woosh alone', () => {
    const frames: FrameRequestCallback[] = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const decodedFade = jest.spyOn(decodedAudio, 'fadeOutDecodedGameplayVoice').mockReturnValue(false);
    expect(preloadArcadeStageClearSounds()).toBe(true);
    expect(playArcadeStageClearCelebrationSounds()).toBe(true);
    expect(playArcadeStageClearThumbWhooshSound()).toBe(true);
    const victory = MockAudio.instances.find(audio => audio.src === ARCADE_STAGE_CLEAR_VICTORY_SOUND_SOURCE)!;
    const applause = MockAudio.instances.find(audio => audio.src === ARCADE_STAGE_CLEAR_APPLAUSE_SOUND_SOURCE)!;
    const whoosh = MockAudio.instances.find(audio => audio.src === ARCADE_STAGE_CLEAR_THUMB_WHOOSH_SOUND_SOURCE)!;

    fadeOutArcadeStageClearCelebrationSounds();
    expect(ARCADE_STAGE_CLEAR_NN_EXIT_FADE_SECONDS).toBe(0.24);
    expect(decodedFade).toHaveBeenCalledWith('arcade-stage-clear-victory', 0.24);
    expect(decodedFade).toHaveBeenCalledWith('arcade-stage-clear-applause', 0.24);
    expect(decodedFade).not.toHaveBeenCalledWith('arcade-stage-clear-thumb-whoosh', expect.any(Number));
    expect(frames).toHaveLength(2);
    const finishedAt = performance.now() + 300;
    frames.forEach(frame => frame(finishedAt));
    expect(victory.volume).toBe(0);
    expect(applause.volume).toBe(0);
    expect(victory.currentTime).toBe(0);
    expect(applause.currentTime).toBe(0);
    expect(whoosh.volume).toBeCloseTo(0.6);
    expect(whoosh.play).toHaveBeenCalledTimes(1);
  });
});
