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
  const styleSource = read('src/style.css');

  test('owns a Juice-archetype finale with a staggered bottom-up mushroom world', () => {
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
    expect(mushroomDefinition).toContain('explosionSpriteSources: mushroomGrowthSources');
    expect(registrySource).toContain('const mushroomGrowthSources = [');
    expect(registrySource).toContain("'./assets/shop/mushroom/mushroom@2x.png'");
    expect(registrySource).toContain('`./assets/shop/mushroom/mushroom${index + 1}.png`');
    expect(registrySource).not.toContain('mushroomDropSources');
    expect(registrySource).not.toContain('part${index + 1}@2x.png');
    expect(juiceSource).toContain("const isMushroomDrop = isCustomDownDrop && options.dropProfile === 'mushroom'");
    expect(juiceSource).toContain('const MUSHROOM_GROWTH_COUNT = 30');
    expect(juiceSource).toContain('const MUSHROOM_GROWTH_MIN_SIZE_PX = 160');
    expect(juiceSource).toContain('const MUSHROOM_GROWTH_MAX_SIZE_PX = 200');
    expect(juiceSource).toContain('const MUSHROOM_GROWTH_MIN_ROTATION_DEG = 8');
    expect(juiceSource).toContain('const MUSHROOM_GROWTH_MAX_ROTATION_DEG = 15');
    expect(juiceSource).toContain('const MUSHROOM_GROWTH_STAGGER_MS = 42');
    expect(juiceSource).toContain('const MUSHROOM_EXIT_REVERSE_STAGGER_MS = 50');
    expect(juiceSource).toContain('const MUSHROOM_PILE_SLOTS: MushroomPileSlot[] = [');
    expect(juiceSource).toContain('Four heavily interlocked rows occupy only the lower ~30%');
    expect(juiceSource).toContain('{ x: -0.08, y: 1.085');
    expect(juiceSource).toContain('A shallow inverted-V cap closes the top');
    expect(juiceSource).toContain('{ x: 0.04, y: 0.925');
    expect(juiceSource).toContain('{ x: 0.50, y: 0.875');
    expect(juiceSource).toContain('{ x: 0.96, y: 0.925');
    expect(juiceSource).toContain('const targetY = screenH * slot.y');
    expect(juiceSource).toContain('const targetScale = targetPixelSize / Math.max(1, tex.width)');
    expect(juiceSource).toContain('const rotationDirection = Math.random() < 0.5');
    expect(juiceSource).toContain('const rotationMagnitude = MUSHROOM_GROWTH_MIN_ROTATION_DEG');
    expect(juiceSource).toContain('fullWorldRevealSeconds - revealDelaySeconds');
    expect(juiceSource).toContain('MUSHROOM_EXIT_REVERSE_STAGGER_MS / 1000');
    expect(juiceSource).toContain('bubble.zIndex = slot.depth');
    expect(juiceSource).toContain('explosionContainer.sortableChildren = true');
    expect(juiceSource).toContain('x: targetScale * 0.06');
    expect(juiceSource).toContain("ease: 'back.in(1.9)'");
    expect(juiceSource).toContain('bubble.anchor.set(0.5, 1)');
    expect(juiceSource).toContain("ease: 'back.out(2.5)'");
    expect(juiceSource).toContain('}, i * MUSHROOM_GROWTH_STAGGER_MS)');
    expect(juiceSource).toContain('idx = Math.max(0, scheduledIndex as number) % bubbleTextures.length');
    expect(juiceSource).toContain('let releaseScheduled = false');
    expect(juiceSource).toContain('Never reset/repool a Pixi target from inside GSAP');
    expect(juiceSource).toContain('tl.call(onBubbleComplete)');
    expect(juiceSource).toContain('container.destroy?.({ children: false })');
    expect(juiceSource).not.toContain('container.destroy?.({ children: true })');
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

  test('owns a scoped foreground layer over the lower HUD for its complete lifecycle', () => {
    expect(juiceSource).toContain("const MUSHROOM_FOREGROUND_CLASS = 'cc-mushroom-finale-foreground'");
    expect(juiceSource).toContain('if (isMushroomDrop) {');
    expect(juiceSource).toContain('setMushroomForegroundOwnership(true)');
    const cleanupBranch = juiceSource.slice(juiceSource.indexOf('function cleanup(): void'));
    expect(cleanupBranch).toContain('setMushroomForegroundOwnership(false)');
    expect(styleSource).toContain('#app.cc-mushroom-finale-foreground canvas');
    expect(styleSource).toContain('z-index: 3 !important;');
    expect(styleSource).toContain('body.cc-mushroom-finale-foreground #hud-board-indicator');
    expect(styleSource).toContain('z-index: 998 !important;');
  });

  test('ships the original icon plus all five growth variants without preloading retired fragment art', () => {
    ['mushroom.png', 'mushroom@2x.png'].forEach((asset) => {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/mushroom/${asset}`))).toBe(true);
    });
    for (let variant = 1; variant <= 5; variant += 1) {
      const asset = `mushroom${variant}.png`;
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/mushroom/${asset}`))).toBe(true);
    }
    expect(assetPreloaderSource).toContain('`./assets/shop/mushroom/mushroom${index + 1}.png`');
    expect(assetPreloaderSource).not.toContain('assets/shop/mushroom/part${index + 1}@2x.png');
  });

  test('adds one pooled layered spore owner with delayed depth bands and individual arrival flashes', () => {
    const pollenBranch = juiceSource.slice(
      juiceSource.indexOf('const pollenStates:'),
      juiceSource.indexOf('// Initial burst stays visible'),
    );
    expect(juiceSource).toContain('const MUSHROOM_POLLEN_COUNT = 72');
    expect(juiceSource).toContain('const MUSHROOM_POLLEN_MIN_RADIUS = 3.2');
    expect(juiceSource).toContain('const MUSHROOM_POLLEN_MAX_RADIUS = MUSHROOM_POLLEN_MIN_RADIUS * 1.4');
    expect(juiceSource).toContain('0xFFBB9F, 0xFFD0A5, 0xFFEDC6, 0xFFF7E7, 0xFFEBE8');
    expect(juiceSource).toContain('Math.random() * (MUSHROOM_POLLEN_MAX_RADIUS - MUSHROOM_POLLEN_MIN_RADIUS)');
    expect(juiceSource).toContain('particle.circle(0, 0, radius * 1.65).fill({ color, alpha: 0.24 })');
    expect(juiceSource).toContain('particle.circle(0, 0, radius).fill({ color, alpha: 1 })');
    expect(juiceSource).toContain(".fill({ color: 0xFFF7E7, alpha: 0.92 })");
    expect(juiceSource).toContain('particle.y = screenH * (1.03 + Math.random() * 0.10)');
    expect(juiceSource).toContain('particle.alpha = 0');
    expect(juiceSource).toContain('const MUSHROOM_POLLEN_DEPTHS = [140, 88, 68, 49, 30] as const');
    expect(juiceSource).toContain('const depthBand = index % MUSHROOM_POLLEN_DEPTHS.length');
    expect(juiceSource).toContain('particle.zIndex = MUSHROOM_POLLEN_DEPTHS[depthBand]');
    expect(juiceSource).toContain('const flockMotion = { time: 0 }');
    expect(juiceSource).toContain('birthDelay: Math.floor(index / 6) * 0.050');
    expect(juiceSource).toContain('+ depthBand * 0.105');
    expect(juiceSource).toContain('riseSpeed: screenH * (0.25 + Math.random() * 0.07)');
    expect(juiceSource).toContain('targetY: screenH * (0.50 + Math.random() * 0.20)');
    expect(juiceSource).toContain('const directionalDrift = state.driftDirection * state.driftSpeed * age');
    expect(juiceSource).toContain('const sparkleWave = 0.5');
    expect(juiceSource).toContain('particle.alpha = fadeIn * state.baseAlpha');
    expect(pollenBranch).not.toContain("trackTimeline({ repeat: -1, yoyo: true })");
    expect(juiceSource).toContain('if (risingY <= state.targetY)');
    expect(juiceSource).toContain('if (state.arrivalStartTime === null)');
    expect(juiceSource).toContain('const arrivalEnvelope = 1 - arrivalProgress');
    expect(juiceSource).toContain('const arrivalFlash = Math.exp(');
    expect(juiceSource).toContain('if (arrivalProgress >= 1 && !state.finished)');
    expect(juiceSource).toContain('pollenStates.every((candidate) => candidate.finished)');
    expect(juiceSource).not.toContain('startMushroomPollenExit');
    expect(juiceSource).not.toContain('pollenExitTween');
    expect(pollenBranch).not.toContain('gravityProgress');
    expect(pollenBranch).not.toContain('fallDistance');
    expect(juiceSource).toContain('? 7200');
    expect(juiceSource).toContain('let pollenReleaseScheduled = false');
    expect(juiceSource).toContain('const particle = graphicsPool.acquire()');
    expect(juiceSource).toContain('graphicsPool.release(particle)');
    expect(juiceSource).toContain("(particle as any)._mushroomPollen = true");
    expect(juiceSource).toContain('lifecycle.trackTimeout(startMushroomPollenFlock, 55)');
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
