import fs from 'node:fs';
import path from 'node:path';
import {
  getCoreWildTypeForSpecialDiceVariant,
  getSpecialDiceShardColors,
  getSpecialDiceSplashOptions,
  getSpecialDiceTrailColors,
  getSpecialDiceVariant,
  pickSpecialDiceVariantForWildSpawn,
  usesRigidSpecialDiceIdle,
} from '../special-dice-registry';
import {
  KANTA_IDLE_FRAME_SOURCE,
  KANTA_IDLE_REPEAT_DELAY_SECONDS,
} from '../kanta-dice-idle';
import {
  getKantaEjectionProgress,
  KANTA_FINALE_DEBRIS_COUNT,
  KANTA_FINALE_DEBRIS_SOURCES,
  KANTA_FINALE_EJECT_START_SECONDS,
  KANTA_FINALE_EJECT_STAGGER_SECONDS,
  KANTA_FINALE_EJECT_TRAVEL_SECONDS,
  KANTA_FINALE_EJECTED_CAN_COUNT,
  KANTA_FINALE_EJECTED_CAN_SOURCE,
  KANTA_FINALE_FIGHTER_COUNT,
  KANTA_FINALE_FIGHTER_SOURCE,
  KANTA_FINALE_LANDED_CAN_SCALE,
  KANTA_FINALE_RIGHT_FIGHTER_DELAY_SECONDS,
  KANTA_FINALE_SCENE_SECONDS,
} from '../kanta-finale-scene';

describe('Kanta special die', () => {
  test('maps exact authored assets and palettes to Wild Star gameplay', () => {
    const kanta = getSpecialDiceVariant('kanta');
    expect(kanta).toMatchObject({
      id: 'kanta',
      archetype: 'wild-star',
      splashText: 'BLOOBY',
      splashColor: '#50D6FE',
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
      text: 'BLOOBY',
      color: '#50D6FE',
      finaleScene: 'kanta-center-sequence',
    });
    expect(kanta?.idleSpriteSources).toEqual(['./assets/shop/kanta/04.png']);

    for (let frame = 1; frame <= 10; frame += 1) {
      const fileName = String(frame).padStart(2, '0');
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/kanta/${fileName}.png`))).toBe(true);
    }
  });

  test('reverses Spaceship suction into a debris-backed two-times Kanta pile', () => {
    expect(KANTA_FINALE_SCENE_SECONDS).toBe(3.36);
    expect(KANTA_FINALE_EJECTED_CAN_COUNT).toBe(8);
    expect(KANTA_FINALE_EJECT_START_SECONDS).toBe(0.62);
    expect(KANTA_FINALE_EJECT_STAGGER_SECONDS).toBe(0.19);
    expect(KANTA_FINALE_EJECT_TRAVEL_SECONDS).toBe(1.02);
    expect(KANTA_FINALE_EJECTED_CAN_SOURCE).toMatch(/assets\/shop\/kanta\/01\.png$/);
    expect(KANTA_FINALE_LANDED_CAN_SCALE).toBe(2);
    expect(KANTA_FINALE_DEBRIS_COUNT).toBe(7);
    expect(KANTA_FINALE_DEBRIS_SOURCES).toHaveLength(7);
    KANTA_FINALE_DEBRIS_SOURCES.forEach((source, index) => {
      expect(source).toMatch(new RegExp(`assets/shop/spaceship/rock${index + 1}(?:@2x)?\\.png$`));
      expect(fs.existsSync(path.resolve(
        process.cwd(),
        source.replace(/^\.\//, '').replace('@2x', ''),
      ))).toBe(true);
    });
    expect(getKantaEjectionProgress(0)).toBe(0);
    expect(getKantaEjectionProgress(0.5)).toBeGreaterThan(0.5);
    expect(getKantaEjectionProgress(1)).toBe(1);
    expect(KANTA_FINALE_FIGHTER_COUNT).toBe(2);
    expect(KANTA_FINALE_RIGHT_FIGHTER_DELAY_SECONDS).toBe(0.2);
    expect(KANTA_FINALE_FIGHTER_SOURCE).toMatch(/assets\/journey assets\/robo\/ship1(?:@2x)?\.png$/);
    expect(fs.existsSync(path.resolve(
      process.cwd(),
      KANTA_FINALE_FIGHTER_SOURCE.replace(/^\.\//, '').replace('@2x', ''),
    ))).toBe(true);
    const finaleSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/kanta-finale-scene.ts'),
      'utf8',
    );
    expect(finaleSource).not.toContain('cc-kanta-finale-frame');
    expect(finaleSource).not.toContain('assets/shop/kanta/animacija');
    expect(finaleSource).toContain("createFighter('left')");
    expect(finaleSource).toContain("createFighter('right')");
    expect(finaleSource).toContain('createRoboAirCombatVariation()');
    expect(finaleSource).toContain('sampleRoboAirCombatSway(');
    expect(finaleSource).toContain('return 1 - getSpaceshipMagneticPullProgress(1 - progress)');
    expect(finaleSource).toContain("can.dataset.kantaFinaleEjectedCan = String(index)");
    expect(finaleSource).toContain("rock.dataset.kantaFinaleEjectedDebris = String(index)");
    expect(finaleSource).toContain('const ejectedItems = [...ejectedDebris, ...ejectedCans]');
    expect(finaleSource).toContain('ejectedItems.forEach((item) => paintEjectedItem(item, elapsedSeconds))');
    expect(finaleSource).toContain('(runtime.landedScale - 1) * landingEase');
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

  test('first appears on Area 55 Cjelina 04 and remains in every later pool', () => {
    for (const journeyBoard of [21, 22, 23]) {
      for (const wildSpawnCount of [0, 1, 4]) {
        expect(pickSpecialDiceVariantForWildSpawn({
          isArcade: false,
          journeyBoard,
          wildSpawnCount,
          worldIntroRoll: 0.9999,
        })?.id).not.toBe('kanta');
      }
    }

    for (const worldIntroRoll of [0, 0.25, 0.75, 0.9999]) {
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        journeyBoard: 24,
        wildSpawnCount: 0,
        worldIntroRoll,
      })?.id).toBe('kanta');
    }

    for (let journeyBoard = 24; journeyBoard <= 30; journeyBoard += 1) {
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        journeyBoard,
        wildSpawnCount: 1,
        worldIntroRoll: 0.9999,
      })?.id).toBe('kanta');
    }
  });

  test('holds frame 04 and runs a random sprite-local squeeze/stretch idle', () => {
    expect(KANTA_IDLE_FRAME_SOURCE).toBe('./assets/shop/kanta/04.png');
    expect(KANTA_IDLE_REPEAT_DELAY_SECONDS).toBe(0.58);
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
