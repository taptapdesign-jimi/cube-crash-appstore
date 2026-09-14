import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE,
  FAIL_SCREEN_CTA_BOUNCE_SOUND_VOLUME,
  FAIL_SCREEN_SAXOPHONE_ACTION_VOLUME,
  FAIL_SCREEN_SAXOPHONE_DURATION_MS,
  FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE,
  FAIL_SCREEN_SAXOPHONE_VOLUME,
  playFailScreenCtaBounceSound,
  playFailScreenSaxophoneSound,
  preloadFailScreenSounds,
  resetFailScreenSoundsForTests,
  stopFailScreenCtaBounceSounds,
  stopFailScreenSounds,
} from '../fail-screen-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  preload = '';
  currentTime = 3;
  volume = 0;
  onended: (() => void) | null = null;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());
  constructor(public src: string) { MockAudio.instances.push(this); }
}

describe('Fail Screen sounds', () => {
  const originalAudio = global.Audio;
  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetFailScreenSoundsForTests();
  });
  afterEach(() => {
    resetFailScreenSoundsForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  test('reuses the Clean Board pull cue at standard SFX gain', () => {
    expect(FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE).toBe('./assets/sound/magnet pul lforce/pull1.wav');
    expect(FAIL_SCREEN_CTA_BOUNCE_SOUND_VOLUME).toBeCloseTo(0.6);
  });

  test('uses the themed fail saxophone at its dedicated result mix', () => {
    expect(FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE)
      .toBe('./assets/sound/fail board/six fail.wav');
    const saxophoneBytes = fs.readFileSync(path.resolve(
      process.cwd(),
      FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(saxophoneBytes).digest('hex'))
      .toBe('ddb783383fe450f06a47db229ff98ceca806b493f02aef62c604b096a4ee8edf');
    expect(FAIL_SCREEN_SAXOPHONE_ACTION_VOLUME).toBe(0.9);
    expect(FAIL_SCREEN_SAXOPHONE_DURATION_MS).toBe(3000);
    expect(FAIL_SCREEN_SAXOPHONE_VOLUME).toBeCloseTo(0.54);
  });

  test('stops every Fail voice before a new route or game takes ownership', () => {
    expect(preloadFailScreenSounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(3);
    expect(playFailScreenSaxophoneSound()).toBe(true);
    expect(playFailScreenCtaBounceSound(0)).toBe(true);
    expect(playFailScreenCtaBounceSound(1)).toBe(true);
    MockAudio.instances.forEach((audio) => {
      expect(audio.play).toHaveBeenCalledTimes(1);
    });
    expect(MockAudio.instances.find((audio) => audio.src === FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE)?.volume)
      .toBeCloseTo(0.54);
    MockAudio.instances
      .filter((audio) => audio.src === FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE)
      .forEach((audio) => expect(audio.volume).toBeCloseTo(0.6));

    const saxophone = MockAudio.instances.find(
      (audio) => audio.src === FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE,
    );
    const ctaVoices = MockAudio.instances.filter(
      (audio) => audio.src === FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE,
    );
    const saxPauseCountBeforeModalCleanup = saxophone?.pause.mock.calls.length;
    const ctaPauseCountsBeforeModalCleanup = ctaVoices.map((audio) => audio.pause.mock.calls.length);

    stopFailScreenCtaBounceSounds();
    expect(saxophone?.pause).toHaveBeenCalledTimes(saxPauseCountBeforeModalCleanup ?? 0);
    ctaVoices.forEach((audio, index) => {
      expect(audio.pause).toHaveBeenCalledTimes(ctaPauseCountsBeforeModalCleanup[index] + 1);
    });

    stopFailScreenSounds();
    expect(saxophone?.pause).toHaveBeenCalledTimes((saxPauseCountBeforeModalCleanup ?? 0) + 1);
    expect(saxophone?.onended).toBeNull();
  });

  test('reports the actual media-element ending to the soundtrack owner', () => {
    const onEnded = jest.fn();
    expect(playFailScreenSaxophoneSound({ onEnded })).toBe(true);
    const saxophone = MockAudio.instances.find(
      (audio) => audio.src === FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE,
    );
    expect(onEnded).not.toHaveBeenCalled();
    saxophone?.onended?.();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  test('settles the result owner when route cleanup stops the sax early', () => {
    const onStopped = jest.fn();
    expect(playFailScreenSaxophoneSound({ onStopped })).toBe(true);

    stopFailScreenSounds();

    expect(onStopped).toHaveBeenCalledTimes(1);
  });

  test('starts after the Fail overlay mount, before each CTA enter, and obeys Sounds OFF', () => {
    const owner = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/board-fail-modal.ts'), 'utf8');
    expect(owner.indexOf('document.body.appendChild(overlay);'))
      .toBeLessThan(owner.indexOf('playFailScreenSaxophoneSound({'));
    expect(owner).toContain('onEnded: () => restoreSoundtrackAfterResultAudio(resultReleaseTarget),');
    expect(owner).toContain('onStopped: () => restoreSoundtrackAfterResultAudio(resultReleaseTarget),');
    expect(owner).toContain("cleanupFailModalLifecycle('gameplay');");
    expect(owner).toContain("restoreSoundtrackAfterResultAudio('gameplay');");
    for (const index of [0, 1]) {
      const soundAt = owner.indexOf(`playFailScreenCtaBounceSound(${index});`);
      expect(soundAt).toBeGreaterThan(-1);
      expect(soundAt).toBeLessThan(owner.indexOf('void controller?.enter();', soundAt));
    }
    expect(owner).toContain('stopFailScreenSounds();');
    expect(owner).not.toContain('stopFailScreenCtaBounceSounds');
    expect(owner).toContain('if (_activeModalPromise) {');
    expect(owner).toContain('return _activeModalPromise;');
    const settingsOwner = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');
    expect(settingsOwner).toContain("import('./fail-screen-sound.ts').then(({ stopFailScreenSounds }) => {");
    expect(settingsOwner).toContain('stopFailScreenSounds();');
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadFailScreenSounds()).toBe(false);
    expect(playFailScreenSaxophoneSound()).toBe(false);
    expect(playFailScreenCtaBounceSound(0)).toBe(false);
  });
});
