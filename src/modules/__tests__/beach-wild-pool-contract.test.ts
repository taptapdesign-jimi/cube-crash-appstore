import fs from 'node:fs';
import path from 'node:path';
import { getAllowedWildTypes } from '../board-specific-rules';
import {
  BEACH_WILD_SLOT_WEIGHTS,
  getCoreWildTypeForSpecialDiceVariant,
  getSpecialDiceVariant,
  pickBeachWildSlot,
  pickSpecialDiceVariantForWildSpawn,
} from '../special-dice-registry';

describe('Beach World wild pool', () => {
  test('allows only Star/Juice core types on every Beach stage', () => {
    for (let board = 11; board <= 20; board += 1) {
      expect(getAllowedWildTypes(board)).toEqual(['wild', 'wild-juice']);
    }
    expect(getAllowedWildTypes(10)).toContain('wild-magnet');
    expect(getAllowedWildTypes(21)).toContain('wild-tnt');
  });

  test('uses the four-slot Beach roll only after the Juice introduction stage', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const start = source.indexOf('const isBeachJourneyBoard =');
    const end = source.indexOf('const specialDiceVariant =', start);
    const beachOwner = source.slice(start, end);

    expect(beachOwner).toContain('boardNumber >= 12 && boardNumber <= 20');
    expect(beachOwner).toContain('const beachWildSlot = isBeachJourneyBoard ? pickBeachWildSlot() : undefined');
    expect(beachOwner).toContain('spawnJuice = beachWildSlot === 1 || beachWildSlot === 2');
    expect(beachOwner).toContain('spawnMagnet = false');
    expect(beachOwner).toContain('spawnTnt = false');
    expect(source).toContain('beachWildSlot,');
  });

  test('Beach Ball reuses TNT gameplay while remaining an explicit Beach-only variant', () => {
    expect(getCoreWildTypeForSpecialDiceVariant(getSpecialDiceVariant('beach-ball'))).toBe('wild-tnt');
  });

  test('gives all four later-stage Beach slots an equal independent 25-percent range', () => {
    expect(BEACH_WILD_SLOT_WEIGHTS).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect([
      pickBeachWildSlot(0),
      pickBeachWildSlot(0.249999),
      pickBeachWildSlot(0.25),
      pickBeachWildSlot(0.499999),
      pickBeachWildSlot(0.5),
      pickBeachWildSlot(0.749999),
      pickBeachWildSlot(0.75),
      pickBeachWildSlot(0.999999),
    ]).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  test('uses the supplied four-slot roll consistently from Beach Cjelina 02 onward', () => {
    for (let journeyBoard = 12; journeyBoard <= 20; journeyBoard += 1) {
      const variants = [0, 1, 2, 3].map((beachWildSlot) => pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        wildSpawnCount: 999,
        journeyBoard,
        beachWildSlot,
      })?.id ?? null);
      expect(variants).toEqual([null, null, 'beach-ball', 'bottle']);
    }
  });

  test('Beach Cjelina 01 cannot assign Beach Ball or Bottle variants', () => {
    for (const beachWildSlot of [0, 1, 2, 3]) {
      expect(pickSpecialDiceVariantForWildSpawn({
        isArcade: false,
        wildSpawnCount: 99,
        journeyBoard: 11,
        beachWildSlot,
      })).toBeNull();
    }
  });
});
