import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fadeOutJourneyForestGameplaySound,
  isJourneyForestGameplaySoundEligible,
  JOURNEY_FOREST_GAMEPLAY_ACTION_VOLUME,
  JOURNEY_FOREST_GAMEPLAY_FADE_OUT_MS,
  JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE,
  JOURNEY_FOREST_GAMEPLAY_VOLUME,
  playJourneyForestGameplaySound,
  preloadJourneyForestGameplaySound,
  resetJourneyForestGameplaySoundForTests,
  stopJourneyForestGameplaySound,
} from '../journey-forest-gameplay-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  preload = '';
  loop = false;
  currentTime = 5;
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

describe('Journey Forest gameplay sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetJourneyForestGameplaySoundForTests();
  });

  afterEach(() => {
    resetJourneyForestGameplaySoundForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('locks the supplied Forest gameplay asset and dedicated mix', () => {
    expect(JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE).toBe(
      './assets/sound/worlds/Forest/gameplay/forest-gameplay-sound.wav',
    );
    expect(JOURNEY_FOREST_GAMEPLAY_ACTION_VOLUME).toBe(0.9);
    expect(JOURNEY_FOREST_GAMEPLAY_VOLUME).toBeCloseTo(0.54);
    expect(JOURNEY_FOREST_GAMEPLAY_FADE_OUT_MS).toBe(2000);

    const bytes = fs.readFileSync(path.resolve(
      process.cwd(),
      JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE.replace(/^\.\//, ''),
    ));
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(
      'f083b05d4eca94bf984fa1b11b8046d47fd27b90b76df53fd4692e77111965be',
    );
  });

  test('is exclusive to Journey Forest boards 1 through 10', () => {
    expect(isJourneyForestGameplaySoundEligible({ boardNumber: 1, isArcade: false })).toBe(true);
    expect(isJourneyForestGameplaySoundEligible({ boardNumber: 10, isArcade: false })).toBe(true);
    expect(isJourneyForestGameplaySoundEligible({ boardNumber: 11, isArcade: false })).toBe(false);
    expect(isJourneyForestGameplaySoundEligible({ boardNumber: 1, isArcade: true })).toBe(false);
  });

  test('loops from committed gameplay entry and fades for exactly two seconds', () => {
    const forest = { boardNumber: 4, isArcade: false };
    expect(preloadJourneyForestGameplaySound(forest)).toBe(true);
    expect(playJourneyForestGameplaySound(forest)).toBe(true);
    expect(MockAudio.instances).toHaveLength(1);
    const audio = MockAudio.instances[0];
    expect(audio.preload).toBe('auto');
    expect(audio.loop).toBe(true);
    expect(audio.currentTime).toBe(0);

    expect(fadeOutJourneyForestGameplaySound()).toBe(true);
    stopJourneyForestGameplaySound({ preserveActiveFade: true });
    jest.advanceTimersByTime(JOURNEY_FOREST_GAMEPLAY_FADE_OUT_MS / 2);
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBeGreaterThan(0);
    expect(audio.volume).toBeLessThan(JOURNEY_FOREST_GAMEPLAY_VOLUME);

    jest.advanceTimersByTime(JOURNEY_FOREST_GAMEPLAY_FADE_OUT_MS / 2);
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(audio.volume).toBeCloseTo(JOURNEY_FOREST_GAMEPLAY_VOLUME);
  });

  test('obeys Sounds OFF and connects visible entry, residual completion and cleanup owners', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    const forest = { boardNumber: 1, isArcade: false };
    expect(preloadJourneyForestGameplaySound(forest)).toBe(false);
    expect(playJourneyForestGameplaySound(forest)).toBe(false);

    const appCore = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/app-core.ts'),
      'utf8',
    );
    const uiManager = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/ui-manager.ts'),
      'utf8',
    );
    expect(appCore.match(/playJourneyForestGameplaySound\(\{/g)).toHaveLength(2);
    expect(appCore).toContain('const residualPopOutCompleted = await residualPopOutCompletion;');
    expect(appCore).toContain('if (residualPopOutCompleted && handoffGeneration === gameplayRunGeneration)');
    expect(appCore).toContain('fadeOutJourneyForestGameplaySound();');
    expect(appCore).toContain('stopJourneyForestGameplaySound({ preserveActiveFade: true });');
    expect(uiManager).toContain("import('./journey-forest-gameplay-sound.ts')");
  });
});
