import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Mushroom special-die visual contract', () => {
  const registrySource = read('src/modules/special-dice-registry.ts');
  const idleSource = read('src/modules/special-dice-idle.ts');
  const juiceSource = read('src/modules/wild-juice-bubbles-explosion.ts');
  const fxSource = read('src/modules/fx.ts');
  const appCoreSource = read('src/modules/app-core.ts');
  const assetPreloaderSource = read('src/modules/asset-preloader.ts');
  const loadTilesSource = read('src/modules/app-core-load-tiles.ts');
  const wildSkinSource = read('src/modules/app-core-wild-skin.ts');

  test('owns a Juice-archetype finale with a single centre burst and below-screen gravity exit', () => {
    const mushroomDefinition = registrySource.slice(
      registrySource.indexOf('  mushroom: {'),
      registrySource.indexOf('  cubero: {'),
    );
    expect(mushroomDefinition).toContain("archetype: 'wild-juice'");
    expect(mushroomDefinition).toContain("splashText: 'SHROOMY'");
    expect(mushroomDefinition).toContain("splashColors: ['#FD7D5F']");
    expect(mushroomDefinition).not.toContain('splashSplitIndex');
    expect(mushroomDefinition).toContain('shardColors: [0xE7B392, 0xFF7B60]');
    expect(mushroomDefinition).toContain('trailColors: [0xFFE1C8, 0xFFEDD9, 0xFF9A80, 0xFF7D61]');
    expect(mushroomDefinition).toContain("juiceDropProfile: 'mushroom'");
    expect(juiceSource).toContain("const isMushroomDrop = isCustomDownDrop && options.dropProfile === 'mushroom'");
    expect(juiceSource).toContain('const totalBubbles = isMushroomDrop ? 24');
    expect(juiceSource).toContain('const spawnDuration = isMushroomDrop ? 520');
    expect(juiceSource).toContain('const maxActive = isMushroomDrop ? 24');
    expect(juiceSource).toContain('const mushroomScale = 0.70 + Math.random() * 0.26');
    expect(juiceSource).toContain('const mushroomBirthSpreadX = screenW * 0.5');
    expect(juiceSource).toContain(
      'const mushroomStartX = screenW * 0.5 + (Math.random() - 0.5) * mushroomBirthSpreadX',
    );
    expect(juiceSource).toContain('const mushroomStartY = screenH * 0.48');
    expect(juiceSource).toContain('const upwardSpeed = -screenH * (0.22 + Math.random() * 0.28)');
    expect(juiceSource).toContain('const gravity = screenH * (0.72 + Math.random() * 0.20)');
    expect(juiceSource).toContain('const rotationTurns = 0.75 + Math.random()');
    expect(juiceSource).toContain('const angularSpeed = rotationDirection * (Math.PI * 2 * rotationTurns) / totalDuration');
    expect(juiceSource).toContain("ease: 'none'");
    expect(juiceSource).toContain('bubble.y = mushroomStartY + upwardSpeed * time + 0.5 * gravity * time * time');
    expect(juiceSource).toContain('const lifecycleScale = mushroomScale * (0.5 + progress)');
    expect(juiceSource).toContain('bubble.alpha = 1');
    expect(juiceSource).toContain('const mushroomPartStaggerMs = 22');
    expect(juiceSource).toContain('}, i * mushroomPartStaggerMs)');
    expect(juiceSource).not.toContain('const mushroomSecondWaveDelayMs');
    expect(juiceSource).not.toContain('const reflectWithinViewport = (rawX: number): number =>');
    const sharedTextIndex = juiceSource.indexOf('createAndShowBubblyText({ text: options.text');
    const mushroomBranchIndex = juiceSource.indexOf('if (isMushroomDrop) {', sharedTextIndex);
    expect(sharedTextIndex).toBeGreaterThan(-1);
    expect(mushroomBranchIndex).toBeGreaterThan(sharedTextIndex);
    expect(appCoreSource).toContain('dropProfile: getSpecialDiceJuiceDropProfile(variant)');
    expect(appCoreSource).toContain('dropProfile: getSpecialDiceJuiceDropProfile(wildJuiceVariantForExplosion)');
  });

  test('uses Mushroom-only pop and pooled-lifecycle-safe smoke instead of Juice bubbles', () => {
    expect(idleSource).toContain("variant.idleMotion === 'mushroom-pop'");
    expect(idleSource).toContain("smokeContainer.label = 'mushroom-idle-smoke'");
    expect(idleSource).toContain('tile._ccMushroomSmokeTimelines = smokeTimelines');
    expect(idleSource).toContain("tile._ccMushroomSmokeContainer.destroy?.({ children: true })");
    expect(fxSource).toContain("if (specialVariantId === 'mushroom')");
    expect(fxSource).toContain('stopWildJuiceBubbles(tile)');
  });

  test('ships the die and all six drop fragments', () => {
    ['mushroom.png', 'mushroom@2x.png'].forEach((asset) => {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/mushroom/${asset}`))).toBe(true);
    });
    for (let part = 1; part <= 6; part += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/mushroom/part${part}@2x.png`))).toBe(true);
    }
  });

  test('keeps Mushroom identity and texture stable across iOS cold preload and fallback restore', () => {
    expect(assetPreloaderSource).toContain("'./assets/shop/mushroom/mushroom.png'");
    const criticalAssets = assetPreloaderSource.slice(assetPreloaderSource.indexOf('const CRITICAL_ASSETS'));
    expect(criticalAssets).toContain("'./assets/shop/mushroom/mushroom.png'");
    expect(loadTilesSource).toContain('specialDiceVariant: t._ccSpecialDiceVariant || t.specialDiceVariant || null');
    expect(wildSkinSource).toContain('void Assets.load(requestedAssetPath).then');
    expect(wildSkinSource).toContain("if (getSpecialDiceTexturePath(tile, '') !== requestedAssetPath) return");
    expect(wildSkinSource).toContain('applyResolvedTexture(loadedTexture || Assets.get(requestedAssetPath))');
  });
});
