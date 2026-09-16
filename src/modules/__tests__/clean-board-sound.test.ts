import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CLEAN_BOARD_APPLAUSE_ACTION_VOLUME,
  CLEAN_BOARD_APPLAUSE_DURATION_MS,
  CLEAN_BOARD_APPLAUSE_SOUND_SOURCE,
  CLEAN_BOARD_APPLAUSE_VOLUME,
  CLEAN_BOARD_CTA_BOUNCE_SOUND_SOURCE,
  CLEAN_BOARD_FAST_POINTS_STACK_ACTION_VOLUME,
  CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE,
  CLEAN_BOARD_FAST_POINTS_STACK_VOLUME,
  CLEAN_BOARD_MONEY_COUNT_ACTION_VOLUME,
  CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE,
  CLEAN_BOARD_MONEY_COUNT_VOLUME,
  CLEAN_BOARD_SAXOPHONE_HAPPY_ACTION_VOLUME,
  CLEAN_BOARD_SAXOPHONE_HAPPY_DURATION_MS,
  CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE,
  CLEAN_BOARD_SAXOPHONE_HAPPY_VOLUME,
  CLEAN_BOARD_SOUND_VOLUME,
  CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE,
  CLEAN_BOARD_STAR_BOUNCE_ACTION_VOLUME,
  CLEAN_BOARD_STAR_BOUNCE_VOLUME,
  CLEAN_BOARD_STAR_HARP_ACTION_VOLUME,
  CLEAN_BOARD_STAR_HARP_SOUND_SOURCES,
  CLEAN_BOARD_STAR_HARP_VOLUME,
  createCleanBoardStarHarpOrder,
  playCleanBoardBonusCountSound,
  playCleanBoardApplauseSound,
  playCleanBoardCtaBounceSound,
  playCleanBoardEarnedStarSound,
  playCleanBoardMoneyCountSound,
  playCleanBoardSaxophoneHappySound,
  resetCleanBoardSoundsForTests,
} from '../clean-board-sound.ts';

describe('Clean Board result sounds', () => {
  beforeEach(() => {
    (window as any)._settings = { gameSoundsEnabled: true };
    resetCleanBoardSoundsForTests();
  });

  afterEach(() => {
    resetCleanBoardSoundsForTests();
    delete (window as any)._settings;
  });

  test('uses the supplied result, counter and earned-star assets', () => {
    expect(CLEAN_BOARD_APPLAUSE_SOUND_SOURCE).toBe('./assets/sound/Clean board/applause.wav');
    const applauseBytes = fs.readFileSync(path.resolve(
      process.cwd(),
      CLEAN_BOARD_APPLAUSE_SOUND_SOURCE.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(applauseBytes).digest('hex'))
      .toBe('c5123c0808c39fb65e4169861c0fb1e96860d465e3733eeadb6c79a6c73737f3');
    expect(CLEAN_BOARD_APPLAUSE_ACTION_VOLUME).toBe(0.6);
    expect(CLEAN_BOARD_APPLAUSE_VOLUME).toBeCloseTo(0.36);
    expect(CLEAN_BOARD_APPLAUSE_DURATION_MS).toBe(10000);
    expect(CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE)
      .toBe('./assets/sound/Clean board/happy victory sax .wav');
    const saxophoneBytes = fs.readFileSync(path.resolve(
      process.cwd(),
      CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(saxophoneBytes).digest('hex'))
      .toBe('c9ae7988458152f994894c5e927777dafc1d7e02e6ed7808813d251bd251abe6');
    expect(CLEAN_BOARD_SAXOPHONE_HAPPY_DURATION_MS).toBe(5000);
    expect(CLEAN_BOARD_SAXOPHONE_HAPPY_ACTION_VOLUME).toBe(0.76);
    expect(CLEAN_BOARD_SAXOPHONE_HAPPY_VOLUME).toBeCloseTo(0.456);
    expect(CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE).toBe('./assets/sound/Clean board/money count.wav');
    expect(CLEAN_BOARD_MONEY_COUNT_ACTION_VOLUME).toBe(0.95);
    expect(CLEAN_BOARD_MONEY_COUNT_VOLUME).toBeCloseTo(0.57);
    expect(CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE)
      .toBe('./assets/sound/Clean board/fastpointsstack.wav');
    const fastPointsBytes = fs.readFileSync(path.resolve(
      process.cwd(),
      CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(fastPointsBytes).digest('hex'))
      .toBe('9ef4931b59789d751b4d10c2c0a57d0971278c9ac76fa466db5b764fc7720e22');
    expect(CLEAN_BOARD_FAST_POINTS_STACK_ACTION_VOLUME).toBe(0.6);
    expect(CLEAN_BOARD_FAST_POINTS_STACK_VOLUME).toBe(0.36);
    expect(CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE).toBe('./assets/sound/Clean board/boinb.wav');
    expect(CLEAN_BOARD_STAR_BOUNCE_ACTION_VOLUME).toBe(0.8);
    expect(CLEAN_BOARD_STAR_BOUNCE_VOLUME).toBeCloseTo(0.48);
    expect(CLEAN_BOARD_CTA_BOUNCE_SOUND_SOURCE).toBe('./assets/sound/magnet pul lforce/pull1.wav');
    expect(CLEAN_BOARD_STAR_HARP_SOUND_SOURCES).toEqual([
      './assets/sound/Clean board/harp1.wav',
      './assets/sound/Clean board/harp2.wav',
      './assets/sound/Clean board/harp3.wav',
    ]);
    expect(CLEAN_BOARD_STAR_HARP_ACTION_VOLUME).toBe(0.4);
    expect(CLEAN_BOARD_STAR_HARP_VOLUME).toBe(0.24);
    expect(CLEAN_BOARD_SOUND_VOLUME).toBe(0.6);
  });

  test('assigns three distinct harp cues and avoids repeating the prior arrangement', () => {
    const first = createCleanBoardStarHarpOrder(() => 0);
    const second = createCleanBoardStarHarpOrder(() => 0);
    expect(new Set(first).size).toBe(3);
    expect(new Set(second).size).toBe(3);
    expect(second).not.toEqual(first);
  });

  test('connects cues to the exact animation starts and only earned filled stars', () => {
    const modal = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/clean-board-modal.ts'), 'utf8');
    expect(modal.indexOf('document.body.appendChild(el);')).toBeLessThan(modal.indexOf('playCleanBoardApplauseSound();'));
    expect(modal.indexOf('document.body.appendChild(el);')).toBeLessThan(modal.indexOf('playCleanBoardSaxophoneHappySound({'));
    expect(modal.indexOf('playCleanBoardApplauseSound();')).toBeLessThan(modal.indexOf('playCleanBoardSaxophoneHappySound({'));
    expect(modal).toContain('const restoreSoundtrackAfterResultAudio = fadeSoundtrackForResultHook();');
    expect(modal).toContain("resultReleaseTarget = 'gameplay';");
    expect(modal).toContain("restoreSoundtrackAfterResultAudio('gameplay');");
    expect(modal).toContain('playCleanBoardApplauseSound();');
    expect(modal).toContain('onEnded: () => restoreSoundtrackAfterResultAudio(resultReleaseTarget),');
    expect(modal).toContain('onStopped: () => restoreSoundtrackAfterResultAudio(resultReleaseTarget),');
    expect(modal).toContain('onUnavailable: () => restoreSoundtrackAfterResultAudio(resultReleaseTarget),');
    expect(modal).toContain('updateScore(currentScore, true, true);');
    expect(modal).toContain('if (playCountSound) playCleanBoardMoneyCountSound(duration);');
    expect(modal.match(/playCleanBoardBonusCountSound\(durationSec\);/g)).toHaveLength(2);
    const earnedStarBranch = modal.split('if (index < numStars) {')[1]?.split('}, index * 500)')[0] ?? '';
    expect(earnedStarBranch).toContain('playCleanBoardEarnedStarSound(index, starHarpOrder[index]);');
    const primaryCtaOwner = modal.split('addButtonPressHandling(primaryBtn, async () => {')[1]
      ?.split("}, 'primary');")[0] ?? '';
    const secondaryCtaOwner = modal.split('addButtonPressHandling(secondaryBtn, async () => {')[1]
      ?.split("}, 'secondary');")[0] ?? '';
    expect(primaryCtaOwner).toContain('stopCleanBoardSounds();');
    expect(secondaryCtaOwner).toContain('stopCleanBoardSounds();');
    const ctaBounceOwner = modal.split('const animateButtonIn =')[1]?.split('const buttonExitDurationMs')[0] ?? '';
    expect(ctaBounceOwner.indexOf('playCleanBoardCtaBounceSound(button === primaryBtn ? 0 : 1);')).toBeLessThan(
      ctaBounceOwner.indexOf('void controller?.enter();'),
    );
    const owner = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/clean-board-sound.ts'), 'utf8');
    expect(owner).toContain('stopAfterSeconds,');
    expect(owner).toContain('fadeOutSeconds: stopAfterSeconds === undefined ? undefined : CLEAN_BOARD_COUNTER_FADE_SECONDS');
    expect(owner).not.toContain('money count2.wav');
    expect(owner).not.toContain('points.wav');
    expect(owner).toContain('CLEAN_BOARD_APPLAUSE_VOLUME,');
    expect(owner).toContain('CLEAN_BOARD_MONEY_COUNT_VOLUME,');
    expect(owner).toContain('CLEAN_BOARD_FAST_POINTS_STACK_VOLUME,');
    expect(owner).toContain('CLEAN_BOARD_STAR_BOUNCE_VOLUME,');
    expect(owner).toContain('CLEAN_BOARD_STAR_HARP_VOLUME,');
  });

  test('obeys Sounds OFF and rejects non-existent star slots', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(playCleanBoardApplauseSound()).toBe(false);
    expect(playCleanBoardSaxophoneHappySound()).toBe(false);
    expect(playCleanBoardMoneyCountSound()).toBe(false);
    expect(playCleanBoardBonusCountSound()).toBe(false);
    expect(playCleanBoardCtaBounceSound(0)).toBe(false);
    expect(playCleanBoardEarnedStarSound(0, CLEAN_BOARD_STAR_HARP_SOUND_SOURCES[0])).toBe(false);
    expect(playCleanBoardEarnedStarSound(3, CLEAN_BOARD_STAR_HARP_SOUND_SOURCES[0])).toBe(false);
  });
});
