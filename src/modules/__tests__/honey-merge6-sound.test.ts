import fs from 'node:fs';
import path from 'node:path';
import {
  HONEY_POST_MERGE_SOUND_SOURCES,
  HONEY_POST_MERGE_SOUND_BASE_VOLUMES,
  HONEY_POST_MERGE_SOUND_VOLUMES,
  HONEY_PULL_MERGE_SOUND_BASE_VOLUMES,
  HONEY_PULL_MERGE_SOUND_SOURCES,
  HONEY_PULL_MERGE_SOUND_VOLUMES,
} from '../honey-merge6-sound.ts';

describe('Honey Merge-6 sound routing', () => {
  test('removes honey1-4 and keeps only splat, smile and BEES3s', () => {
    expect(HONEY_PULL_MERGE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/honey/honeysplat.wav',
      './assets/sound/Wild and special kockice/bee/smile.wav',
    ]);
    expect(HONEY_POST_MERGE_SOUND_SOURCES).toEqual([
      './assets/sound/Wild and special kockice/honey/BEES3s.wav',
    ]);
    expect(HONEY_PULL_MERGE_SOUND_BASE_VOLUMES).toEqual([1, 1]);
    expect(HONEY_PULL_MERGE_SOUND_VOLUMES).toEqual([0.6, 0.6]);
    expect(HONEY_POST_MERGE_SOUND_BASE_VOLUMES).toEqual([0.48]);
    expect(HONEY_POST_MERGE_SOUND_VOLUMES).toEqual([0.288]);
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
