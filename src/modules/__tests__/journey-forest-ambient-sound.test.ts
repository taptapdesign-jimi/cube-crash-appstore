import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fadeOutJourneyForestAmbientSounds,
  JOURNEY_FOREST_AMBIENT_ACTION_VOLUME,
  JOURNEY_FOREST_AMBIENT_BOOST,
  JOURNEY_FOREST_AMBIENT_FADE_OUT_MS,
  JOURNEY_FOREST_AMBIENT_SOUND_SOURCES,
  JOURNEY_FOREST_AMBIENT_VOLUME,
  playJourneyForestAmbientSounds,
  preloadJourneyForestAmbientSounds,
  resetJourneyForestAmbientSoundsForTests,
  stopJourneyForestAmbientSounds,
} from '../journey-forest-ambient-sound';

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

describe('Journey Forest ambient sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetJourneyForestAmbientSoundsForTests();
  });

  afterEach(() => {
    resetJourneyForestAmbientSoundsForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('locks both supplied Forest loops and their shared ambient mix', () => {
    expect(JOURNEY_FOREST_AMBIENT_SOUND_SOURCES).toEqual([
      './assets/sound/worlds/Forest/soft bees ambiance.wav',
      './assets/sound/worlds/Forest/forest nature sounds.wav',
    ]);
    expect(JOURNEY_FOREST_AMBIENT_ACTION_VOLUME).toBe(0.85);
    expect(JOURNEY_FOREST_AMBIENT_BOOST).toBe(1.2);
    expect(JOURNEY_FOREST_AMBIENT_VOLUME).toBeCloseTo(0.612);

    const expectedHashes = [
      '11094c17ae1ddaefece295a74ef516a13241d58c389318e3d930939c300c9b32',
      'd71babf206e4e7e39332cb4ee0b60664bd95ea73601af27cb8da66c14bb43d60',
    ];
    JOURNEY_FOREST_AMBIENT_SOUND_SOURCES.forEach((source, index) => {
      const bytes = fs.readFileSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')));
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(expectedHashes[index]);
    });
  });

  test('preloads and continuously loops both layers only while Sounds are enabled', () => {
    expect(preloadJourneyForestAmbientSounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(2);
    expect(MockAudio.instances.every((audio) => audio.preload === 'auto')).toBe(true);
    expect(MockAudio.instances.every((audio) => audio.loop)).toBe(true);

    expect(playJourneyForestAmbientSounds()).toBe(true);
    MockAudio.instances.forEach((audio) => {
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.currentTime).toBe(0);
      expect(audio.volume).toBeCloseTo(JOURNEY_FOREST_AMBIENT_VOLUME);
    });

    (window as any)._settings.gameSoundsEnabled = false;
    stopJourneyForestAmbientSounds();
    expect(playJourneyForestAmbientSounds()).toBe(false);
    MockAudio.instances.forEach((audio) => expect(audio.paused).toBe(true));
  });

  test('fades both loops linearly for exactly 1.5 seconds before rewind', () => {
    playJourneyForestAmbientSounds();
    expect(fadeOutJourneyForestAmbientSounds()).toBe(true);
    stopJourneyForestAmbientSounds({ preserveActiveFade: true });

    jest.advanceTimersByTime(JOURNEY_FOREST_AMBIENT_FADE_OUT_MS / 2);
    MockAudio.instances.forEach((audio) => {
      expect(audio.paused).toBe(false);
      expect(audio.volume).toBeGreaterThan(0);
      expect(audio.volume).toBeLessThan(JOURNEY_FOREST_AMBIENT_VOLUME);
    });

    jest.advanceTimersByTime(JOURNEY_FOREST_AMBIENT_FADE_OUT_MS / 2);
    MockAudio.instances.forEach((audio) => {
      expect(audio.paused).toBe(true);
      expect(audio.currentTime).toBe(0);
      expect(audio.volume).toBeCloseTo(JOURNEY_FOREST_AMBIENT_VOLUME);
    });
  });

  test('connects Forest-only enter, accepted game CTA fade, World close and cleanup ownership', () => {
    const manager = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    expect(manager).toContain('if (worldId === 1) preloadJourneyForestAmbientSounds();');
    expect(manager).toContain('if (worldId === 1) playJourneyForestAmbientSounds();');
    expect(manager).toContain('this.prepareJourneyAmbientForGameEntry();');
    expect(manager).toContain('stopJourneyForestAmbientSounds({ preserveActiveFade: true });');
  });
});
