import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  BOTTLE_PULL_MERGE_CUSTOM_BUS_SCALE,
  BOTTLE_PULL_MERGE_PLAYBACK_RATE,
  BOTTLE_PULL_MERGE_SOUND_BASE_VOLUMES,
  BOTTLE_PULL_MERGE_SOUND_SOURCES,
  BOTTLE_PULL_MERGE_SOUND_VOLUMES,
  playBottlePullMergeSounds,
  preloadBottlePullMergeSounds,
  resetBottlePullMergeSoundCacheForTests,
  stopBottlePullMergeSounds,
} from '../bottle-pull-merge-sound.ts';

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  preload = '';
  currentTime = 3;
  defaultPlaybackRate = 2;
  playbackRate = 2;
  volume = 0;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

describe('Bottle pull Merge-6 sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetBottlePullMergeSoundCacheForTests();
  });

  afterEach(() => {
    resetBottlePullMergeSoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.restoreAllMocks();
  });

  test('keeps both supplied bubsplat WAVs under a dedicated Bottle custom-bus trim', () => {
    expect(BOTTLE_PULL_MERGE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/bottle/bubsplat1.wav',
      './assets/sound/Wild and special kockice/bottle/bubsplat2.wav',
    ]);
    expect(BOTTLE_PULL_MERGE_CUSTOM_BUS_SCALE).toBe(0.72);
    expect(BOTTLE_PULL_MERGE_SOUND_BASE_VOLUMES).toEqual([0.88, 0.88]);
    BOTTLE_PULL_MERGE_SOUND_VOLUMES.forEach((volume) => {
      expect(volume).toBeCloseTo(0.38016);
    });
    expect(BOTTLE_PULL_MERGE_PLAYBACK_RATE).toBe(1);

    const expectedHashes = [
      'ed50ca5a4378f06f43f21b49969df0cf3ea20238d20b4166c43b295252aed5ae',
      '3845b6e23acaa80680452ac8a9508ad81ed7f7765073092bd79092b4bb55c555',
    ];
    BOTTLE_PULL_MERGE_SOUND_SOURCES.forEach((source, index) => {
      const bytes = fs.readFileSync(path.resolve(process.cwd(), source.replace(/^\.\//, '')));
      const dataChunkOffset = bytes.indexOf(Buffer.from('data'));
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
      expect(bytes.readUInt16LE(22)).toBe(2);
      expect(bytes.readUInt32LE(24)).toBe(48_000);
      expect(bytes.readUInt16LE(34)).toBe(16);
      expect(dataChunkOffset).toBeGreaterThan(0);
      expect(bytes.readUInt32LE(dataChunkOffset + 4) / (48_000 * 2 * 2)).toBeCloseTo(3.4, 6);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expectedHashes[index]);
    });
  });

  test('starts both bounded voices together and rewinds them on cleanup', () => {
    expect(preloadBottlePullMergeSounds()).toBe(true);
    expect(MockAudio.instances).toHaveLength(2);
    expect(playBottlePullMergeSounds()).toBe(true);
    MockAudio.instances.forEach((audio) => {
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.currentTime).toBe(0);
      expect(audio.playbackRate).toBe(1);
      expect(audio.volume).toBeCloseTo(0.38016);
    });

    stopBottlePullMergeSounds();
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });

  test('binds only Bottle to the committed second merge and owns preload and cleanup', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const uiManager = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');
    const journey = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'), 'utf8');
    const convergeBlock = appCore.split('if (arrivedCount === totalTiles) {')[1] ?? '';

    expect(convergeBlock).toContain("if (magnetVariantAtMergeEntry?.id === 'bottle') {");
    expect(convergeBlock).toContain('playBottlePullMergeSounds();');
    expect(convergeBlock.indexOf('playBottlePullMergeSounds();')).toBeLessThan(
      convergeBlock.indexOf('await tryMergePulledTiles();'),
    );
    expect(appCore).toContain('stopBottlePullMergeSounds();');
    expect(uiManager).toContain('preloadBottlePullMergeSounds();');
    expect(uiManager).toContain('stopBottlePullMergeSounds();');
    expect(journey).toContain('preloadBottlePullMergeSounds();');
  });

  test('obeys Settings Sounds OFF', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadBottlePullMergeSounds()).toBe(false);
    expect(playBottlePullMergeSounds()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);
  });
});
