import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  HONEY_FIRST_MERGE_SOUND_BASE_VOLUMES,
  HONEY_FIRST_MERGE_SOUND_SOURCES,
  HONEY_FIRST_MERGE_SOUND_VOLUMES,
  HONEY_POST_MERGE_SOUND_SOURCES,
  HONEY_POST_MERGE_SOUND_BASE_VOLUMES,
  HONEY_POST_MERGE_SOUND_VOLUMES,
  HONEY_PULL_MERGE_SOUND_BASE_VOLUMES,
  HONEY_PULL_MERGE_SOUND_SOURCES,
  HONEY_PULL_MERGE_SOUND_VOLUMES,
} from '../honey-merge6-sound.ts';

describe('Honey Merge-6 sound routing', () => {
  test('routes honeysplat to the first merge and harp plus supersplat to the pull merge', () => {
    expect(HONEY_FIRST_MERGE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/honey/honeysplat.wav',
    ]);
    expect(HONEY_PULL_MERGE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/honey/hapr.wav',
      './assets/sound/Wild and special kockice/honey/supersplat.wav',
    ]);
    expect(HONEY_POST_MERGE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/honey/BEES3s.wav',
    ]);
    expect(HONEY_FIRST_MERGE_SOUND_BASE_VOLUMES).toEqual([1]);
    expect(HONEY_FIRST_MERGE_SOUND_VOLUMES).toEqual([0.6]);
    expect(HONEY_PULL_MERGE_SOUND_BASE_VOLUMES).toEqual([0.8, 0.8]);
    expect(HONEY_PULL_MERGE_SOUND_VOLUMES).toEqual([0.48, 0.48]);
    expect(HONEY_POST_MERGE_SOUND_BASE_VOLUMES).toEqual([0.336]);
    expect(HONEY_POST_MERGE_SOUND_VOLUMES).toEqual([0.2016]);
  });

  test('locks the supplied harp WAV used by the second Honey pull merge', () => {
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
    expect(bytes.readUInt32LE(dataChunkOffset + 4) / (48_000 * 2 * 2)).toBeCloseTo(1.055917, 6);
    expect(bytes).toHaveLength(202_814);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '6e9790da6013e395ce371e3b959364db2837b3062d9c690d2172619e57e2fb40',
    );
  });

  test('locks the supplied supersplat WAV used by the second Honey pull merge', () => {
    const assetPath = path.resolve(
      process.cwd(),
      HONEY_PULL_MERGE_SOUND_SOURCES[1].replace(/^\.\//, ''),
    );
    const bytes = fs.readFileSync(assetPath);
    const dataChunkOffset = bytes.indexOf(Buffer.from('data'));

    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
    expect(bytes.readUInt16LE(22)).toBe(2);
    expect(bytes.readUInt32LE(24)).toBe(48_000);
    expect(bytes.readUInt16LE(34)).toBe(16);
    expect(dataChunkOffset).toBeGreaterThan(0);
    expect(bytes.readUInt32LE(dataChunkOffset + 4) / (48_000 * 2 * 2)).toBeCloseTo(3.4, 6);
    expect(bytes).toHaveLength(652_878);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'a3d0bb8a255c12270566c652fb22d9c7aba21ac5486331811b8fdb9f06a20e83',
    );
  });

  test('locks the shortened authored honeysplat WAV used by the Honey pull merge', () => {
    const assetPath = path.resolve(
      process.cwd(),
      HONEY_FIRST_MERGE_SOUND_SOURCES[0].replace(/^\.\//, ''),
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
    expect(appCore).toContain('playHoneyFirstMergeSounds();');
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
