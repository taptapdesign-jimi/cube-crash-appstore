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
} from '../special-dice-registry';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Robo Cube special die', () => {
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
    expect(juiceSource).toContain("const isRoboNameplate = bubblyText.join('') === 'BIBI - RIBI'");
    expect(juiceSource).toContain("isRoboDivider ? 'margin-right: 7px' : 'margin-right: 0'");
    expect(juiceSource).toContain("isRoboDivider ? 'margin-left: 3px' : 'margin-left: -4.2px'");
    expect(robo?.idleSpriteSources).toEqual(Array.from(
      { length: 4 },
      (_, index) => `./assets/shop/robo/robo-cube${index + 1}.png`,
    ));
    expect(robo?.explosionSpriteSources).toHaveLength(12);
    expect(getSpecialDiceFinaleAccentSpriteSources(robo)).toHaveLength(4);

    for (let frame = 1; frame <= 4; frame += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/robo-cube${frame}.png`))).toBe(true);
    }
    for (let frame = 1; frame <= 12; frame += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/robo${frame}.png`))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/robo${frame}@2x.png`))).toBe(true);
    }
    for (let frame = 1; frame <= 4; frame += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/neon${frame}.png`))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/robo/neon${frame}@2x.png`))).toBe(true);
    }
  });

  test('keeps Robo Cube in every Area 55 pool while later dice unlock cumulatively', () => {
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard: 21,
      wildSpawnCount: 0,
      previousWildType: null,
      worldIntroRoll: 0,
    })).toBeNull();
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard: 21,
      wildSpawnCount: 1,
      previousWildType: null,
      worldIntroRoll: 0.9999,
    })?.id).toBe('robo-cube');
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard: 22,
      wildSpawnCount: 1,
      previousWildType: 'wild-tnt',
      worldIntroRoll: 0.34,
    })?.id).toBe('robo-cube');
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard: 23,
      wildSpawnCount: 1,
      previousWildType: 'wild-magnet',
      worldIntroRoll: 0.26,
    })?.id).toBe('robo-cube');

    for (let journeyBoard = 23; journeyBoard <= 30; journeyBoard += 1) {
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        journeyBoard,
        wildSpawnCount: 7,
        worldIntroRoll: 0.25,
      })?.id).toBe('robo-cube');
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        journeyBoard,
        wildSpawnCount: 7,
        worldIntroRoll: 0.50,
      })?.id).toBe('laser-gun');
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

  test('runs one bounded Robo/Neon finale with a fixed-pose sprite sequence and windmill X accents', () => {
    expect(juiceSource).toContain("const isRoboDrop = isCustomDownDrop && options.dropProfile === 'robo'");
    expect(juiceSource).toContain('const robotBaseWidth = Math.min(screenW * 0.576, 288)');
    expect(juiceSource).toContain('const robotOriginY = screenH * 0.70');
    expect(juiceSource).not.toContain('const robotOriginY = screenH * 0.70 + 80');
    expect(juiceSource).toContain('robot.y = screenH + robotBaseWidth');
    expect(juiceSource).toContain('y: robotOriginY - ROBO_HEAD_GRAVITY_HOP_PX');
    expect(juiceSource).toContain('y: robotOriginY');
    expect(juiceSource).toContain('const robotTexturePool = bubbleTextures.slice(0, 11)');
    expect(juiceSource).toContain('const robotForwardSequence = robotTexturePool.slice(1)');
    expect(juiceSource).not.toContain('const robotReverseSequence');
    expect(juiceSource).toContain('const robotFrameSequence = robotForwardSequence');
    expect(juiceSource).not.toContain('availableTextureIndices');
    expect(juiceSource).toContain('robot.texture = texture');
    expect(juiceSource).not.toContain('robot.position.set(robotOriginX, robotOriginY)');
    expect(juiceSource).not.toContain('robot.rotation = 0');
    expect(juiceSource).toContain('robot.alpha = 1');
    expect(juiceSource).toContain('x: robotBaseScale * 1.035');
    expect(juiceSource).toContain('y: robotBaseScale * 0.985');
    expect(juiceSource).toContain('duration: ROBO_FRAME_SMEAR_IN_SECONDS');
    expect(juiceSource).toContain('frameStart + ROBO_FRAME_SMEAR_IN_SECONDS');
    expect(juiceSource).toContain('duration: ROBO_FRAME_SMEAR_OUT_SECONDS');
    expect(juiceSource).not.toContain('BlurFilter');
    expect(juiceSource).not.toContain('ROBO_BOING_OFFSETS');
    expect(juiceSource).not.toContain('robotTransition');
    expect(juiceSource).not.toContain('crossfadeSeconds');
    expect(juiceSource).toContain('const ROBO_NEON_DUPLICATE_COUNT = 3');
    expect(juiceSource).toContain('const ROBO_EXTRA_NEON_COUNT = 7');
    expect(juiceSource).toContain('const ROBO_BELOW_TEXT_DUPLICATE_RATIO = 0.60');
    expect(juiceSource).toContain('Math.round(upperNeonCount * ROBO_BELOW_TEXT_DUPLICATE_RATIO)');
    expect(juiceSource).toContain('const heartCount = 5');
    expect(juiceSource).toContain('const requiredAlternateTextureIndices = Array.from(');
    expect(juiceSource).toContain('(_, index) => index + 1');
    expect(juiceSource).toContain('const neonTextureIndices = [');
    expect(juiceSource).toContain('accentTextures.length > 3 && Math.random() < 0.20');
    expect(juiceSource).toContain('Math.floor(Math.random() * nonPistolAlternateCount)');
    expect(juiceSource).toContain('lastNeon4RotationDirection === 1 ? -1 : 1');
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
    expect(juiceSource).toContain('neon.y = screenH + popDiameter');
    expect(juiceSource).toContain('x: originX + enterDriftX * 0.12');
    expect(juiceSource).toContain('y: originY - ROBO_NEON_EXIT_HOP_PX');
    expect(juiceSource).toContain('duration: ROBO_NEON_EXIT_FALL_SECONDS');
    expect(juiceSource).toContain('y: originY');
    expect(juiceSource).toContain('const neonMotion = { time: 0, progress: 0 }');
    expect(juiceSource).toContain('progress: 1');
    expect(juiceSource).toContain('duration: roboNeonMotionSeconds');
    expect(juiceSource).toContain('const circularRadius = 8 + (index % 4) * 2.5');
    expect(juiceSource).toContain('const scatterProgress = Math.max(0, (neonMotion.progress - 0.62) / 0.38)');
    expect(juiceSource).toContain('Math.cos(wave) * circularRadius');
    expect(juiceSource).toContain('Math.sin(wave * 0.92) * circularRadius * 0.65');
    expect(juiceSource).toContain('scatterX * easedScatter');
    expect(juiceSource).toContain('scatterY * easedScatter');
    expect(juiceSource).not.toContain('originY - neonMotion.progress * 100');
    expect(juiceSource).toContain('const isWindmill = textureIndex === 1 || textureIndex === 2');
    expect(juiceSource).toContain('? rotationWave * 1.35 * rotationDirection');
    expect(juiceSource).toContain('const ROBO_NEON_EXIT_STAGGER_SECONDS = 0.006');
    expect(juiceSource).toContain('const ROBO_NEON_EXIT_HOP_SECONDS = 0.10');
    expect(juiceSource).toContain('const ROBO_NEON_EXIT_FALL_SECONDS = 0.44');
    expect(juiceSource).toContain('const ROBO_NEON_EXIT_HOP_PX = 24');
    expect(juiceSource).toContain('const ROBO_HEAD_GRAVITY_HOP_SECONDS = 0.10');
    expect(juiceSource).toContain('const ROBO_HEAD_GRAVITY_FALL_SECONDS = 0.50');
    expect(juiceSource).toContain('const ROBO_HEAD_GRAVITY_HOP_PX = 30');
    expect(juiceSource).toContain('const ROBO_HEAD_ENTER_SECONDS = ROBO_HEAD_GRAVITY_FALL_SECONDS + ROBO_HEAD_GRAVITY_HOP_SECONDS');
    expect(juiceSource).toContain('const ROBO_NEON_ENTER_INITIAL_DELAY_SECONDS = 0.02');
    expect(juiceSource).toContain('const ROBO_NEON_ENTER_STAGGER_SECONDS = 0.016');
    expect(juiceSource).toContain('const ROBO_GRAVITY_EXIT_PADDING_SECONDS = 0.05');
    expect(juiceSource).toContain('const ROBO_NEON_EXIT_LEAD_SECONDS = 0.20');
    expect(juiceSource).toContain('const robotAnimationEndSeconds = ROBO_HEAD_ENTER_SECONDS');
    expect(juiceSource).toContain('const frameStart = ROBO_HEAD_ENTER_SECONDS + 0.10 + sequenceIndex * ROBO_FRAME_STEP_SECONDS');
    expect(juiceSource).toContain('const roboGravityExitStartSeconds = robotAnimationEndSeconds');
    expect(juiceSource).toContain('roboGravityExitStartSeconds - ROBO_NEON_EXIT_LEAD_SECONDS');
    expect(juiceSource).not.toContain('ROBO_NEON_EXIT_ANTICIPATION_SECONDS');
    expect(juiceSource).toContain('const neonExitTimeline = trackTimeline({');
    expect(juiceSource).toContain("neonExitTimeline.addLabel('neon-gravity-exit', 0)");
    expect(juiceSource).toContain("neonExitTimeline.addLabel('head-gravity-exit', ROBO_NEON_EXIT_LEAD_SECONDS)");
    expect(juiceSource).toContain("}, 'head-gravity-exit')");
    expect(juiceSource).toContain("}, undefined, 'neon-gravity-exit')");
    expect(juiceSource).toContain('delay: roboNeonGravityExitStartSeconds');
    expect(juiceSource).toContain("traceRoboFinale('shared-exit-start'");
    expect(juiceSource).toContain("traceRoboFinale('head-exit-start')");
    expect(juiceSource).toContain('const exitFrameIndex = selectRoboExitFrameIndex(');
    expect(juiceSource).toContain('lastRoboExitFrameIndex = exitFrameIndex');
    expect(juiceSource).toContain('robot.texture = exitTexture');
    expect(juiceSource).toContain("traceRoboFinale('head-exit-frame-selected'");
    expect(juiceSource).toContain("traceRoboFinale('visual-exit-complete')");
    expect(juiceSource).toContain('const liveNeonSprites = neonSprites');
    expect(juiceSource).toContain("onStart: () => traceRoboFinale('shared-exit-start'");
    expect(juiceSource).toContain('const robotEnterTimeline = trackTimeline()');
    expect(juiceSource).toContain('roboAnimations.push(robotEnterTimeline, robotTimeline)');
    expect(juiceSource).toContain('animationManager.killExternalTimeline(robotEnterTimeline)');
    expect(juiceSource).not.toContain('animationManager.killExternalTimeline(robotTimeline)');
    expect(juiceSource).toContain('neonExitTimeline.to(robot, {');
    expect(juiceSource).not.toContain('neonExitTimeline.to(neonExitState, {');
    expect(juiceSource).toContain('let renderNeonExitFrame: (() => void) | null = null');
    expect(juiceSource).toContain('if (neonExitStarted) {');
    expect(juiceSource).toContain('renderNeonExitFrame?.();');
    expect(juiceSource).toContain('const gravityProgress = fallProgress * fallProgress');
    expect(juiceSource).toContain('const belowScreenY = screenH + Math.max(80, sprite.height)');
    expect(juiceSource).toContain('sprite.y = hopY + (belowScreenY - hopY) * gravityProgress');
    expect(juiceSource).toContain('if (fallProgress >= 1) sprite.alpha = 0');
    expect(juiceSource).toContain('const shuffledNeonIndices = liveNeonSprites.map');
    expect(juiceSource).toContain('neonExitOrderByIndex.set(spriteIndex, orderIndex)');
    expect(juiceSource).toContain('orderIndex * ROBO_NEON_EXIT_STAGGER_SECONDS');
    expect(juiceSource).not.toContain('if (localElapsed <= 0) return');
    expect(juiceSource).toContain('sprite.rotation = startState.rotation + liveRotationDelta');
    expect(juiceSource).toContain('(neonMotion.time - neonExitMotionStartRadians)');
    expect(juiceSource).not.toContain('animationManager.killExternalTween(neonMotionTween)');
    expect(juiceSource).not.toContain('neonExitTimeline.to(liveNeonSprites.map((sprite) => sprite.scale)');
    expect(juiceSource).toContain('/ ROBO_NEON_EXIT_FALL_SECONDS');
    expect(juiceSource).toContain('y: screenH + robotBaseWidth');
    expect(juiceSource).toContain("ease: 'power2.in'");
    expect(juiceSource).toContain('robot.alpha = 0');
    expect(juiceSource).toContain('if (!sprite.destroyed) sprite.alpha = 0');
    expect(juiceSource).not.toContain('const popTl = trackTimeline');
    expect(juiceSource).toContain('duration: ROBO_HEAD_GRAVITY_FALL_SECONDS');
    expect(juiceSource).not.toContain('robot.position.set(robotOriginX, robotOriginY)');
    expect(juiceSource).toContain('neon.y = screenH + popDiameter');
    expect(juiceSource).toContain('y: originY - ROBO_NEON_EXIT_HOP_PX');
    expect(juiceSource).toContain('robot.zIndex = 10000');
    expect(juiceSource).toContain('ROBO_FRAME_STEP_SECONDS = 0.12');
    expect(juiceSource).toContain('ROBO_FRAME_SMEAR_IN_SECONDS = 0.024');
    expect(juiceSource).toContain('ROBO_FRAME_SMEAR_OUT_SECONDS = 0.052');
    expect(juiceSource).toContain('ROBO_FINALE_SAFETY_TIMEOUT_MS = 6000');
    expect(juiceSource).toContain('const roboNeonMotionSeconds = Math.max(');
    expect(juiceSource).toContain('if (!isExplosionActive || cleanupInProgress || neonExitStarted || roboNeonMotionSeconds <= 0) return');
    expect(juiceSource).toContain('gsap.killTweensOf(sprite.scale)');
    expect(juiceSource).toContain('ROBO_NEON_MOTION_RADIANS_PER_SECOND = (Math.PI * 4) / 0.85');
    expect(juiceSource).toContain('const ROBO_NEON_ROTATION_SPEED_RATIO = 0.50');
    expect(juiceSource).toContain('* ROBO_NEON_ROTATION_SPEED_RATIO + phase');
    expect(juiceSource).toContain('* ROBO_NEON_ROTATION_SPEED_RATIO + metadata.phase');
    expect(juiceSource).toContain('time: ROBO_NEON_MOTION_RADIANS_PER_SECOND * roboNeonMotionSeconds');
    expect(juiceSource).toContain('isRoboDrop ? ROBO_FINALE_SAFETY_TIMEOUT_MS');
    expect(juiceSource).not.toContain('}, ROBO_FINALE_COMPLETE_MS);');
    expect(appCoreSource.match(/accentSpritePaths: getSpecialDiceFinaleAccentSpriteSources/g)).toHaveLength(2);
  });

  test('starts the complete four-texture Neon gravity wave inside the 200ms head lead', () => {
    const accentCount = getSpecialDiceFinaleAccentSpriteSources(getSpecialDiceVariant('robo-cube'))?.length ?? 0;
    const upperNeonCount = accentCount * 3 + 7;
    const neonCount = upperNeonCount + Math.round(upperNeonCount * 0.60);
    const maximumGravityStartSpreadSeconds = Math.max(0, neonCount - 1) * 0.006;
    expect(accentCount).toBe(4);
    expect(maximumGravityStartSpreadSeconds).toBeLessThanOrEqual(0.20);
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

  test('invalidates stale asset continuations before a reset run can paint into a null container', () => {
    expect(juiceSource).toContain('let explosionRunGeneration = 0');
    expect(juiceSource).toContain('const runGeneration = ++explosionRunGeneration');
    expect(juiceSource).toContain('if (runGeneration !== explosionRunGeneration)');
    expect(juiceSource).toContain('const ownedExplosionContainer = explosionContainer');
    expect(juiceSource).toContain('if (!ownedExplosionContainer || ownedExplosionContainer.destroyed)');
    expect(juiceSource).toContain('bubblePool.release(robot);\n      notifySequenceComplete();');
    expect(juiceSource).toContain('ownedExplosionContainer.addChild(robot)');
    expect(juiceSource).toContain('function cleanup(): void {\n  explosionRunGeneration += 1;');
    expect(juiceSource).not.toContain('explosionContainer.addChild(robot)');
  });
});
