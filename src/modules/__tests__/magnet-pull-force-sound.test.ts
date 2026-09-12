import fs from 'node:fs';
import path from 'node:path';
import {
  MAGNET_PULL_FORCE_SOUND_BASE_VOLUMES,
  MAGNET_PULL_FORCE_SOUND_SOURCES,
  MAGNET_PULL_FORCE_SOUND_VOLUMES,
  isMagnetArchetypeMerge6SoundEvent,
  playMagnetPullForceSounds,
  resetMagnetPullForceSoundsForTests,
} from '../magnet-pull-force-sound.ts';

describe('Magnet pull force sound', () => {
  beforeEach(() => {
    (window as any)._settings = { gameSoundsEnabled: true };
    resetMagnetPullForceSoundsForTests();
  });

  afterEach(() => {
    resetMagnetPullForceSoundsForTests();
    delete (window as any)._settings;
  });

  test('assigns quiet magnetpulls plus planks to the first merge and only boiing to the pull merge', () => {
    expect(MAGNET_PULL_FORCE_SOUND_SOURCES).toEqual([
      './assets/sound/magnet pul lforce/magnetpulls.wav',
      './assets/sound/magnet pul lforce/planks break.wav',
      './assets/sound/magnet pul lforce/boiing.wav',
    ]);
    expect(MAGNET_PULL_FORCE_SOUND_BASE_VOLUMES).toEqual([0.5, 0.5, 1]);
    expect(MAGNET_PULL_FORCE_SOUND_VOLUMES).toEqual([0.3, 0.3, 0.6]);
  });

  test('uses the canonical Merge-6 foundation for both stages without the removed custom mix', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/magnet-pull-force-sound.ts'),
      'utf8',
    );
    expect(source.match(/const foundationStarted = playRegularMerge6Sound\(\);/g)).toHaveLength(2);
    expect(source).toContain('preloadRegularMerge6Sounds();');
    expect(source).toContain('stopRegularMerge6Sounds();');
    expect(source).not.toContain('magnet happy');
    expect(source).not.toContain('pull1.wav');
    expect(source).not.toContain('pull2.wav');
    expect(source).not.toContain('loop: true');
    expect(source).toContain('const planksBreakStarted = playAccent(1);');
    expect(source).toContain('const boiingStarted = playAccent(2);');
    expect(source).not.toContain('sparkle.wav');
  });

  test('recognizes core Magnet, Bottle, Honey and Spaceship only at Merge 6', () => {
    expect(isMagnetArchetypeMerge6SoundEvent({ effectiveSum: 6, srcSpecial: 'wild-magnet' })).toBe(true);
    for (const variant of ['bottle', 'honey', 'spaceship']) {
      expect(isMagnetArchetypeMerge6SoundEvent({
        effectiveSum: 6,
        srcSpecialDiceVariantId: variant,
      })).toBe(true);
    }
    expect(isMagnetArchetypeMerge6SoundEvent({ effectiveSum: 5, srcSpecial: 'wild-magnet' })).toBe(false);
    expect(isMagnetArchetypeMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'flower' })).toBe(false);
  });

  test('starts once when the shared Magnet or Bottle pull converges and survives a committed merge cleanup', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const pullBlock = source.split('if (nearestTiles.length > 0) {')[1]
      ?.split('// Store callback to trigger merge when multiplier appears')[0] ?? '';
    const convergeBlock = pullBlock.split('if (arrivedCount === totalTiles) {')[1] ?? '';
    expect(convergeBlock).toContain('playMagnetPullForceSounds();');
    expect(convergeBlock.indexOf('playMagnetPullForceSounds();')).toBeLessThan(
      convergeBlock.indexOf('await tryMergePulledTiles();'),
    );
    expect(pullBlock).toContain('if (!preserveCommittedPullSound) stopMagnetPullForceSounds();');
    expect(pullBlock).toContain('cleanupAllPullAnimations(true);');
    expect(source).toContain('playMagnetArchetypeMerge6Sound();');
  });

  test('obeys Sounds OFF', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(playMagnetPullForceSounds()).toBe(false);
    const uiManager = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');
    expect(uiManager).toContain("import('./magnet-pull-force-sound.ts').then(({ stopMagnetPullForceSounds }) => {");
  });
});
