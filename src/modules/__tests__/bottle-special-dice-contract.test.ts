import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string => fs.readFileSync(path.resolve(relativePath), 'utf8');

describe('Bottle special-die visual contract', () => {
  test('keeps Magnet gameplay but independently scatters glass and floats paper in the Cubero owner', () => {
    const registrySource = read('src/modules/special-dice-registry.ts');
    const splashSource = read('src/modules/splash-text-overlay.ts');
    const sparkleSource = read('src/modules/text-sparkles.ts');
    const bottleDefinition = registrySource.slice(
      registrySource.indexOf('  bottle: {'),
      registrySource.indexOf('  honey: {'),
    );
    expect(bottleDefinition).toContain("archetype: 'wild-magnet'");
    expect(bottleDefinition).toContain("splashText: 'S.O.S.'");
    expect(bottleDefinition).toContain('cuberoFlight: true');
    for (const marker of [
      'count: 17',
      'bottleScatter: true',
      'baseSizeScale: 1',
      "mixBlendMode: 'normal'",
    ]) {
      expect(bottleDefinition).toContain(marker);
    }
    expect(splashSource).toContain('const usesCuberoFlight = options?.burstMotion?.cuberoFlight === true');
    expect(splashSource).toContain('? attachSmallStarCenterBurst(overlay, {');
    expect(splashSource).toContain(': attachBoltSprites(overlay, {');
    expect(sparkleSource).toContain('const bottleScatter = motion.bottleScatter === true');
    expect(sparkleSource).toContain('const isBottleGlass = bottleScatter');
    expect(sparkleSource).toContain('scale: (gravityFall || bottleScatter) ? 1 : 0');
    expect(sparkleSource).toContain('opacity: (gravityFall || bottleScatter) ? 1 : 0');
    expect(sparkleSource).toContain("{ x: -0.9, y: -1 }");
    expect(sparkleSource).toContain("{ x: 0, y: -1 }");
    expect(sparkleSource).toContain("{ x: 0.9, y: -1 }");
    expect(sparkleSource).toContain('const glassLandingDirections = [-1, -0.55, 0, 0.55, 1]');
    expect(sparkleSource).toContain('scale: 2');
    expect(sparkleSource).toContain("ease: 'power2.in'");
    expect(sparkleSource).toContain("ease: 'sine.inOut'");
    expect(sparkleSource).toContain("gsap.set(wrap, { visibility: 'hidden' })");
    const bottleBranch = sparkleSource.slice(
      sparkleSource.indexOf('    if (bottleScatter) {'),
      sparkleSource.indexOf('    } else if (gravityFall) {'),
    );
    expect(bottleBranch).not.toContain('opacity: 0');
  });

  test('duplicates every glass source while keeping one paper set', () => {
    const registrySource = read('src/modules/special-dice-registry.ts');
    const sourceDefinitions = registrySource.slice(
      registrySource.indexOf('const bottleGlassAndPaperSources1x'),
      registrySource.indexOf('const beachBallExplosionSources'),
    );
    expect(sourceDefinitions.match(/assets\/shop\/bottle\/glass\$\{index \+ 1\}\.png/g)).toHaveLength(2);
    expect(sourceDefinitions.match(/assets\/shop\/bottle\/glass\$\{index \+ 1\}@2x/g)).toHaveLength(2);
    expect(sourceDefinitions.match(/assets\/shop\/bottle\/paper\$\{index \+ 1\}\.png/g)).toHaveLength(1);
    expect(sourceDefinitions.match(/assets\/shop\/bottle\/paper\$\{index \+ 1\}@2x/g)).toHaveLength(1);
  });

  test('keeps sparse pooled Honey-style idle bubbles separate from the larger organic merge field', () => {
    const registrySource = read('src/modules/special-dice-registry.ts');
    const fxSource = read('src/modules/fx.ts');
    const sparkleSource = read('src/modules/text-sparkles.ts');
    const poolSource = read('src/modules/object-pool.ts');
    const bottleDefinition = registrySource.slice(
      registrySource.indexOf('  bottle: {'),
      registrySource.indexOf('  honey: {'),
    );
    expect(bottleDefinition).toContain('idleBubbleColors: [0xCCF3F1, 0xFFFFFF]');
    expect(fxSource).toContain("const isBottle = specialVariantId === 'bottle'");
    expect(fxSource).toContain('const crossDirection = Math.random() < 0.5 ? -1 : 1');
    expect(fxSource).toContain('startX - crossDirection * crossDistance');
    expect(fxSource).toContain('_ccBottleTintProgress: 1');
    expect(fxSource).toContain('bubble.tint = (red << 16) | (green << 8) | blue');
    expect(fxSource).toContain('startWildJuiceBubbles(tile);');
    expect(fxSource).not.toContain('gsap.ticker.add(bottleTicker)');
    expect(sparkleSource).toContain('const bottleBubbleWaveSizes = [8, 11, 9]');
    expect(sparkleSource).toContain('const bottleBubbleWaveStarts = [0.1, 0.48, 0.96]');
    expect(sparkleSource).toContain("domElementPool.acquire('div')");
    expect(sparkleSource).toContain('const bubbleSize = idleEquivalentSize * (2 + Math.random() * 0.5)');
    expect(sparkleSource).toContain('const bubbleAspect = 0.68 + Math.random() * 0.64');
    expect(sparkleSource).toContain('borderRadius: organicRadiusB');
    expect(sparkleSource).toContain("background: rgba(204,243,241,0.6)");
    expect(sparkleSource).toContain("backgroundColor: 'rgba(255,255,255,0.36)'");
    expect(sparkleSource).toContain('const bubbleDuration = (2.05 + Math.random() * 0.85)');
    expect(sparkleSource).toContain('const bubbleDelay = bottleBubbleWaveStarts[waveIndex]');
    expect(sparkleSource).toContain("triggerHapticImpact?.('light')");
    expect(sparkleSource).toContain("ease: 'back.in(2.4)'");
    expect(sparkleSource).toContain('(cleanupOwner as any).completionDelaySeconds = autoCleanupDelay');
    expect(read('src/modules/splash-text-overlay.ts')).toContain('const particleRemainingSeconds = Math.max(0, particleCompletionDelaySeconds - particleElapsedSeconds)');
    expect(read('src/modules/splash-text-overlay.ts')).toContain('const cleanupDelay = Math.max(exitTotal + beeFlightTail, particleRemainingSeconds + 0.05)');
    expect(sparkleSource).toContain('domElementPool.release(bubble)');
    expect(fxSource).toContain('bubble.tint = 0xFFFFFF');
    expect(poolSource).toContain('g.tint = 0xFFFFFF');
  });

  test('uses the Bottle palette for both the main magnet merge and its pull burst', () => {
    const appCoreSource = read('src/modules/app-core.ts');
    const mergeSource = read('src/modules/app-merge.ts');
    expect(appCoreSource).toContain('const magnetVariantAtMergeEntry = isWildMagnetMerge');
    expect(appCoreSource).toContain('const magnetShardColorsAtMergeEntry = Object.freeze([');
    expect(appCoreSource.match(/magnetShardColors: magnetShardColorsAtMergeEntry/g)).toHaveLength(2);
    expect(mergeSource).toContain('const pullShardColors = Array.isArray(helpers?.magnetShardColors)');
    expect(mergeSource).toContain('colors: pullShardColors');
  });

  test('gives Bottle paper the Cubero flag lifecycle with sixty-percent more turn', () => {
    const sparkleSource = read('src/modules/text-sparkles.ts');
    expect(sparkleSource).toContain('const isBottlePaper = bottleScatter');
    expect(sparkleSource).toContain('(50 + Math.random() * 120) * 1.6');
    expect(sparkleSource).toContain('const paperLaunchTime = (0.1 + Math.random() * 0.18)');
    expect(sparkleSource).toContain('const paperTravelTime = (1.05 + Math.random() * 0.85)');
    expect(sparkleSource).toContain('const paperExitAngle = Math.random() * Math.PI * 2');
    expect(sparkleSource).toContain('const paperExitRadius = Math.min(viewportW, viewportH) * (0.34 + Math.random() * 0.2)');
    expect(sparkleSource).toContain('const paperWindB = -centrifugalDirection');
    expect(sparkleSource).toContain("ease: 'sine.inOut'");
    expect(sparkleSource).toContain('if (flagWave || isBottlePaper)');
    expect(sparkleSource).toContain('const bottlePaperRotationBoost = isBottlePaper ? 1.6 : 1');
  });

  test('keeps every Bottle glass shard on one uninterrupted randomized ballistic timeline', () => {
    const sparkleSource = read('src/modules/text-sparkles.ts');
    const glassBranch = sparkleSource.slice(
      sparkleSource.indexOf('      if (isBottleGlass) {'),
      sparkleSource.indexOf('      } else {', sparkleSource.indexOf('      if (isBottleGlass) {')),
    );
    expect(glassBranch).toContain('const glassLaunchDuration = (0.16 + Math.random() * 0.22)');
    expect(glassBranch).toContain('const glassFallDuration = (0.72 + Math.random() * 0.68)');
    expect(glassBranch).toContain("+ size * 2 + 100");
    expect(glassBranch).toContain('const launchX = launchDirection.x * (55 + Math.random() * 65)');
    expect(glassBranch).toContain('keyframes: [');
    expect(glassBranch.match(/tl\.to\(wrap/g)).toHaveLength(1);
  });

  test('starts Bottle glass and paper immediately without a visible hold', () => {
    const sparkleSource = read('src/modules/text-sparkles.ts');
    expect(sparkleSource).toContain('const delay = bottleScatter');
    expect(sparkleSource).toContain('? 0');
    expect(sparkleSource).toContain('const bottleBubbleWaveStarts = [0.1, 0.48, 0.96]');
  });

  test('retires every Bottle idle-bubble tween before pooled Pixi teardown on drag', () => {
    const fxSource = read('src/modules/fx.ts');
    const dragSource = read('src/modules/drag-core.ts');
    expect(fxSource).toContain('activeTweens: new Set()');
    expect(fxSource).toContain('bubbleTweens: new Map()');
    expect(fxSource).toContain('const ownBubbleTween = (bubble, tween) =>');
    expect(fxSource).toContain('queueMicrotask(() =>');
    expect(fxSource).toContain('graphicsPool.isInPool(bubble)');
    expect(fxSource).toContain('system.container.destroy({ children: false })');
    expect(fxSource).not.toContain('system.container.destroy({ children: true })');
    expect(dragSource).toContain('const usesJuiceIdleFx = isSpecialDiceJuiceLikeTile(t)');
    expect(dragSource).toContain('if (!usesJuiceIdleFx && isSpecialDiceMagnetLikeTile(t))');
  });

  test('consumes the Magnet owner after replacements instead of revealing an addon cube', () => {
    const mergeSource = read('src/modules/app-merge.ts');
    expect(mergeSource).toContain("console.log('🧲 Respawn complete — removing consumed magnet merge-6 owner')");
    expect(mergeSource.indexOf('stopSpecialDiceIdleMotion(dst)')).toBeLessThan(
      mergeSource.indexOf('removeTile(dst)'),
    );
    expect(mergeSource).toContain("console.log('🧲 Removed consumed magnet merge-6 owner at', c, r)");
    expect(mergeSource).not.toContain('Converted magnet merge-6 to fresh cube');
    expect(mergeSource).not.toContain('boardHelpers.setValue(dst, freshVal');
    expect(read('src/modules/app-core.ts')).not.toContain('magnetVariantId: magnetVariantAtMergeEntry?.id ?? null');
    expect(mergeSource).not.toContain('isBottleMagnetVariant');
    expect(mergeSource).not.toContain('const belowCell = { c: merge6GridX, r: merge6GridY + 1 };');
    expect(mergeSource).toContain('if (obligatorySpawnCount > 0 && dst');
  });
});
