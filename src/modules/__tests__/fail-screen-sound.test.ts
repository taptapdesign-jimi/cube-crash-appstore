import fs from 'node:fs';
import path from 'node:path';
import {
  FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE,
  FAIL_SCREEN_CTA_BOUNCE_SOUND_VOLUME,
  playFailScreenCtaBounceSound,
  preloadFailScreenSounds,
  resetFailScreenSoundsForTests,
  stopFailScreenSounds,
} from '../fail-screen-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  preload = '';
  currentTime = 3;
  volume = 0;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());
  constructor(public src: string) { MockAudio.instances.push(this); }
}

describe('Fail Screen CTA bounce sounds', () => {
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

  test('owns independent voices for both CTA entrances and cleans them up', () => {
    expect(preloadFailScreenSounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(2);
    expect(playFailScreenCtaBounceSound(0)).toBe(true);
    expect(playFailScreenCtaBounceSound(1)).toBe(true);
    MockAudio.instances.forEach((audio) => {
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.volume).toBeCloseTo(0.6);
    });
    stopFailScreenSounds();
    MockAudio.instances.forEach((audio) => expect(audio.pause).toHaveBeenCalled());
  });

  test('starts immediately before each CTA enter and obeys Sounds OFF', () => {
    const owner = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/board-fail-modal.ts'), 'utf8');
    for (const index of [0, 1]) {
      const soundAt = owner.indexOf(`playFailScreenCtaBounceSound(${index});`);
      expect(soundAt).toBeGreaterThan(-1);
      expect(soundAt).toBeLessThan(owner.indexOf('void controller?.enter();', soundAt));
    }
    expect(owner).toContain('stopFailScreenSounds();');
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadFailScreenSounds()).toBe(false);
    expect(playFailScreenCtaBounceSound(0)).toBe(false);
  });
});
