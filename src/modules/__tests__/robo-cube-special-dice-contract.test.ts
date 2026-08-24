import fs from 'node:fs';
import path from 'node:path';
import {
  getCoreWildTypeForSpecialDiceVariant,
  getSpecialDiceFinaleAccentSpriteSources,
  getSpecialDiceJuiceDropProfile,
  getSpecialDiceShardColors,
  getSpecialDiceTrailColors,
  getSpecialDiceVariant,
  pickSpecialDiceVariantForWildSpawn,
  ROBO_WILD_VARIANT_CHANCE,
} from '../special-dice-registry';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Robo Cube special die', () => {
  const registrySource = read('src/modules/special-dice-registry.ts');
  const idleSource = read('src/modules/robo-cube-idle.ts');
  const specialIdleSource = read('src/modules/special-dice-idle.ts');
  const juiceSource = read('src/modules/wild-juice-bubbles-explosion.ts');
  const appCoreSource = read('src/modules/app-core.ts');
  const wildSkinSource = read('src/modules/app-core-wild-skin.ts');
  const fxSource = read('src/modules/fx.ts');

  test('owns the requested Juice identity, palette, text, and exact supplied assets', () => {
    const robo = getSpecialDiceVariant('robo-cube');
    expect(robo).toMatchObject({
      id: 'robo-cube',
      archetype: 'wild-juice',
      texture: './assets/shop/robo/robo-cube1.png',
      splashText: 'BIBI - RIBI',
      splashColor: '#A68B7C',
      idleMotion: 'robo-sprite-cycle',
      juiceDropProfile: 'robo',
    });
    expect(getCoreWildTypeForSpecialDiceVariant(robo)).toBe('wild-juice');
    expect(getSpecialDiceJuiceDropProfile(robo)).toBe('robo');
    expect(getSpecialDiceTrailColors(robo)).toEqual([0xFED49C, 0xE99D5F, 0xAA9482, 0x8AEEFE]);
    expect(getSpecialDiceShardColors(robo)).toEqual([0x91F2FF, 0xFAC388]);
    expect(robo?.idleSpriteSources).toEqual(Array.from(
      { length: 4 },
      (_, index) => `./assets/shop/robo/robo-cube${index + 1}.png`,
    ));
    expect(robo?.explosionSpriteSources).toHaveLength(12);
    expect(getSpecialDiceFinaleAccentSpriteSources(robo)).toHaveLength(3);

    for (let frame = 1; frame <= 4; frame += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/robo-cube${frame}.png`))).toBe(true);
    }
    for (let frame = 1; frame <= 12; frame += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/robo${frame}.png`))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/robo${frame}@2x.png`))).toBe(true);
    }
    for (let frame = 1; frame <= 3; frame += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/neon${frame}.png`))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/neon${frame}@2x.png`))).toBe(true);
    }
  });

  test('guarantees the first Robo World Stage 1 wild and randomizes only later Robo stages', () => {
    expect(ROBO_WILD_VARIANT_CHANCE).toBe(0.25);
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard: 21,
      wildSpawnCount: 0,
      roboWildRoll: 0.99,
    })?.id).toBe('robo-cube');
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard: 21,
      wildSpawnCount: 1,
      roboWildRoll: 0,
    })).toBeNull();

    for (let journeyBoard = 22; journeyBoard <= 30; journeyBoard += 1) {
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        journeyBoard,
        wildSpawnCount: 7,
        roboWildRoll: 0.249999,
      })?.id).toBe('robo-cube');
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        journeyBoard,
        wildSpawnCount: 7,
        roboWildRoll: 0.25,
      })).toBeNull();
    }

    for (const journeyBoard of [1, 2, 10, 11, 20, 31]) {
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        journeyBoard,
        wildSpawnCount: 0,
        roboWildRoll: 0,
      })?.id).not.toBe('robo-cube');
    }
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: true,
      arcadeStage: 1,
      wildSpawnCount: 99,
      roboWildRoll: 0,
    })?.id).not.toBe('robo-cube');
  });

  test('crossfades four idle frames with one reusable overlay and bounded on-demand preload', () => {
    expect(specialIdleSource).toContain("variant.idleMotion === 'robo-sprite-cycle'");
    expect(specialIdleSource).toContain('startRoboCubeIdle(tile, idleSources, finaleSources)');
    expect(idleSource).toContain("overlay.label = 'robo-cube-idle-crossfade'");
    expect(idleSource).not.toContain('portalGlow');
    expect(idleSource.match(/new Graphics\(\)/g)).toHaveLength(1);
    expect(idleSource).toContain('index !== currentFrameIndex');
    expect(idleSource).toContain('Math.floor(Math.random() * candidates.length)');
    expect(idleSource).toContain('currentFrameIndex = Math.min(1, textures.length - 1)');
    expect(idleSource).toContain('timeline?.pause()');
    expect(idleSource).toContain('timeline?.resume()');
    expect(idleSource).toContain("trailContainer.label = 'robo-cube-antenna-trail'");
    expect(idleSource).toContain('const ANTENNA_TRAIL_PARTICLE_COUNT = 15');
    expect(idleSource).toContain('const ANTENNA_TRAIL_BURST_COUNT = 5');
    expect(idleSource).toContain('ANTENNA_TRAIL_EMISSION_INTERVAL_SECONDS = 0.06');
    expect(idleSource).toContain('ANTENNA_TRAIL_BOUNCE_IN_SECONDS = 0.16');
    expect(idleSource).toContain('ANTENNA_TRAIL_FADE_OUT_SECONDS = 0.20');
    expect(idleSource).toContain('const antennaEmitterY = -paintedHeight * 0.54 + 8');
    expect(idleSource).toContain("Math.min(4, paintedWidth * 0.045)) * 3");
    expect(idleSource).toContain('const distance = 10 + Math.random() * 18');
    expect(idleSource).toContain('_ccTrailExitX');
    expect(idleSource).toContain("ease: 'back.out(2.2)'");
    expect(idleSource).toContain("ease: 'back.in(1.5)'");
    expect(idleSource).toContain('0.82 + Math.random() * 0.68');
    expect(idleSource).toContain('0.32 + Math.random() * 0.46');
    expect(idleSource).toContain('trailDirection = trailDirection === -1 ? 1 : -1');
    expect(idleSource).toContain('particle.rect(');
    expect(idleSource).toContain('particle.circle(');
    expect(idleSource).toContain('particle.poly([');
    expect(idleSource).toContain('color: 0x8AEEFE');
    expect(idleSource).toContain('trailContainer.destroy({ children: true })');
    expect(specialIdleSource).toContain('const roboController = tile?._ccRoboCubeIdle');
    expect(specialIdleSource).toContain('roboController.setDragging(dragging)');
    expect(idleSource).toContain('new Sprite(textures[0])');
    expect(idleSource).not.toContain('FRAME_HOLD_SECONDS');
    expect(idleSource).toContain('EXPRESSION_FRAME_SECONDS = 0.35');
    expect(idleSource).toContain('EXPRESSION_CYCLE_SECONDS = EXPRESSION_FRAME_SECONDS * 4');
    expect(idleSource).toContain('CROSSFADE_SECONDS = 0.12');
    expect(idleSource).toContain('timeline.call(prepareRandomFrame, undefined, phaseStart)');
    expect(idleSource).toContain('timeline.call(() => {}, undefined, EXPRESSION_CYCLE_SECONDS)');
    expect(idleSource).toContain('trailTimeline = animationManager.trackExternalTimeline');
    expect(idleSource).toContain('animationManager.killExternalTimeline(trailTimeline)');
    expect(idleSource).toContain('PRELOAD_BATCH_SIZE = 3');
    expect(idleSource).toContain('animationManager.killExternalTimeline(timeline)');
    expect(idleSource).toContain('overlay.destroy({ texture: false, textureSource: false })');
    expect(idleSource).toContain('loaded.filter(isUsablePixiImageTexture)');
    expect(idleSource).toContain('textures.forEach(pinPixiImageTexture)');
    expect(idleSource).toContain('if (!isUsablePixiImageTexture(pendingTexture)) return');
    expect(idleSource).toContain('if (!isUsablePixiImageTexture(dragTexture)) return');
    expect(wildSkinSource).not.toContain('Texture.from(requestedAssetPath)');
    expect(wildSkinSource).toContain('isUsablePixiImageTexture(resolvedTexture)');
    expect(wildSkinSource).toContain('reloadPixiImageTexture(requestedAssetPath)');
    expect(fxSource).toContain("specialVariantId === 'mushroom' || specialVariantId === 'robo-cube'");
  });

  test('runs one bounded polished Robo/Neon finale with random fade-through frames and lateral scatter', () => {
    expect(juiceSource).toContain("const isRoboDrop = isCustomDownDrop && options.dropProfile === 'robo'");
    expect(juiceSource).toContain('const robotBaseWidth = Math.min(screenW * 0.576, 288)');
    expect(juiceSource).toContain('const robotOriginY = screenH * 0.70 + 80');
    expect(juiceSource).toContain('robot.y = robotOriginY');
    expect(juiceSource).toContain('const robotTexturePool = bubbleTextures.slice(0, 12)');
    expect(juiceSource).toContain('Array.from({ length: 10 }');
    expect(juiceSource).toContain('textureIndex !== previousRobotTextureIndex');
    expect(juiceSource).toContain('Math.floor(Math.random() * availableTextureIndices.length)');
    expect(juiceSource).toContain('const normalizedSequenceProgress = sequenceIndex / Math.max(1, robotFrameSequence.length - 1)');
    expect(juiceSource).toContain('1 - Math.abs(normalizedSequenceProgress * 2 - 1)');
    expect(juiceSource).toContain('const ROBO_BOING_OFFSETS = [');
    expect(juiceSource).toContain('{ x: -20, y: -12 }');
    expect(juiceSource).toContain('{ x: 0, y: 0 }');
    expect(juiceSource).toContain('const targetX = robotOriginX + boingOffset.x * 0.55');
    expect(juiceSource).toContain('const targetY = robotOriginY + boingOffset.y * 0.55');
    expect(juiceSource).toContain('const fadeOutSeconds = ROBO_FRAME_STEP_SECONDS * 0.42');
    expect(juiceSource).toContain('robot.texture = texture');
    expect(juiceSource).toContain('frameStart + ROBO_FRAME_STEP_SECONDS * 0.44');
    expect(juiceSource).toContain('const fadeInSeconds = ROBO_FRAME_STEP_SECONDS * 0.56');
    expect(juiceSource).not.toContain('robotTransition');
    expect(juiceSource).not.toContain('alpha: 0.72');
    expect(juiceSource).toContain("* 0.012");
    expect(juiceSource).toContain('const ROBO_NEON_DUPLICATE_COUNT = 3');
    expect(juiceSource).toContain('const ROBO_EXTRA_NEON_COUNT = 7');
    expect(juiceSource).toContain('const ROBO_BELOW_TEXT_DUPLICATE_RATIO = 0.60');
    expect(juiceSource).toContain('Math.round(upperNeonCount * ROBO_BELOW_TEXT_DUPLICATE_RATIO)');
    expect(juiceSource).toContain('const heartCount = 5');
    expect(juiceSource).toContain('const neonTextureIndices = [');
    expect(juiceSource).toContain('Math.floor(Math.random() * (accentTextures.length - 1))');
    expect(juiceSource).toContain('].sort(() => Math.random() - 0.5)');
    expect(juiceSource).not.toContain('neonLayoutSlots');
    expect(juiceSource).toContain('const placedNeonOrigins: Array<{ x: number; y: number; diameter: number }> = []');
    expect(juiceSource).toContain('for (let attempt = 0; attempt < 120; attempt += 1)');
    expect(juiceSource).toContain('Math.random() * Math.max(1, screenW - horizontalMargin * 2)');
    expect(juiceSource).toContain('const requiredDistance = (popDiameter + placed.diameter) * 0.5 + 16');
    expect(juiceSource).toContain('if (clearance >= 0) break');
    expect(juiceSource).toContain('const targetWidth = Math.min(52');
    expect(juiceSource).toContain('Math.round(neonCount * 0.50)');
    expect(juiceSource).toContain('const sizeMultiplier = enlargedIndices.has(index) ? 1.40 : 1');
    expect(juiceSource).toContain('const minimumAlpha = 0.75 + Math.random() * 0.20');
    expect(juiceSource).toContain('const scatterAngle = Math.random() * Math.PI * 2');
    expect(juiceSource).toContain('const scatterDistance = 20 + Math.random() * 32');
    expect(juiceSource).toContain('phase: Math.random() * Math.PI * 2');
    expect(juiceSource).toContain('sprite.alpha = minimumAlpha + (1 - minimumAlpha) * pulse');
    expect(juiceSource).toContain('x: targetScale * 1.28');
    expect(juiceSource).toContain("ease: 'back.out(2.5)'");
    expect(juiceSource).toContain('x: originX - rotationDirection * 6');
    expect(juiceSource).toContain('x: originX + rotationDirection * 6');
    expect(juiceSource).toContain('const neonMotion = { time: 0, progress: 0 }');
    expect(juiceSource).toContain('progress: 1');
    expect(juiceSource).toContain('duration: ROBO_NEON_MOTION_SECONDS');
    expect(juiceSource).toContain('const circularRadius = 8 + (index % 4) * 2.5');
    expect(juiceSource).toContain('const scatterProgress = Math.max(0, (neonMotion.progress - 0.62) / 0.38)');
    expect(juiceSource).toContain('Math.cos(wave) * circularRadius');
    expect(juiceSource).toContain('Math.sin(wave * 0.92) * circularRadius * 0.65');
    expect(juiceSource).toContain('scatterX * easedScatter');
    expect(juiceSource).toContain('scatterY * easedScatter');
    expect(juiceSource).not.toContain('originY - neonMotion.progress * 100');
    expect(juiceSource).toContain("ease: 'back.in(2.5)'");
    expect(juiceSource).toContain('robot.zIndex = 10000');
    expect(juiceSource).toContain('ROBO_FRAME_STEP_SECONDS = 0.19');
    expect(juiceSource).toContain('ROBO_FINALE_COMPLETE_MS = 2300');
    expect(juiceSource).toContain('ROBO_NEON_MOTION_SECONDS = 0.62');
    expect(juiceSource).toContain('ROBO_NEON_EXIT_START_MS = 1450');
    expect(juiceSource).toContain('isRoboDrop ? ROBO_FINALE_COMPLETE_MS + 300');
    expect(appCoreSource.match(/accentSpritePaths: getSpecialDiceFinaleAccentSpriteSources/g)).toHaveLength(2);
  });

  test('routes the complete effect through the existing Juice lock and cleanup owner', () => {
    expect(juiceSource).toContain("startWildFxDragLockForAnimation('juice-bubbles'");
    expect(juiceSource).toContain('(robot as any)._bubbleTweens = roboAnimations');
    expect(juiceSource).not.toContain('(robotTransition as any)._bubbleTweens = roboAnimations');
    expect(juiceSource).toContain('(sprite as any)._bubbleTweens = roboAnimations');
    expect(juiceSource).toContain('notifySequenceComplete();\n      cleanup();');
    expect(juiceSource).toContain("setWildFxDragLock('juice-bubbles', false)");
    expect(juiceSource).not.toContain('new Application(');
    expect(juiceSource).not.toContain('new Ticker(');
  });
});
