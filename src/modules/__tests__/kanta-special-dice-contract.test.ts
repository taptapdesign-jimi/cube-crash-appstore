import fs from 'node:fs';
import path from 'node:path';
import {
  getCoreWildTypeForSpecialDiceVariant,
  getSpecialDiceShardColors,
  getSpecialDiceTrailColors,
  getSpecialDiceVariant,
  pickSpecialDiceVariantForWildSpawn,
  usesRigidSpecialDiceIdle,
} from '../special-dice-registry';
import {
  getKantaIdleFrameIndex,
  getKantaIdleRockRotation,
  KANTA_IDLE_FRAME_SECONDS,
  KANTA_IDLE_ROCK_CYCLE_SECONDS,
  KANTA_IDLE_ROCK_DEGREES,
} from '../kanta-dice-idle';

describe('Kanta special die', () => {
  test('maps exact authored assets and palettes to Wild Star gameplay', () => {
    const kanta = getSpecialDiceVariant('kanta');
    expect(kanta).toMatchObject({
      id: 'kanta',
      archetype: 'wild-star',
      splashText: 'KANTA!',
      splashColor: '#EBC29B',
      shardColors: [0xE4B688, 0x96FDFC],
      trailColors: [0xEBC29B, 0xDDAD7F, 0xDCFEFB, 0x9CFDFC],
      visualFit: 'height',
      hitAreaSize: 'tile',
      idleOrbit: false,
      idleMotion: 'kanta-rock',
      inputReleaseAtRatio: 0.25,
    });
    expect(kanta?.texture).toMatch(/assets\/shop\/kanta\/kanta1(?:@2x)?\.png$/);
    expect(getCoreWildTypeForSpecialDiceVariant(kanta)).toBe('wild');
    expect(getSpecialDiceTrailColors(kanta)).toEqual([0xEBC29B, 0xDDAD7F, 0xDCFEFB, 0x9CFDFC]);
    expect(getSpecialDiceShardColors(kanta)).toEqual([0xE4B688, 0x96FDFC]);
    expect(kanta?.idleSpriteSources).toHaveLength(6);
    kanta?.idleSpriteSources?.forEach((source, index) => {
      expect(source).toMatch(new RegExp(`assets/shop/kanta/kanta${index + 1}(?:@2x)?\\.png$`));
    });

    for (let frame = 1; frame <= 6; frame += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/kanta/kanta${frame}.png`))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/kanta/kanta${frame}@2x.png`))).toBe(true);
    }
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

  test('loops 01 through 06 and rocks gently around a single slow cycle', () => {
    expect(KANTA_IDLE_FRAME_SECONDS).toBe(0.16);
    expect([0, 0.16, 0.32, 0.48, 0.64, 0.80, 0.961]
      .map((seconds) => getKantaIdleFrameIndex(seconds, 6)))
      .toEqual([0, 1, 2, 3, 4, 5, 0]);
    expect(KANTA_IDLE_ROCK_CYCLE_SECONDS).toBe(2.88);
    expect(KANTA_IDLE_ROCK_DEGREES).toBe(3);
    expect(getKantaIdleRockRotation(0)).toBeCloseTo(0, 10);
    expect(getKantaIdleRockRotation(KANTA_IDLE_ROCK_CYCLE_SECONDS / 4))
      .toBeCloseTo(3 * Math.PI / 180, 10);
    expect(getKantaIdleRockRotation(KANTA_IDLE_ROCK_CYCLE_SECONDS / 2))
      .toBeCloseTo(0, 10);
  });

  test('stays rigid and cannot enter the generic cube squash/stretch idle', () => {
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
