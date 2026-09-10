import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import {
  JOURNEY_BACKPACK_SOUND_BASE_VOLUMES,
  JOURNEY_BACKPACK_SOUND_DELAYS_MS,
  JOURNEY_BACKPACK_SOUND_PLAYBACK_RATES,
  JOURNEY_BACKPACK_SOUND_SOURCES,
  JOURNEY_BACKPACK_SOUND_VOLUMES,
  playJourneyBackpackSounds,
  preloadJourneyBackpackSounds,
  resetJourneyBackpackSoundsForTests,
  stopJourneyBackpackSounds,
} from '../journey-backpack-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  preload = '';
  currentTime = 2;
  defaultPlaybackRate = 2;
  playbackRate = 2;
  volume = 0;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());
  constructor(public src: string) { MockAudio.instances.push(this); }
}

describe('Journey backpack sound sequence', () => {
  const originalAudio = global.Audio;
  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetJourneyBackpackSoundsForTests();
  });
  afterEach(() => {
    resetJourneyBackpackSoundsForTests();
    jest.useRealTimers();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  it('preserves both supplied WAVs, volumes, and the requested 200ms spacing', () => {
    expect(JOURNEY_BACKPACK_SOUND_DELAYS_MS).toEqual([0, 200]);
    expect(JOURNEY_BACKPACK_SOUND_PLAYBACK_RATES).toEqual([1.4, 2.1]);
    expect(JOURNEY_BACKPACK_SOUND_BASE_VOLUMES).toEqual([0.96, 0.3]);
    expect(JOURNEY_BACKPACK_SOUND_VOLUMES).toEqual([0.576, 0.18]);
    const hashes = [
      'f9fb0e93766326bd5705393c78f071da8af6fff468bf55e785875ace2f06f9a0',
      '50b246f10e535fd854c9637e2efd7d3969db833d048fcb1c021b58a47071b8dd',
    ];
    JOURNEY_BACKPACK_SOUND_SOURCES.forEach((source, index) => {
      const asset = fs.readFileSync(path.resolve(process.cwd(), source.replace('./', '')));
      expect(createHash('sha256').update(asset).digest('hex')).toBe(hashes[index]);
    });
  });

  it('plays backpack 1 immediately and backpack 2 after 200ms', () => {
    expect(preloadJourneyBackpackSounds()).toBe(true);
    expect(playJourneyBackpackSounds()).toBe(true);
    expect(MockAudio.instances.map((audio) => audio.play.mock.calls.length)).toEqual([1, 0]);
    jest.advanceTimersByTime(199);
    expect(MockAudio.instances[1].play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(MockAudio.instances.map((audio) => audio.play.mock.calls.length)).toEqual([1, 1]);
    expect(MockAudio.instances.map((audio) => audio.volume)).toEqual([0.576, 0.18]);
    expect(MockAudio.instances.map((audio) => audio.playbackRate)).toEqual([1.4, 2.1]);
  });

  it('is Journey-backpack-only and cleanup cancels the delayed layer', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/wild-spawn-drop.ts'), 'utf8');
    expect(source).toContain('else playJourneyBackpackSounds();');
    preloadJourneyBackpackSounds();
    playJourneyBackpackSounds();
    stopJourneyBackpackSounds();
    jest.runAllTimers();
    expect(MockAudio.instances.map((audio) => audio.play.mock.calls.length)).toEqual([1, 0]);
  });
});
