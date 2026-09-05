import { decideWildType } from '../app-core-wild-type';
import { getAllowedWildTypes } from '../board-specific-rules';

const noop = () => {};

function decideForRoll({
  roll,
  boardNumber = 1,
  isArcade = false,
  wildSpawnCount = 0,
  lastWildDropType = 'wild',
}: {
  roll: number;
  boardNumber?: number;
  isArcade?: boolean;
  wildSpawnCount?: number;
  lastWildDropType?: 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt' | null;
}) {
  const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(roll);
  const filterWildType = jest.fn((type: string) => type);
  try {
    return {
      result: decideWildType({
        boardNumber,
        isArcade,
        firstWildSpawned: false,
        wildSpawnCount,
        lastWildDropType,
        wildDropTypeStreak: 99,
        filterWildType,
        devLog: noop,
        devWarn: noop,
      }),
      filterWildType,
    };
  } finally {
    randomSpy.mockRestore();
  }
}

describe('Forest progressive Wild pool', () => {
  test.each([
    [1, ['wild']],
    [2, ['wild']],
    [3, ['wild', 'wild-tnt']],
    [4, ['wild', 'wild-tnt', 'wild-magnet']],
    [6, ['wild', 'wild-tnt', 'wild-magnet', 'wild-juice']],
    [7, ['wild', 'wild-tnt', 'wild-magnet', 'wild-juice']],
    [10, ['wild', 'wild-tnt', 'wild-magnet', 'wild-juice']],
  ] as const)('publishes only earned gameplay archetypes for Cjelina %i', (board, expected) => {
    expect(getAllowedWildTypes(board)).toEqual(expected);
  });

  test.each([0.1, 0.6, 0.75, 0.95])(
    'keeps Cjelina 01 on Wild Star for every roll (%s)',
    (roll) => {
      const { result, filterWildType } = decideForRoll({ roll });

      expect(result).toEqual({
        spawnJuice: false,
        spawnMagnet: false,
        spawnTnt: false,
        wildType: 'wild',
        specialDiceVariantId: null,
      });
      expect(filterWildType).not.toHaveBeenCalled();
    },
  );

  test.each([
    [2, 'wild', 'bee'],
    [3, 'wild-tnt', 'flower'],
    [4, 'wild-magnet', 'honey'],
    [6, 'wild-juice', 'mushroom'],
    [7, 'wild-tnt', null],
  ] as const)(
    'guarantees the newly introduced reward on Cjelina %i first drop',
    (boardNumber, wildType, specialDiceVariantId) => {
      expect(decideForRoll({
        roll: 0.99,
        boardNumber,
        wildSpawnCount: 0,
        lastWildDropType: null,
      }).result).toMatchObject({ wildType, specialDiceVariantId });
    },
  );

  test.each([
    [2, 0.01, 'wild', null],
    [2, 0.75, 'wild', 'bee'],
    [3, 0.8, 'wild-tnt', 'flower'],
    [4, 0.9, 'wild-magnet', 'honey'],
    [7, 0.85, 'wild-tnt', null],
    [10, 0.45, 'wild-tnt', 'flower'],
  ] as const)(
    'uses only the earned Forest pool on Cjelina %i at roll %s',
    (boardNumber, roll, wildType, specialDiceVariantId) => {
      const { result, filterWildType } = decideForRoll({
        roll,
        boardNumber,
        wildSpawnCount: 1,
      });
      expect(result).toMatchObject({ wildType, specialDiceVariantId });
      expect(filterWildType).not.toHaveBeenCalled();
    },
  );

  test('does not apply the Forest restriction to Arcade Round 01', () => {
    expect(decideForRoll({ roll: 0.95, isArcade: true }).result).toMatchObject({
      spawnTnt: true,
      wildType: 'wild-tnt',
    });
  });

  test('does not apply the Forest restriction to Beach', () => {
    expect(decideForRoll({ roll: 0.75, boardNumber: 12 }).result).toMatchObject({
      spawnMagnet: true,
      wildType: 'wild-magnet',
    });
  });
});

describe('Beach Cjelina 01 Wild pool', () => {
  test('starts with Wild Star', () => {
    expect(decideForRoll({
      roll: 0,
      boardNumber: 11,
      wildSpawnCount: 0,
      lastWildDropType: null,
    }).result).toMatchObject({
      spawnJuice: false,
      wildType: 'wild',
    });
  });

  test('uses a 60% Juice / 40% Star base roll after the first drop', () => {
    expect(decideForRoll({
      roll: 0.5999,
      boardNumber: 11,
      wildSpawnCount: 1,
      lastWildDropType: 'wild-juice',
    }).result).toMatchObject({
      spawnJuice: true,
      wildType: 'wild-juice',
    });
    expect(decideForRoll({
      roll: 0.60,
      boardNumber: 11,
      wildSpawnCount: 2,
      lastWildDropType: 'wild-juice',
    }).result).toMatchObject({
      spawnJuice: false,
      wildType: 'wild',
    });
  });

  test('forces Juice after Star so two Stars cannot arrive consecutively', () => {
    expect(decideForRoll({
      roll: 0.9999,
      boardNumber: 11,
      wildSpawnCount: 3,
      lastWildDropType: 'wild',
    }).result).toMatchObject({
      spawnJuice: true,
      wildType: 'wild-juice',
    });
  });
});

describe('Area 55 progressive Wild pool', () => {
  test.each([
    [21, ['wild', 'wild-juice']],
    [22, ['wild', 'wild-juice', 'wild-tnt']],
    [23, ['wild', 'wild-juice', 'wild-tnt', 'wild-magnet']],
    [30, ['wild', 'wild-juice', 'wild-tnt', 'wild-magnet']],
  ] as const)('publishes only earned gameplay archetypes for Cjelina %i', (board, expected) => {
    expect(getAllowedWildTypes(board)).toEqual(expected);
  });

  test('keeps Cjelina 01 on Star and Robo Cube only', () => {
    expect(decideForRoll({
      roll: 0.95,
      boardNumber: 21,
      wildSpawnCount: 0,
      lastWildDropType: null,
    }).result).toMatchObject({ wildType: 'wild', specialDiceVariantId: null });
    expect(decideForRoll({
      roll: 0.95,
      boardNumber: 21,
      wildSpawnCount: 1,
      lastWildDropType: 'wild',
    }).result).toMatchObject({ wildType: 'wild-juice', specialDiceVariantId: 'robo-cube' });
  });

  test('introduces LaserGun in Cjelina 02 and Spaceship in Cjelina 03', () => {
    const laser = decideForRoll({
      roll: 0,
      boardNumber: 22,
      wildSpawnCount: 0,
      lastWildDropType: null,
    });
    expect(laser.result).toMatchObject({
      spawnTnt: true,
      wildType: 'wild-tnt',
      specialDiceVariantId: 'laser-gun',
    });
    expect(laser.filterWildType).not.toHaveBeenCalled();

    const spaceship = decideForRoll({
      roll: 0,
      boardNumber: 23,
      wildSpawnCount: 0,
      lastWildDropType: null,
    });
    expect(spaceship.result).toMatchObject({
      spawnMagnet: true,
      wildType: 'wild-magnet',
      specialDiceVariantId: 'spaceship',
    });
    expect(spaceship.filterWildType).not.toHaveBeenCalled();
  });
});
