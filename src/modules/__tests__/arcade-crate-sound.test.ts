import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ARCADE_CRATE_SOUND_BASE_VOLUMES,
  ARCADE_CRATE_SOUND_DELAYS_MS,
  ARCADE_CRATE_SOUND_SOURCES,
  ARCADE_CRATE_SOUND_VOLUMES,
  playArcadeCrateSounds,
  preloadArcadeCrateSounds,
  resetArcadeCrateSoundsForTests,
  stopArcadeCrateSounds,
} from '../arcade-crate-sound';

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

  constructor(public src: string) {
    MockAudio.instances.push(this);
  }
}

describe('Arcade crate sound sequence', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetArcadeCrateSoundsForTests();
  });

  afterEach(() => {
    resetArcadeCrateSoundsForTests();
    jest.useRealTimers();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  it('preserves all four supplied WAVs and the requested 0/300/600/800ms order', () => {
    expect(ARCADE_CRATE_SOUND_DELAYS_MS).toEqual([0, 300, 600, 800]);
    expect(ARCADE_CRATE_SOUND_BASE_VOLUMES).toEqual([0.448, 0.336, 0.224, 0.392]);
    expect(ARCADE_CRATE_SOUND_VOLUMES).toEqual([0.2688, 0.2016, 0.1344, 0.2352]);
    const expectedHashes = [
      'b41e49bac458088ce959317ba39c9c82f2d7255d5dcdf61c569271ce90b9f632',
      '2d2caa9dc055d3cba7e04c1fe1e1f915fa0dcc5f3470dcf92c9717ad434da7cd',
      '919148c4d60d7e0e59d070a04f70ed1616035fd0a7ab0d23b28396dc26d9c3e2',
      '0bae1ce9ef48a9b330e6f3ec9329fb7f329c15437ded9d204d141d3c96fbbdb8',
    ];
    ARCADE_CRATE_SOUND_SOURCES.forEach((source, index) => {
      const asset = fs.readFileSync(path.resolve(process.cwd(), source.replace('./', '')));
      expect(createHash('sha256').update(asset).digest('hex')).toBe(expectedHashes[index]);
    });
  });

  it('preloads fixed voices and plays the fallback layers at the authored offsets', () => {
    expect(preloadArcadeCrateSounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(4);
    expect(playArcadeCrateSounds()).toBe(true);
    expect(MockAudio.instances.map((audio) => audio.play.mock.calls.length)).toEqual([1, 0, 0, 0]);
    jest.advanceTimersByTime(300);
    expect(MockAudio.instances.map((audio) => audio.play.mock.calls.length)).toEqual([1, 1, 0, 0]);
    jest.advanceTimersByTime(300);
    expect(MockAudio.instances.map((audio) => audio.play.mock.calls.length)).toEqual([1, 1, 1, 0]);
    jest.advanceTimersByTime(200);
    expect(MockAudio.instances.map((audio) => audio.play.mock.calls.length)).toEqual([1, 1, 1, 1]);
    expect(MockAudio.instances.map((audio) => audio.volume)).toEqual([0.2688, 0.2016, 0.1344, 0.2352]);
  });

  it('is Arcade-crate-only and cleanup cancels every delayed layer', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/wild-spawn-drop.ts'), 'utf8');
    expect(source).toContain('if (useArcadeCrate) playArcadeCrateSounds();');
    expect(source).not.toContain('if (!useArcadeCrate) playArcadeCrateSounds();');

    preloadArcadeCrateSounds();
    playArcadeCrateSounds();
    stopArcadeCrateSounds();
    jest.runAllTimers();
    expect(MockAudio.instances.map((audio) => audio.play.mock.calls.length)).toEqual([1, 0, 0, 0]);
  });
});
