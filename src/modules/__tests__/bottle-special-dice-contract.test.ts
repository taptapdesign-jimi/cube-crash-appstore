import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string => fs.readFileSync(path.resolve(relativePath), 'utf8');

describe('Bottle special-die visual contract', () => {
  test('keeps Magnet gameplay and routes S.O.S. to the dedicated ocean finale', () => {
    const registrySource = read('src/modules/special-dice-registry.ts');
    const splashSource = read('src/modules/splash-text-overlay.ts');
    const bottleDefinition = registrySource.slice(
      registrySource.indexOf('  bottle: {'),
      registrySource.indexOf('  honey: {'),
    );
    expect(bottleDefinition).toContain("archetype: 'wild-magnet'");
    expect(bottleDefinition).toContain("splashText: 'S.O.S.'");
    expect(bottleDefinition).toContain("splashColor: '#75DDDF'");
    expect(bottleDefinition).toContain("finaleScene: 'bottle-ocean'");
    expect(bottleDefinition).not.toContain('bottleScatter');
    expect(bottleDefinition).not.toContain('glass1');
    expect(bottleDefinition).not.toContain('paper1');
    expect(splashSource).toContain("const usesBottleOceanScene = options?.finaleScene === 'bottle-ocean'");
    expect(splashSource).toContain('? attachBottleFinaleScene(overlay, 1, BOOM_ENTER_DELAY)');
  });

  test('uses only three lifted bottles and the PNG bubble pack', () => {
    const scene = read('src/modules/bottle-finale-scene.ts');
    for (const key of ['botle1', 'botle2', 'botle3']) {
      expect(scene).toContain(`key: '${key}'`);
    }
    for (const removedKey of ['sea1', 'sea2', 'sea3', 'splav1', 'splav2', 'splav3']) {
      expect(scene).not.toContain(`key: '${removedKey}'`);
      expect(scene).not.toContain(`source('${removedKey}'`);
    }
    expect(scene).toContain('const ORIGINAL_BUBBLE_COUNT = 25');
    expect(scene).toContain('const SMALL_BUBBLE_COUNT = 15');
    expect(scene).toContain('const BUBBLE_COUNT = ORIGINAL_BUBBLE_COUNT + SMALL_BUBBLE_COUNT');
    expect(scene).toContain('const BUBBLE_WAVE_SIZES = [6, 10, 7, 7, 5, 5] as const');
    expect(scene).toContain('const BUBBLE_WAVE_STARTS = [0, 0.4, 0.9, 1.4, 1.9, 2.35] as const');
    expect(scene).toContain("key: 'botle1', src: source('botle1'), z: 8, width: '30%', left: '18%'");
    expect(scene).toContain("key: 'botle2', src: source('botle2'), z: 9, width: '36%', left: '50%'");
    expect(scene).toContain("key: 'botle3', src: source('botle3'), z: 10, width: '27%', left: '78%'");
    expect(scene).toContain('source(`bubble${(index % 6) + 1}`)');
    expect(scene).not.toContain('backgroundColor');
    expect(scene).not.toContain('borderRadius');
    expect(scene).not.toContain("domElementPool.acquire('div')");
    const pack = path.resolve('assets/shop/bottle/bottle animation pack');
    for (const name of ['botle1', 'botle2', 'botle3']) {
      expect(fs.existsSync(path.join(pack, `${name}.png`))).toBe(true);
      expect(fs.existsSync(path.join(pack, `${name}@2x.png`))).toBe(true);
    }
    for (let index = 1; index <= 6; index += 1) {
      expect(fs.existsSync(path.join(pack, `bubble${index}.png`))).toBe(true);
      expect(fs.existsSync(path.join(pack, `bubble${index}@2x.png`))).toBe(true);
    }
  });

  test('sinks bottles from above with a bounded trailing-bubble stream, then cleans up idempotently', () => {
    const scene = read('src/modules/bottle-finale-scene.ts');
    expect(scene).toContain("ease: 'sine.inOut'");
    expect(scene).toContain('restY: 100, speedMultiplier: 1');
    expect(scene).toContain('restY: 0, speedMultiplier: 1.488');
    expect(scene).toContain('restY: -60, speedMultiplier: 1.332');
    expect(scene).toContain("mover.style.top = '-9%'");
    expect(scene).toContain('y: -viewportH * (0.07 + index * 0.006)');
    expect(scene).toContain('const TRAIL_BUBBLES_PER_BOTTLE = 20');
    expect(scene).toContain('const TRAIL_MAX_LIFETIME_SECONDS = 0.72');
    expect(scene).toContain('const BOTTLE_SINK_DURATION_SECONDS = 3.2');
    expect(scene).toContain('const layerSinkDuration = BOTTLE_SINK_DURATION_SECONDS / layer.speedMultiplier');
    expect(scene).toContain('const driftDirection = Math.random() < 0.5 ? -1 : 1');
    expect(scene).toContain('const driftDistance = viewportW * (0.06 + Math.random() * 0.08)');
    expect(scene).toContain('const wobbleDirection = Math.random() < 0.5 ? -1 : 1');
    expect(scene).toContain('const initialRotation = wobbleDirection * (6 + Math.random() * 4)');
    expect(scene).toContain('-wobbleDirection * (14 + Math.random() * 4)');
    expect(scene).toContain('wobbleDirection * (12 + Math.random() * 5)');
    expect(scene).toContain('-wobbleDirection * (17 + Math.random() * 3)');
    expect(scene).toContain('wobbleDirection * (14 + Math.random() * 6)');
    expect(scene).toContain('const wobblePhaseRatios = [0.22, 0.28, 0.23, 0.27] as const');
    expect(scene).toContain("mover.className = `cc-bottle-finale-mover cc-bottle-finale-mover-${layer.key}`");
    expect(scene).toContain('mover.appendChild(image)');
    expect(scene).toContain('bottleTimeline.to(mover, {');
    expect(scene).toContain('const wobbleTimeline = own(trackTimeline({ delay: bottleStartDelaySeconds }))');
    expect(scene).toContain('wobbleTimeline.to(image, {');
    expect(scene).toContain('duration: layerSinkDuration * wobblePhaseRatios[phaseIndex]');
    expect(scene).toContain('image.style.transformOrigin = \'50% 82%\'');
    expect(scene).toContain('x: driftDirection * driftDistance');
    expect(scene).toContain('y: viewportH * 1.24 + layer.restY');
    expect(scene).toContain("ease: 'none'");
    expect(scene).toContain('const trailBubbleCount = TRAIL_BUBBLES_PER_BOTTLE');
    expect(scene).toContain('trailIndex < trailBubbleCount');
    expect(scene).toContain("'cc-bottle-finale-bubble cc-bottle-finale-trail-bubble'");
    expect(scene).toContain('const trailSize = 8 + Math.pow(Math.random(), 0.72) * 48');
    expect(scene).toContain('const trailPushDown = 8 + Math.random() * 14');
    expect(scene).toContain('const trailStartScale = 0.35 + Math.random() * 0.2');
    expect(scene).toContain('const trailEndScale = 0.9 + Math.random() * 0.25');
    expect(scene).toContain('const emissionOrdinal = trailIndex * BOTTLE_LAYERS.length + index');
    expect(scene).toContain('const trailEmissionWindow = layerSinkDuration - TRAIL_MAX_LIFETIME_SECONDS');
    expect(scene).toContain('const trailDelay = (emissionOrdinal / finalEmissionOrdinal) * trailEmissionWindow');
    expect(scene).toContain('const trailTravelDuration = 0.32 + Math.random() * 0.18');
    expect(scene).not.toContain('crossDirection');
    expect(scene).toContain('const emitterPort = [0.32, 0.5, 0.68][trailIndex % 3]');
    expect(scene).toContain('let trailRise = 60');
    expect(scene).toContain('trailBubble.dataset.bottleEmitter = layer.key');
    expect(scene).toContain('const bottleRect = mover.getBoundingClientRect()');
    expect(scene).toContain('const fieldRect = field.getBoundingClientRect()');
    expect(scene).toContain('bottleRect.width * emitterPort');
    expect(scene).toContain('bottleRect.height * (0.72 + Math.random() * 0.18)');
    expect(scene).toContain('trailRise = bottleRect.height * (0.16 + Math.random() * 0.08)');
    expect(scene).toContain('const bottleStartDelaySeconds = 0');
    expect(scene).toContain('const mainBubbleStartDelaySeconds = startDelaySeconds');
    expect(scene).toContain('const bottleTimeline = own(trackTimeline({ delay: bottleStartDelaySeconds }))');
    expect(scene).toContain('const trailTimeline = own(trackTimeline({ delay: bottleStartDelaySeconds + trailDelay }))');
    expect(scene).toContain('bottleTimeline.set(mover, { opacity: 1, scale: 0.9 }, 0)');
    expect(scene).toContain('mover.style.zIndex = String(layer.z * 10)');
    expect(scene).toContain('trailBubble.style.zIndex = String(layer.z * 10 - 1)');
    expect(scene).toContain('opacity: 0.52 + Math.random() * 0.33');
    expect(scene).toContain('y: trailPushDown');
    expect(scene).toContain('y: () => -trailRise');
    expect(scene).toContain('scale: trailEndScale');
    expect(scene).toContain('activeTimelines.splice(0).forEach');
    expect(scene).toContain('if (cleaned || exitStarted) return');
    expect(scene).toContain('if (cleaned) return');
    expect(scene).toContain('activeTimelines.forEach');
    expect(scene).toContain('domElementPool.release(image)');
    expect(scene).toContain('cleanup.startExit = startExit');
    expect(scene).toContain('cleanup.completionDelaySeconds = startDelaySeconds + 5.35');
  });

  test('sends independently woven bubble waves above the screen with sparse mid-rise pauses', () => {
    const scene = read('src/modules/bottle-finale-scene.ts');
    expect(scene).toContain('const isAddedSmallBubble = index >= ORIGINAL_BUBBLE_COUNT');
    expect(scene).toContain('const sizeMultiplier = isAddedSmallBubble ? 1.08 : 2.4');
    expect(scene).toContain('while (index >= waveStartIndex + BUBBLE_WAVE_SIZES[waveIndex]');
    expect(scene).toContain('const verticalGap = 50 + Math.random() * 50');
    expect(scene).toContain('const verticalLane = waveSlot % 4');
    expect(scene).toContain('const withinWaveDelay = waveSlot * (0.045 + Math.random() * 0.035)');
    expect(scene).toContain('const pausesNearMiddle = Math.random() < 0.16');
    expect(scene).toContain('const riseDuration = 1.45 + Math.random() * 0.45');
    expect(scene).toContain('const popRiseRatio = pausesNearMiddle');
    expect(scene).toContain(': 0.68 + Math.random() * 0.28');
    expect(scene).toContain('const delay = index === 0');
    expect(scene).toContain('? 0');
    expect(scene).toContain('const timeline = own(trackTimeline({ delay: mainBubbleStartDelaySeconds + delay }))');
    expect(scene).toContain('y: -rise * (pausesNearMiddle ? 0.49 : 0.6)');
    expect(scene).toContain('y: -rise }');
    expect(scene).toContain("ease: 'power2.out' }, popAt)");
    expect(scene).toContain("ease: 'back.in(3)' }, popAt + 0.06)");
    expect(scene).toContain('const BUBBLE_FIELD_END_SECONDS = 5.1');
    expect(scene).toContain('const sceneEndSeconds = startDelaySeconds + BUBBLE_FIELD_END_SECONDS');
    expect(scene).toContain('const remainingBubbleTime = Math.max(0, sceneEndSeconds - elapsedSeconds)');
    expect(scene).toContain('delayedExit.call(beginExit)');
  });

  test('keeps sparse pooled Honey-style idle bubbles separate from the PNG finale', () => {
    const registrySource = read('src/modules/special-dice-registry.ts');
    const fxSource = read('src/modules/fx.ts');
    const bottleDefinition = registrySource.slice(
      registrySource.indexOf('  bottle: {'),
      registrySource.indexOf('  honey: {'),
    );
    expect(bottleDefinition).toContain('idleBubbleColors: [0xCCF3F1, 0xFFFFFF]');
    expect(fxSource).toContain("const isBottle = specialVariantId === 'bottle'");
    expect(fxSource).toContain('_ccBottleTintProgress: 1');
    expect(fxSource).toContain('bubble.tint = (red << 16) | (green << 8) | blue');
    expect(fxSource).not.toContain('gsap.ticker.add(bottleTicker)');
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

  test('retires every Bottle idle-bubble tween before pooled Pixi teardown on drag', () => {
    const fxSource = read('src/modules/fx.ts');
    const dragSource = read('src/modules/drag-core.ts');
    expect(fxSource).toContain('activeTweens: new Set()');
    expect(fxSource).toContain('bubbleTweens: new Map()');
    expect(fxSource).toContain('const ownBubbleTween = (bubble, tween) =>');
    expect(fxSource).toContain('queueMicrotask(() =>');
    expect(fxSource).toContain('graphicsPool.isInPool(bubble)');
    expect(fxSource).toContain('system.container.destroy({ children: false })');
    expect(dragSource).toContain('const usesJuiceIdleFx = isSpecialDiceJuiceLikeTile(t)');
  });

  test('keeps v915 Magnet density while canonically normalizing the reused survivor', () => {
    const mergeSource = read('src/modules/app-merge.ts');
    const resolutionSource = read('src/modules/magnet-post-spawn-resolution.ts');
    expect(mergeSource).toContain('v915 Magnet continuation');
    expect(mergeSource.indexOf('stopSpecialDiceIdleMotion(dst)')).toBeLessThan(
      mergeSource.indexOf('collapseTileToSingleStackVisual(dst)'),
    );
    expect(mergeSource).toContain('collapseTileToSingleStackVisual(dst)');
    expect(mergeSource).toContain('boardHelpers.setValue(dst, freshVal, 0)');
    expect(resolutionSource).toContain('const obligatorySpawnCount = hasTilesToRespawn ? 1 : 0');
    expect(mergeSource).toContain('spawnBounce(dst, () =>');
  });
});
