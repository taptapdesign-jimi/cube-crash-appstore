import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  HONEY_POST_MERGE_SOUND_SOURCES,
  HONEY_POST_MERGE_SOUND_BASE_VOLUMES,
  HONEY_POST_MERGE_SOUND_VOLUMES,
  HONEY_PULL_MERGE_SOUND_BASE_VOLUMES,
  HONEY_PULL_MERGE_SOUND_SOURCES,
  HONEY_PULL_MERGE_SOUND_VOLUMES,
} from '../honey-merge6-sound.ts';

describe('Honey Merge-6 sound routing', () => {
  test('keeps the approved splat, smile, twinkle and BEES3s routing', () => {
    expect(HONEY_PULL_MERGE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/honey/honeysplat.wav',
      './assets/sound/Wild and special kockice/bee/smile.wav',
      './assets/sound/Wild and special kockice/honey/twinkle1.wav',
    ]);
    expect(HONEY_POST_MERGE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/honey/BEES3s.wav',
    ]);
    expect(HONEY_PULL_MERGE_SOUND_BASE_VOLUMES).toEqual([1, 1, 1]);
    expect(HONEY_PULL_MERGE_SOUND_VOLUMES).toEqual([0.6, 0.6, 0.6]);
    expect(HONEY_POST_MERGE_SOUND_BASE_VOLUMES).toEqual([0.48]);
    expect(HONEY_POST_MERGE_SOUND_VOLUMES).toEqual([0.288]);
  });

  test('locks the supplied twinkle WAV used by the second Honey pull merge', () => {
    const assetPath = path.resolve(
      process.cwd(),
      HONEY_PULL_MERGE_SOUND_SOURCES[2].replace(/^\.\//, ''),
    );
    const bytes = fs.readFileSync(assetPath);
    const dataChunkOffset = bytes.indexOf(Buffer.from('data'));

    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
    expect(bytes.readUInt16LE(22)).toBe(2);
    expect(bytes.readUInt32LE(24)).toBe(48_000);
    expect(bytes.readUInt16LE(34)).toBe(16);
    expect(dataChunkOffset).toBeGreaterThan(0);
    expect(bytes.readUInt32LE(dataChunkOffset + 4) / (48_000 * 2 * 2)).toBeCloseTo(1.454458, 6);
    expect(bytes).toHaveLength(279_334);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '7907c555b101ebf41b9f49608ad4827aefe5ad32fec9c365d1a728189256eb96',
    );
  });

  test('locks the shortened authored honeysplat WAV used by the Honey pull merge', () => {
    const assetPath = path.resolve(
      process.cwd(),
      HONEY_PULL_MERGE_SOUND_SOURCES[0].replace(/^\.\//, ''),
    );
    const bytes = fs.readFileSync(assetPath);
    const dataChunkOffset = bytes.indexOf(Buffer.from('data'));

    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
    expect(bytes.readUInt16LE(22)).toBe(2);
    expect(bytes.readUInt32LE(24)).toBe(48_000);
    expect(bytes.readUInt16LE(34)).toBe(16);
    expect(dataChunkOffset).toBeGreaterThan(0);
    expect(bytes.readUInt32LE(dataChunkOffset + 4) / (48_000 * 2 * 2)).toBeCloseTo(1.427625, 6);
    expect(bytes).toHaveLength(274_182);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '64b12504417cac09d9ac07ad270f3b61eccb7d3e258c4fc5da80487a8da3d9ef',
    );
  });

  test('binds Honey-only cues to merge commit and bee-flight finale start', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore).not.toContain('playHoneyMerge6Sounds();');
    expect(appCore).toContain("if (wildMagnetVariant?.id === 'honey') {");
    expect(appCore).toContain('playHoneyPostMergeSounds();');
    expect(appCore).toContain('playHoneyPullMergeSounds();');
    expect(appCore.indexOf('playHoneyPostMergeSounds();')).toBeLessThan(
      appCore.indexOf('showMagneticText(getSpecialDiceSplashOptions(wildMagnetVariant)'),
    );
  });

  test('preloads at both entry owners and stops with gameplay cleanup and Sounds OFF', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const uiManager = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');
    const journey = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'), 'utf8');
    expect(appCore).toContain('stopHoneyMerge6Sounds();');
    expect(uiManager).toContain('preloadHoneyMerge6Sounds();');
    expect(uiManager).toContain('stopHoneyMerge6Sounds();');
    expect(journey).toContain('preloadHoneyMerge6Sounds();');
  });
});
