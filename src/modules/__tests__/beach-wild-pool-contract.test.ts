import fs from 'node:fs';
import path from 'node:path';
import { getAllowedWildTypes } from '../board-specific-rules';
import {
  BEACH_WILD_SLOT_WEIGHTS,
  getCoreWildTypeForSpecialDiceVariant,
  getSpecialDiceVariant,
  pickBeachWildSlot,
  pickBeachWildSlotForSpawn,
  pickSpecialDiceVariantForWildSpawn,
} from '../special-dice-registry';

describe('Beach World wild pool', () => {
  test('allows only Star/Juice core types on every Beach stage', () => {
    for (let board = 11; board <= 20; board += 1) {
      expect(getAllowedWildTypes(board)).toEqual(['wild', 'wild-juice']);
    }
    expect(getAllowedWildTypes(10)).toContain('wild-magnet');
    expect(getAllowedWildTypes(21)).toEqual(['wild']);
    expect(getAllowedWildTypes(22)).toContain('wild-juice');
    expect(getAllowedWildTypes(22)).not.toContain('wild-tnt');
    expect(getAllowedWildTypes(23)).toContain('wild-magnet');
    expect(getAllowedWildTypes(24)).toContain('wild-tnt');
  });

  test('introduces Juice on Beach Cjelina 02 first drop, then uses the five-slot roll', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const start = source.indexOf('const isBeachJourneyBoard =');
    const end = source.indexOf('const specialDiceVariant =', start);
    const beachOwner = source.slice(start, end);

    expect(beachOwner).toContain('boardNumber >= 12 && boardNumber <= 20');
    expect(beachOwner).toContain('pickBeachWildSlotForSpawn(boardNumber, wildSpawnCount)');
    expect(beachOwner).toContain('spawnJuice = beachWildSlot === 1 || beachWildSlot === 2');
    expect(beachOwner).toContain('spawnMagnet = false');
    expect(beachOwner).toContain('spawnTnt = false');
    expect(source).toContain('beachWildSlot,');
  });

  test('forces only Cjelina 02 first persisted Wild Meter drop to plain Juice', () => {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999999]) {
      expect(pickBeachWildSlotForSpawn(12, 0, roll)).toBe(1);
    }
    expect(pickBeachWildSlotForSpawn(12, 1, 0)).toBe(0);
    expect(pickBeachWildSlotForSpawn(12, 2, 0.75)).toBe(3);
    expect(pickBeachWildSlotForSpawn(11, 0, 0)).toBe(0);
    expect(pickBeachWildSlotForSpawn(13, 0, 0.75)).toBe(3);
  });

  test('Beach Ball reuses TNT gameplay while remaining an explicit Beach-only variant', () => {
    expect(getCoreWildTypeForSpecialDiceVariant(getSpecialDiceVariant('beach-ball'))).toBe('wild-tnt');
  });

  test('Fish reuses Wild Star gameplay as the first Beach reward', () => {
    expect(getCoreWildTypeForSpecialDiceVariant(getSpecialDiceVariant('fish'))).toBe('wild');
  });

  test('gives all five later-stage Beach slots an equal independent 20-percent range', () => {
    expect(BEACH_WILD_SLOT_WEIGHTS).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
    expect([
      pickBeachWildSlot(0),
      pickBeachWildSlot(0.199999),
      pickBeachWildSlot(0.2),
      pickBeachWildSlot(0.399999),
      pickBeachWildSlot(0.4),
      pickBeachWildSlot(0.599999),
      pickBeachWildSlot(0.6),
      pickBeachWildSlot(0.799999),
      pickBeachWildSlot(0.8),
      pickBeachWildSlot(0.999999),
    ]).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  test('uses the supplied five-slot roll consistently from Beach Cjelina 02 onward', () => {
    for (let journeyBoard = 12; journeyBoard <= 20; journeyBoard += 1) {
      const variants = [0, 1, 2, 3, 4].map((beachWildSlot) => pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        wildSpawnCount: 999,
        journeyBoard,
        beachWildSlot,
      })?.id ?? null);
      expect(variants).toEqual(['fish', null, 'beach-ball', 'bottle', null]);
    }
  });

  test('Beach Cjelina 01 leaves its Fish introduction to the Wild decision owner', () => {
    for (const beachWildSlot of [0, 1, 2, 3, 4]) {
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        wildSpawnCount: 99,
        journeyBoard: 11,
        beachWildSlot,
      })).toBeNull();
    }
  });
});
