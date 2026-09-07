import fs from 'node:fs';
import path from 'node:path';
import {
  getCoreWildTypeForSpecialDiceVariant,
  getSpecialDiceShardColors,
  getSpecialDiceSplashLetterColors,
  getSpecialDiceSplashOptions,
  getSpecialDiceTrailColors,
  getSpecialDiceVariant,
  pickSpecialDiceVariantForWildSpawn,
  usesRigidSpecialDiceIdle,
} from '../special-dice-registry';
import {
  getKantaBackdropSide,
  getKantaIdleCompositeCenterCorrectionX,
  KANTA_IDLE_BACK_HORIZONTAL_OFFSET_RATIO,
  KANTA_IDLE_BACK_LEFT_SOURCE,
  KANTA_IDLE_BACK_LOWER_RATIO,
  KANTA_IDLE_BACK_OFFSET_Y_PX,
  KANTA_IDLE_BACK_POP_IN_SECONDS,
  KANTA_IDLE_BACK_SCALE,
  KANTA_IDLE_BACK_TILT_MAX_DEGREES,
  KANTA_IDLE_BACK_TILT_MIN_DEGREES,
  KANTA_IDLE_FRAME_SOURCE,
  KANTA_IDLE_FRONT_OFFSET_X_PX,
  KANTA_IDLE_REPEAT_DELAY_SECONDS,
  KANTA_IDLE_TOP_BUBBLE_COLOR,
  KANTA_IDLE_TOP_BUBBLE_COUNT,
  KANTA_IDLE_TOP_BUBBLE_EMIT_MAX_SECONDS,
  KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS,
  KANTA_IDLE_TOP_BUBBLE_INSET_PX,
  KANTA_IDLE_TOP_BUBBLE_INITIAL_BURST_COUNT,
  KANTA_IDLE_TOP_BUBBLE_ORIGIN_FROM_BOTTOM_RATIO,
  KANTA_IDLE_TOP_BUBBLE_TRAVEL_RATIO,
  KANTA_IDLE_TOP_BUBBLE_TRAVEL_MAX_SECONDS,
  KANTA_IDLE_TOP_BUBBLE_TRAVEL_MIN_SECONDS,
  KANTA_IDLE_TOP_BUBBLE_Z_INDEX,
} from '../kanta-dice-idle';
import {
  KANTA_FINALE_CAN_COUNT,
  KANTA_FINALE_CAN_PILE_SLOTS,
  KANTA_FINALE_CAN_SCALE,
  KANTA_FINALE_CAN_SOURCE_ASPECT_RATIO,
  KANTA_FINALE_CAN_SOURCES,
  KANTA_FINALE_COMPOSITE_SPECS,
  KANTA_FINALE_COMPOSITE_SCALE,
  KANTA_FINALE_ENTRY_SECONDS,
  KANTA_FINALE_EXIT_ADVANCE_SECONDS,
  KANTA_FINALE_EXTRA_PICKUP_CAN_RAISE_RATIO,
  KANTA_FINALE_EXTRA_PICKUP_CAN_COUNT,
  KANTA_FINALE_EXIT_START_SECONDS,
  KANTA_FINALE_GROUND_BELOW_VIEWPORT_RATIO,
  KANTA_FINALE_INDIVIDUAL_CAN_LOWER_RATIO,
  KANTA_FINALE_PICKUP_CAN_Z_INDEX,
  KANTA_FINALE_PICKUP_END_SCALE,
  KANTA_FINALE_PICKUP_EXIT_LANES,
  KANTA_FINALE_PICKUP_MAX_SIDE_OVERFLOW_RATIO,
  KANTA_FINALE_PICKUP_SECONDS,
  KANTA_FINALE_ROBOT_COUNT,
  KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS,
  KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS,
  KANTA_FINALE_ROBOT_LOWER_RATIO,
  KANTA_FINALE_ROBOT_RAISE_RATIO,
  KANTA_FINALE_ROBOT_SCALE,
  KANTA_FINALE_ROBOT_SOURCES,
  KANTA_FINALE_ROBOT_STEP_BOUNCE_PX,
  KANTA_FINALE_ROBOT_TRAVEL_SECONDS,
  KANTA_FINALE_ROBOT_Z_INDEX,
  KANTA_FINALE_SCENE_SECONDS,
  KANTA_FINALE_SIDE_COMPOSITE_LIFT_RATIO,
  KANTA_FINALE_UPPER_CAN_COUNT,
  KANTA_FINALE_UPPER_CAN_EXTRA_LOWER_RATIO,
  KANTA_FINALE_UPPER_CAN_ROTATION_VARIANCE_DEGREES,
} from '../kanta-finale-scene';
import { showSparkleText, stopSparkleText } from '../splash-text-overlay';

describe('Kanta special die', () => {
  test('maps exact authored assets and palettes to Wild Star gameplay', () => {
    const kanta = getSpecialDiceVariant('kanta');
    expect(kanta).toMatchObject({
      id: 'kanta',
      archetype: 'wild-star',
      splashText: 'SPLAT!',
      splashColor: '#7BD3E0',
      splashLetterOpacityRange: [1, 1],
      shardColors: [0xE4B688, 0x96FDFC],
      trailColors: [0xEBC29B, 0xDDAD7F, 0xDCFEFB, 0x9CFDFC],
      visualHeight: 128,
      hitAreaSize: 'tile',
      idleOrbit: false,
      idleMotion: 'kanta-rock',
      finaleScene: 'kanta-center-sequence',
      inputReleaseAtRatio: 0.25,
    });
    expect(kanta?.visualWidth).toBeCloseTo(128 * (128 / 171), 10);
    expect((kanta?.visualWidth || 0) / (kanta?.visualHeight || 1)).toBeCloseTo(128 / 171, 10);
    expect(kanta?.texture).toMatch(/assets\/shop\/kanta\/04\.png$/);
    expect(getCoreWildTypeForSpecialDiceVariant(kanta)).toBe('wild');
    expect(getSpecialDiceTrailColors(kanta)).toEqual([0xEBC29B, 0xDDAD7F, 0xDCFEFB, 0x9CFDFC]);
    expect(getSpecialDiceShardColors(kanta)).toEqual([0xE4B688, 0x96FDFC]);
    expect(getSpecialDiceSplashOptions(kanta)).toMatchObject({
      text: 'SPLAT!',
      color: '#7BD3E0',
      letterOpacityRange: [1, 1],
      finaleScene: 'kanta-center-sequence',
    });
    expect(getSpecialDiceSplashLetterColors(kanta)).toBeUndefined();
    expect(kanta?.idleSpriteSources).toEqual([
      './assets/shop/kanta/04.png',
      './assets/shop/kanta/02.png',
    ]);

    for (let frame = 1; frame <= 10; frame += 1) {
      const fileName = String(frame).padStart(2, '0');
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/kanta/${fileName}.png`))).toBe(true);
    }
  });

  test('paints SPLAT! with a light cyan fill and broad pale-neon halo', () => {
    const kanta = getSpecialDiceVariant('kanta');
    showSparkleText({ x: 195, y: 430 }, getSpecialDiceSplashOptions(kanta));
    try {
      const overlay = document.querySelector<HTMLElement>('[data-effect-text="SPLAT!"]');
      const letters = Array.from(
        overlay?.querySelectorAll<HTMLElement>('.cc-sparkle-text-letter') ?? [],
      );

      expect(overlay?.dataset.effectPalette).toBe('solid');
      expect(letters.map((letter) => letter.textContent)).toEqual(['S', 'P', 'L', 'A', 'T', '!']);
      expect(letters.map((letter) => letter.dataset.effectLetterColor))
        .toEqual(Array(6).fill('#7BD3E0'));
      expect(letters.map((letter) => letter.style.color))
        .toEqual(Array(6).fill('rgb(123, 211, 224)'));
      expect(letters.map((letter) => letter.dataset.effectLetterGlow))
        .toEqual(Array(6).fill('kanta-neon'));
      expect(letters.every((letter) => (
        letter.style.textShadow.includes('rgba(240, 255, 255, 0.98)')
        && letter.style.textShadow.includes('rgba(153, 252, 255, 0.95)')
        && letter.style.textShadow.includes('rgba(88, 238, 250, 0.82)')
        && letter.style.textShadow.includes('rgba(6, 244, 255, 0.62)')
      ))).toBe(true);
    } finally {
      stopSparkleText();
    }
  });

  test('builds four enlarged collectors and one dense Kanta heap without spaceships', () => {
    expect(KANTA_FINALE_SCENE_SECONDS).toBeCloseTo(3.18, 10);
    expect(KANTA_FINALE_ENTRY_SECONDS).toBe(0.36);
    expect(KANTA_FINALE_EXIT_START_SECONDS).toBeCloseTo(2.56, 10);
    expect(KANTA_FINALE_EXIT_ADVANCE_SECONDS).toBe(0.50);
    expect(KANTA_FINALE_ROBOT_COUNT).toBe(4);
    expect(KANTA_FINALE_ROBOT_SCALE).toBeCloseTo(1.89 * 2, 10);
    expect(KANTA_FINALE_ROBOT_RAISE_RATIO).toBeCloseTo(0.14 + 0.08, 10);
    expect(KANTA_FINALE_ROBOT_LOWER_RATIO).toBe(0.35);
    expect(KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS).toBe(0.80);
    expect(KANTA_FINALE_ROBOT_ENTRY_STAGGER_SECONDS).toBe(0.30);
    expect(KANTA_FINALE_ROBOT_TRAVEL_SECONDS).toBe(1.48);
    expect(KANTA_FINALE_ROBOT_STEP_BOUNCE_PX).toBe(10);
    expect(KANTA_FINALE_ROBOT_Z_INDEX).toBe(11);
    expect(KANTA_FINALE_PICKUP_CAN_Z_INDEX).toBe(14);
    expect(KANTA_FINALE_PICKUP_SECONDS).toBeCloseTo(0.32 / 0.60, 10);
    expect(KANTA_FINALE_PICKUP_END_SCALE).toBe(1.20);
    expect(KANTA_FINALE_PICKUP_EXIT_LANES).toEqual([
      -0.34, -0.26, -0.18, -0.10,
      0, 0, 0,
      0.10, 0.18, 0.26, 0.34,
    ]);
    expect(KANTA_FINALE_PICKUP_MAX_SIDE_OVERFLOW_RATIO).toBe(0.10);
    expect(KANTA_FINALE_CAN_COUNT).toBe(11);
    expect(KANTA_FINALE_EXTRA_PICKUP_CAN_COUNT).toBe(7);
    expect(KANTA_FINALE_CAN_SCALE).toBeCloseTo((4 / 2.3) * 2 * 0.60 * 1.24, 10);
    expect(KANTA_FINALE_CAN_SOURCE_ASPECT_RATIO).toBeCloseTo(171 / 128, 10);
    expect(KANTA_FINALE_COMPOSITE_SCALE).toBe(1.5);
    expect(KANTA_FINALE_GROUND_BELOW_VIEWPORT_RATIO).toBe(0.10);
    expect(KANTA_FINALE_INDIVIDUAL_CAN_LOWER_RATIO).toBeCloseTo(0.28 - 0.30, 10);
    expect(KANTA_FINALE_UPPER_CAN_COUNT).toBe(4);
    expect(KANTA_FINALE_EXTRA_PICKUP_CAN_RAISE_RATIO).toBe(0.40);
    expect(KANTA_FINALE_UPPER_CAN_EXTRA_LOWER_RATIO).toBe(0.10);
    expect(KANTA_FINALE_UPPER_CAN_ROTATION_VARIANCE_DEGREES).toBe(5);
    expect(KANTA_FINALE_SIDE_COMPOSITE_LIFT_RATIO).toBe(0.05);
    expect(KANTA_FINALE_CAN_PILE_SLOTS.slice(0, KANTA_FINALE_CAN_COUNT)).toHaveLength(11);
    expect(KANTA_FINALE_CAN_SOURCES).toEqual([
      './assets/shop/kanta/01.png',
      './assets/shop/kanta/03.png',
      './assets/shop/kanta/04.png',
    ]);
    expect(KANTA_FINALE_COMPOSITE_SPECS.map(({ id, liftFromCenterRatio, zIndex }) => ({
      id,
      liftFromCenterRatio,
      zIndex,
    }))).toEqual([
      { id: 'left', liftFromCenterRatio: 0.05, zIndex: 12 },
      { id: 'center', liftFromCenterRatio: 0, zIndex: 13 },
      { id: 'right', liftFromCenterRatio: 0.05, zIndex: 12 },
    ]);
    expect(KANTA_FINALE_ROBOT_SOURCES).toHaveLength(2);
    [
      ...KANTA_FINALE_ROBOT_SOURCES,
      ...KANTA_FINALE_CAN_SOURCES,
      ...KANTA_FINALE_COMPOSITE_SPECS.map(({ source }) => source),
    ].forEach((source) => {
      expect(fs.existsSync(path.resolve(
        process.cwd(),
        source.replace(/^\.\//, '').replace('@2x', ''),
      ))).toBe(true);
    });
    const finaleSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/kanta-finale-scene.ts'),
      'utf8',
    );
    expect(finaleSource).not.toContain('cc-kanta-finale-frame');
    expect(finaleSource).not.toContain('assets/shop/kanta/animacija');
    expect(finaleSource).not.toContain('cc-kanta-finale-fighter');
    expect(finaleSource).not.toContain('createRoboAirCombatVariation()');
    expect(finaleSource).not.toContain('sampleRoboAirCombatSway(');
    expect(finaleSource).toContain('element.dataset.kantaFinaleRobot = String(index)');
    expect(finaleSource).toContain('element.dataset.kantaFinaleStackedCan = String(index)');
    expect(finaleSource).not.toContain('fighters.forEach((fighter) => paintFighter(fighter, elapsedSeconds))');
    expect(finaleSource).toContain('robots.forEach((robot) => paintRobot(robot, elapsedSeconds))');
    expect(finaleSource).toContain('cans.forEach((can) => paintCan(can, elapsedSeconds))');
    expect(finaleSource).toContain(
      'composites.forEach((composite) => paintComposite(composite, elapsedSeconds))',
    );
    expect(finaleSource).not.toContain('getSpaceshipMagneticPullProgress');
    expect(finaleSource).not.toContain('cc-kanta-finale-ejected');
    expect(finaleSource).not.toContain('rock.dataset');
    expect(finaleSource).toContain('window.cancelAnimationFrame(animationFrameId)');

    const splashSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/splash-text-overlay.ts'),
      'utf8',
    );
    expect(splashSource).toContain("options?.finaleScene === 'kanta-center-sequence'");
    expect(splashSource).toContain('attachKantaFinaleScene(overlay, 2)');
    expect(splashSource).toContain("container.className = 'cc-sparkle-text-letters'");
    expect(splashSource).not.toContain('if (usesKantaCenterSequence) {');
  });

  test('first appears on Area 55 Cjelina 01 and remains in every later pool', () => {
    for (const worldIntroRoll of [0, 0.25, 0.75, 0.9999]) {
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        journeyBoard: 21,
        wildSpawnCount: 0,
        worldIntroRoll,
      })?.id).toBe('kanta');
    }

    const kantaRollByBoard = new Map<number, number>([
      [21, 0.9999], [22, 0.34], [23, 0.26],
      [24, 0.21], [25, 0.21], [26, 0.21], [27, 0.21],
      [28, 0.21], [29, 0.21], [30, 0.21],
    ]);
    for (let journeyBoard = 21; journeyBoard <= 30; journeyBoard += 1) {
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        journeyBoard,
        wildSpawnCount: 1,
        worldIntroRoll: kantaRollByBoard.get(journeyBoard) ?? 0,
      })?.id).toBe('kanta');
    }
  });

  test('holds frame 04 and runs a random sprite-local squeeze/stretch idle', () => {
    expect(getKantaBackdropSide(194, 390)).toBe(-1);
    expect(getKantaBackdropSide(196, 390)).toBe(1);
    expect(KANTA_IDLE_FRAME_SOURCE).toBe('./assets/shop/kanta/04.png');
    expect(KANTA_IDLE_BACK_LEFT_SOURCE).toBe('./assets/shop/kanta/02.png');
    expect(KANTA_IDLE_BACK_SCALE).toBeCloseTo(0.76, 10);
    expect(KANTA_IDLE_BACK_TILT_MIN_DEGREES).toBe(3);
    expect(KANTA_IDLE_BACK_TILT_MAX_DEGREES).toBe(7);
    expect(KANTA_IDLE_BACK_HORIZONTAL_OFFSET_RATIO).toBe(0.40);
    expect(KANTA_IDLE_BACK_LOWER_RATIO).toBe(-0.10);
    expect(KANTA_IDLE_FRONT_OFFSET_X_PX).toBe(8);
    expect(KANTA_IDLE_BACK_OFFSET_Y_PX).toBe(-2);
    expect(KANTA_IDLE_BACK_POP_IN_SECONDS).toBe(0.42);
    expect(KANTA_IDLE_TOP_BUBBLE_COLOR).toBe(0x06F4FF);
    expect(KANTA_IDLE_TOP_BUBBLE_COUNT).toBe(9);
    expect(KANTA_IDLE_TOP_BUBBLE_INSET_PX).toBe(3);
    expect(KANTA_IDLE_TOP_BUBBLE_Z_INDEX).toBe(2600);
    expect(KANTA_IDLE_TOP_BUBBLE_ORIGIN_FROM_BOTTOM_RATIO).toBe(0.75);
    expect(KANTA_IDLE_TOP_BUBBLE_INITIAL_BURST_COUNT).toBe(3);
    expect(KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS).toBeCloseTo(0.1485, 10);
    expect(KANTA_IDLE_TOP_BUBBLE_EMIT_MAX_SECONDS).toBeCloseTo(0.2565, 10);
    expect(KANTA_IDLE_TOP_BUBBLE_TRAVEL_RATIO).toBeCloseTo(0.552, 10);
    expect(KANTA_IDLE_TOP_BUBBLE_TRAVEL_MIN_SECONDS).toBeCloseTo(1.026, 10);
    expect(KANTA_IDLE_TOP_BUBBLE_TRAVEL_MAX_SECONDS).toBeCloseTo(1.458, 10);
    expect(KANTA_IDLE_REPEAT_DELAY_SECONDS).toBe(0.58);
    for (const side of [-1, 1] as const) {
      const width = 128 * (128 / 171);
      const correction = getKantaIdleCompositeCenterCorrectionX(width, side);
      const frontCenter = KANTA_IDLE_FRONT_OFFSET_X_PX + correction;
      const backCenter = side * width * KANTA_IDLE_BACK_HORIZONTAL_OFFSET_RATIO + correction;
      const leftEdge = Math.min(
        frontCenter - width * 0.5,
        backCenter - width * KANTA_IDLE_BACK_SCALE * 0.5,
      );
      const rightEdge = Math.max(
        frontCenter + width * 0.5,
        backCenter + width * KANTA_IDLE_BACK_SCALE * 0.5,
      );
      expect((leftEdge + rightEdge) * 0.5).toBeCloseTo(0, 10);
    }
    const idleSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/kanta-dice-idle.ts'),
      'utf8',
    );
    expect(idleSource).toContain('createJourneyInterimBounceVariant()');
    expect(idleSource).toContain('JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleX');
    expect(idleSource).toContain('repeatRefresh: true');
    expect(idleSource).toContain('variant = createJourneyInterimBounceVariant()');
    expect(idleSource).toContain('originalScaleX * variant.peakScaleX');
    expect(idleSource).toContain('originalScaleY * variant.peakScaleY');
    expect(idleSource).toContain("'kanta-idle-back'");
    expect(idleSource).not.toContain("'kanta-idle-back-right'");
    expect(idleSource).toContain('onUpdate: syncBackdropPose');
    expect(idleSource).toContain('const opposingScaleRatioX = Math.max(0.8, 2 - scaleRatioX)');
    expect(idleSource).toContain('const opposingScaleRatioY = Math.max(0.8, 2 - scaleRatioY)');
    expect(idleSource).toContain('const sideDirection = Math.sign(offsetX) || -1');
    expect(idleSource).toContain("ease: 'back.out(2.35)'");
    expect(idleSource).toContain('bubble.circle(0, 0, radius).fill');
    expect(idleSource).toContain("container.label = 'kanta-idle-top-bubbles'");
    expect(idleSource).toContain("rearContainer.label = 'kanta-idle-back-bubbles'");
    expect(idleSource).toContain('container.zIndex = KANTA_IDLE_TOP_BUBBLE_Z_INDEX');
    expect(idleSource).toContain('bubbleParent.sortChildren()');
    expect(idleSource).toContain('color: KANTA_IDLE_TOP_BUBBLE_COLOR, alpha: 1');
    expect(idleSource).not.toContain('topBubbleSpawnCall?.pause()');
    expect(idleSource).not.toContain('topBubbleTweens.forEach((tween) => tween.pause())');
    expect(idleSource).toContain("acquirePixiMobileActivityLease('kanta-idle-bubbles')");
    expect(idleSource).toContain('releaseTopBubbleMobileActivity?.()');
    expect(idleSource).toContain('animationManager.killExternalTween(topBubbleSpawnCall)');
    expect(idleSource).toContain('const bubble = graphicsPool.acquire()');
    expect(idleSource).toContain('graphicsPool.release(bubble)');
    expect(idleSource).toContain('const scheduleNextBubble = () =>');
    expect(idleSource).toContain('gsap.delayedCall(nextDelay');
    expect(idleSource).toContain('keyframes: [');
    expect(idleSource).toContain("ease: 'sine.inOut'");
    expect(idleSource).toContain("ease: 'back.in(2.4)'");
    expect(idleSource).toContain('x: 1.58');
    expect(idleSource).toContain('queueMicrotask(() =>');
    expect(idleSource).toContain('parent.addChildAt(sprite');
    expect(idleSource).not.toContain('getKantaIdleFrameIndex');
    expect(idleSource).not.toContain('getKantaIdleRockRotation');
  });

  test('uses only its dedicated sprite-local stretch owner, never the generic whole-tile idle', () => {
    expect(usesRigidSpecialDiceIdle({ _ccSpecialDiceVariant: 'kanta' })).toBe(true);
    expect(usesRigidSpecialDiceIdle({ specialDiceVariant: 'kanta' })).toBe(true);
    expect(usesRigidSpecialDiceIdle({ _ccSpecialDiceVariant: 'bee' })).toBe(false);
    expect(usesRigidSpecialDiceIdle({ value: 3 })).toBe(false);

    const idleSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/tile-idle-bounce.ts'),
      'utf8',
    );
    expect(idleSource).toContain("import { usesRigidSpecialDiceIdle } from './special-dice-registry.js';");
    expect(idleSource).toContain('if (!tile || tile.destroyed || usesRigidSpecialDiceIdle(tile)) return;');
    expect(idleSource).toContain('if (usesRigidSpecialDiceIdle(t)) return false;');
  });

  test('releases drag-owned idle state on pointer cancel and watchdog interruption', () => {
    const dragSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/drag-core.ts'),
      'utf8',
    );
    const watchdogStart = dragSource.indexOf('function restartDragWatchdog');
    const watchdogEnd = dragSource.indexOf('function pauseSpecialDiceIdleForDrag', watchdogStart);
    const cancelStart = dragSource.indexOf('function onCancel');
    const cancelEnd = dragSource.indexOf('// === STABLE HIT-TEST', cancelStart);

    expect(dragSource.slice(watchdogStart, watchdogEnd))
      .toContain('setSpecialDiceIdleDragging(t, false)');
    expect(dragSource.slice(cancelStart, cancelEnd))
      .toContain('setSpecialDiceIdleDragging(t, false)');
  });
});
