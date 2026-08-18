import fs from 'node:fs';
import path from 'node:path';
import { getAllowedWildTypes } from '../board-specific-rules';
import {
  getBeachWildSlotForSpawn,
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

  test('cycles Star, Juice, Beach Ball, then Bottle without a core Magnet/TNT path', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const start = source.indexOf('const isBeachJourneyBoard =');
    const end = source.indexOf('const specialDiceVariant =', start);
    const beachOwner = source.slice(start, end);

    expect(beachOwner).toContain('const beachWildSlot = getBeachWildSlotForSpawn(boardNumber, wildSpawnCount)');
    expect(beachOwner).toContain('spawnJuice = beachWildSlot === 1 || beachWildSlot === 2');
    expect(beachOwner).toContain('spawnMagnet = false');
    expect(beachOwner).toContain('spawnTnt = false');
  });

  test('rotates only Beach Stage 02 so Bottle is first without duplicating the four-item bag', () => {
    expect([0, 1, 2, 3].map((count) => getBeachWildSlotForSpawn(12, count))).toEqual([3, 0, 1, 2]);
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      wildSpawnCount: 0,
      journeyBoard: 12,
    })?.id).toBe('bottle');

    expect([0, 1, 2, 3].map((count) => getBeachWildSlotForSpawn(11, count))).toEqual([0, 1, 2, 3]);
    expect([0, 1, 2, 3].map((count) => getBeachWildSlotForSpawn(13, count))).toEqual([0, 1, 2, 3]);
  });
});
