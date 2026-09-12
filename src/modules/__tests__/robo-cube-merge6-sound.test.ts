import fs from 'node:fs';
import path from 'node:path';
import {
  ROBO_CUBE_MERGE6_BASE_VOLUMES,
  ROBO_CUBE_MERGE6_SOUND_SOURCES,
  ROBO_CUBE_MERGE6_VOLUMES,
  isRoboCubeMerge6SoundEvent,
  playRoboCubeMerge6Sounds,
  preloadRoboCubeMerge6Sounds,
  resetRoboCubeMerge6SoundCacheForTests,
  stopRoboCubeMerge6Sounds,
} from '../robo-cube-merge6-sound.ts';

class MockAudio {
  static instances: MockAudio[] = [];
  preload = '';
  currentTime = 1;
  defaultPlaybackRate = 2;
  playbackRate = 2;
  volume = 0;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());

  constructor(public readonly src: string) {
    MockAudio.instances.push(this);
  }
}

describe('Robo Cube Merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetRoboCubeMerge6SoundCacheForTests();
  });

  afterEach(() => {
    stopRoboCubeMerge6Sounds();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  test('uses the three supplied Robo layers and the requested outro level', () => {
    expect(ROBO_CUBE_MERGE6_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/robo/bibiribi.wav',
      './assets/sound/Wild and special kockice/robo/robo1.wav',
      './assets/sound/Wild and special kockice/robo/outro zing.wav',
    ]);
    expect(ROBO_CUBE_MERGE6_BASE_VOLUMES).toEqual([1, 1, 0.7]);
    expect(ROBO_CUBE_MERGE6_VOLUMES).toEqual([0.6, 0.6, 0.42]);
  });

  test('accepts only a committed Robo Cube Merge-6 event', () => {
    expect(isRoboCubeMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'robo-cube' })).toBe(true);
    expect(isRoboCubeMerge6SoundEvent({ effectiveSum: 6, dstSpecialDiceVariantId: 'robo-cube' })).toBe(true);
    expect(isRoboCubeMerge6SoundEvent({ effectiveSum: 5, srcSpecialDiceVariantId: 'robo-cube' })).toBe(false);
    expect(isRoboCubeMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'fish' })).toBe(false);
  });

  test('plays each supplied layer once and obeys Sounds OFF', () => {
    expect(preloadRoboCubeMerge6Sounds()).toBe(true);
    expect(playRoboCubeMerge6Sounds()).toBe(true);
    ROBO_CUBE_MERGE6_SOUND_SOURCES.forEach((source, index) => {
      const audio = MockAudio.instances.find(candidate => candidate.src === source)!;
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.volume).toBeCloseTo(ROBO_CUBE_MERGE6_VOLUMES[index]);
      expect(audio.playbackRate).toBe(1);
    });
    (window as any)._settings.gameSoundsEnabled = false;
    expect(playRoboCubeMerge6Sounds()).toBe(false);
  });

  test('is wired once at committed Merge-6 routing, preload and cleanup boundaries', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const uiManager = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');
    const journey = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'), 'utf8');
    expect(appCore).toContain('isRoboCubeMerge6SoundEvent({');
    expect(appCore.match(/playRoboCubeMerge6Sounds\(\);/g)).toHaveLength(1);
    expect(appCore).toContain('stopRoboCubeMerge6Sounds();');
    expect(uiManager).toContain('preloadRoboCubeMerge6Sounds();');
    expect(uiManager).toContain("import('./robo-cube-merge6-sound.ts')");
    expect(journey).toContain('preloadRoboCubeMerge6Sounds();');
  });
});
