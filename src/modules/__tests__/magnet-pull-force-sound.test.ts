import fs from 'node:fs';
import path from 'node:path';
import {
  BOTTLE_PULL_FORCE_BOIING_BASE_VOLUME,
  BOTTLE_PULL_FORCE_BOIING_VOLUME,
  HONEY_PULL_FORCE_BOIING_BASE_VOLUME,
  HONEY_PULL_FORCE_BOIING_VOLUME,
  MAGNET_PULL_FORCE_SOUND_BASE_VOLUMES,
  MAGNET_PULL_FORCE_SOUND_SOURCES,
  MAGNET_PULL_FORCE_SOUND_VOLUMES,
  isMagnetArchetypeMerge6SoundEvent,
  playMagnetPullForceSounds,
  resolveMagnetPullForceBoiingVolume,
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

  test('removes magnetpulls and planks while retaining boiing on the pull merge', () => {
    expect(MAGNET_PULL_FORCE_SOUND_SOURCES).toEqual([
      './assets/sound/magnet pul lforce/boiing.wav',
    ]);
    expect(MAGNET_PULL_FORCE_SOUND_BASE_VOLUMES).toEqual([1]);
    expect(MAGNET_PULL_FORCE_SOUND_VOLUMES).toEqual([0.6]);
    expect(HONEY_PULL_FORCE_BOIING_BASE_VOLUME).toBe(0.6);
    expect(HONEY_PULL_FORCE_BOIING_VOLUME).toBeCloseTo(0.36);
    expect(BOTTLE_PULL_FORCE_BOIING_BASE_VOLUME).toBe(0.4);
    expect(BOTTLE_PULL_FORCE_BOIING_VOLUME).toBeCloseTo(0.24);
  });

  test('uses the canonical Merge-6 foundation for both stages without the removed custom mix', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/magnet-pull-force-sound.ts'),
      'utf8',
    );
    expect(source.match(/const foundationStarted = playSpecialMerge6FoundationSound\(\);/g)).toHaveLength(2);
    expect(source).toContain('preloadRegularMerge6Sounds();');
    expect(source).toContain('stopRegularMerge6Sounds();');
    expect(source).not.toContain('magnet happy');
    expect(source).not.toContain('pull1.wav');
    expect(source).not.toContain('pull2.wav');
    expect(source).not.toContain('loop: true');
    expect(source).toContain("if (variantId === 'honey')");
    expect(source).toContain("if (variantId === 'bottle')");
    expect(source).toContain('BOTTLE_PULL_FORCE_BOIING_VOLUME');
    expect(source).not.toContain('sparkle.wav');
    expect(source).not.toContain('magnetpulls.wav');
    expect(source).not.toContain('planks break.wav');
  });

  test('isolates the reduced boiing levels to Honey and Bottle', () => {
    expect(resolveMagnetPullForceBoiingVolume()).toBeCloseTo(0.6);
    expect(resolveMagnetPullForceBoiingVolume('spaceship')).toBeCloseTo(0.6);
    expect(resolveMagnetPullForceBoiingVolume('honey')).toBeCloseTo(0.36);
    expect(resolveMagnetPullForceBoiingVolume('bottle')).toBeCloseTo(0.24);
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
    expect(convergeBlock).toContain('magnetVariantAtMergeEntry?.id,');
    expect(convergeBlock.indexOf('playMagnetPullForceSounds(')).toBeLessThan(
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
