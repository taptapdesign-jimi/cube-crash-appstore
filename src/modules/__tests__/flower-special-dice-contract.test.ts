import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Flower special-die visual contract', () => {
  const registrySource = read('src/modules/special-dice-registry.ts');
  const fxSource = read('src/modules/fx.ts');
  const tntSource = read('src/modules/tnt-animation.ts');

  test('keeps Flower on TNT gameplay while owning a separate pollen-only idle profile', () => {
    const flowerDefinition = registrySource.slice(
      registrySource.indexOf('  flower: {'),
      registrySource.indexOf('  mushroom: {'),
    );
    expect(registrySource).toContain("id: 'flower'");
    expect(registrySource).toContain("archetype: 'wild-tnt'");
    expect(flowerDefinition).not.toContain('lastExplosionFrameOnExitOnly: true');
    expect(flowerDefinition).toContain('hideExplosionFrameIndicesAtExitStart: [0, 1]');
    expect(flowerDefinition).toContain('burstParticleSources: useHighResolutionSpecialDiceFx');
    expect(flowerDefinition).toContain('explosionScale: 0.9775');
    expect(flowerDefinition).toContain('explosionHorizontalScale: 0.84');
    expect(flowerDefinition).toContain('explosionVerticalStretch: 1');
    expect(flowerDefinition).toContain('baseSizeScale: 1.428');
    expect(flowerDefinition).toContain('speedScale: 0.92');
    expect(flowerDefinition).toContain('staggerSpanScale: 1');
    expect(flowerDefinition).toContain('waveTimes: [0.1, 0.905, 1.71]');
    expect(flowerDefinition).toContain('depthLayered: true');
    expect(flowerDefinition).not.toContain('idleMotion:');
    expect(fxSource).toContain("getSpecialDiceVariantForTile(tile)?.id === 'flower'");
    expect(fxSource).toContain('startFlowerPollenIdle(tile)');
    expect(fxSource).toContain('stopFlowerPollenIdle(tile)');
    expect(fxSource).toContain('const usesArtworkAlphaMask = Boolean(tile.base?.texture && tile.base.texture !== Texture.EMPTY)');
    expect(fxSource).toContain('mask = new Sprite(tile.base.texture)');
    expect(fxSource).toContain('tile._wildShimmerMask.destroy?.({ texture: false, textureSource: false })');
    expect(fxSource).toContain('const FLOWER_POLLEN_COLORS = [0xFFF16B, 0xFFE246, 0xFFCE34]');
    expect(fxSource).toContain('const FLOWER_POLLEN_SIZE_SCALE = 1.625');
    expect(fxSource).toContain('const count = Math.random() < 0.3 ? 6 : 4');
    expect(fxSource).toContain('(2 + Math.random() * 1.45) * FLOWER_POLLEN_SIZE_SCALE');
    expect(fxSource).toContain('const peakAlpha = 0.6 + Math.random() * 0.35');
    expect(fxSource).toContain('const grainShape = Math.random()');
    expect(fxSource).toContain('particle.ellipse(0, 0, width, height)');
    expect(fxSource).toContain('particle.poly(points)');
    expect(fxSource).toContain('_flowerPollenProgress: 1');
    expect(fxSource).toContain("ease: 'none'");
    expect(fxSource).toContain('const verticalTravel = -22 + Math.random() * 35');
    expect(fxSource).toContain('particle.alpha = peakAlpha * fadeIn * fadeOut');
    expect(fxSource).toContain('tile._flowerPollenInterval = trackAppInterval(emit, 760)');
  });

  test('keeps bush10 out of the registered Flower animation so it cannot appear during exit', () => {
    expect(registrySource).toContain('const flowerExplosionSources1x = Array.from(\n  { length: 9 }');
    expect(registrySource).toContain('const flowerExplosionSources2x = Array.from(\n  { length: 9 }');
    expect(tntSource).toContain('const numFrames = activeFrames.length');
    expect(tntSource).toContain('const isExitOnlyFinalFrame = lastFrameOnExitOnly && i === numFrames - 1');
    expect(tntSource).toContain('if (hiddenAtExitStart.has(i)) return');
    expect(tntSource).toContain('attachSmallStarCenterBurst(overlay');
    expect(tntSource).toContain('const burstWaveTimes = configuredWaveTimes.length');
    expect(tntSource).toContain('const randomSize = (1 + Math.random() * 0.52) * frameScale');
    expect(tntSource).toContain(': VERTICAL_STRETCH;');
    expect(tntSource).toContain('x: randomSize * frameHorizontalScale');
    expect(tntSource).toContain('y: randomSize * frameVerticalStretch');
    expect(tntSource).not.toContain('y: randomSize * VERTICAL_STRETCH');
    expect(tntSource).toContain('const depthProfiles = [');
    expect(tntSource).toContain('[0.5, 2.5, 4.5, 6.5, 7.5, 3.5, 5.5, 1.5, 4.5]');
    expect(tntSource).toContain('[2.5, 4.5, 6.5, 7.5, 5.5, 3.5, 1.5, 6.5, 4.5]');
    expect(tntSource).toContain('const depthSlot = depthProfile[particleIndex % depthProfile.length]');
    expect(tntSource).toContain('sprite.zIndex = 8.5');
    expect(tntSource).toContain('attachDepthLayeredFlowerBurst(');
    expect(tntSource).toContain('particleIndex * (0.035 + Math.random() * 0.01)');
    expect(tntSource).toContain('const particlePlans: Array<{');
    expect(tntSource).toContain('masterTimeline = trackTimeline();');
    expect(tntSource).toContain('masterClock.time < plan.delay');
    expect(tntSource).toContain("duration: 1.12 * speedScale");
    expect(tntSource).toContain("ease: 'none'");
    expect(tntSource).toContain('const forwardDistance = plan.distance * progress');
    expect(tntSource).toContain('const swirlTurns = 1.15 + Math.random() * 0.85');
    expect(tntSource).toContain('const swirlOscillation = Math.sin((progress * Math.PI * 2 * plan.swirlTurns) + plan.swirlPhase)');
    expect(tntSource).toContain('if (needsDepthSort)');
    const appCoreSource = read('src/modules/app-core.ts');
    expect(appCoreSource).toContain("tntVariantForMerge?.id === 'flower'");
    expect(appCoreSource).toContain('bonusParticleScale: tntVariantForMerge?.id === \'flower\' ? 1.4 : 1');
    for (let frame = 1; frame <= 9; frame += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/bush/bush${frame}.png`))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/bush/bush${frame}@2x.png`))).toBe(true);
    }
    for (let flower = 1; flower <= 6; flower += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/bush/flowr${flower}.png`))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/bush/flowr${flower}@2x.png`))).toBe(true);
    }
  });

  test('keeps gameplay input locked through the complete Flower transaction', () => {
    expect(tntSource).toContain('export function releaseTntGameplayInputGate(): void');
    const visualTailSection = tntSource.slice(
      tntSource.indexOf('const sprite10ExitLeadTime'),
      tntSource.indexOf('// Cleanup after all animations'),
    );
    expect(visualTailSection).not.toContain('releaseTntInputGate()');

    const appCoreSource = read('src/modules/app-core.ts');
    expect(appCoreSource).toContain('if (!tntBonusGameplayComplete || !tntVisibleSequenceComplete) return;');
    expect(appCoreSource).toContain('releaseTntGameplayInputGate();');
    expect(appCoreSource).toContain('releaseSpecialDiceTransaction(specialTransactionToken');
  });
});
