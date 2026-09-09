import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import {
  NO_MOVES_SOUND_BASE_VOLUME,
  NO_MOVES_SOUND_SOURCE,
  NO_MOVES_SOUND_VOLUME,
  areNoMovesSoundsEnabled,
  playNoMovesSound,
  preloadNoMovesSound,
  resetNoMovesSoundCacheForTests,
  stopNoMovesSound,
} from '../no-moves-sound';

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

describe('NO MOVES Grandpa sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetNoMovesSoundCacheForTests();
  });

  afterEach(() => {
    resetNoMovesSoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  it('preserves the supplied Grandpa MP3 and applies 70 percent action gain', () => {
    expect(NO_MOVES_SOUND_SOURCE).toBe('./assets/sound/grandpa - no moves left.mp3');
    expect(NO_MOVES_SOUND_BASE_VOLUME).toBe(0.7);
    expect(NO_MOVES_SOUND_VOLUME).toBeCloseTo(0.42);
    const asset = fs.readFileSync(path.resolve(process.cwd(), 'assets/sound/grandpa - no moves left.mp3'));
    expect(createHash('sha256').update(asset).digest('hex')).toBe(
      '304d00ef26fcd49952f6e3291a4c17e5954c3aa028a572b1e203798b2df2ca54',
    );
  });

  it('preloads one bounded voice and replays it from the start', () => {
    expect(preloadNoMovesSound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(1);
    const audio = MockAudio.instances[0];
    expect(audio.load).toHaveBeenCalledTimes(1);

    expect(playNoMovesSound()).toBe(true);
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.playbackRate).toBe(1);
    expect(audio.volume).toBeCloseTo(0.42);
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(1);

    stopNoMovesSound();
    expect(audio.currentTime).toBe(0);
  });

  it('is Settings-gated and starts only after the NO MOVES overlay mounts', () => {
    const overlaySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/splash-text-overlay.ts'),
      'utf8',
    );
    const showOwner = overlaySource.split('export function showNoMovesText(): void {')[1]
      ?.split('\nexport function clearNoMovesText', 1)[0] ?? '';
    expect(showOwner.indexOf('document.body.appendChild(overlay);'))
      .toBeLessThan(showOwner.indexOf('playNoMovesSound();'));
    expect(showOwner.match(/playNoMovesSound\(\);/g)).toHaveLength(1);
    expect(overlaySource).not.toContain("import { playNoMovesSound, stopNoMovesSound }");
    expect(overlaySource.split('function cleanupNoMovesOverlay(): void {')[1]
      ?.split('\n}', 1)[0]).not.toContain('stopNoMovesSound');

    const appCoreSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/app-core.ts'),
      'utf8',
    );
    expect(appCoreSource).not.toContain('stopNoMovesSound');

    (window as any)._settings.gameSoundsEnabled = false;
    expect(areNoMovesSoundsEnabled()).toBe(false);
    expect(preloadNoMovesSound()).toBe(false);
    expect(playNoMovesSound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);
  });
});
